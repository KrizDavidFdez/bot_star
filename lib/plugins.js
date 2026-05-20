const fs = require('fs')
const path = require('path')
const chokidar = require('chokidar')

let plugins = []

function loadPlugins(pluginsPath) {

  if (!fs.existsSync(pluginsPath)) {
    console.warn(`🚩 Carpeta plugins no encontrada: ${pluginsPath}`)
    return plugins
  }

  plugins = []

  const files = fs
    .readdirSync(pluginsPath)
    .filter(f => f.endsWith('.js') && f !== 'MessagesUpsert.js')

  for (let file of files) {

    const pluginPath = path.join(pluginsPath, file)

    if (!fs.existsSync(pluginPath)) continue

    try {

      delete require.cache[require.resolve(pluginPath)]

      const plugin = require(pluginPath)

      plugins.push(plugin)

    } catch (err) {
      console.error(err)
    }

  }

  return plugins
}

function watchPlugins(pluginsPath) {

  if (!fs.existsSync(pluginsPath)) return

  chokidar.watch(pluginsPath).on('all', (event, filePath) => {

    const fileName = path.basename(filePath)

    if (filePath.endsWith('.js') && fileName !== 'MessagesUpsert.js') {

      console.log(`🚩 Plugin ${fileName} (${event}) actualizado\n`)

      loadPlugins(pluginsPath)

    }

  })

}

module.exports = { loadPlugins, watchPlugins, plugins }
/*const fs = require('fs')
const path = require('path')
const chokidar = require('chokidar')

let plugins = []

function loadPlugins(pluginsPath) {
  plugins = []
  const files = fs.readdirSync(pluginsPath).filter(f => f.endsWith('.js') && f !== 'MessagesUpsert.js')
  for (let file of files) {
    const pluginPath = path.join(pluginsPath, file)
    if (!fs.existsSync(pluginPath)) continue
    try {
      delete require.cache[require.resolve(pluginPath)]
      const plugin = require(pluginPath)
      plugins.push(plugin)
    } catch (err) {
      console.error(err)
    }
  }
  return plugins
}

function watchPlugins(pluginsPath) {
  chokidar.watch(pluginsPath).on('all', (event, filePath) => {
    const fileName = path.basename(filePath)
    if (filePath.endsWith('.js') && fileName !== 'MessagesUpsert.js') {
      console.log(`🚩 Plugin ${fileName} (${event}) actualizado\n`)
      loadPlugins(pluginsPath)
    }
  })
}

module.exports = { loadPlugins, watchPlugins, plugins }*/
