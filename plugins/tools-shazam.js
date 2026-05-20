var FormData = require('form-data')
var fetch = require('node-fetch')

async function UploadTmpfiles(buffer, ext = "mp3") {
  const fakeUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
  const formData = new FormData()
  formData.append("file", buffer, `starlight.${ext}`)
  const res = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: formData,
    headers: { "User-Agent": fakeUserAgent }
  })
  const result = await res.json()
  const originalURL = result?.data?.url
  return originalURL ? `https://tmpfiles.org/dl/${originalURL.split("/").slice(-2).join("/")}` : null
}

module.exports = {
  command: ['shazam', 'whatmusic'],
  help: ['shazam'],
  tags: ['tools'],
  run: async (m, { light }) => {
    const media = await m.types()
    if (!media.isVideo && !media.isAudio) {
      await light.type(m.from).text('🚩 Responde a un *Video/Audio*', m)
      return false
    }
    await light.react(m, '🕛')
    try {
      var buffer = await media.download()
      var ext = media.isVideo ? 'mp4' : 'mp3'
      var url = await UploadTmpfiles(buffer, ext)
      var result = await light.Api.get('/starlight/shazam', { params: { url } })
      var s = result.data
      var info = `\n🍟ᩖ𑪐ㅤ ୭୭ ㅤˁ › . ‹ ˀㅤ ヸ  𝖠𝗋𝗍𝗂𝗌𝗍𝖺 : *${s.artist}*\n🌸ᩖ𑪐ㅤ ୭୭ ㅤˁ › . ‹ ˀㅤ ヸ  𝖦𝖾𝗇𝖾𝗋𝗈 : *${s.gender}*\n🍟ᩖ𑪐ㅤ ୭୭ ㅤˁ › . ‹ ˀㅤ ヸ  𝖴𝗋𝗅 : *${s.url}*\n`
      await light.sendMessage(m.from, {
        text: info,
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          externalAdReply: {
            title: s.title,
            body: "ㅤ我看著你 ° 我想著你",
            mediaType: 1,
            previewType: "PHOTO",
            thumbnail: await light.type(m.from).fetchBuffer(s.thumbnail),
            thumbnailUrl: "https://www.instagram.com/atemvdd?igsh=eW15d202OGQwOTU0",
            sourceUrl: "https://www.instagram.com/atemvdd?igsh=eW15d202OGQwOTU0"
          }
        }
      }, { quoted: m })
      await light.react(m, '✅')
      return true
    } catch (err) {
      await light.react(m, '🍮')
      return false
    }
  },
  limit: 2,
}

/*var FormData = require('form-data')
var fetch = require('node-fetch')

async function UploadTmpfiles(buffer, ext = "mp3") {
  const fakeUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
  const formData = new FormData()
  formData.append("file", buffer, `starlight.${ext}`)
  const res = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: formData,
    headers: { "User-Agent": fakeUserAgent }
  })
  const result = await res.json()
  const originalURL = result?.data?.url
  return originalURL ? `https://tmpfiles.org/dl/${originalURL.split("/").slice(-2).join("/")}` : null
}

module.exports = {
  command: ['shazam', 'whatmusic'],
  help: ['shazam'],
  tags: ['tools'],
  run: async (m, { light }) => {
    const media = await m.types()
    if (!media.isVideo && !media.isAudio) {
      await light.type(m.from).text('🚩 Responde a un *Video/Audio*', m)
      return false
    }
    await light.react(m, '🕛')
    try {
      var buffer = await media.download()
      var ext = media.isVideo ? 'mp4' : 'mp3'
      var url = await UploadTmpfiles(buffer, ext)
      var result = await light.Api.get('/starlight/shazam', { params: { url } })
      var s = result.data
      const msg = `*${s.title}*\nര᪲       ֵ     🧃      𖹭̮ㅤ𝖠𝗋𝗍𝗂𝗌𝗍𝖺 : *${s.artist}*\nര᪲       ֵ     ☕      𖹭̮ㅤ𝖦𝖾𝗇𝖾𝗋𝗈 : *${s.gender}*\nര᪲       ֵ     🧩      𖹭̮ㅤ𝖴𝗋𝗅 : *${s.url}*`
      await light.type(m.from).image(await light.type(m.from).fetchBuffer(s.thumbnail), msg, m)
      await light.react(m, '✅')
      return true
    } catch (err) {
      await light.react(m, '🍮')
      return false
    }
  },
  limit: 1,
}*/




    