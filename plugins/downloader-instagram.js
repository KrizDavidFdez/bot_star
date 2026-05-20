module.exports = {
  command: ['ig', 'instagram', 'igdl'],
  help: ['instagram'],
  tags: ['downloader'],
  run: async (m, { light, text }) => {
    try {
      if (!text) {
        await light.type(m.from).text('🚩 Ingresa la *Url* de *Instagram*', m)
        return false
      }

      await light.react(m, '🕛')
      const data = await light.Api.get('/starlight/instagram-dl', { params: { url: text } })

      for (let media of data.url) {
        const buffer = await light.type(m.from).fetchBuffer(media)
        if (data.isVideo) {
          await light.type(m.from).video(buffer, data.caption || '', m)
        } else {
          await light.type(m.from).image(buffer, data.caption || '', m)
        }
      }

      await light.react(m, '✅')
      return true
    } catch {
      await light.react(m, '🍮')
      return false
    }
  },
  limit: 1
}



