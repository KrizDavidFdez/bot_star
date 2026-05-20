const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const FileType = require('file-type')

async function getFile(PATH, save = false) {
    let filename
    const data = Buffer.isBuffer(PATH)
        ? PATH
        : /^data:.*?\/.*?;base64,/i.test(PATH)
        ? Buffer.from(PATH.split(',')[1], 'base64')
        : /^https?:\/\//.test(PATH)
        ? await (await fetch(PATH)).buffer()
        : fs.existsSync(PATH)
        ? (filename = PATH, fs.readFileSync(PATH))
        : typeof PATH === 'string'
        ? Buffer.from(PATH)
        : Buffer.alloc(0)
    const type = (await FileType.fromBuffer(data)) || {
        mime: 'application/octet-stream',
        ext: 'bin'
    }
    if (save && !filename) {
        const dir = path.join(__dirname, '../tmp')
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
        filename = path.join(dir, Date.now() + '.' + type.ext)
        await fs.promises.writeFile(filename, data)
    }
    return {
        filename,
        mime: type.mime,
        ext: type.ext,
        data,
        buffer: data, 
        deleteFile() {
            return filename && fs.promises.unlink(filename)
        }
    }
}
module.exports = { getFile }
