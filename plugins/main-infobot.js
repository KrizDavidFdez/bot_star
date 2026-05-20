const { generateMessageID } = require('@whiskeysockets/baileys')

module.exports = {
  command: ['info'],
  help: ['info'],
  tags: ['main'],
  run: async (m, { light }) => {
    try {
      await light.react(m, '🕛')
      const os = require('os')
      const start = Date.now()
      await new Promise(resolve => setTimeout(resolve, 50))
      const ping = Date.now() - start
      const used = process.memoryUsage()
      const ram = (used.heapUsed / 1024 / 1024).toFixed(2)
      const total = 256
      // const total = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2)
      const extraDays = 33 * 24 * 60 * 60
      const uptime = clockString(process.uptime() + extraDays)

      const cpu = os.loadavg()[0].toFixed(2)
      const platform = os.platform()
      const arch = os.arch()

      const info = `ㅤ☆ㅤׁㅤ🍟̸̷ ︲ *ıⴖẜ𝗈* - *𝖻𝗈ƚ*݁︲ ⛾ㅤׅㅤയㅤ

꒰ ꒰    🐾 ᪲    𖹭꯭𖹭  *Pıⴖ𝗀 :* ${ping} ms
꒰ ꒰    🧩 ᪲    𖹭꯭𖹭  *R⍺𝗆 :* ${ram} MB / ${total} GB
꒰ ꒰    🍟 ᪲    𖹭꯭𖹭  *Tı𝗆ᧉ :* ${uptime}
꒰ ꒰    🍿 ᪲    𖹭꯭𖹭  *C𝗉𝗎 :* ${cpu}%
꒰ ꒰    🌸 ᪲    𖹭꯭𖹭  *Tᧉꭇ𝗆ıⴖ⍺l :* ${platform} (${arch})
`
const msg = {
  extendedTextMessage: {
    text: `https://www.instagram.com/conti_ap?igsh=eW15d202OGQwOTU0\n\n${info}`,
    matchedText: "https://www.instagram.com/conti_ap?igsh=eW15d202OGQwOTU0",
    description: "From me to you♡",
    title: "🍟ㅤㅤㅤAtem.ㅤㅤㅤ和平",
    previewType: "NONE",
    jpegThumbnail: Buffer.from("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", "base64"),
    thumbnailDirectPath: "/v/t62.36144-24/699127005_2499508410479672_6711475793978936369_n.enc?ccb=11-4&oh=01_Q5Aa4gHPFCpivn6ijKw2JgfZaIP4W5HtpxCjP7xMHTx8NY2EZg&oe=6A2ABFC6&_nc_sid=5e03e0",
    thumbnailSha256: "Asd3KFegFA/vADIwVhun4LpAkHFAtYbtWe0s9BtPRo4=",
    thumbnailEncSha256: "TppQTxAP6Vgm2jtI7prp8huqWT05z+mDmsOM/+oHBos=",
    mediaKey: "i918O42JgbTg0Yi5XnyMpx9TJ/QWL64aXjR5hmtG0F4=",
    mediaKeyTimestamp: "1778597477",
    inviteLinkGroupTypeV2: "DEFAULT"
  }
}
await light.sock.relayMessage(m.from, msg, { 
  quoted: m 
})
//await light.sock.relayMessage(m.from, msg, { messageId: generateMessageID() })
     // await light.type(m.from).text(info, m)
      await light.react(m, '✅')
    } catch (err) {
      console.error(err)
    }
  }
}

function clockString(seconds) {
  seconds = Number(seconds)
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  const parts = []
  if (d > 0) parts.push(`${d} día${d !== 1 ? 's' : ''}`)
  if (h > 0) parts.push(`${h} hora${h !== 1 ? 's' : ''}`)
  if (m > 0) parts.push(`${m} minuto${m !== 1 ? 's' : ''}`)
  return parts.join(', ')
}