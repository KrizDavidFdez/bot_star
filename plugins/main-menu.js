const { generateMessageID } = require('@whiskeysockets/baileys')

module.exports = {
  command: ['menu', 'menú'],
  help: ['menu'],
  tags: ['main'],
  run: async (m, { light, prefix }) => {
    try {
      const plugins = Object.values(require.cache)
        .map(mod => mod.exports)
        .filter(p => p && p.help)

      const cmds = []
      for (let plugin of plugins) {
        let help = Array.isArray(plugin.help) ? plugin.help : [plugin.help]
        let tag = plugin.tags ? plugin.tags[0] : 'otros'
        for (let cmd of help) cmds.push({ cmd, tag })
      }

      const totalCmds = cmds.length
      const categorias = {}
      for (let { cmd, tag } of cmds) {
        if (!categorias[tag]) categorias[tag] = []
        categorias[tag].push(cmd)
      }

      const tagNames = {
        main: 'M⍺ıⴖ',
        tools: 'T𝗈𝗈l𝗌',
        downloader: 'D𝗈ⴍⴖl𝗈⍺𝖽ᧉꭇ',
        group: 'Gꭇ𝗈𝗎𝗉𝗌',
        game: 'G⍺𝗆ᧉ𝗌',
        rpg: 'R𝗉𝗀',
        search: 'Sᧉ⍺ꭇ𝖼h',
        serbot: 'Sᧉꭇ𝖻𝗈ƚ',
        ai: 'Aı',
        acciones: 'A𝖼𝖼ı𝗈ⴖᧉ𝗌'
      }
      const tagEmojis = {
        main: ['꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🍪͚    ❀◌', '꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🧇͚    ❀◌'],
        tools: ['꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🀄͚    ❀◌', '꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🧁͚    ❀◌'],
        downloader: ['꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🍚͚    ❀◌', '꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🍙͚    ❀◌'],
        acciones: ['꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🫘 ͚    ❀◌', '꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🍡 ͚    ❀◌'],
        group: ['꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🍪 ͚    ❀◌', '꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    ☕ ͚    ❀◌'],
        game: ['꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🍥͚    ❀◌', '꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🥗͚    ❀◌'],
        rpg: ['꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🥨͚    ❀◌', '꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🥯͚    ❀◌'],
        search: ['꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🍰͚    ❀◌', '꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🍪͚    ❀◌'],
        serbot: ['꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🍞͚    ❀◌', '꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🍔͚    ❀◌'],
        otros: ['💠', '🔹'],
        ai: ['꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🥪 ͚    ❀◌', '꒰⑅ ⸝⸝⸝꒱   ׅ    𝆬    🥙 ͚    ❀◌']
      }

      const name = m.pushName || m.sender.split("@")[0]
      let user = global.db.data.users[m.sender]

      let info = `ׅ   ׂ   ⸼ *⍵ᧉlc𝗈ოᧉ t𝗈 ოᧉ𝗇u*  ೕ  ֵ  ۫
*⊹𓂃   ׄ     ꒰ ୨  ꨄ  ୧ ꒱   ׅ     𓂃⊹ׄ𓂃*

* ㅤ𑜦 ㅤ🧁 ㅤ─ *𝗎𝗌𝗎⍺ꭇı𝗈* ⦂ *${name}*
* ㅤ𑜦 ㅤ🍪 ㅤ─ *ᧉx𝗉* ⦂ *${user.exp}*
* ㅤ𑜦 ㅤ🎂 ㅤ─ *𝖼𝗈ıⴖ𝗌* ⦂ *${user.limit}*
* ㅤ𑜦 ㅤ🥪 ㅤ─ *𝖼𝗆𝖽𝗌* ⦂ *${totalCmds}*

 ׂ  ׅ  ㊓ ⸼ *太阳与达令*  ׂ  ֵ  ꪱ᱙ ˒˓
︶𝄄۪︶۫۫︶𝄄۫︶  ୨୧  ︶۫𝄄︶۫۫︶۪۫𝄄︶۫\n\n`
      for (let tag in categorias) {
        let tagTitle = tagNames[tag] || tag
        info += `㋼        *${tagTitle}*      ҂\n\n`

        const emojis = tagEmojis[tag] || ['✨', '🌸']
        let i = 0

        for (let cmd of categorias[tag]) {
          const emoji = emojis[i % emojis.length]
          info += `  ${emoji}   ${prefix + cmd}\n`
          i++
        }

        info += `\n`
      }

      info += `𝅭  ⎯⎯ㅤִㅤ୭ 🐾 ৎㅤִ  ⎯⎯   𝅭`

     const content = {
  interactiveMessage: {
    header: {
      imageMessage: {
        url: "https://mmg.whatsapp.net/v/t62.7118-24/694737724_1571762897853913_3073126280906978383_n.enc?ccb=11-4&oh=01_Q5Aa4gFWhJ21ff4wCRVfuIaEQW1MNnSbUwIjP3VPUXJ3BjHtEA&oe=6A28E57A&_nc_sid=5e03e0&mms3=true",
        mimetype: "image/jpeg",
        caption: info,
        fileSha256: "uKXD9gJltit9+cMNSpmmHf9aB96WMrCYM2ObXfOLbic=",
        fileLength: "31191",
        height: 414,
        width: 736,
        mediaKey: "pQLmnC2flPGHFUnXEstYGFsacydnin/vSdwzSc5Hqz4=",
        fileEncSha256: "HXq8R9eJLaWVIeMPshkJJL8KU/fpUMW4ewSswx+f3IY=",
        directPath: "/v/t62.7118-24/694737724_1571762897853913_3073126280906978383_n.enc?ccb=11-4&oh=01_Q5Aa4gFWhJ21ff4wCRVfuIaEQW1MNnSbUwIjP3VPUXJ3BjHtEA&oe=6A28E57A&_nc_sid=5e03e0",
        mediaKeyTimestamp: "1778482091",
        jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIACgASAMBIgACEQEDEQH/xAAtAAADAQEBAAAAAAAAAAAAAAAABAUDAgEBAQEBAAAAAAAAAAAAAAAAAAABAv/aAAwDAQACEAMQAAAAejtJy+PqOLpx2jFHWNXGTQ1mAi+jnW1eJTrJPliTG0lQFzMqPmFmgCtVAhjoBMA//8QAHxAAAgMAAwEAAwAAAAAAAAAAAQIAAxEEEiFBFDJh/9oACAEBAAE/ALOT0QnJba9pJYxVYegzj3Fj1aWt1yCwStxGQEH+ykA1jROU24J9gnEpJfs05uL0m7PyCjYJWGdEY/YCqgDZyt7wsQZW3oMpbQZz39QRCdi0M10rsCoK2MsZ1ObOThbdhIPkq/bDLeUtSAL60Ba5iSYtRyV0OfpEroBHsZW0gmPYznTNitGfTOGvctBWR8layyzzFmT/xAAXEQADAQAAAAAAAAAAAAAAAAABEBEw/9oACAECAQE/AKjr/8QAGBEBAAMBAAAAAAAAAAAAAAAAARAgMEH/2gAIAQMBAT8ACCnMf//Z"
      },
      hasMediaAttachment: true
    },

    body: {
      text: info
    },

    footer: {
      text: "永遠嘅乖乖"
    },

    nativeFlowMessage: {
      buttons: [
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "Owner",
            id: ".owner"
          })
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "Info Bot",
            id: ".info"
          })
        }
      ],

      messageParamsJson: JSON.stringify({
        bottom_sheet: {
          list_title: "Starlight Bot",
          button_title: "Menu",
          in_thread_buttons_limit: 1
        }
      })
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

await light.sock.relayMessage(m.from, content, relayOption)
    
  /*    await light.sock.relayMessage(m.from, {
  viewOnceMessage: {
    message: {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
        participant: m.key.participant || m.key.remoteJid,
        stanzaId: m.key.id,
        quotedMessage: m.message
      },

      interactiveMessage: {
        //body: { text: info },
       // footer: { text: "我好想掛住你." },
       body: { text: '' },
       footer: { text: info },
        header: {
          hasMediaAttachment: false,
          productMessage: {
            product: {
              productImage: {
                interactiveAnnotations: [],
                scanLengths: [],
                annotations: [],
                mimetype: "image/jpeg",
                ...p.productImage
              },
              productId: p.productId,
              title: p.title,
              currencyCode: "USD",
              priceAmount1000: p.priceAmount1000,
              productImageCount: 1,
              salePriceAmount1000: p.salePriceAmount1000
            },
            businessOwnerJid: "14672312983598@lid"
          }
        },

        nativeFlowMessage: {
          buttons: [
            {
              name: "cta_url",
              buttonParamsJson: JSON.stringify({
                display_text: "Instagram",
                url: "https://www.instagram.com/srt.conti?igsh=eW15d202OGQwOTU0"
              })
            },
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "Owner",
                id: ".owner"
              })
            }
          ]
        }
      }
    }
  }
}, {
  messageId: generateMessageID()
})*/
      /*const imagenes = [
        "https://i.postimg.cc/fbfHKrrk/6c22e746-5f22-4c02-8c59-17564b304391.jpg",
  "https://i.postimg.cc/zG5YbqrY/9c458b06-ab29-44b9-baa9-1f442a7383c9.jpg"
      ]

      const thumbnail = imagenes[Math.floor(Math.random() * imagenes.length)]

      await light.button(
        m.from,
        info,
        '我好想掛住你.',
        thumbnail,
        [['🌸 𝖮𝗐𝗇𝖾𝗋', `.creador`]],
        m,
        null,
        [
          ['𝖨𝗇𝗌𝗍𝖺𝗀𝗋𝖺𝗆', "https://www.instagram.com/srt.conti?igsh=eW15d202OGQwOTU0"],
          ['𝖨𝗇𝗌𝗍𝖺𝗀𝗋𝖺𝗆 2', "https://www.instagram.com/gatoniel_sh?igsh=MTNqampmYXlwOHk2MQ=="],
          ['𝖢𝗁𝖺𝗇𝗇𝖾𝗅', "https://whatsapp.com/channel/0029VaBfsIwGk1FyaqFcK91S"]
        ],
        {}
      )*/

    } catch (e) {
      console.error(e)
    }
  }
}