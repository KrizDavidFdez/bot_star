const cooldowns = {}

function segundosAHMS(segundos) {
  return `${segundos % 60} segundos`
}

module.exports = {
  command: ['cf', 'coinflip', 'flip'],
  help: ['cf'],
  tags: ['game'],
  run: async (m, { light, args, command }) => {
    var user = global.db.data.users[m.sender]
    var name = m.pushName || m.sender.split("@")[0]
    var tiempoEspera = 5
    var text = args[0]
    if (cooldowns[m.sender] && Date.now() - cooldowns[m.sender] < tiempoEspera * 1000) {
      const tiempoRestante = segundosAHMS(Math.ceil((cooldowns[m.sender] + tiempoEspera * 1000 - Date.now()) / 1000))
      return await light.type(m.from).text(`🚩 Espere ${tiempoRestante}* para volver a jugar`, m)
    }
    if (!text || !['cara', 'cruz'].includes(text.toLowerCase())) {
      return await light.type(m.from).text(`🚩 Elige una opción ( *cara o cruz* ) para lanzar la moneda.\n\nEjemplo:\n> *${command} cara*`, m)
    }

    cooldowns[m.sender] = Date.now()
    const resultado = Math.random() < 0.5 ? 'cara' : 'cruz'
    const esGanador = text.toLowerCase() === resultado

    if (esGanador) {
      user.exp += 2000
      await light.type(m.from).text(`🍟 La moneda cayó en *${resultado}*, acabas de ganar *+2000* 💫 Exp`, m)
    } else {
      user.exp -= 500
      await await light.type(m.from).text(`🍟 La moneda cayó en *${resultado}*, acabas de perder *-500* 💫 Exp`, m)
    }
  }
}