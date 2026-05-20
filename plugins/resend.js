const { proto } = require('@whiskeysockets/baileys')

module.exports = {
  tags: ['owner'],
  owner: true,
  
  before: async (m, { light }) => {
    if (!m.isOwner) return
    
    const text = (m.body || '').trim()
    if (text !== 'resend') return
    if (!m.quoted) return light.type(m.from).text('Responde a un mensaje', m)

    try {
      let originalMsg = m.quoted.message || m.quoted.msg || {}
      
      // Desenvolver mensajes especiales
      if (originalMsg.ephemeralMessage) originalMsg = originalMsg.ephemeralMessage.message
      if (originalMsg.viewOnceMessage) originalMsg = originalMsg.viewOnceMessage.message
      if (originalMsg.viewOnceMessageV2) originalMsg = originalMsg.viewOnceMessageV2.message
      
      const type = Object.keys(originalMsg)[0] || 'conversation'
      const msgId = `BAE5${Date.now()}${Math.random().toString(36).slice(2, 10).toUpperCase()}`
      
      const code = `const msg = ${JSON.stringify(originalMsg, null, 2)}
await sock.relayMessage("${m.from}", msg, { messageId: "${msgId}" })`
      
      const output = `// Tipo: ${type}\n\n${code}`
      
      await light.type(m.from).text(output, m)
      await light.react(m.from, m.key, '📋')
      
    } catch (error) {
      await light.type(m.from).text(`Error: ${error.message}`, m)
    }
    
    return true
  }
}