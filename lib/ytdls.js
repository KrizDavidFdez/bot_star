const { exec } = require('child_process');
const crypto = require('crypto');
const axios = require('axios');
const util = require('util');
const fetch = require('node-fetch');
const execAsync = util.promisify(exec);

class yt1s {
  constructor() {
    this.key = 'a8d4e2456d59b90c8402fc4f060982aa';
    this.auth = 'Ig9CxOQPYu3RB7GC21sOcgRPy4uyxFKTx54bFDu07G3eAMkrdVqXY9bBatu4WqTpkADrQ';
    this.b = 'https://fast.dlsrv.online/';
    this.h = {
      referer: 'https://v1.yt1s.biz/download/',
      'user-agent': 'Mozilla/5.0 (Android 15; Mobile; SM-F958; rv:130.0) Gecko/130.0 Firefox/130.0'
    };
  }

  extractId(url) {
    try {
      const patterns = [
        /(?:v=|\/v\/|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
      ];
      for (const p of patterns) {
        const match = url.match(p);
        if (match) return match[1];
      }
      return null;
    } catch {
      return null;
    }
  }

  minePoW(str1, str2, initialNonce = 0) {
    let nonce = initialNonce;
    while (nonce < 1000000) {
      const powhash = crypto.createHash('sha256').update(`${str1}:${str2}:${nonce}`).digest('hex');
      if (powhash.startsWith('0000')) {
        return { nonce: String(nonce), powhash };
      }
      nonce++;
    }
    throw new Error('PoW failed: nonce too high');
  }

  async getSes() {
    try {
      const res = await axios.get(this.b, { withCredentials: false, headers: this.h });
      return res.headers['x-session-token'];
    } catch (e) {
      console.error('GetSes error:', e.message);
      throw e;
    }
  }

  formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  async download(opt = {}) {
    let { url = '', type = 'audio', quality = '128' } = opt;
    let result = {
      status: false,
      url: null,
      filename: null,
      duration: null
    };

    let oembedData = {};

    try {
      const id = this.extractId(url);
      const oembedResponse = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
        headers: {
          "accept": "",
          "accept-language": "es-US,es-419;q=0.9,es;q=0.8",
          "cache-control": "no-cache",
          "pragma": "no-cache",
          "sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\"",
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": "\"Android\"",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "cross-site",
          "Referer": "https://y2meta.mobi/",
          "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        method: "GET"
      });

      oembedData = await oembedResponse.json();

      const session = await this.getSes();
      const now = Date.now().toString();
      const ssign = crypto.createHmac('sha256', this.key)
        .update(`${session}:/${type}:${now}`).digest('hex');
      const { nonce, powhash } = this.minePoW(session, `/${type}`);
      const payload = { videoId: id, quality };

      const hr = {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'x-api-auth': this.auth,
        'x-session-token': session,
        'x-signature': ssign,
        'x-signature-timestamp': now,
        nonce,
        powhash,
        ...this.h
      };

      const cmd = `curl '${this.b}gateway/${type}' \\\n${Object.entries(hr)
        .map(([i, j]) => `-H '${i}: ${j}' \\\n`).join('')}--data-raw '${JSON.stringify(payload)}' \\\n--compressed`;

      const { stdout } = await execAsync(cmd);

      if (stdout) {
        const data = JSON.parse(stdout);
        result = {
          status: true,
          url: data.url || null,
          filename: data.filename || null,
          duration: data.duration || null
        };
      }
    } catch (e) {
    } finally {
      const durationFormatted = this.formatDuration(result.duration || 36028);
      return {
        status: result.status ? 'tunnel' : 'error',
        title: oembedData.title || '',
        thumbnail: oembedData.thumbnail_url || null,
        duration: durationFormatted,
        author: oembedData.author_name || '',
        filename: result.filename || '',
        dl_url: result.url || '',
      };
    }
  }
}

async function ytdls(url, quality = '128', type = 'audio') {
  const api = new yt1s();
  return await api.download({ url, type, quality });
}


module.exports = { ytdls };

