const { getContentType, proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys')
const { getFile } = require('./getfile') 
const NodeID3 = require('node-id3')
const fetch = require('node-fetch')
const config = require('../config.json')
const crypto = require("crypto")

function bailMessage(sock) {
  async function fetchBuffer(url, options = {}) {
    try {
      const res = await fetch(url, options)
      const buffer = await res.arrayBuffer()
      return Buffer.from(buffer)
    } catch (err) {}
  }

  async function sendButtonQuick(
    jid,
    text = '',
    footer = '',
    media = null,
    buttons = [],
    quoted = null,
    copy = null,
    urls = [],
    options = {}
  ) {
    try {
      if (Array.isArray(buttons) && buttons.length && !Array.isArray(buttons[0]) && typeof buttons[0] === 'string') {
        buttons = [buttons]
      }

      const newbtns = []

      if (Array.isArray(urls)) {
        urls.forEach(url => {
          if (!Array.isArray(url) || url.length < 2) return
          newbtns.push({
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: url[0],
              url: url[1],
              merchant_url: url[1]
            })
          })
        })
      }

      ;(buttons || []).forEach(btn => {
        newbtns.push({
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: btn[0],
            id: btn[1]
          })
        })
      })

      if (copy !== undefined && copy !== null && (typeof copy === 'string' || typeof copy === 'number')) {
        newbtns.push({
          name: 'cta_copy',
          buttonParamsJson: JSON.stringify({
            display_text: 'Copy',
            copy_code: String(copy)
          })
        })
      }

      let header = { hasMediaAttachment: false }
      if (media) {
        let input = media
        if (typeof media === 'object' && media.url) input = media.url
        const file = await getFile(input)
        const isImage = /image/.test(file.mime || '')
        const isVideo = /video/.test(file.mime || '')

        if (isImage || isVideo) {
          const prepared = await prepareWAMessageMedia(
            { [isImage ? 'image' : 'video']: file.data },
            { upload: sock.waUploadToServer }
          )
          const mimeKey = isImage ? 'imageMessage' : 'videoMessage'
          header = {
            hasMediaAttachment: true,
            [mimeKey]: prepared[mimeKey]
          }
        }
      }

      const interactiveMessage = {
        body: { text },
        footer: { text: footer },
        header,
        nativeFlowMessage: {
          buttons: newbtns,
          messageParamsJson: ''
        }
      }

      const msgL = generateWAMessageFromContent(
        jid,
        {
          viewOnceMessage: {
            message: {
              interactiveMessage,
              messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }
            }
          }
        },
        { userJid: sock.user?.id, quoted }
      )

      return await sock.relayMessage(jid, msgL.message, { messageId: msgL.key.id, ...options })
    } catch (e) {
      return sock.sendMessage(jid, { text }, { quoted })
    }
  }

  
  async function sendMessage(jid, options = {}, opts = {}) {
    let content
    if (options?.media) {
      const { mime, buffer } = await getFile(options.media)

      let mtype = ''
      if (/webp/.test(mime)) mtype = 'sticker'
      else if (/image/.test(mime)) mtype = 'image'
      else if (/video/.test(mime)) mtype = (Buffer.byteLength(buffer) >= 104857600 ? 'document' : 'video')
      else if (/audio/.test(mime)) mtype = 'audio'
      else mtype = 'document'

      delete options.media
      content = { [mtype]: buffer, mimetype: mime, ...options }
    } else if (options?.image || options?.video || options?.document || options?.sticker || options?.audio) {
      const mediaType = Object.keys(options).find(key =>
        ['image', 'video', 'document', 'sticker', 'audio'].includes(key)
      )
      content = { ...options, [mediaType]: (await getFile(options[mediaType])).buffer }
    } else {
      content = { ...options }
    }

    return sock.sendMessage(jid, content, opts)
  }

  async function sendList(chatId, title = '', text = '', buttonText = '', buffer = null, listSections = [], quoted = null, options = {}) {
    let media
    if (buffer) {
      try {
        const file = await getFile(buffer)
        const isImage = /image/.test(file.mime || '')
        const isVideo = /video/.test(file.mime || '')
        if (isImage || isVideo) {
          media = await prepareWAMessageMedia(
            { [isImage ? 'image' : 'video']: file.data },
            { upload: sock.waUploadToServer || ((buf) => buf) } 
          )
        }
      } catch (err) {
      }
    }

    const interactiveMessage = {
      body: { text },
      footer: { text: options.footer || '' },
      header: {
        title,
        hasMediaAttachment: Boolean(media),
        imageMessage: media?.imageMessage,
        videoMessage: media?.videoMessage
      },
      nativeFlowMessage: {
        buttons: [
          {
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: buttonText || 'Seleccionar',
              sections: listSections
            })
          }
        ],
        messageParamsJson: ''
      }
    }

    const msgL = generateWAMessageFromContent(
      chatId,
      { viewOnceMessage: { message: { interactiveMessage } } },
      { userJid: sock.user?.id, quoted }
    )

    return await sock.relayMessage(chatId, msgL.message, { messageId: msgL.key.id })
  }
