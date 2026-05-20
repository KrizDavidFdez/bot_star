const axios = require('axios')

async function spotify(url) {
  if (!url || !url.includes('spotify.com/track/')) {
    throw new Error('URL inválida')
  }

  const headers = {
    origin: 'https://spotdown.org',
    referer: 'https://spotdown.org/',
    'user-agent':
      'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
  }

  const { data: s } = await axios.get(
    `https://spotdown.org/api/song-details?url=${encodeURIComponent(url)}`,
    { headers }
  )

  const song = s?.songs?.[0]
  if (!song) throw new Error('Track no encontrado')

  const { data: audio } = await axios.post(
    'https://spotdown.org/api/download',
    { url: song.url },
    {
      headers,
      responseType: 'arraybuffer'
    }
  )

  const sizeMB = (audio.byteLength / 1024 / 1024).toFixed(2) + ' MB'

  return {
    title: song.title,
    artist: song.artist,
    url: song.url,
    cover: song.thumbnail,
    size: sizeMB,
    audio
  }
}

module.exports = {
  command: ['spotifydl'],
  help: ['spotifydl'],
  tags: ['downloader'],
  limit: 1, 
  run: async (m, { light, text }) => {
    try {
      if (!text || !text.includes('spotify.com/track/')) {
        await light.type(m.from).text(
          '🚩 Ingresa la *Url* de *Spotify*',
          m
        )
        return false
      }

      await light.react(m, '🕛')

      const data = await spotify(text)

      let txt = '\n'
      txt += `⛾      ꒰‎ ‎ 🌵  ꒱  *Tamaño* ꠩ ${data.size}\n`
      txt += `⛾      ꒰‎ ‎ 🌷  ꒱  *Artista* ꠩ ${data.artist}\n`
      txt += `⛾      ꒰‎ ‎ ☁️  ꒱  *Url* ꠩ ${data.url}\n`

      const coverBuffer = await light.type(m.from).fetchBuffer(data.cover)

      await light.type(m.from).image(coverBuffer, txt, m)
      await light.type(m.from).audio(
        data.audio,
        {
          title: data.title,
          artist: data.artist,
          image: coverBuffer,
          quoted: m
        }
      )

      await light.react(m, '✅')
      return true 
    } catch (err) {
      await light.react(m, '🍮')
      return false 
    }
  }
}
