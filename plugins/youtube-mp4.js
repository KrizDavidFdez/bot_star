const axios = require('axios')
const FormData = require('form-data')
const { randomUUID } = require('crypto')

class YTDown {
  constructor() {
    this.baseUrl = 'https://app.ytdown.to'
    this.headers = {
      'User-Agent': 'Mozilla/5.0',
      'Accept': '*/*',
      'Origin': this.baseUrl,
      'Referer': this.baseUrl + '/id15/',
      'x-requested-with': 'XMLHttpRequest'
    }

    this.cookies = {
      PHPSESSID: randomUUID().replace(/-/g, ''),
      _ga: 'GA1.1.' + Math.floor(Math.random() * 1000000000) + '.' + Math.floor(Date.now() / 1000)
    }
  }

  getCookieString() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  }

  async getVideoInfo(url) {
    const form = new FormData()
    form.append('url', url)

    const res = await axios.post(`${this.baseUrl}/proxy.php`, form, {
      headers: {
        ...this.headers,
        ...form.getHeaders(),
        Cookie: this.getCookieString()
      }
    })

    return res.data
  }

  async waitDownload(url) {
    while (true) {
      const { data } = await axios.get(url)

      if (data.status === "completed") return data.fileUrl

      await new Promise(r => setTimeout(r, 2000))
    }
  }

  async download(url, quality = "360p") {
    const info = await this.getVideoInfo(url)

    const media = info.api.mediaItems.find(v =>
      v.mediaUrl.includes(quality)
    )

    if (!media) throw "🚩Calidad no disponible"

    const dl = await this.waitDownload(media.mediaUrl)

    return {
      dl,
      title: info?.api?.title || info?.title || 'video'
    }
  }
}

async function tryYtdlss(url, quality) {
  try {
    const qualityMap = {
      "360p": "360p",
      "480p": "480p", 
      "720p": "720p",
      "1080p": "1080p"
    }
    
    const selectedQuality = qualityMap[quality] || "360p"
    
    const response = await axios.get(`https://ytdlss-7l8w.vercel.app/api/index?url=${encodeURIComponent(url)}`, {
      timeout: 10000, 
      validateStatus: false 
    })
    let videoUrl = null
    if (response.data.video && response.data.video.quality === `mp4 (${selectedQuality})`) {
      videoUrl = response.data.video.url
    } else if (response.data.video?.url) {
      videoUrl = response.data.video.url
    }
    const checkUrl = await axios.head(videoUrl, {
      timeout: 5000,
      validateStatus: false
    }).catch(() => ({ status: 403 }))
    return {
      dl: videoUrl,
      title: response.data.title || 'video',
      source: 'ytdlss'
    }
  } catch (error) {
  }
}

async function ytdls(url, quality) {
  try {
    const result = await tryYtdlss(url, quality)
    return result
  } catch (error) {
    const yt = new YTDown()
    const result = await yt.download(url, quality)
    return {
      ...result,
      source: 'ytdown'
    }
  }
}

module.exports = {
  command: ['ytv', 'ytmp4'],
  help: ['ytmp4'],
  tags: ['downloader'],
  limit: 1,

  run: async (m, { light, text }) => {
    if (!text) {
      await light.type(m.from).text("🚩 Ingresa la *Url* de *YouTube*", m)
      return
    }

    await light.react(m, '🕛')

    try {
      const args = text.split(" ")
      let url = args[0]
      let quality = args[1] || "360p"

      const data = await ytdls(url, quality)
      const dl = data.dl

      const head = await axios.head(dl, { timeout: 10000 }).catch(() => null)
      const size = Number(head?.headers?.['content-length'] || 0)

      if (size > 200 * 1024 * 1024) {
        return light.type(m.from).text('🚩 El video supera el limit de *200Mb*', m)
      }

      await light.type(m.from).video(
        await light.type(m.from).fetchBuffer(dl),
        `${data.title || ''}`,
        m,
        size > 110 * 1024 * 1024
          ? {
              asDocument: true,
              fileName: `${data.title || 'video'}.mp4`
            }
          : {}
      )
      await light.react(m, '✅')
    } catch (err) {
      await light.react(m, '🍮')
    }
  }
}