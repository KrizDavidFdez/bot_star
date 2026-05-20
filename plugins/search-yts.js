const yts = require('yt-search')
const fetch = require('node-fetch')
const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys')

module.exports = {
  command: ['ytsearch', 'yts'],
  help: ['ytsearch'],
  tags: ['search'],
  limit: 1,

  run: async (m, { light, text }) => {
    try {
      if (!text) {
        await light.type(m.from).text(
          '🚩 Ingresa el *texto* de *búsqueda*',
          m
        )
        return false
      }

      await light.react(m, '🕓')

      async function sendList(title = '', bodyText = '', buttonText = '', mediaInput = null, listSections = [], quoted = m, options = {}) {
        let img = null
        let video = null

        try {
          if (mediaInput) {
            if (Buffer.isBuffer(mediaInput)) {
              img = await prepareWAMessageMedia(
                { image: mediaInput },
                { upload: light.sock.waUploadToServer }
              )
            } else if (typeof mediaInput === 'string' && /^https?:\/\//i.test(mediaInput)) {
              const res = await fetch(mediaInput)
              const contentType = res.headers.get('content-type') || ''

              if (/^video\//i.test(contentType)) {
                video = await prepareWAMessageMedia(
                  { video: { url: mediaInput } },
                  { upload: light.sock.waUploadToServer }
                )
              } else {
                img = await prepareWAMessageMedia(
                  { image: { url: mediaInput } },
                  { upload: light.sock.waUploadToServer }
                )
              }
            }
          }
        } catch (e) {
        }

        const interactiveMessage = {
          header: {
            title,
            hasMediaAttachment: Boolean(img || video),
            imageMessage: img?.imageMessage,
            videoMessage: video?.videoMessage
          },
          body: {
            text: bodyText
          },
          footer: {
            text: "隱藏嘅秘密🌇"
          },
          nativeFlowMessage: {
            buttons: [
              {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                  title: buttonText,
                  sections: listSections
                })
              }
            ],
            messageParamsJson: ''
          }
        }

        const msgL = generateWAMessageFromContent(
          m.from,
          {
            viewOnceMessage: {
              message: {
                interactiveMessage
              }
            }
          },
          {
            userJid: light.sock.user?.id,
            quoted,
            ...options
          }
        )

        return await light.sock.relayMessage(m.from, msgL.message, {
          messageId: msgL.key.id,
          ...options
        })
      }

      const res = await yts(text)
      const videos = res.videos.slice(0, 30)

      if (!videos.length) {
        await light.react(m, '✖️')
        return false
      }

      const sections = videos.map((v, i) => ({
        title: `${i + 1}. ${v.title.length > 60 ? v.title.slice(0, 57) + '...' : v.title}`,
        highlight_label: `${Number(v.views || 0).toLocaleString()} vistas`,
        rows: [
          {
            title: "Mp3 🎶",
            id: `.ytmp3 ${v.url}`
          },
          {
            title: "Mp4 📹",
            id: `.ytmp4 ${v.url}`
          }
        ]
      }))

      await sendList(
        '🔭  *ִყ𖦹υƗubᧉ sᧉαrch*  🕸️\n╌ִ──ׄ───  🦦  ───ׄ──ִ╌',
        `𔖮𔖭 ֵ  ׂ  Ⳋꪱ  *B𝗎𝗌𝗊𝗎ᧉ𝖽⍺* ⦂ ${text}\n𔖮𔖭 ֵ  ׂ  Ⳋꪱ  *Rᧉsυᥣƚ⍺dᦅs Eᥒcᦅᥒtr⍺dᦅs* ⦂ ${videos.length}`,
        'Seleccionar',
        videos[0].thumbnail,
        sections,
        m
      )

      await light.react(m, '✅')
      return true
    } catch (err) {
      await light.react(m, '✖️')
      return false
    }
  }
}