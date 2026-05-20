const axios = require("axios")

class BlackboxAI {
  constructor(options = {}) {
    this.baseURL = "https://app.blackbox.ai"
    this.timeout = options.timeout || 30000

    this.headers = {
      "Content-Type": "application/json",
      "User-Agent":
        options.userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      "Origin": "https://www.blackbox.ai",
      "Referer": "https://www.blackbox.ai/",
      ...(options.headers || {})
    }
  }

  randomId(length = 7) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    let result = ""
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  buildPayload(prompt, options = {}) {
    return {
      messages: [
        {
          role: "user",
          content: prompt,
          id: this.randomId(7)
        }
      ],
      id: this.randomId(7),
      codeModelMode: options.codeModelMode ?? true,
      maxTokens: options.maxTokens ?? 1024,
      userSelectedAgent: options.userSelectedAgent ?? "VscodeAgent",
      validated: options.validated ?? "a38f5889-8fef-46d4-8ede-bf4668b6a9bb"
    }
  }

  async chat(prompt, options = {}) {
    const payload = this.buildPayload(prompt, options)

    try {
      const res = await axios.post(
        `${this.baseURL}/api/chat`,
        payload,
        {
          headers: this.headers,
          timeout: this.timeout,
          responseType: "text",
          validateStatus: () => true
        }
      )

      return {
        success: true,
        status: res.status,
        result: typeof res.data === "string"
          ? res.data.trim()
          : res.data
      }
    } catch (error) {
      return {
        success: false,
        error:
          "" ||
          "" ||
          ""
      }
    }
  }
}

module.exports = {
  command: ['blackbox'],
  help: ['blackbox'],
  tags: ['ai'],
  limit: 1,
  run: async (m, { light, text }) => {
    if (!text) {
      await light.type(m.from).text("🚩 Ingresa su *pregunta*", m)
      return false
    }
    await light.react(m, '🕛')
    try {
      const ai = new BlackboxAI()
      const res = await ai.chat(text)
      let msg = res.result || ""
      msg = msg.toString().slice(0, 10000)
      await light.type(m.from).text(msg, m)
      await light.react(m, '✅')
      return true
    } catch (err) {
      await light.react(m, '🍮')
      return false
    }
  }
}