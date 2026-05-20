module.exports = {
  command: ['bank', 'banco'],
  help: ['bank'],
  tags: ['rpg'],

  run: async (m, { light }) => {
    try {

      if (!(m.sender in global.db.data.users))
        return await light.type(m.from).text(`*El usuario no se encuentra en mi base de datos.*`, m)

      const user = global.db.data.users[m.sender]
      const name = m.sender === m.sender ? 'Tienes' : `@${m.sender.split('@')[0]} tiene`

      const txt = `[ ✰ ] ${name} *${formatNumber(user.bank)} StarCoins* en el Banco.`
      
      await light.type(m.from).text(txt, m, { mentions: [m.sender] })

    } catch (e) {
      console.error(e)
    }
  }
}

function formatNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}
