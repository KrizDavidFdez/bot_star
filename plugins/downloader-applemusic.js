const fetch = require('node-fetch')
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ID3Writer = require("node-id3");

async function coverIph(urlCancion) {
  const res = await fetch('https://brats-56i5.vercel.app/api/applemusic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: urlCancion })
  })

  const data = await res.json()
  const base64Data = data.imagen.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')

  return {
    titulo: data.titulo,
    artista: data.artista,
    duracion: data.duracion,
    cover: buffer
  }
}
 
async function ytdls(url) {
  const { data } = await axios.get(`https://apis-starlights.vercel.app/api/youtubedl?url=${url}&format=mp3`)
  return data.result
}

class YouTubeSearch {
  async search(query) {
    const { data } = await axios.request({
      baseURL: "https://youtube.com",
      url: "/results",
      params: { search_query: query },
    });

    const $ = cheerio.load(data);
    let _string = "";

    $("script").each((i, e) => {
      if (/var ytInitialData = /gi.exec($(e).html())) {
        _string += $(e)
          .html()
          .replace(/var ytInitialData = /i, "")
          .replace(/;$/, "");
      }
    });

    const _initData = JSON.parse(_string).contents.twoColumnSearchResultsRenderer.primaryContents;
    const results = [];
    let _render = null;

    if (_initData.sectionListRenderer) {
      _render = _initData.sectionListRenderer.contents
        .filter(item => item?.itemSectionRenderer?.contents?.filter(v => v.videoRenderer))
        .shift().itemSectionRenderer.contents;
    }

    for (const item of _render) {
      if (item.videoRenderer && item.videoRenderer.lengthText) {
        const video = item.videoRenderer;

        results.push({
          title: video?.title?.runs?.[0]?.text || "",
          duration: video?.lengthText?.simpleText || "",
          thumbnail: video?.thumbnail?.thumbnails?.pop()?.url || "",
          url: "https://www.youtube.com/watch?v=" + video.videoId,
        });
      }
    }

    return results;
  }
}

class AudioDownloader {
  async downloadFromUrl(url) {
    const yt = await ytdls(url)

    const response = await axios.get(yt.dl_url, {
      responseType: "arraybuffer"
    })

    return Buffer.from(response.data)
  }
}

class AudioProcessor {
  constructor() {
    this.audioFilters = [
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      "bass=g=6:f=110:w=0.3",
      "treble=g=4:f=3000:w=0.5",
      "acompressor=threshold=-12dB:ratio=2:attack=20:release=250",
      "dynaudnorm=g=12",
      "highpass=f=30",
      "lowpass=f=18000"
    ];
  }

  static convertirDuracion(duracion) {
    const match = duracion?.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return duracion;
    const minutos = parseInt(match[1] || 0);
    const segundos = parseInt(match[2] || 0);
    return `${minutos}:${segundos.toString().padStart(2, "0")}`;
  }

  async processAudio(audioBuffer) {
    return new Promise((resolve, reject) => {
      const tempInput = path.join(__dirname, `temp-input-${Date.now()}.mp3`);
      const tempOutput = path.join(__dirname, `temp-output-${Date.now()}.mp3`);

      fs.writeFileSync(tempInput, audioBuffer);

      ffmpeg(tempInput)
        .audioCodec("libmp3lame")
        .audioBitrate("256k")
        .audioChannels(2)
        .audioFrequency(44100)
        .save(tempOutput)
        .on("end", () => {
          const processedBuffer = fs.readFileSync(tempOutput);
          fs.unlinkSync(tempInput);
          fs.unlinkSync(tempOutput);
          resolve(processedBuffer);
        })
        .on("error", reject);
    });
  }

  async addMetadata(audioBuffer, metadata) {
    try {
      const imgResp = await axios.get(metadata.imagen, {
        responseType: "arraybuffer",
        timeout: 10000
      });

      let imageBuffer = Buffer.from(imgResp.data);
      imageBuffer = await this.convertToJpg(imageBuffer);
      const tags = {
        title: metadata.titulo || "",
        artist: metadata.artista || "",
        album: metadata.album || "",
        year: metadata.fecha ? new Date(metadata.fecha).getFullYear() : "",
        image: {
          mime: "image/jpeg",
          type: {
            id: 3,
            name: "front cover"
          },
          description: `Cover - ${metadata.titulo}`,
          imageBuffer: imageBuffer
        },
        ...(metadata.duracion && { TXXX: { description: 'duration', value: metadata.duracion } })
      };

      console.log("🎵 Agregando metadata:", {
        title: tags.title,
        artist: tags.artist,
        hasImage: !!tags.image.imageBuffer.length
      });

      const result = ID3Writer.update(tags, audioBuffer);
      
      if (!result) {
        return audioBuffer; 
      }

      return result;
    } catch (error) {
      return audioBuffer;
    }
  }

