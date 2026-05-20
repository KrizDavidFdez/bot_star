const fs = require('fs')
const os = require('os')
const path = require('path')
const axios = require('axios')
const FormData = require('form-data')
const fetch = require('node-fetch')

async function vocalremove(file) {
  try {
    const form = new FormData()
    form.append('fileName', fs.createReadStream(file))

    return await axios.post(
      'https://aivocalremover.com/api/v2/FileUpload',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10)'
        }
      }
    ).then(async function (r) {
      const body = new URLSearchParams({
        file_name: r.data.file_name,
        action: 'watermark_video',
        key: 'X9QXlU9PaCqGWpnP1Q4IzgXoKinMsKvMuMn3RYXnKHFqju8VfScRmLnIGQsJBnbZFdcKyzeCDOcnJ3StBmtT9nDEXJn',
        web: 'web'
      })

      return await axios.post(
        'https://aivocalremover.com/api/v2/ProcessFile',
        body,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10)',
            'Content-Type': 'application/x-www-form-urlencoded',
            origin: 'https://aivocalremover.com',
            referer: 'https://aivocalremover.com/'
          }
        }
      ).then(function (x) {
        if (!x?.data?.instrumental_path && !x?.data?.vocal_path) {
        }
        return {
          status: 'success',
          instrumental: x.data.instrumental_path || null,
          vocal: x.data.vocal_path || null
        }
      })
    })

  } catch (e) {
    return { status: 'error', msg: e.message }
  }
}

async function downloadBuffer(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  })
  return Buffer.from(await res.arrayBuffer())
}

module.exports = {
  command: ['removocal'],
  help: ['removocal'],
  tags: ['tools'],
  limit: 2,
  run: async (m, { light }) => {
    const media = await m.types()

    if (!media.isVideo && !media.isAudio) {
      await light.type(m.from).text('🚩 Responde a un *Audio*', m)
      return false
    }

    await light.react(m, '🕛')

    let tempFile = null

    try {
      const buffer = await media.download()
      const ext = media.isVideo ? 'mp4' : 'mp3'
      tempFile = path.join(os.tmpdir(), `removocal_${Date.now()}.${ext}`)

      fs.writeFileSync(tempFile, buffer)

      const result = await vocalremove(tempFile)
      if (result.instrumental) {
        const instrumentalBuffer = await downloadBuffer(result.instrumental)
        await light.type(m.from).audio(
          instrumentalBuffer,
          {
            mimetype: 'audio/mpeg',
            fileName: `instrumental_${Date.now()}.mp3`,
            title: 'Ai remove',
            artist: 'Instrumental',
            quoted: m
          }
        )
      }
      if (result.vocal) {
        const vocalBuffer = await downloadBuffer(result.vocal)
        await light.type(m.from).audio(
          vocalBuffer,
          {
            mimetype: 'audio/mpeg',
            fileName: `vocal_${Date.now()}.mp3`,
            title: 'Ai Remove',
            artist: 'Vocal',
            quoted: m
          }
        )
      }
      await light.react(m, '✅')
      return true
    } catch (err) {
      await light.react(m, '🍮')
      return false
    } finally {
      try {
        if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
      } catch {
      }
    }
  }
}