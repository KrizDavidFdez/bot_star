const { imageToWebp, writeExif } = require('../lib/converter')
const config = require('../config.json')
const fetch = require('node-fetch')

async function getBuffer(url) {
  const res = await fetch(url)
  const buffer = await res.buffer()
  return buffer
}

module.exports = {
  command: ['brat'],
  help: ['brat'],
  tags: ['tools'],
  run: async (m, { light, text }) => {
    try {
      if (!text) return light.type(m.from).text("🚩 Ingresa un *texto*", m)

      await light.react(m, '🕒')

      const media = await getBuffer(`https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(text)}&isAnimated=false&delay=500`)

      const name = m.pushName || m.sender.split("@")[0]
      const packname = name
      const author = config.author

      const webpBuffer = await imageToWebp(media)
      const sticker = await writeExif(webpBuffer, { packname, author })

      await light.sticker(m.from, sticker, m)
      await light.react(m, '✅')

    } catch (err) {
      console.log(err)
      await light.react(m, '🚫')
    }
  }
}