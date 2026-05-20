const webp = require('node-webpmux')
const util = require('util')

module.exports = {
  command: ['getwm'],
  help: ['getwm'],
  tags: ['tools'],
  run: async (m) => {
    try {
      if (!m.isQuoted) {
        return await light.type(m.from).text('🚩 Responde a un *sticker*', m)
      }
      const isWebp = /webp/.test(m.mime || '') || m.quoted?.type === 'stickerMessage'
      if (!isWebp) {
        return await light.type(m.from).text('🚩 Responde a un *sticker*', m)
      }
      const buffer = await m.download()
      const exifData = await getExif(buffer)
      return await m.reply(util.format(exifData))
    } catch (e) {
    }
  }
}

async function getExif(buffer) {
  try {
    const img = new webp.Image()
    await img.load(buffer)
    if (!img.exif || img.exif.length < 22) {
      return { error: '' }
    }

    const json = JSON.parse(img.exif.slice(22).toString())
    return json

  } catch (err) {
    return { error: err.message }
  }
}