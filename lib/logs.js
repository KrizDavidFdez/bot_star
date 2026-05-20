const chalk = require('chalk')

function logs(m, body, sender, isGroup) {
  if (!m.message) return

  const timer = new Date().toLocaleString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  console.log(
    chalk.white(chalk.bgRed('🎟️ ノ 𝖬𝗌𝗀 𖹭')),
    chalk.black(chalk.bgYellow(timer)),
    chalk.black(chalk.bgGreen('\n' + (body || '')) + '\n' +
    chalk.white('🥢  ര  𝖣𝖾:')),
    chalk.green(m.pushName || sender.split('@')[0]),
    chalk.yellow(sender) + '\n' +
    chalk.white('🍣  ര  𝖤𝗇:'),
    chalk.green(isGroup ? 'Grupo' : 'Privado', m.key.remoteJid || '')
  )
}

module.exports = { logs }
