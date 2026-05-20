const fs = require("fs")
const path = require("path")
const { tmpdir } = require("os")
const ff = require("fluent-ffmpeg")
const webp = require("node-webpmux")
const FileType = require("file-type")

function randomName(ext) {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`
}

async function imageToWebp(media) {
  const tmpFileIn = path.join(tmpdir(), randomName("jpg"))
  const tmpFileOut = path.join(tmpdir(), randomName("webp"))

  fs.writeFileSync(tmpFileIn, media)

  await new Promise((resolve, reject) => {
    ff(tmpFileIn)
      .on("error", reject)
      .on("end", () => resolve(true))
      .addOutputOptions([
        "-vcodec", "libwebp", "-vf",
        "scale=500:500:force_original_aspect_ratio=decrease,setsar=1,pad=500:500:-1:-1:color=white@0.0,split [a][b];[a] palettegen=reserve_transparent=on:transparency_color=ffffff [p];[b][p] paletteuse",
        "-loop", "0", "-preset", "default"
      ])
      .toFormat("webp")
      .save(tmpFileOut)
  })

  const buff = fs.readFileSync(tmpFileOut)
  fs.unlinkSync(tmpFileOut)
  fs.unlinkSync(tmpFileIn)
  return buff
}

async function gifToWebp(media) {
  const tmpFileIn = path.join(tmpdir(), randomName("gif"))
  const tmpFileOut = path.join(tmpdir(), randomName("webp"))

  fs.writeFileSync(tmpFileIn, media)

  await new Promise((resolve, reject) => {
    ff(tmpFileIn)
      .on("error", reject)
      .on("end", () => resolve(true))
      .addOutputOptions([
        "-vf", "scale=512:512:force_original_aspect_ratio=decrease",
        "-loop", "0",
        "-preset", "default",
        "-an", "-vsync", "0"
      ])
      .toFormat("webp")
      .save(tmpFileOut)
  })

  const buff = fs.readFileSync(tmpFileOut)
  fs.unlinkSync(tmpFileOut)
  fs.unlinkSync(tmpFileIn)
  return buff
}

async function videoToWebp(media) {
  const tmpFileIn = path.join(tmpdir(), randomName("mp4"))
  const tmpFileOut = path.join(tmpdir(), randomName("webp"))

  fs.writeFileSync(tmpFileIn, media)

  await new Promise((resolve, reject) => {
    ff(tmpFileIn)
      .on("error", reject)
      .on("end", () => resolve(true))
      .addOutputOptions([
        "-vcodec", "libwebp",
        "-vf", "scale=320:320:force_original_aspect_ratio=disable,setdar=1:1,setsar=1:1,fps=15,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse",
        "-loop", "0",
        "-ss", "00:00:00",
        "-t", "00:00:05",
        "-preset", "default",
        "-an", "-vsync", "0"
      ])
      .toFormat("webp")
      .save(tmpFileOut)
  })

  const buff = fs.readFileSync(tmpFileOut)
  fs.unlinkSync(tmpFileOut)
  fs.unlinkSync(tmpFileIn)
  return buff
}

async function writeExif(media, data = {}) {
  const type = await FileType.fromBuffer(media)
  let wMedia
  if (/webp/.test(type.mime)) wMedia = media
  else if (/gif/.test(type.mime)) wMedia = await gifToWebp(media)
  else if (/jpe?g|png/.test(type.mime)) wMedia = await imageToWebp(media)
  else if (/mp4/.test(type.mime)) wMedia = await videoToWebp(media)
  else return null

  const tmpFileIn = path.join(tmpdir(), randomName("webp"))
  const tmpFileOut = path.join(tmpdir(), randomName("webp"))
  fs.writeFileSync(tmpFileIn, wMedia)

  const img = new webp.Image()
  const packname = data.packname || ""
  const author = data.author || ""

  const json = {
    "sticker-pack-id": "sticker-pack",
    "sticker-pack-name": packname,
    "sticker-pack-publisher": author,
    emojis: [""],
    "is-avatar-sticker": 0
  }

  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00,
    0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
    0x07, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x16, 0x00, 0x00, 0x00
  ])

  const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8")
  const exif = Buffer.concat([exifAttr, jsonBuff])
  exif.writeUIntLE(jsonBuff.length, 14, 4)
  await img.load(tmpFileIn)
  fs.unlinkSync(tmpFileIn)
  img.exif = exif
  await img.save(tmpFileOut)
  const buff = fs.readFileSync(tmpFileOut)
  fs.unlinkSync(tmpFileOut)
  return buff
}

module.exports = { imageToWebp, gifToWebp, videoToWebp, writeExif }
