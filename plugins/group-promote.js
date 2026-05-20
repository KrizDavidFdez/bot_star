module.exports = {
  command: ['promote', 'daradmin'],
  help: ['promote'],
  tags: ['group'],
  group: true,
  admin: true,
  botAdmin: true,

  run: async (m, { light }) => {
    try {
      let users = []
      if (m.mentionedJid && m.mentionedJid.length) {
        users = m.mentionedJid
      } else if (m.isQuoted) {
        const quotedSender =
          m.quoted?.key?.participant ||
          m.quoted?.key?.remoteJid  ||
          m.quoted?.participant      ||
          null
        if (quotedSender) users = [quotedSender]
      }

      if (!users.length) {
        return await light.type(m.from).text("🚩 Tagea al *usuario*", m)
      }

      users = users.map(j => String(j).replace(/:\d+@/g, '@'))

      await light.sock.groupParticipantsUpdate(m.from, users, 'promote')
      
      await light.type(m.from).text("🚩 El usuario ahora es *admin*", m)
    } catch (e) {
    }
  }
}