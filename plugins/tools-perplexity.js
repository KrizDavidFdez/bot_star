const axios = require('axios')
const { v4: uuidv4 } = require('uuid')

const ANDROID_ID = '0a0000000002f59a'

const perplexity = {
  handleSSE: function (response) {
    return new Promise((resolve, reject) => {
      let finalData = null
      let buffer = ''

      response.data.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')

        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = line.substring(6).trim()
              if (jsonData === '{}') continue

              const data = JSON.parse(jsonData)

              if (data.final === true || data.status === 'COMPLETED') {
                finalData = data
              }
            } catch {
              continue
            }
          }
        }
      })

      response.data.on('end', () => {
        let fullAnswer = ''
        let chunks = []
        let webResults = []

        if (finalData && finalData.blocks) {
          const markdownBlock = finalData.blocks.find(
            (b) => b.intended_usage === 'ask_text' && b.markdown_block
          )

          if (markdownBlock?.markdown_block) {
            if (markdownBlock.markdown_block.answer) {
              fullAnswer = markdownBlock.markdown_block.answer
            } else if (markdownBlock.markdown_block.chunks) {
              chunks = markdownBlock.markdown_block.chunks
              fullAnswer = chunks.join('')
            }
          }
        }

        try {
          const parsedSteps = JSON.parse(finalData?.text || '[]')
          const searchStep = parsedSteps.find(
            (s) => s.step_type === 'SEARCH_RESULTS'
          )
          if (searchStep?.content?.web_results) {
            webResults = searchStep.content.web_results
          }
        } catch {}

        resolve({
          answer: fullAnswer,
          chunks,
          source: webResults,
          relatedQueries: finalData?.related_queries || []
        })
      })

      response.data.on('error', reject)
    })
  },

  chat: async function (query) {
    const data = JSON.stringify({
      query_str: query,
      params: {
        source: 'android',
        version: '2.17',
        frontend_uuid: uuidv4(),
        android_device_id: ANDROID_ID,
        mode: 'concise',
        timezone: 'America/Lima',
        language: 'es',
        query_source: 'home',
        use_schematized_api: true,
        sources: ['web'],
        model_preference: 'turbo'
      }
    })

    const config = {
      method: 'POST',
      url: 'https://www.perplexity.ai/rest/sse/perplexity_ask',
      headers: {
        'User-Agent':
          'Ask/2.51.0 (Android 12)',
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        'x-device-id': `android:${ANDROID_ID}`
      },
      data,
      responseType: 'stream'
    }

    const res = await axios.request(config)
    return await this.handleSSE(res)
  }
}

module.exports = {
  command: ['perplexity'],
  help: ['perplexity'],
  tags: ['ai'],
  limit: 1,
  run: async (m, { light, text }) => {
    if (!text) {
      await light.type(m.from).text("🚩 Ingresa su *pregunta*", m)
      return false
    }
    await light.react(m, '🕛')
    try {
      const res = await perplexity.chat(text)
      let msg = res.answer || ''
      if (res.source?.length) {
        msg += '\n\n🚩 *Fuentes* :\n'
        msg += res.source.slice(0, 3)
          .map((s, i) => `${i + 1}. ${s.name || s.url}`)
          .join('\n')
      }
      await light.type(m.from).text(msg, m)
      await light.react(m, '✅')
      return true
    } catch (e) {
      await light.react(m, '🍮')
      return false
    }
  }
}