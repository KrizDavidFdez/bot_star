let cooldowns = {}

module.exports = {
  command: ['ruleta', 'roulette', 'rt'],
  help: ['ruleta'],
  tags: ['game'],
  group: true,

  run: async (m, { light, text, prefix, command }) => {
    try {
      const user = global.db.data.users[m.sender]
      const tiempoEspera = 10

      if (cooldowns[m.sender] && Date.now() - cooldowns[m.sender] < tiempoEspera * 1000) {
        const tiempoRestante = segundosAHMS(
          Math.ceil((cooldowns[m.sender] + tiempoEspera * 1000 - Date.now()) / 1000)
        )
        return await light.type(m.from).text(`[ ✰ ] Ya has iniciado una apuesta recientemente.\nEspera *⏱ ${tiempoRestante}* para apostar nuevamente.`, m)
      }

      cooldowns[m.sender] = Date.now()

      if (!text)
        return await light.type(m.from).text(`[ ✰ ] Debes ingresar una cantidad de *StarCoins* y apostar a un color.\nEjemplo: *${prefix + command} 20 black*`, m)

      const args = text.trim().split(' ')
      if (args.length !== 2)
        return await light.type(m.from).text(`[ ✰ ] Formato incorrecto.\nEjemplo correcto: *${prefix + command} 50 red*`, m)

      const limit = parseInt(args[0])
      const color = args[1].toLowerCase()

      if (isNaN(limit) || limit <= 0)
        return await light.type(m.from).text(`[ ✰ ] Por favor, ingresa una cantidad válida para apostar.`, m)

      if (!(color === 'black' || color === 'red'))
        return await light.type(m.from).text(`[ ✰ ] Color inválido. Solo puedes apostar a *black* o *red.*`, m)

      if (limit > user.limit)
        return await light.type(m.from).text(`[ ✰ ] No tienes suficientes *StarCoins* para realizar esa apuesta.`,m)

      await light.type(m.from).text(`[ ✰ ] Apostaste *${formatNumber(limit)} StarCoins* al color *${color}*.\n⏱ Espera *10 segundos* para conocer el resultado...`, m)

      setTimeout(async () => {
        const result = Math.random() < 0.5 ? 'black' : 'red'
        const win = color === result

        if (win) {
          user.limit += limit
          await light.type(m.from).text(`🎉 ¡Ganaste!\nObtuviste *${formatNumber(limit)} StarCoins.*\nTotal actual: *${formatNumber(user.limit)} StarCoins.*`, m)
        } else {
          user.limit -= limit
          await light.type(m.from).text(`Perdiste.\nSe restaron *${formatNumber(limit)} StarCoins.*\nTotal actual: *${formatNumber(user.limit)} StarCoins.*`, m)
        }
      }, 10000)

    } catch {
    }
  }
}

function segundosAHMS(segundos) {
  return `${segundos} segundo${segundos === 1 ? '' : 's'}`
}
 
function formatNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}