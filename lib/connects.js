/*const fs = require('fs')
const path = require('path')
const { JadiBot } = require('./jadibot') 

async function subss(light, store) {
  const baseDir = path.join(__dirname, 'atem')

  if (!fs.existsSync(baseDir)) return
  const sessions = fs.readdirSync(baseDir).filter(f => fs.statSync(path.join(baseDir, f)).isDirectory())

  for (let from of sessions) {
    if (global.client[from]) {
      console.log(`🚩 Sub ${from} ya estaba activo`)
      continue
    }
    try {
      await JadiBot(light, from, {}, store)
    } catch (e) {
    }
  }
}
module.exports = { subss }*/
