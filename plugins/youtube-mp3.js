const axios = require("axios")
const fs = require("fs")
const { pipeline } = require("stream/promises")
const { promisify } = require("util")
const stream = require("stream")
const finished = promisify(stream.finished)

// ⚡🔥 MÁXIMA VELOCIDAD - Descarga con chunks paralelos
class UltraFastDownloader {
  constructor(concurrentChunks = 5) {
    this.concurrentChunks = concurrentChunks
    this.activeDownloads = new Map()
  }

  async downloadAudio(url, options = {}) {
    const {
      maxRetries = 3,
      chunkSize = 1024 * 1024 * 9, // 9MB chunks
      showProgress = true
    } = options

    try {
      console.log("🚀 Iniciando descarga ultra rápida...")

      // 1️⃣ Obtener metadata
      const metadata = await this._fetchMetadata(url)
      
      // 2️⃣ Descarga paralela por chunks
      const result = await this._parallelDownload(
        metadata.audioUrl,
        metadata.filename,
        metadata.size,
        chunkSize,
        showProgress
      )

      console.log("✅ Descarga completada en", result.duration, "segundos")
      
      return {
        ...metadata,
        path: `./${metadata.filename}`,
        speed: result.speed,
        source: 'ultrafast-chunks'
      }

    } catch (error) {
      console.error("❌ Error en descarga rápida:", error.message)
      throw error
    }
  }

  async _fetchMetadata(url) {
    const { data } = await axios.get(
      `https://ytdlss-7l8w.vercel.app/api/index?url=${encodeURIComponent(url)}`,
      { timeout: 15000 }
    )

    if (!data?.success || !data?.audio?.url) {
      throw new Error("No se encontró audio")
    }

    // Head request para obtener tamaño real
    const headRes = await axios.head(data.audio.url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    })
    
    const size = Number(headRes.headers["content-length"] || 0)

    return {
      audioUrl: data.audio.url,
      title: data.title || "audio",
      filename: data.audio.filename || `${data.title.replace(/[\\/:*?"<>|]/g, "_")}.mp3`,
      size,
      duration: data.duration || 0
    }
  }

  async _parallelDownload(url, filename, totalSize, chunkSize, showProgress) {
    const startTime = Date.now()
    const tempDir = `./temp_${Date.now()}`
    fs.mkdirSync(tempDir, { recursive: true })

    try {
      if (totalSize === 0) {
        // Si no sabemos el tamaño, descarga normal optimizada
        return await this._streamDownload(url, filename, showProgress)
      }

      // 🔥 Dividir en chunks
      const chunks = []
      for (let start = 0; start < totalSize; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, totalSize - 1)
        chunks.push({ start, end, index: chunks.length })
      }

      console.log(`📦 Descargando en ${chunks.length} chunks paralelos...`)

      // Descarga paralela controlada
      let completed = 0
      let downloadedBytes = 0
      const progressInterval = showProgress ? setInterval(() => {
        const progress = ((downloadedBytes / totalSize) * 100).toFixed(1)
        const speed = (downloadedBytes / ((Date.now() - startTime) / 1000) / 1024 / 1024).toFixed(1)
        process.stdout.write(`\r⚡ Progreso: ${progress}% | ${speed} MB/s   `)
      }, 200) : null

      // Procesar chunks en lotes
      for (let i = 0; i < chunks.length; i += this.concurrentChunks) {
        const batch = chunks.slice(i, i + this.concurrentChunks)
        const batchPromises = batch.map(chunk => 
          this._downloadChunk(url, tempDir, chunk)
            .then(result => {
              downloadedBytes += chunk.end - chunk.start + 1
              completed++
              return result
            })
        )
        await Promise.all(batchPromises)
      }

      if (progressInterval) {
        clearInterval(progressInterval)
        process.stdout.write('\n')
      }

      // Combinar chunks en orden
      console.log("🔧 Combinando chunks...")
      await this._mergeChunks(tempDir, filename, chunks.length)

      const endTime = Date.now()
      const duration = ((endTime - startTime) / 1000).toFixed(2)
      const speed = (totalSize / ((endTime - startTime) / 1000) / 1024 / 1024).toFixed(2)

      return { duration, speed: `${speed} MB/s` }

    } finally {
      // Limpiar archivos temporales
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  }

  async _downloadChunk(url, tempDir, chunk) {
    const { start, end, index } = chunk
    
    try {
      const response = await axios({
        url,
        method: "GET",
        responseType: "stream",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Range": `bytes=${start}-${end}`
        },
        timeout: 30000
      })

      const chunkFile = `${tempDir}/chunk_${index}`
      const writer = fs.createWriteStream(chunkFile)
      
      response.data.pipe(writer)
      await finished(writer)

      return { index, file: chunkFile }
    } catch (error) {
      console.error(`Error en chunk ${index}:`, error.message)
      throw error
    }
  }

  async _mergeChunks(tempDir, outputFile, totalChunks) {
    const writer = fs.createWriteStream(outputFile)
    
    for (let i = 0; i < totalChunks; i++) {
      const chunkFile = `${tempDir}/chunk_${i}`
      if (fs.existsSync(chunkFile)) {
        const reader = fs.createReadStream(chunkFile)
        reader.pipe(writer, { end: false })
        await finished(reader)
      }
    }
    
    writer.end()
    await finished(writer)
  }

  async _streamDownload(url, filename, showProgress) {
    const startTime = Date.now()
    
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
      headers: { "User-Agent": "Mozilla/5.0" }
    })

    let downloaded = 0
    if (showProgress) {
      response.data.on("data", chunk => {
        downloaded += chunk.length
        if (downloaded % (1024 * 1024) < chunk.length) {
          process.stdout.write(`\r📥 Descargado: ${(downloaded / 1024 / 1024).toFixed(1)} MB`)
        }
      })
    }

    await pipeline(response.data, fs.createWriteStream(filename))
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    const speed = (downloaded / ((Date.now() - startTime) / 1000) / 1024 / 1024).toFixed(2)

    return { duration, speed: `${speed} MB/s` }
  }
}

