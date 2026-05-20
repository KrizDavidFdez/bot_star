const { InstaSearch } = require("../lib/querys.js")

module.exports = {
  command: ['igsearch'],
  help: ['igsearch'],
  tags: ['search'],
  limit: 1,

  run: async (m, { light, text }) => {
    try {
      if (!text) {
        await light.type(m.from).text(
          '🚩 Ingresa el *texto* de *búsqueda*',
          m
        )
        return false
      }

      await light.react(m, '🕓')

      const resultados = await InstaSearch(text)

      const sgg = resultados
        .slice(0, 20)
        .map((res) =>
          `${res.titulo}\n\n🧃 *Desc:* ${res.desc}\n🧋 *Url:* ${res.url}`
        )
        .join('\n\n')
      const th = await light.type(m.from).fetchBuffer("https://i.postimg.cc/q7ZmhQVB/f05c13bc-f5b1-4dea-a112-0a3173364fca.jpg")
      await light.type(m.from).image(
        th,
        sgg,
        m
      )

      await light.react(m, '✅')
      return true

    } catch (e) {
      await light.react(m, '✖️')
      return false
    }
  }
}