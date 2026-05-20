module.exports = {
  command: ['snap', 'snapdl', 'snapchat'],
  help: ['snapchat'],
  tags: ['downloader'],
  run: async (m, { light, text }) => {
    try {
      if (!text) {
        await light.type(m.from).text('🚩 Ingresa la *Url* de *Snapchat*', m)
        return false
      }
      await light.react(m, '🕛')
      var res = await light.Api.get('/starlight/snapchat-DL', { params: { url: text } })
      await light.type(m.from).video(await light.type(m.from).fetchBuffer(res.data.url), '', m)
      await light.react(m, '✅')
      return true
    } catch (err) {
      await light.react(m, '🍮')
      return false
    }
  },
  limit: 1
}