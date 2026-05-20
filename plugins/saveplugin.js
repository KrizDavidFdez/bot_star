const fs = require('fs')
const path = require('path')

module.exports = {
  command: ['svv'],
  tags: ['tools'],
  run: async (m, { light, text }) => {
    try {
      if (!text) {
        return await light.type(m.from).text(
          '🚩 Responde al codigo',
          m
        )
      }

      const fileName = text.replace(/\.js$/i, '').trim()
      if (!fileName) {
        return await light.type(m.from).text(
          '🚩 Ingresa el nombre',
          m
        )
      }

      let code = null
      if (m.quoted?.text) code = m.quoted.text
      else if (m.quoted?.body) code = m.quoted.body
      else if (m.quoted?.msg?.text) code = m.quoted.msg.text
      else if (m.quoted?.msg?.conversation) code = m.quoted.msg.conversation
      else if (m.quoted?.message?.conversation) code = m.quoted.message.conversation
      if (!code) {
        const ctx =
          m.message?.extendedTextMessage?.contextInfo ||
          m.message?.imageMessage?.contextInfo ||
          m.message?.videoMessage?.contextInfo
        if (ctx?.quotedMessage) {
          code =
            ctx.quotedMessage.conversation ||
            ctx.quotedMessage.extendedTextMessage?.text ||
            ctx.quotedMessage.text
        }
      }

      if (!code && m.text) {
        const body = m.text
        const cmd = body.split(' ')[0]
        code = body.replace(cmd, '').trim()
      }

      const dir = path.join(__dirname, '../plugins')
      const filePath = path.join(dir, `${fileName}.js`)

      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      fs.writeFileSync(filePath, code, 'utf8')

      await light.react(m, '📝')
      await light.type(m.from).text(
        `🍟 Guardado correctamente:\nplugins/${fileName}.js`,
        m
      )

    } catch (err) {
      await light.react(m, '🚫')
    }
  }
}


