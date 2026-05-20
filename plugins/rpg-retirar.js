module.exports = {
  command: ['withdraw', 'retirar', 'wd'],
  help: ['retirar'],
  tags: ['rpg'],

  run: async (m, { light, text }) => {
    try {
      const user = global.db.data.users[m.sender]
      const amountArg = text?.trim()

      if (!amountArg)
        return await light.type(m.from).text(`🚩 Ingresa la cantidad de *StarCoins* que deseas retirar.`, m)

      if (amountArg.toLowerCase() === 'all') {
        const count = parseInt(user.bank)
        if (count <= 0)
          return await light.type(m.from).text(`No tienes *StarCoins* en el Banco.`, m)

        user.bank -= count
        user.limit += count

        return await light.type(m.from).text(`🚩 Retiraste *${formatNumber(count)} StarCoins* del Banco.`, m)
      }

      if (isNaN(amountArg))
        return await light.type(m.from).text(`🚩 La cantidad debe ser un número.`, m)

      const count = parseInt(amountArg)

      if (count < 1)
        return await light.type(m.from).text(`🚩 Ingresa una cantidad válida de *StarCoins.*`, m)

      if (!user.bank || user.bank < count)
        return await light.type(m.from).text(`Solo tienes *${formatNumber(user.bank)} StarCoins* en el Banco.`, m)

      user.bank -= count
      user.limit += count

      await light.type(m.from).text(
        `🚩 Retiraste *${formatNumber(count)} StarCoins* del Banco.`,
        m
      )

    } catch {
    }
  }
}

function formatNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}