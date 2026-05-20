const { generateWAMessageFromContent } = require("@whiskeysockets/baileys")
const crypto = require("crypto")

module.exports = {
  command: ['setup'],
  help: ['setup'],
  tags: ['tools'],
  limit: 1,

  run: async (m, { light, text }) => {
    try {

      const sock = light.sock
      const quoted = m.quoted || m
      const media = await quoted.types()

      if (!text && !media.isImage && !media.isVideo && !media.isSticker && !media.isGif) {
        return light.type(m.from).text(
          "🚩 Escribe un texto o responde a una imagen/video/sticker/gif",
          m
        )
      }

      await light.react(m, '🕛')

      let buffer

      if (media.isImage || media.isVideo || media.isSticker || media.isGif) {
        buffer = await quoted.download()
      }

      if (!buffer) {
        buffer = await txtimg(text)
      }

      const msg = generateWAMessageFromContent(m.from, {
        imageMessage: {
          image: buffer,
          caption: `🚩 Resultado: ${text || "media procesada"}`,
          jpegThumbnail: buffer
        },
        contextInfo: {
          externalAdReply: {
            title: "DALL·E Result",
            body: text || "Media",
            mediaType: 1,
            thumbnail: buffer,
            sourceUrl: ""
          }
        }
      })

      await sock.relayMessage(
        m.from,
        msg.message,
        { messageId: crypto.randomBytes(8).toString("hex") }
      )

      await light.react(m, '✅')

    } catch (err) {
      console.log("ERROR DALLE:", err)
      await light.react(m, '🚫')
    }
  }
}