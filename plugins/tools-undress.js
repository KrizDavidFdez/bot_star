const axios = require("axios")
const fs = require("fs")
const path = require("path")
const os = require("os")

class SwapfacesClient {
  constructor(options = {}) {
    this.baseURL = "https://api.swapfaces.ai/api"
    this.filesBase = "https://files.swapfaces.ai"
    this.website = options.website || "swapfaces"
    this.timeout = options.timeout || 30000
    this.token = options.token || null

    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        "User-Agent":
          options.userAgent ||
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36",
        Accept: "application/json, text/plain,",
      },
    })
  }

  _authHeaders(extra = {}) {
    return this.token
      ? { ...extra, Authorization: this.token }
      : { ...extra }
  }

  _randomDevice() {
    return {
      userAgent:
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36",
      lang: "en-US",
      platform: "Linux armv81",
      screenWidth: 424,
      screenHeight: 949,
      screenColorDepth: 24,
      screenPixelDepth: 24,
      audioFingerprint: Number((Math.random() * 200).toFixed(12)),
    }
  }

  async _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async loginGuest() {
    const { data } = await this.http.post("/account/login", {
      platform: "guest",
      device: this._randomDevice(),
      website: this.website,
    })
    this.token = data.result.token
  }

  async getPresign({ actionType = "image_image_to_image", contentType = "image/jpeg" } = {}) {
    const { data } = await this.http.post("/upload/presign", null, {
      params: { action_type: actionType, content_type: contentType },
      headers: this._authHeaders(),
    })
    return data
  }

  async uploadFile(localPath) {
    const presign = await this.getPresign()
    const { presignUrl, url } = presign.result

    const fileBuffer = fs.readFileSync(localPath)

    await axios.put(presignUrl, fileBuffer, {
      headers: { "Content-Type": "image/jpeg" },
    })

    return url
  }

  async imageToImage({ imageUrl, style }) {
    const { data } = await this.http.post("/image/image-to-image", {
      imageUrl,
      style,
      website: this.website,
    }, {
      headers: this._authHeaders({ "Content-Type": "application/json" }),
    })

    return data
  }

  async getActionHistory() {
    const { data } = await this.http.post("/account/action/history", {
      offset: 0,
      limit: 30,
      actionTypes: ["image_image_to_image"],
      website: this.website,
    }, {
      headers: this._authHeaders({ "Content-Type": "application/json" }),
    })

    return data
  }

  async waitForAction(actionId) {
    const start = Date.now()

    while (Date.now() - start < 120000) {
      const history = await this.getActionHistory()
      const item = history?.result?.find(x => x.id === actionId)

      if (item?.status === "success") {
        let parsed = null
        try {
          parsed = JSON.parse(item.response)
        } catch {
          parsed = item.response
        }
        return parsed?.resultUrl
      }

      await this._sleep(2000)
    }
  }

  async runImageToImage({ filePath, style }) {
    if (!this.token) await this.loginGuest()

    const uploadedUrl = await this.uploadFile(filePath)
    const create = await this.imageToImage({ imageUrl: uploadedUrl, style })
    return await this.waitForAction(create?.actionId)
  }
}

module.exports = {
  command: ['undress'],
  help: ['undress'],
  tags: ['tools'],
  limit: 1,
  run: async (m, { light }) => {
    const media = await m.types()

    if (!media.isImage) {
      await light.type(m.from).text("🚩 Responde a una *Imagen*", m)
      return false
    }

    await light.react(m, '🕛')

    let tempFile = null

    try {
      const buffer = await m.download()
      tempFile = path.join(os.tmpdir(), `undress_${Date.now()}.jpg`)
      fs.writeFileSync(tempFile, buffer)

      const client = new SwapfacesClient()

      const resultUrl = await client.runImageToImage({
        filePath: tempFile,
        style: "undress"
      })
      const img = await light.type(m.from).fetchBuffer(resultUrl)

      await light.type(m.from).image(img, '', m)
      await light.react(m, '✅')
      return true

    } catch (err) {
      await light.react(m, '🍮')
      return false
    } finally {
      try {
        if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
      } catch {}
    }
  }
}