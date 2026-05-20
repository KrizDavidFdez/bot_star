const { imageToWebp, videoToWebp, gifToWebp, writeExif } = require('../lib/converter')
const config = require('../config.json')

module.exports = {
  command: ['s', 'sticker'],
  help: ['sticker'],
  tags: ['tools'],
  run: async (m, { light, text }) => {
    try {
      const media = await m.types()
      if (!media.isImage && !media.isVideo && !media.isSticker && !media.isGif)
        return light.type(m.from).text("🚩 Responde a un *Video/Imagen*", m)
      let duration = 0
      if (m.message?.videoMessage?.seconds) {
        duration = m.message.videoMessage.seconds
      } else if (
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage?.seconds
      ) {
        duration =
          m.message.extendedTextMessage.contextInfo.quotedMessage.videoMessage.seconds
      }
      if ((media.isVideo || media.isGif) && duration > 7) {
        return light
          .type(m.from)
          .text("🚩 Maximo 7 segundos", m)
      }
      await light.react(m, '🕒')
      const buffer = await media.download()
      const name = m.pushName || m.sender.split("@")[0]

     // let [packname, author] = (text || '').split('|').map(s => s?.trim())
     let packname =
  'ㅤㅤㅤㅤㅤㅤ\n' +
  'ㅤㅤㅤㅤㅤㅤㅤ\n' +
  'ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ\n' +
  'ㅤㅤㅤࣤㅤㅤㅤ✿ㅤㅤ﹐ㅤㅤㅤֺㅤㅤ░\n' +
  'ㅤ 𝚂͜ե͜⍺r͜𝗅ı͜ght͜  ֵ✽ㅤㅤㅤ⬮⬯ㅤ ㅤ﹗ㅤ ㅤ媽的達令\n' +
  '𝄔ㅤㅤ࣫ㅤㅤㅤ⢱ㅤㅤㅤ[ 🥢 ]ㅤㅤㅤ●●࣪ㅤㅤ／＼\n' +
  'ㅤㅤㅤㅤㅤㅤㅤㅤ\n' +
  'ㅤㅤㅤㅤㅤ'
       let author = 'ig   /   @srt.conti ' 
     /*packname = packname || name
      author = author || config.author*/

      let webpBuffer

      if (media.isSticker) {
        webpBuffer = buffer
      } else if (media.isImage) {
        webpBuffer = await imageToWebp(buffer)
      } else if (media.isGif) {
        webpBuffer = await gifToWebp(buffer)
      } else {
        webpBuffer = await videoToWebp(buffer) 
      }
      const sticker = await writeExif(webpBuffer, { packname, author })
      await light.sticker(m.from, sticker, media.quoted || m)

      await light.react(m, '✅')
    } catch (err) {
      console.error(err)
      await light.react(m, '🚫')
    }
  }
}