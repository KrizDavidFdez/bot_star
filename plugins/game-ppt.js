let cooldowns = {}
const cooldownTime = 5 * 1000
const rewardWin = 300
const rewardTie = 100

module.exports = {
  command: ['ppt'],
  help: ['ppt'],
  tags: ['game'],

  run: async (m, { light, text, prefix, command }) => {
    try {
      const user = global.db.data.users[m.sender]
      const opciones = ['piedra', 'papel', 'tijera']

      if (cooldowns[m.sender] && Date.now() - cooldowns[m.sender] < cooldownTime) {
        const restante = Math.ceil((cooldowns[m.sender] + cooldownTime - Date.now()) / 1000)
        return await light.type(m.from).text(`🚩 Ya has jugado recientemente, espera *⏱ ${restante} segundos* para volver a jugar.`, m)
      }
      cooldowns[m.sender] = Date.now()

      if (!text)
        return await light.type(m.from).text(`🚩 Elige una opción para jugar ( *piedra*, *papel* o *tijera* ).\n\n` + `> Ejemplo:\n*${prefix + command} piedra*`, m)

      const eleccion = text.toLowerCase()
      if (!opciones.includes(eleccion))
        return await light.type(m.from).text(`🚩 Opción no válida. Usa: *piedra*, *papel* o *tijera*.\n\n` + `> Ejemplo:\n*${prefix + command} papel*`, m)

      const botChoice = opciones[Math.floor(Math.random() * opciones.length)]
      let resultado = ''
      let puntos = 0
      
      if (eleccion === botChoice) {
        resultado = `🤝 *Empate!* Ambos eligieron *${botChoice}*.\nRecibes *${rewardTie} StarCoins*.`
        puntos = rewardTie
      } else if (
        (eleccion === 'piedra' && botChoice === 'tijera') ||
        (eleccion === 'tijera' && botChoice === 'papel') ||
        (eleccion === 'papel' && botChoice === 'piedra')
      ) {
        resultado = `🏆 *GANASTE!* Tú elegiste *${eleccion}* y el bot *${botChoice}*.\nGanas *${rewardWin} StarCoins*.`
        puntos = rewardWin
      } else {
        resultado = `😢 *PERDISTE!* Tú elegiste *${eleccion}* y el bot *${botChoice}*.\nPierdes *${rewardWin} StarCoins*.`
        puntos = -rewardWin
      }

      user.limit += puntos

      await light.type(m.from).text(resultado, m)

    } catch (e) {
      console.error(e)
    }
  }
}