const ytSearch = require('yt-search')
const {
  prepareWAMessageMedia
} = require('@whiskeysockets/baileys')

module.exports = {
  command: ['play'],
  help: ['play'],
  tags: ['downloader'],

  run: async (m, { light, text }) => {
    try {
      if (!text) {
        return await light.type(m.from).text(
          '🚩 Ingresa el *Nombre*',
          m
        )
      }

      light.react(m, '🕛')

      const search = await ytSearch(text)
      const result = search.videos[0]
      const link = result.url

      let info = `ㅤㅆㅤㅤ  🗻ㅤㅤ   ıⴖ͜ẜ͜𝗈ㅤㅤ  ֵㅤㅤ  ೕ
ㅤ𖹭᳢ㅤㅤㅤⴗ𝗈𝗎ƚ𝗎𝖻𝖾ㅤㅤㅤ🌸 ㅤㅤㅤ𝖻ⴗ︩
ㅤ⌒᷼∩ㅤㅤ   ㇵㅤㅤ   *阿特姆*  ㅤㅤ  ഡ
ㅤㅤㅤㅤㅤ࿙࿚࿒࿙ִ͝࿚࿒࿙࿚ㅤ𐙚ㅤ࿙࿚࿒࿙ִ͝࿚࿒࿙࿚

* ⛾ㅤㅤ🍟  ㅤׅㅤ  ꒰  𝖭𝗈𝗆𝖻𝗋𝖾 ⦂ ${result.title}
* ⛾ㅤㅤ🗻  ㅤׅㅤ  ꒰  𝖠𝗋𝗍𝗂𝗌𝗍𝖺 ⦂ ${result.author.name}
* ⛾ㅤㅤ🧩  ㅤׅㅤ  ꒰  𝖴𝗋𝗅 ⦂ ${link}
`

      const media = await prepareWAMessageMedia(
        {
          image: {
            url: result.thumbnail
          }
        },
        {
          upload: light.sock.waUploadToServer
        }
      )

      const content = {
        interactiveMessage: {
          header: {
            ...media,
            hasMediaAttachment: true
          },

          body: {
            text: info
          },

          footer: {
            text: '我好想掛住你.'
          },

          nativeFlowMessage: {
            buttons: [
              {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: "𝖬𝗉3 🎵",
                  id: `.yta ${link}`
                })
              },
              {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: "𝖬𝗉4 📹",
                  id: `.ytv ${link}`
                })
              }
            ]
          },

          contextInfo: {
            pairedMediaType: "NOT_PAIRED_MEDIA"
          }
        }
      }

      const relayOption = {
        additionalNodes: [
          {
            tag: "biz",
            attrs: {},
            content: [
              {
                tag: "interactive",
                attrs: {
                  type: "native_flow",
                  v: "1"
                },
                content: [
                  {
                    tag: "native_flow",
                    attrs: {
                      v: "9",
                      name: "mixed"
                    }
                  }
                ]
              }
            ]
          }
        ]
      }

      await light.sock.relayMessage(
        m.from,
        content,
        relayOption
      )

      light.react(m, '✅')

    } catch (err) {
      
      light.react(m, '🚫')
    }
  }
}