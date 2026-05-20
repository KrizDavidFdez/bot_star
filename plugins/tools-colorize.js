const fs = require('fs')
const path = require('path')
const FormData = require('form-data')
const fetch = require('node-fetch')

async function uploadFile(filePath) {
  let form = new FormData()
  form.append("files[]", fs.createReadStream(filePath))

  let res = await (await fetch("https://uguu.se/upload.php", {
    method: "post",
    headers: { ...form.getHeaders() },
    body: form
  })).json()

  await fs.promises.unlink(filePath)
  return res.files[0].url
}

module.exports = {
  command: ['colorize', 'colorear', 'restore'],
  help: ['colorize'],
  tags: ['tools'],
  limit: 1,
  run: async (m, { light }) => {
    const media = await m.types()
    if (!media.isImage) {
      await light.type(m.from).text("🚩 Responde a una *Imagen*", m)
      return false
    }
    await light.react(m, '🕛')
    try {
      const buffer = await m.download()
      const tmpDir = path.join(__dirname, '../tmp')
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
      const filePath = path.join(tmpDir, `colorize_${Date.now()}.jpg`)
      fs.writeFileSync(filePath, buffer)
      const uploadedUrl = await uploadFile(filePath)
      const data = await light.Api.get('/starlight/colorize-ai', {
        params: { url: uploadedUrl }
      })
      const enhancedImg = data?.data?.url
      const result = await light.type(m.from).fetchBuffer(enhancedImg)
      await light.type(m.from).image(await light.type(m.from).fetchBuffer(result), '🚩 Imagen revivida', m)
      await light.react(m, '✅')
      return true
    } catch (err) {
      await light.react(m, '🍮')
      return false
    }
  }
}