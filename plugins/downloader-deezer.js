class DeezerFlacDownloader {
  constructor() {
    this.deezerApi = 'https://api.deezer.com/track'
    this.flacBase = 'https://flacdownloader.com/flac'
    this.accessKey = 'l@p*gute)77=g5clebcp4lz#=x%(*rwg+ku0_)bh=&%6wg!a'

    this.headers = {
      info: {
        'accept': '*/*',
        'user-agent': 'Mozilla/5.0'
      },
      token: {
        'accept': '*/*',
        'user-agent': 'Mozilla/5.0',
        'X-Download-Access': this.accessKey
      },
      download: {
        'accept': '*/*',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        'referer': 'https://flacdownloader.com/',
        'origin': 'https://flacdownloader.com'
      }
    }
  }

  extractTrackId(input) {
    if (!input) return null
    if (/^\d+$/.test(input)) return input

    try {
      const url = new URL(input)

      const trackMatch = url.pathname.match(/\/track\/(\d+)/)
      if (trackMatch) return trackMatch[1]

      const t = url.searchParams.get('t')
      if (t) return t

      return null
    } catch {
      return null
    }
  }

  formatDuration(seconds = 0) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  }

  async getInfo(deezerUrlOrId) {
    try {
      const id = this.extractTrackId(deezerUrlOrId)
      const res = await fetch(`${this.deezerApi}/${id}`, {
        method: 'GET',
        headers: this.headers.info
      })

      const text = await res.text()
      let data

      try {
        data = JSON.parse(text)
      } catch {
      }
      return {
        status: true,
        id: String(data.id),
        title: data.title || '',
        artist: data.artist?.name || '',
        album: data.album?.title || '',
        thumbnail: data.album?.cover_xl || data.album?.cover_big || data.album?.cover_medium || null,
        timestamp: this.formatDuration(data.duration || 0),
        url: data.link || null
      }
    } catch (e) {
      return {
        status: false,
        error: e.message
      }
    }
  }

  async getToken(trackId) {
    try {
      const url = `${this.flacBase}/download-token?t=${trackId}&f=FLAC`

      const res = await fetch(url, {
        method: 'GET',
        headers: this.headers.token
      })
      const text = await res.text()
      let data

      try {
        data = JSON.parse(text)
      } catch {
      }
      return {
        status: true,
        token: data.token,
        expires: data.expires,
        raw: data
      }
    } catch (e) {
      return {
        status: false,
        error: e.message
      }
    }
  }

  async download(trackInfo) {
    try {
      const tokenData = await this.getToken(trackInfo.id)
      const url = `${this.flacBase}/download?t=${trackInfo.id}&f=FLAC&token=${encodeURIComponent(tokenData.token)}&expires=${tokenData.expires}`

      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: this.headers.download
      })

      const arrayBuffer = await res.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const disposition = res.headers.get('content-disposition') || ''
      let fileName = `${trackInfo.title || trackInfo.id}.flac`

      const utf8Match = disposition.match(/filename\*\=utf-8''([^;]+)/i)
      const normalMatch = disposition.match(/filename="?([^"]+)"?/i)

      if (utf8Match) {
        fileName = decodeURIComponent(utf8Match[1])
      } else if (normalMatch) {
        fileName = normalMatch[1]
      }

      return {
        status: true,
        buffer,
        fileName,
        sizeBytes: buffer.length,
        sizeMB: `${(buffer.length / 1024 / 1024).toFixed(2)} MB`,
        mimeType: res.headers.get('content-type') || 'audio/flac',
        token: tokenData.token,
        expires: tokenData.expires
      }
    } catch (e) {
      return {
        status: false,
        error: e.message
      }
    }
  }

  async downloadFromUrl(deezerUrlOrId) {
    try {
      const info = await this.getInfo(deezerUrlOrId)
      const audio = await this.download(info)
      return {
        status: true,
        track: info,
        audio
      }
    } catch (e) {
      return {
        status: false,
        error: e.message
      }
    }
  }
}

module.exports = {
  command: ['deezerdl'],
  help: ['deezerdl'],
  tags: ['downloader'],
  limit: 1,
  run: async (m, { light, text }) => {
    try {
      if (!text || (!text.includes('deezer.com/track/') && !/^\d+$/.test(text))) {
        await light.type(m.from).text(
          '🚩 Ingresa la *Url* de *Deezer*',
          m
        )
        return false
      }
      await light.react(m, '🕛')

      const deezer = new DeezerFlacDownloader()
      const result = await deezer.downloadFromUrl(text)
      const { track, audio } = result

      let txt = '\n'
      txt += `⛾      ꒰‎ ‎ 🍚  ꒱  *Título* ꠩ ${track.title}\n`
      txt += `⛾      ꒰‎ ‎ 🌷  ꒱  *Artista* ꠩ ${track.artist}\n`
      txt += `⛾      ꒰‎ ‎ 🍧  ꒱  *Álbum* ꠩ ${track.album}\n`
      txt += `⛾      ꒰‎ ‎ 🌵  ꒱  *Tamaño* ꠩ ${audio.sizeMB}\n`
      txt += `⛾      ꒰‎ ‎ ☁️  ꒱  *Url* ꠩ ${track.url}\n`

      let coverBuffer = null

      if (track.thumbnail) {
        try {
          coverBuffer = await light.type(m.from).fetchBuffer(track.thumbnail)
          await light.type(m.from).image(coverBuffer, txt, m)
        } catch {
          await light.type(m.from).text(txt, m)
        }
      } else {
        await light.type(m.from).text(txt, m)
      }
      await light.type(m.from).audio(
        audio.buffer,
        {
          title: track.title,
          artist: track.artist,
          image: coverBuffer,
          quoted: m
        }
      )
      await light.react(m, '✅')
      return true
    } catch (err) {
      await light.react(m, '🍮')
      return false
    }
  }
}