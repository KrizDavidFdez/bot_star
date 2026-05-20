const cooldowns = {}

const works = [
   "Trabajas como cortador de galletas y ganas",
   "Trabaja para una empresa militar privada, ganando",
   "Organiza un evento de cata de vinos y obtienes",
   "Limpias la chimenea y encuentras",
   "Desarrollas juegos para ganarte la vida y ganas",
   "Trabajaste en la oficina horas extras por",
   "Trabajas como secuestrador de novias y ganas",
   "Alguien vino y representó una obra de teatro. Por mirar te dieron",
   "Compraste y vendiste artículos y ganaste",
   "Trabajas en el restaurante de la abuela como cocinera y ganas",
   "Trabajas 10 minutos en un Pizza Hut local. Ganaste",
   "Trabajas como escritor(a) de galletas de la fortuna y ganas",
   "Revisas tu bolso y decides vender algunos artículos inútiles que no necesitas. Resulta que toda esa basura valía",
   "Desarrollas juegos para ganarte la vida y ganas",
   "Trabajas todo el día en la empresa por",
   "Diseñaste un logo para una empresa por",
   "¡Trabajó lo mejor que pudo en una imprenta que estaba contratando y ganó su bien merecido!",
   "Trabajas como podador de arbustos y ganas",
   "Trabajas como actor de voz para Bob Esponja y te las arreglaste para ganar",
   "Estabas cultivando y Ganaste",
   "Trabajas como constructor de castillos de arena y ganas",
   "Trabajas como artista callejera y ganas",
   "¡Hiciste trabajo social por una buena causa! por tu buena causa Recibiste",
   "Reparaste un tanque T-60 averiado en Afganistán. La tripulación te pagó",
   "Trabajas como ecologista de anguilas y ganas",
   "Trabajas en Disneyland como un panda disfrazado y ganas",
   "Reparas las máquinas recreativas y recibes",
   "Hiciste algunos trabajos ocasionales en la ciudad y ganaste",
   "Limpias un poco de moho tóxico de la ventilación y ganas",
   "Resolviste el misterio del brote de cólera y el gobierno te recompensó con una suma de",
   "Trabajas como zoólogo y ganas",
   "Vendiste sándwiches de p escado y obtuviste",
   "Reparas las máquinas recreativas y recibes",
]

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function segundosAHMS(segundos) {
  let minutos = Math.floor((segundos % 3600) / 60)
  let segundosRestantes = segundos % 60
  return `${minutos} minutos y ${segundosRestantes} segundos`
}

function toNum(number) {
  if (number >= 1000 && number < 1000000) return (number / 1000).toFixed(1) + 'k'
  if (number >= 1000000) return (number / 1000000).toFixed(1) + 'M'
  if (number <= -1000 && number > -1000000) return (number / 1000).toFixed(1) + 'k'
  if (number <= -1000000) return (number / 1000000).toFixed(1) + 'M'
  return number.toString()
}

module.exports = {
  command: ['work', 'trabajar'],
  help: ['work'],
  tags: ['rpg'],
  run: async (m, { light }) => {
    const user = global.db.data.users[m.sender]
    const name = m.pushName || m.sender.split("@")[0]
    const times = 5 * 60 
    if (cooldowns[m.sender] && Date.now() - cooldowns[m.sender] < times * 1000) {
      const tiempoRestante = segundosAHMS(Math.ceil((cooldowns[m.sender] + times * 1000 - Date.now()) / 1000))
      return light.type(m.from).text(`🚩 Espera *${tiempoRestante}* para volver a trabajar`, m)
    }
    const resultado = Math.floor(Math.random() * (5000 - 500 + 1)) + 500
    user.exp += resultado
    cooldowns[m.sender] = Date.now()
await light.type(m.from).text(`🚩 ${pickRandom(works)}  ( *${toNum(resultado)}* ) XP 💫`, m)
}}