return {
    type(chatId) {
      return {
        text: (txt, quoted = null, extra = {}) => 
  sock.sendMessage(chatId, { text: txt, ...global.replyy }, { quoted, ...extra }), 
        image: (buffer, caption = '', quoted = null) => sock.sendMessage(chatId, { image: buffer, caption }, { quoted }),
        audio: async (buffer, { ptt = false, title, artist, image, quoted = null } = {}) => {
          try {
            const tags = {}
            if (title) tags.title = title
            if (artist) tags.artist = artist
            if (image) tags.image = image
            const tagged = NodeID3.write(tags, buffer)
            return await sock.sendMessage(chatId, { audio: tagged, ptt, mimetype: 'audio/mpeg' }, { quoted })
          } catch (err) {
            return sock.sendMessage(chatId, { audio: buffer, ptt, mimetype: 'audio/mpeg' }, { quoted })
          }
        },
       /* video: (buffer, caption = '', quoted = null) => sock.sendMessage(chatId, { video: buffer, caption }, { quoted }),*/
      video: (buffer, caption = '', quoted = null, options = {}) => {
  var fileName = options.fileName || ''
  var typemsg = options.asDocument
    ? { document: buffer, mimetype: 'video/mp4', fileName, caption }
    : { video: buffer, caption }
  return sock.sendMessage(chatId, typemsg, { quoted })},
        sticker: (buffer, quoted = null) => sock.sendMessage(chatId, { sticker: buffer }, { quoted }),
        list: sendList,
        fetchBuffer
      }
    },
    send: {
      text: (chatId, txt, quoted = null) => sock.sendMessage(chatId, { text: txt }, { quoted }),
      image: (chatId, buffer, caption = '', quoted = null) => sock.sendMessage(chatId, { image: buffer, caption }, { quoted }),
      audio: async (chatId, buffer, options = {}) => {
        const { ptt = false, title, artist, image, quoted = null } = options
        try {
          const tags = {}
          if (title) tags.title = title
          if (artist) tags.artist = artist
          if (image) tags.image = image
          const tagged = NodeID3.write(tags, buffer)
          return await sock.sendMessage(chatId, { audio: tagged, ptt, mimetype: 'audio/mpeg' }, { quoted })
        } catch {
          return sock.sendMessage(chatId, { audio: buffer, ptt, mimetype: 'audio/mpeg' }, { quoted })
        }
      },
      video: (chatId, buffer, caption = '', quoted = null) => sock.sendMessage(chatId, { video: buffer, caption }, { quoted }),
      sticker: (chatId, buffer, quoted = null) => sock.sendMessage(chatId, { sticker: buffer }, { quoted })
    },
    Api: {
      get: async (endpoint, options = {}) => {
        const url = `${config.api.light}${endpoint}`
        const params = options.params ? new URLSearchParams(options.params).toString() : ''
        const fullUrl = params ? `${url}?${params}` : url
        const res = await fetch(fullUrl)
        return await res.json()
      }
    },
    button: (chatId, text = '', footer = '', media = null, buttons = [], quoted = null, copy = null, urls = [], options = {}) =>
  sendButtonQuick(chatId, text, footer, media, buttons, quoted, copy, urls, { ...global.rcanal, ...options }),
    /*button: (chatId, text = '', footer = '', media = null, buttons = [], quoted = null, copy = null, urls = [], options = {}) =>
      sendButtonQuick(chatId, text, footer, media, buttons, quoted, copy, urls, options),*/
    list: (chatId, title, text, buttonText, buffer, listSections, quoted = null, options = {}) =>
    sendMessage,
    reply: (m, txt) => sock.sendMessage(m.from, { text: txt }, { quoted: m }),
    react: (m, emoji) => sock.sendMessage(m.from, { react: { text: emoji, key: m.key } }),
    config
  }
}

module.exports = { bailMessage }






   





