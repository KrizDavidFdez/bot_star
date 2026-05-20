module.exports = {
  command: ['tk', 'tiktok', 'ttdl'],
  help: ['tiktok'],
  tags: ['downloader'],
  run: async (m, { light, text }) => {
    try {
      if (!text) {
        await light.type(m.from).text('🚩 Ingresa la *Url* de *TikTok*', m)
        return false
      }
      await light.react(m, '🕛')
      var res = await light.Api.get('/starlight/tiktok', { params: { url: text } })
      await light.type(m.from).video(await light.type(m.from).fetchBuffer(res.nowm), res.title || '', m)
      await light.react(m, '✅')
      return true
    } catch (err) {
      await light.react(m, '🍮')
      return false
    }
  },
  limit: 1
}

