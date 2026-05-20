const { Serbot } = require('../lib/jadibot')

module.exports = {
  command: ["serbot", "code"],
  help: ["code"],
  tags: ["serbot"],
  run: async (m, { light, store }) => {
    try {
      const from = m.sender.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
      await Serbot(light, from, m, store)
      await light.react(m, "🕐")
    } catch (err) {
    }
  }
}
