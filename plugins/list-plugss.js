const fs = require('fs')
const path = require('path')

module.exports = {
  command: ['plugss'],
  tags: ['tools'],
  run: async (m, { light, text }) => {
    try {
      const dir = path.join(__dirname, '../plugins')

      if (!fs.existsSync(dir)) {
        return await light.type(m.from).text(
          '🚩 No existe la carpeta plugins',
          m
        )
      }

      const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'))

      if (!files.length) {
        return await light.type(m.from).text(
          '🚩 No hay plugins',
          m
        )
      }

      let result = []
      let search = text?.toLowerCase()

      for (const file of files) {
        const filePath = path.join(dir, file)
        const code = fs.readFileSync(filePath, 'utf8')
        let name =
          code.match(/command:\s*\[([^\]]+)\]/)?.[1] ||
          code.match(/name:\s*['"`]([^'"`]+)['"`]/)?.[1] ||
          'Desconocido'

        name = name.replace(/['"`]/g, '').trim()

        const fileName = file.replace('.js', '')

        if (search) {
          if (
            !fileName.toLowerCase().includes(search) &&
            !name.toLowerCase().includes(search)
          ) continue
        }

        result.push(
          `🍟 *Archivo:* ${fileName}\n🚩 *Plugin:* ${name}`
        )
      }

      if (!result.length) {
        return await light.type(m.from).text(
          '🚩 No se encontró un plugin con ese nombre',
          m
        )
      }

      await light.react(m, '🧃')
      await light.type(m.from).text(
        `🍟 *LISTA DE PLUGINS*\n\n${result.join('\n\n')}`,
        m
      )

    } catch (err) {
      await light.react(m, '🚫')
    }
  }
}