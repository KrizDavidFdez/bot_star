const fetch = require('node-fetch')
const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys')

module.exports = {
  command: ['playlist'],
  help: ['playlist'],
  tags: ['downloader'],
  limit: 1,

  run: async (m, { light, text }) => {
    try {
      if (!text) {
        await light.type(m.from).text(
          '🚩 Ingresa el *Url* de la *Playlist*',
          m
        )
        return false
      }

      if (!/youtube\.com\/playlist|list=|music\.youtube\.com/i.test(text)) {
        await light.type(m.from).text(
          '🚩 Ingresa una *Url* valida',
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
        } catch (e) {}

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

      var api = `https://apis-starlights-team.koyeb.app/starlight/youtube-playlist?url=${encodeURIComponent(text)}`
      var response = await fetch(api)
      var data = await response.json()
      var videos = Array.isArray(data?.videos) ? data.videos.slice(0, 100) : []
      var playlistTitle = videos[0]?.title || ''
      const sections = [
        {
          title: '🎶 Lista de Canciones 🎶',
          rows: videos.map((v, i) => ({
            title: `${v.number || i + 1}. ${(v.title || '').slice(0, 65)}`,
            id: `.ytmp3 ${v.url}`,
            description: 'Mp3 🎶'
          }))
        }
      ]
      await sendList(
        '🔭  *ִყ𖦹υƗubᧉ ρᥣ⍺ყᥣɪst*  🕸️\n╌ִ──ׄ───  🦦  ───ׄ──ִ╌',
        `𔖮𔖭 ֵ  ׂ  Ⳋꪱ  *Pᥣ⍺ყᥣɪst* ⦂ ${playlistTitle}\n𔖮𔖭 ֵ  ׂ  Ⳋꪱ  *Rᧉsυᥣƚ⍺dᦅs Eᥒcᦅᥒtr⍺dᦅs* ⦂ ${videos.length}`,
        'Seleccionar',
        videos[0]?.thumbnail || null,
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