const { SubsList } = require('../lib/jadibot')

module.exports = {
  command: ["bots"],
  help: ["bots"],
  tags: ["serbot"],
  run: async (m, { light }) => {
    try {
      await SubsList(light, m)
    } catch {
    }
  }
}