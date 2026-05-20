const axios = require('axios')
const FormData = require('form-data')

async function translateToEnglish(text) {
  try {
    const url = 'https://translate.googleapis.com/translate_a/single'
    const params = {
      client: 'gtx',
      sl: 'auto',
      tl: 'en',
      dt: 't',
      q: text
    }

    const res = await axios.get(url, { params })
    return res.data?.[0]?.[0]?.[0] || text
  } catch (err) {
    return text
  }
}

async function txtimg(prompt) {
  try {
    const translatedPrompt = await translateToEnglish(prompt)

    const form = new FormData()
    form.append('prompt', translatedPrompt)
    form.append('input_image_type', 'text2image')
    form.append('aspect_ratio', '4x5')
    form.append('guidance_scale', '9.5')
    form.append('controlnet_conditioning_scale', '0.5')

    const response = await axios.post(
      'https://api.creartai.com/api/v2/text2image',
      form,
      {
        headers: form.getHeaders(),
        responseType: 'arraybuffer'
      }
    )
    return Buffer.from(response.data)
  } catch (err) {
    throw new Error(err?.response?.data?.toString?.() || err?.message || String(err))
  }
}

module.exports = {
  command: ['dalle'],
  help: ['dalle'],
  tags: ['tools'],
  limit: 1,

  run: async (m, { light, text }) => {
    try {
      if (!text) {
        return light.type(m.from).text('🚩 Ingrese el *texto* a *generar*', m)
      }
      await light.react(m, '🕛')
      const buffer = await txtimg(text)
      await light.type(m.from).image(buffer, `🚩 Resultado de : *${text}*`, m)
      await light.react(m, '✅')
    } catch (err) {
      await light.react(m, '🚫')
    }
  }
}