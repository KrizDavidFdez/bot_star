module.exports = {
  command: ['minar', 'mine'],
  help: ['minar'],
  tags: ['rpg'],
  run: async (m, { light, prefix }) => {
    let user = global.db.data.users[m.sender]
    const name = m.pushName || m.sender.split("@")[0]
    const cooldown = 10 * 60 * 1000
    if (user.lastMine && Date.now() - user.lastMine < cooldown) {
      const mining = cooldown - (Date.now() - user.lastMine)
      const minutes = Math.floor(mining / 60000)
      const seconds = Math.floor((mining % 60000) / 1000)
      return light.type(m.from).text(`🚩 Espera *${minutes}m ${seconds}s* para volver a minar`, m)
    }
    const sume = Math.floor(Math.random() * (4282 - 700 + 1)) + 700
    user.exp += sume
    user.lastMine = Date.now()
    await light.type(m.from).text(`🚩 Genial! minaste *${sume} 💫 XP.*`, m)
  }
}
