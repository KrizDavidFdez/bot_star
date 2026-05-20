module.exports = {
  command: ['buycoins', 'buyall'],
  help: ['buycoins', 'buyall'],
  tags: ['rpg'],
  run: async (m, { light, command, args }) => {
    const user = global.db.data.users[m.sender]
    const xpperlimit = 360 
    let count = command.replace(/^buycoins/i, '')
    count = count
      ? /all/i.test(count)
        ? Math.floor(user.exp / xpperlimit)
        : parseInt(count)
      : args[0]
        ? parseInt(args[0])
        : 1
    count = Math.max(1, count) 
    if (user.exp >= xpperlimit * count) {
      user.exp -= xpperlimit * count
      user.limit += count 
      await light.type(m.from).text(`く    ㅤ         𝗌h𝗈𝗉   ㅤ   ㅤ   👜                      コ
യㅤ             🌸              ㅤ⍺ƚ꯭ᧉ𝗆  ㅤ                ଃ          
ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ
 •     ♡  ::  C𝗈𝗆𝗉ꭇ⍺ : + *${count}* 🍟 Starcoins 
 •     ✿  ::  C𝗈𝗌ƚ𝗈 : *-${xpperlimit * count} 💫 XP*
 
`, m)
    } else {
      await light.type(m.from).text(`🚩 Lo siento, no tienes suficiente *💫 XP* para comprar *${count} 👜 StarCoins.*`, m)
    }
  }
}