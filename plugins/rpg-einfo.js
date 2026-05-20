module.exports = {
  command: ['coins', 'wallet', 'cartera', 'bal', 'balance', 'einfo', 'economyinfo'],
  help: ['einfo'],
  tags: ['rpg'],
  run: async (m, { light, prefix }) => {
  
  let user = global.db.data.users[m.sender]
  const name = m.pushName || m.sender.split("@")[0]
  await light.type(m.from).text(`\n⾕ㅤֵㅤׄㅤ𝗎𝗌ᧉꭇㅤׅㅤ🍟ㅤּㅤꕮ  : *${name}*
⾕ㅤֵㅤׄㅤ𝖼𝗼ıⴖ𝗌ㅤׅㅤ🍟ㅤּㅤꕮ  : *${user.limit}*
⾕ㅤֵㅤׄㅤᧉx𝗉ㅤׅㅤ🍟ㅤּㅤꕮ  : *${user.exp}*\n`, m)
 /* let txt = `Coins ${user.limit}\n`
     txt += `EXP ${user.exp}\n`
     txt += `Nombre ${name}\n`
  
  await light.type(m.from).text(txt, m)*/
  
  }
}