// ========== RESPALDO Y2MATE (sin eliminar nada) ==========
// Cliente optimizado para streaming
const streamClient = axios.create({
  timeout: 30000,
  responseType: 'stream',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive'
  }
})

// Cliente para la API de respaldo (y2mate)
const backupClient = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10)',
    'Accept': '*/*',
    'Origin': 'https://y2mate.com',
    'Referer': 'https://y2mate.com/'
  }
})

// Función para obtener audio desde y2mate
async function tryY2mateAudio(url) {
  try {
    console.log("🎵 Usando y2mate como respaldo para audio...")
    
    // Obtener key de sanity
    const { data: keyData } = await backupClient.get(
      'https://api.y2mate.com/sanity/key'
    )

    const key = keyData.key || keyData.data?.key || keyData

    const params = new URLSearchParams({
      link: url,
      format: 'mp3',
      audioBitrate: '128',
      filenameStyle: 'pretty'
    })

    const { data } = await backupClient.post(
      'https://api.y2mate.com/v2/converter',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          key
        }
      }
    )

    if (!data.url && !data.downloadUrl) {
      throw new Error("No download URL from y2mate")
    }

    const audioUrl = data.url || data.downloadUrl
    const filename = data.filename || 'audio.mp3'
    
    console.log("✅ URL obtenida de y2mate, descargando...")
    
    // Descargar el audio completo (buffer)
    const audioData = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 90000
    })
    
    console.log(`✅ Audio descargado de respaldo: ${(audioData.data.byteLength / 1024 / 1024).toFixed(2)} MB`)
    
    return {
      buffer: Buffer.from(audioData.data),
      filename: filename,
      title: filename.replace('.mp3', ''),
      size: audioData.data.byteLength,
      source: 'y2mate'
    }
    
  } catch (error) {
    console.log("❌ y2mate falló:", error.message)
    throw error
  }
}

// Función principal: PRIMERO ultrafast, SEGUNDO y2mate
async function tryYtmp3(url, options = {}) {
  // 🚀 PRIMERA OPCIÓN: Descarga ultra rápida con chunks paralelos
  try {
    const downloader = new UltraFastDownloader(
      options.concurrentChunks || 8  // 8 conexiones paralelas por defecto
    )
    
    const result = await downloader.downloadAudio(url, {
      chunkSize: options.chunkSize || 1024 * 1024 * 9, // 9MB chunks
      showProgress: options.showProgress !== false
    })
    
    // Leer el archivo descargado y devolverlo como buffer
    const buffer = fs.readFileSync(result.path)
    fs.unlinkSync(result.path) // Limpiar archivo temporal
    
    return {
      buffer: buffer,
      filename: result.filename,
      title: result.title,
      size: result.size,
      source: 'ultrafast-chunks'
    }
    
  } catch (error) {
    // 🎵 SEGUNDA OPCIÓN: y2mate como respaldo
    console.log("⚠️ Falló descarga ultra rápida, usando y2mate como respaldo...")
    return await tryY2mateAudio(url)
  }
}

// Función para enviar archivo por partes (chunks) si es muy grande
async function sendLargeFile(light, m, buffer, filename, title, size) {
  if (size > 120 * 1024 * 1024) {
    return light.type(m.from).text(
      '🚩 El audio supera el límite de *120MB*',
      m
    )
  }

  if (size > 70 * 1024 * 1024) {
    await light.sock.sendMessage(m.from, {
      document: buffer,
      mimetype: 'audio/mpeg',
      fileName: filename,
      caption: `${title || filename}`
    }, { quoted: m })
  } else {
    await light.type(m.from).audio(buffer, {
      title: title || '',
      artist: null,
      quoted: m
    })
  }
}

module.exports = {
  command: ['yta', 'ytmp3'],
  help: ['ytmp3'],
  tags: ['downloader'],
  limit: 1,

  run: async (m, { light, text }) => {
    if (!text) {
      return light.type(m.from).text(
        '🚩 Ingresa la *Url* de *YouTube*', m 
      )
    }

    await light.react(m, '🕛')

    try {
      const result = await tryYtmp3(text, {
        concurrentChunks: 8,  // 🔥 8 conexiones paralelas
        chunkSize: 1024 * 1024 * 9,  // 9MB por chunk
        showProgress: true
      })
      
      // Enviar el audio
      await sendLargeFile(light, m, result.buffer, result.filename, result.title, result.size)

      console.log(`✅ Audio enviado desde: ${result.source === 'ultrafast-chunks' ? 'Descarga Ultra Rápida (Chunks Paralelos)' : 'Respaldo (y2mate)'}`)
      await light.react(m, '✅')

    } catch (e) {
      console.error("Error en yta:", e)
      await light.react(m, '🍮')
      await light.type(m.from).text(
        '🚩 Error al descargar el audio. Intenta de nuevo más tarde.',
        m
      )
    }
  }
}