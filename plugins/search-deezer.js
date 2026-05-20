const fetch = require('node-fetch')
const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys')

function formatDuration(seconds = 0) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

async function deezerSearch(query) {
  const url = `https://api.deezer.com/search/track?q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'accept': '*/*',
      'user-agent': 'Mozilla/5.0'
    }
  })
  const data = await res.json()
  return data.data.map(track => ({
    id: String(track.id),
    title: track.title || '',
    artist: track.artist?.name || '',
    album: track.album?.title || '',
    duration: formatDuration(track.duration || 0),
    url: track.link || `https://www.deezer.com/track/${track.id}`,
    thumbnail:
      track.album?.cover_xl ||
      track.album?.cover_big ||
      track.album?.cover_medium ||
      track.artist?.picture_xl ||
      track.artist?.picture_big ||
      track.artist?.picture_medium ||
      null
  }))
}

module.exports = {
  command: ['dzsearch', 'dzs'],
  help: ['dzsearch'],
  tags: ['search'],
  limit: 1,
  run: async (m, { light, text }) => {
    try {
      if (!text) {
        await light.type(m.from).text(
          '🚩 Ingresa el *nombre*',
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
            text: '𖦹 愛與和平'
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

      const results = await deezerSearch(text)
      const tracks = results.slice(0, 30)
      const sections = tracks.map((track, i) => ({
        title: `${i + 1}. ${track.title.length > 60 ? track.title.slice(0, 57) + '...' : track.title}`,
        highlight_label: `${track.artist} • ${track.duration}`,
        rows: [
          {
            title: `Mp3 🎶`,
            id: `.deezerdl ${track.url}`
          }
        ]
      }))

      await sendList(
        '🎧  *Dᥱᥱzᥱr  Sᥱarch*  🍥\n╌ִ──ׄ───  🍟  ───ׄ──ִ╌',
        `𔖮𔖭 ֵ  ׂ  Ⳋꪱ  *Búsqueda* ⦂ ${text}\n𔖮𔖭 ֵ  ׂ  Ⳋꪱ  *Resultados encontrados* ⦂ ${tracks.length}\n𔖮𔖭 ֵ  ׂ  Ⳋꪱ  *Fuente* ⦂ Deezer`,
        'Seleccionar',
        tracks[0].thumbnail,
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