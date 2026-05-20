const fetch = require('node-fetch')
const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys')

module.exports = {
  command: ['hsearch'],
  help: ['hsearch', 'hsearch -cat'],
  tags: ['search'],
  limit: 1,

  run: async (m, { light, text }) => {
    try {
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

      let apiUrl = ''
      let mode = ''
      let query = String(text || '').trim()
      let catPage = 1

      // Detecta si es catalog
      const catMatch = query.match(/-cat\s+(\d+)/i)
      if (catMatch) {
        catPage = Number(catMatch[1]) || 1
        apiUrl = `https://apis-starlights-team.koyeb.app/starlight/hentaila?type=catalog&page=${catPage}`
        mode = 'catalog'
      } else if (query) {
        apiUrl = `https://apis-starlights-team.koyeb.app/starlight/hentaila?type=search&q=${encodeURIComponent(query)}`
        mode = 'search'
      } else {
        apiUrl = `https://apis-starlights-team.koyeb.app/starlight/hentaila?type=catalog&page=1`
        mode = 'catalog'
      }

      const res = await fetch(apiUrl)
      const data = await res.json()

      if (!data?.success || !Array.isArray(data.results) || !data.results.length) {
        await light.react(m, '✖️')
        await light.type(m.from).text(
          '❌ No se encontraron resultados.',
          m
        )
        return false
      }

      const results = data.results.slice(0, 20)

      const sections = results.map((item, i) => {
        const rows = (item.episodes || []).map(ep => ({
          title: `Capítulo ${ep.episode}`,
          description: `${item.title} • Episodio ${ep.episode}`,
          id: `.hentailadl ${ep.url}`
        }))

        return {
          title: `${i + 1}. ${item.title.length > 60 ? item.title.slice(0, 57) + '...' : item.title}`,
          highlight_label: `${item.totalEpisodes || rows.length || 1} capítulo(s)`,
          rows
        }
      })

      const firstThumb = results[0]?.thumbnail || null

      let body = ''

      if (mode === 'search') {
        body =
          `🔍 Búsqueda: ${query}\n` +
          `Resultados: ${results.length}\n\n` +
          `Selecciona un anime y luego el capítulo que quieras descargar.`
      } else {
        body =
          `📚 Catálogo HentaiLa: Página ${catPage}\n` +
          `Resultados: ${results.length}\n\n` +
          `Selecciona un anime y luego el capítulo que quieras descargar.`
      }

      await sendList(
        '🔞  HentaiLa Search',
        body,
        'hentailadl',
        firstThumb,
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