const util = require('util')
const { exec } = require('child_process')

module.exports = {
  tags: ['owner'],
 // owner: true,

  before: async (m, { light }) => {
    //if (!m.isOwner) return

    let text = (m.body || '').trim()
    if (!text) return

    let command = text.split(' ')[0]
    let code = text.slice(command.length).trim()

    if (!['=>', '>', '$'].includes(command)) return
    if (!code) return

    const msg = m
    const sock = m.sock
    const db = m.db
    const quoted = m.quoted
    const sender = m.sender
    const from = m.from

    try {
      if (command === '=>') {
        try {
          let result = await eval(`(async () => { return ${code} })()`)
          if (typeof result !== 'string') {
            result = util.inspect(result, { depth: 2 })
          }
          await m.reply(result || '✓')
          return true
        } catch (e) {
          await m.reply(e.toString())
          return true
        }
      }

      else if (command === '>') {
        let logs = []
        let originalLog = console.log

        try {
          console.log = (...args) => {
            logs.push(args.map(a => typeof a === 'string' ? a : util.inspect(a)).join(' '))
          }

          let result = await eval(`(async () => { ${code} })()`)

          console.log = originalLog

          let output = ''

          if (logs.length) {
            output += logs.join('\n')
          }

          if (result !== undefined) {
            if (typeof result !== 'string') {
              result = util.inspect(result, { depth: 2 })
            }
            output += (output ? '\n' : '') + result
          }

          if (output) {
            await m.reply(output)
          }

          return true
        } catch (e) {
          console.log = originalLog
          await m.reply(util.format(e))
          return true
        }
      }

      else if (command === '$') {
        exec(code, async (err, stdout, stderr) => {
          try {
            if (err) return await m.reply(err.toString())
            if (stderr) return await m.reply(stderr.toString())
            if (stdout) return await m.reply(stdout.toString())
            return await m.reply('✓')
          } catch {}
        })
        return true
      }

    } catch (e) {
      await m.reply('error')
      return true
    }
  }
}