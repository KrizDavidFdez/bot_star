module.exports = {
  command: ['xdl', 'twidl'],
  help: ['xdl'],
  tags: ['downloader'],
  run: async (m, { light, text }) => {
    try {
      if (!text) {
        await light.type(m.from).text('🚩 Ingresa la *URL* de *X*', m)
        return false
      }

      if (!isTwitterUrl(text)) {
        await light.type(m.from).text('🚩 El enlace es *incorrecto*', m)
        return false
      }
      await light.react(m, '🕓')
      var res = await fetch(`https://apis-starlights-team.koyeb.app/starlight/twitter-dl?url=${text}`)
      var json = await res.json()
      var data = json?.data
      if (data.video) {
        const buffer = await light.type(m.from).fetchBuffer(data.video)
        await light.type(m.from).video(buffer, `${data.title}`, m)
        await light.react(m, '✅')
        return true
      }
      if (Array.isArray(data.images) && data.images.length > 0) {
        for (const img of data.images) {
          const imgBuffer = await light.type(m.from).fetchBuffer(img)
          await light.type(m.from).image(imgBuffer, `🍟 您的图像就绪`, m)
        }
        await light.react(m, '✅')
        return true
      }
      await light.react(m, '✖')
      return false
    } catch (e) {
      console.error(e)
      await light.react(m, '✖')
      return false
    }
  },
  limit: 1
}

function isTwitterUrl(url) {
  const regex = /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/.+$/i
  return regex.test(url)
}

/*module.exports = {
  command: ['xdl', 'twidl'],
  help: ['twitter <url>'],
  tags: ['downloader'],
  run: async (m, { light, text }) => {
    try {
      if (!text) {
        await light.type(m.from).text('🚩 Ingresa la *Url* de *X*', m)
        return false
      }
      await light.react(m, '🕛')
      const res = await light.Api.get('/starlight/twitter-dl', { params: { url: text } })
      const data = res?.data?.data
      if (data.video) {
        const buffer = await light.type(m.from).fetchBuffer(data.video)
        await light.type(m.from).video(buffer, data.title || '', m)
      }
      if (Array.isArray(data.images) && data.images.length > 0) {
        for (let img of data.images) {
          var buffers = await light.type(m.from).fetchBuffer(img)
          await light.type(m.from).image(buffers, '🍟 您的图像就绪', m)
        }
      }
      await light.react(m, '✅')
      return true
    } catch (err) {
      console.error(err)
      await light.react(m, '🍮')
      return false
    }
  },
  limit: 1
}*/


