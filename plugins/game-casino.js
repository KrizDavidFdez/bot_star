let cooldowns = {}
const cooldownTime = 15

module.exports = {
  command: ['apostar', 'casino'],
  help: ['apostar'],
  tags: ['game'],

  run: async (m, { light, text, prefix, command }) => {
    try {
      const user = global.db.data.users[m.sender]
      const name = m.pushName || m.sender.split('@')[0]
      let count = text ? parseInt(text) : 1

      if (cooldowns[m.sender] && Date.now() - cooldowns[m.sender] < cooldownTime * 1000) {
        const remaining = Math.ceil(
          (cooldowns[m.sender] + cooldownTime * 1000 - Date.now()) / 1000
        )
        return await light.type(m.from).text(`🍟 Ya has apostado recientemente, espera *⏱ ${remaining} segundos* para volver a apostar.`, m)
      }
      cooldowns[m.sender] = Date.now()

      if (!text)
        return await light.type(m.from).text(`🚩 Ingresa la cantidad de *StarCoins* que deseas apostar contra *Starlight*.\n\n` + `> Ejemplo: *${prefix + command}* 100`, m)

      if (isNaN(count) || count < 1)
        return await light.type(m.from).text(`🚩 Ingresa una cantidad válida de *StarCoins.*`, m)

      if (user.limit < count)
        return await light.type(m.from).text(`🚩 No tienes suficientes *StarCoins* para apostar.\nSaldo actual: *${formatNumber(user.limit)}*`, m)

      const botNum = Math.floor(Math.random() * 101)
      const userNum = Math.floor(Math.random() * 55)

      user.limit -= count

      let resultText = '`🎰 Veamos los números!`\n\n'
      resultText += `➠ *Starlight*: ${botNum}\n`
      resultText += `➠ *${name}*: ${userNum}\n\n`

      if (botNum > userNum) {
        resultText += `> ${name}, *PERDISTE* ${formatNumber(count)} StarCoins. 😢`
      } else if (botNum < userNum) {
        const reward = count * 2
        user.limit += reward
        resultText += `> ${name}, *GANASTE* ${formatNumber(reward)} StarCoins. 🥳`
      } else {
        user.limit += count
        resultText += `> ${name}, fue un *EMPATE*. Recuperas tus *${formatNumber(count)} StarCoins.* 🤝`
      }

      await light.type(m.from).text(resultText, m)

    } catch (e) {
      console.error(e)
    }
  }
}

function formatNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}