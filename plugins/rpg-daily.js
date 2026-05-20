module.exports = {
  command: ['daily', 'claim'],
  help: ['daily'],
  tags: ['rpg'],
  run: async (m, { light }) => {
  let user = global.db.data.users[m.sender]
  const name = m.pushName || m.sender.split("@")[0]
  const cooldown = 24 * 60 * 60 * 1000
  if (user.lastDaily && Date.now() - user.lastDaily < cooldown) {
  const remaining = cooldown - (Date.now() - user.lastDaily)
  const hours = Math.floor(remaining / 3600000)
  const minutes = Math.floor((remaining % 3600000) / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
   return light.type(m.from).text(`🚩 Ya reclamaste, espere *${hours}h ${minutes}m ${seconds}s* para *reclamar*`, m)
    }
    const sume = Math.floor(Math.random() * (5828 - 2000 + 1)) + 2000
    user.exp += sume
    user.lastDaily = Date.now()
    await light.type(m.from).text(`🚩 Felicidades 🎉, reclamaste *+${sume}* 💫 XP*.`, m)
  }
}

