const axios = require('axios')
const fetch = require('node-fetch')
const cheerio = require("cheerio")

module.exports = {
  command: ['fb', 'facebook', 'fbdl'],
  help: ['facebook'],
  tags: ['downloader'],

  run: async (m, { light, text }) => {
    try {
      if (!text)
        return light.type(m.from).text('🚩 Ingrese la *Url* de *Facebook*', m)

      await light.react(m, '🕛')

      const res = await fbdlv1(text)
      const dl = res.data.result[0].url

      let size = 0
      try {
        const head = await fetch(dl, { method: 'HEAD' })
        size = parseInt(head.headers.get('content-length') || 0)
      } catch {}

      if (size > 150 * 1024 * 1024)
        return light.type(m.from).text('🚩 El video supera el límite de *150MB*', m)

      var data = await light.Api.get('/starlight/facebook', { params: { url: text } })
      let title = (data?.title || '').toString().trim()
      if (!title) title = 'Video'

      await light.type(m.from).video(
        { url: dl },
        title,
        m,
        size > 110 * 1024 * 1024
          ? { asDocument: true, fileName: title }
          : {}
      )

      await light.react(m, '✅')
    } catch (e) {
      await light.react(m, '🍮')
    }
  },

  limit: 1
}

async function fbdlv1(url, proxy = null) {
  let decode = url => JSON.parse(`"${url.replace(/\\\//g, "/")}"`);
  let rgx = {
    hd: /"playable_url_quality_hd":\s*"([^"]+)"/,
    sd: /"playable_url":\s*"([^"]+)"/,
    alta: /"browser_native_hd_url":\s*"([^"]+)"/,
    baja: /"browser_native_sd_url":\s*"([^"]+)"/
  };
  let result = {
    creator: '@Samush',
    data: { isPrivate: false, result: [] }
  };
  try {
    let cns = await axios.get(url, {
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-US,en;q=0.9,id;q=0.8',
        'cache-control': 'max-age=0',
        'sec-ch-prefers-color-scheme': 'light',
        'sec-ch-ua': '"Chromium";v="110", "Not A(Brand";v="24", "Microsoft Edge";v="110"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.1587.41'
      },
      httpsAgent: proxy
    });
    let body = cns.data;
    for (let [quality, regex] of Object.entries(rgx)) {
      const match = body.match(regex);
      if (match) {
        result.data.result.push({ quality, type: 'mp4', url: decode(match[1]) });
      }
    }
    if (!result.data.result.length && body.includes('isprivate')) {
      result.data.isPrivate = true;
    }
    return result;
  } catch (error) {
    return {
      creator: '@Samush',
      message: error.message || '://'
    }
  }
}