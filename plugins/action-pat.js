module.exports = {
  command: ['patear'],
  help: ['patear'],
  tags: ['acciones'],
  run: async (m, { light }) => {
    try {
      const gifs = [
        "https://raw.githubusercontent.com/IrokzDal/uploads/main/1776721773669.gif",
        "https://raw.githubusercontent.com/IrokzDal/uploads/main/1776721927515.mp4",
        "https://raw.githubusercontent.com/IrokzDal/uploads/main/1776721972513.mp4",
        "https://raw.githubusercontent.com/IrokzDal/uploads/main/1776722014238.mp4"
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
   let text = `@${m.sender.split('@')[0]} a pateado a @${who.split('@')[0]}`
      await light.sock.sendMessage(m.from, {
        video: { url: randomGif },
        caption: text,
        gifPlayback: true,
        mentions: [m.sender, who]
      }, { quoted: m })
    } catch (e) {
    }}
}