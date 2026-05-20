module.exports = {
  command: ['besar'],
  help: ['besar'],
  tags: ['acciones'],
  run: async (m, { light }) => {
    try {
      const gifs = [
        "https://raw.githubusercontent.com/IrokzDal/uploads/main/1776721158488.mp4",
        "https://raw.githubusercontent.com/IrokzDal/uploads/main/1776721194966.mp4",
        "https://raw.githubusercontent.com/IrokzDal/uploads/main/1776721225034.mp4",
        "https://raw.githubusercontent.com/IrokzDal/uploads/main/1776721253389.mp4"
      ]
      let who = null
      if (m.mentionedJid && m.mentionedJid.length) {
        who = m.mentionedJid[0]
      }
      if (!who) {
        const ctx = m.message?.extendedTextMessage?.contextInfo
        if (ctx?.participant) {
          who = ctx.participant
        }
      }
      if (!who) {
        return await light.type(m.from).text("🚩 Tagea al *usuario*", m)
      }
      let randomGif = gifs[Math.floor(Math.random() * gifs.length)]
      let text = `@${m.sender.split('@')[0]} esta besando a @${who.split('@')[0]}`
      await light.sock.sendMessage(m.from, {
        video: { url: randomGif },
        caption: text,
        gifPlayback: true,
        mentions: [m.sender, who]
      }, { quoted: m })
    } catch (e) {
    }}
}