/*const fetch = require("node-fetch")
const Jimp = require("jimp") 

async function ytdls(url, format = "mp3") {
  let body = new URLSearchParams({ query: url, cf_token: "", vt: "youtube" })
  let res = await fetch("https://ssvid.net/api/ajax/search", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "origin": "https://ssvid.net",
      "referer": "https://ssvid.net/youtube-to-mp3"
    },
    body
  })
  let search = await res.json()

  if (search.p === "search") {
    const { v } = search.items[0]
    body = new URLSearchParams({ query: `https://www.youtube.com/watch?v=${v}`, cf_token: "", vt: "youtube" })
    res = await fetch("https://ssvid.net/api/ajax/search", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "origin": "https://ssvid.net",
        "referer": "https://ssvid.net/youtube-to-mp3"
      },
      body
    })
    search = await res.json()
  }

  let key
  if (format === "mp3") {
    key = search.links?.mp3?.mp3128?.k
  } else {
    const set = Object.entries(search.links.mp4)
    const q = set.map(v => v[1].q).filter(v => /\d+p/.test(v)).map(v => parseInt(v)).sort((a, b) => b - a).map(v => `${v}p`)
    if (!q.includes(format)) format = q[0]
    const elc = set.find(v => v[1].q === format)
    key = elc?.[1]?.k
  }

  body = new URLSearchParams({ k: key, vid: search.vid })
  res = await fetch("https://ssvid.net/api/ajax/convert", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "origin": "https://ssvid.net",
      "referer": "https://ssvid.net/youtube-to-mp3"
    },
    body
  })
  let env = await res.json()

  if (env.c_status === "CONVERTING") {
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 5000))
      let checkRes = await fetch("https://ssvid.net/api/convert/check?hl=en", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "origin": "https://ssvid.net",
          "referer": "https://ssvid.net/youtube-to-mp3"
        },
        body: new URLSearchParams({ vid: search.vid, b_id: env.b_id })
      })
      let check = await checkRes.json()
      if (check.c_status === "CONVERTED") env = check
    }
  }

  if (env.c_status !== "CONVERTED") {
    throw new Error("🚩 La conversión ha fallado")
  }
  let dls = await fetch(
    `https://www.youtube.com/oembed?url=${url}&format=json`,
    { headers: { "accept-language": "es-ES,es;q=0.9", "user-agent": "Mozilla/5.0" } }
  )
  let info = await dls.json()
  let covers
  try {
    var image = await Jimp.read(info.thumbnail_url)
    image.cover(300, 300)
    covers = await image.getBufferAsync(Jimp.MIME_JPEG)
  } catch (e) {
    covers = null
  }
  return {
    status: env.status,
    c_status: env.c_status,
    id: env.vid,
    title: info.title,
    thumbnail: covers,
    author: info.author_name,
    dl_url: env.dlink
  }
}

module.exports = { ytdls }*/

/*const fetch = require("node-fetch")

async function ytdls(url, format = "mp3") {
  let body = new URLSearchParams({ query: url, cf_token: "", vt: "youtube" })
  let res = await fetch("https://ssvid.net/api/ajax/search", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "origin": "https://ssvid.net",
      "referer": "https://ssvid.net/youtube-to-mp3"
    },
    body
  })
  let search = await res.json()

  if (search.p === "search") {
    const { v } = search.items[0]
    body = new URLSearchParams({ query: `https://www.youtube.com/watch?v=${v}`, cf_token: "", vt: "youtube" })
    res = await fetch("https://ssvid.net/api/ajax/search", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "origin": "https://ssvid.net",
        "referer": "https://ssvid.net/youtube-to-mp3"
      },
      body
    })
    search = await res.json()
  }

  let key
  if (format === "mp3") {
    key = search.links?.mp3?.mp3128?.k
  } else {
    var set = Object.entries(search.links.mp4)
    var q = set.map(v => v[1].q).filter(v => /\d+p/.test(v)).map(v => parseInt(v)).sort((a, b) => b - a).map(v => `${v}p`)
    if (!q.includes(format)) format = q[0]
    var elc = set.find(v => v[1].q === format)
    key = elc?.[1]?.k
  }

  body = new URLSearchParams({ k: key, vid: search.vid })
  res = await fetch("https://ssvid.net/api/ajax/convert", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "origin": "https://ssvid.net",
      "referer": "https://ssvid.net/youtube-to-mp3"
    },
    body
  })
  let env = await res.json()

  if (env.c_status === "CONVERTING") {
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 5000))
      let checkRes = await fetch("https://ssvid.net/api/convert/check?hl=en", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "origin": "https://ssvid.net",
          "referer": "https://ssvid.net/youtube-to-mp3"
        },
        body: new URLSearchParams({ vid: search.vid, b_id: env.b_id })
      })
      let check = await checkRes.json()
      if (check.c_status === "CONVERTED") env = check
    }
  }

  if (env.c_status !== "CONVERTED") {
    throw new Error("🚩 La conversión ha fallado")
  }

  let dls = await fetch(
    `https://www.youtube.com/oembed?url=${url}&format=json`,
    {
      headers: {
        "accept-language": "es-ES,es;q=0.9",
        "user-agent": "Mozilla/5.0"
      }
    }
  )
  let info = await dls.json()

  return {
    status: env.status,
    c_status: env.c_status,
    id: env.vid,
    title: info.title,
    thumbnail: info.thumbnail_url,
    author: info.author_name,
    dl_url: env.dlink
  }
}

module.exports = { ytdls }*/