  async convertToJpg(imageBuffer) {
    return new Promise((resolve, reject) => {
      const input = path.join(__dirname, `img-${Date.now()}.tmp`);
      const output = path.join(__dirname, `img-${Date.now()}.jpg`);

      fs.writeFileSync(input, imageBuffer);

      ffmpeg(input)
        .outputOptions('-vf', 'scale=500:500:force_original_aspect_ratio=decrease,pad=500:500:(ow-iw)/2:(oh-ih)/2,setsar=1')
        .toFormat("image2")
        .size('500x500')
        .save(output)
        .on("end", () => {
          const result = fs.readFileSync(output);
          fs.unlinkSync(input);
          fs.unlinkSync(output);
          resolve(result);
        })
        .on("error", (err) => {
          fs.unlinkSync(input);
          fs.unlinkSync(output);
          reject(err);
        });
    });
  }
}

class AppleMusicDownloader {
  constructor() {
    this.downloader = new AudioDownloader();
    this.processor = new AudioProcessor();
    this.searcher = new YouTubeSearch();
  }

  async getInfo(url) {
    const { data: html } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const $ = cheerio.load(html);
    const jsonText = $('script#schema\\:song').html();
    
    const json = JSON.parse(jsonText);
    const audio = json.audio?.audio || json.audio || {};
    const artist = audio.byArtist?.[0] || json.audio?.byArtist?.[0] || {};
    const albumArtist = audio.inAlbum?.byArtist?.[0] || {};
    const albumTitle = $('h1[data-testid="non-editable-product-title"]').text().trim();

    return {
      titulo: json.name || audio.name,
      descripcion: json.description || audio.description,
      artista: artist.name || albumArtist.name || null,
      artista_url: artist.url || albumArtist.url || null,
      album: albumTitle || null,
      album_url: audio.inAlbum?.url || null,
      imagen: audio.image || json.image || null,
      fecha: audio.uploadDate || json.datePublished || null,
      duracion: AudioProcessor.convertirDuracion(audio.duration || json.timeRequired),
      audio_url: audio.contentUrl || null,
    };
  }

  async download(url) {
    const info = await this.getInfo(url)
    const query = `${info.titulo} ${info.artista}`
    const videos = await this.searcher.search(query)
    const video = videos[0]

    const rawAudioBuffer = await this.downloader.downloadFromUrl(video.url)
    const processedBuffer = await this.processor.processAudio(rawAudioBuffer)
    const finalBuffer = await this.processor.addMetadata(processedBuffer, info)

    return {
      info,
      buffer: finalBuffer
    }
  }
}

const downloader = new AppleMusicDownloader()

module.exports = {
  command: ['appledl'],
  help: ['appledl'],
  tags: ['downloader'],
  limit: 1,
  run: async (m, { light, text }) => {
    try {
      if (!text || !text.includes('music.apple.com')) {
        await light.type(m.from).text(
          '🚩 Ingresa la *Url* de *AppleMusic*',
          m
        )
        return false
      }
      await light.react(m, '🕛')
      const info = await downloader.getInfo(text)
      const buffer = await light.type(m.from).fetchBuffer(info.imagen)
      
      let txt = '\n'
      txt += `⛾      ꒰ ☕ ꒱ *Título* ꠩ ${info.titulo}\n`
      txt += `⛾      ꒰ 🌸 ꒱ *Artista* ꠩ ${info.artista}\n`
      txt += `⛾      ꒰ 🍟 ꒱ *Duracion* ꠩ ${info.duracion}\n`
      if (info.fecha) txt += `⛾      ꒰ 💿 ꒱ *Fecha* ꠩ ${info.fecha}\n`
      
      await light.type(m.from).image(buffer, txt || '', m)
      const audio = await downloader.download(text)
      await light.sock.sendMessage(m.from, { 
        audio: audio.buffer, 
        mimetype: 'audio/mpeg',
        ptt: false 
      }, { quoted: m })
      
      await light.react(m, '✅')
      return true
    } catch (err) {
      await light.react(m, '🍮')
      return false
    }
  }
}