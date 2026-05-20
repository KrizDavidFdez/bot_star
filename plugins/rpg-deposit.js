module.exports = {
  command: ['deposit', 'depositar', 'dep', 'd'],
  help: ['deposit'],
  tags: ['rpg'],

  run: async (m, { light, text }) => {
    try {
      const user = global.db.data.users[m.sender]
      const amountArg = text?.trim()

      if (!amountArg)
        return await light.type(m.from).text(`[ ✰ ] Ingresa la cantidad de *StarCoins* que deseas depositar.`, m
        )

      if (amountArg.toLowerCase() === 'all') {
        const count = parseInt(user.limit)
        if (count <= 0)
          return await light.type(m.from).text(`No tienes *StarCoins* para depositar.`, m)

        user.limit -= count
        user.bank += count

        return await light.type(m.from).text(`[ ✰ ] Depositaste *${formatNumber(count)} StarCoins* al Banco.`, m)
      }

      if (isNaN(amountArg))
        return await light.type(m.from).text(`[ ✰ ] La cantidad debe ser un número.`, m)

      const count = parseInt(amountArg)

      if (count < 1)
        return await light.type(m.from).text(`[ ✰ ] Ingresa una cantidad válida de *StarCoins.*`, m)

      if (!user.limit || user.limit < count)
        return await light.type(m.from).text(`Solo tienes *${formatNumber(user.limit)} StarCoins* en la Cartera.`, m)

      user.limit -= count
      user.bank += count

      await light.type(m.from).text(`Depositaste *${formatNumber(count)} StarCoins* al Banco.`, m)

    } catch {
    }
  }
}

function formatNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}