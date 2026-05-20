module.exports = {
  command: ['fbsearch'],
  help: ['fbsearch'],
  tags: ['search'],
  limit: 1,

  run: async (m, { light, text }) => {
    try {
      const { facebooksearch } = require("../lib/querys.js")

      if (!text) {
        await light.type(m.from).text(
          '🚩 Ingresa el *texto* de *búsqueda*',
          m
        )
        return false
      }

      await light.react(m, '🕓')

      const resultados = await facebooksearch(text)

      const sgg = resultados
        .slice(0, 20)
        .map((res) =>
          `${res.titulo}\n\n🧃 *Desc:* ${res.desc}\n🧋 *Url:* ${res.url}`
        )
        .join('\n\n')
      const th = await light.type(m.from).fetchBuffer("https://i.postimg.cc/FKt5d9jn/737c8862-c80d-4455-a9d7-8bca48f019b1.jpg")
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