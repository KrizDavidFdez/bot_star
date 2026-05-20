const fs = require("fs")
const path = require("path")
const os = require("os")
const FormData = require("form-data")
const fetch = require("node-fetch")

let isProcessing = false
const voices = {
  hutao: "388",
  rose_bp: "352",
  miku: "359",
  the_weeknd: "357",
  joji: "405",
  drake: "364",
  lisa_bp: "371",
  auronplay: "709",
  aldeanomc: "350",
  satoru_gojo: "355",
  ronaldo: "363",
  bruno_mars: "383",
  jisoo_bp: "377",
  jennie_bp: "368",
  bad_bunny: "426",
  ozuna: "451",
  travis_scott: "471",
  chae_twice: "384",
  mjackson: "362",
  taylor_swift: "389",
  paulo_londra: "1078",
  romeo_sts: "713",
  daarick28: "1083",
  arthur_mg: "392",
  elmo: "661",
  mon_laferte: "636",
}

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/117.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/118.0 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 10; SM-G975F) Chrome/119.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 Version/16.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:117.0) Gecko/20100101 Firefox/117.0"
]

const acceptLangs = [
  "es-PE,es-419;q=0.9,es;q=0.8",
  "en-US,en;q=0.9",
  "fr-FR,fr;q=0.8,en;q=0.6",
  "de-DE,de;q=0.9,en;q=0.8"
]

const referers = [
  "https://filme.imyfone.com/",
  "https://www.google.com/",
  "https://www.youtube.com/",
  "https://www.facebook.com/",
  "https://www.twitter.com/"
]

function generateHeaders(extraHeaders = {}) {
  return {
    "accept": "application/json",
    "accept-language": acceptLangs[Math.floor(Math.random() * acceptLangs.length)],
    "user-agent": userAgents[Math.floor(Math.random() * userAgents.length)],
    "sec-ch-ua": `"Chromium";v="${100 + Math.floor(Math.random() * 40)}", "Not/A)Brand";v="${10 + Math.floor(Math.random() * 20)}"`,
    "sec-ch-ua-mobile": Math.random() > 0.5 ? "?0" : "?1",
    "sec-ch-ua-platform": Math.random() > 0.5 ? `"Android"` : `"Windows"`,
    "Referer": referers[Math.floor(Math.random() * referers.length)],
    "x-random-header": Math.random().toString(36).substring(2),
    "x-trace-id": Date.now().toString(36) + "-" + Math.floor(Math.random() * 1000000),
    ...extraHeaders
  }
}

class AudioProcessor {
  constructor(inputPath) {
    this.inputPath = inputPath
  }

  async sAIvoice(voiceName = "hutao") {
    const voiceId = voices[voiceName.toLowerCase()] || voices["hutao"]

    const form = new FormData()
    form.append("timestamp", Date.now().toString())
    form.append("file", fs.createReadStream(this.inputPath))
    form.append("voice_id", voiceId)

    const headers = {
      ...generateHeaders(),
      ...form.getHeaders()
    }

    const response = await fetch("https://voxbox-voice-ma-api.imyfone.com/magicmic_web/voice/rvc", {
      method: "POST",
      headers,
      body: form
    })

    const data = await response.json()
    return data?.data || null
  }
}

async function downloadBuffer(url) {
  const res = await fetch(url)
  return await res.buffer()
}


module.exports = {
  command: Object.keys(voices),
  help: Object.keys(voices),
  tags: ['ai'],
  limit: 2,
  run: async (m, { light, command }) => {
    if (isProcessing) {
      await light.type(m.from).text('🚩 *Una solicitud se esta procesando, espera tu turno*', m)
      return false
    }
    const media = await m.types()
    if (!media.isAudio) {
      await light.type(m.from).text('🚩 Responde a un *Audio*', m)
      return false
    }
    isProcessing = true 
    await light.react(m, '🕛')
    let tempFile = null
    try {
      const buffer = await media.download()
      tempFile = path.join(os.tmpdir(), `voice_${Date.now()}.mp3`)
      fs.writeFileSync(tempFile, buffer)

      const voiceName = command.toLowerCase()

      const processor = new AudioProcessor(tempFile)
      const resultUrl = await processor.sAIvoice(voiceName)
      const audioBuffer = await downloadBuffer(resultUrl)
      await light.type(m.from).audio(
        audioBuffer,
        {
          mimetype: 'audio/mpeg',
          fileName: `voice_${voiceName}.mp3`,
          title: 'AI Voice',
          artist: voiceName,
          quoted: m
        }
      )

      await light.react(m, '✅')
      return true

    } catch (err) {
      await light.react(m, '🍮')
      return false
    } finally {
      isProcessing = false 
      try {
        if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
      } catch {}
    }
  }
}