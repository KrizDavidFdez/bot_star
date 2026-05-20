const { downloadContentFromMessage, jidDecode } = require('@whiskeysockets/baileys')
const path = require('path')
const fs = require('fs')
const chokidar = require('chokidar')
const { getUser, loadDatabase, db, saveDB } = require('./lib/db')
const { logs } = require('./lib/logs')
const fetch = require('node-fetch')

loadDatabase()
const processedMessagesByBot = new Map()

function getBotProcessedMap(sock) {
  const botId = decodeJid(sock?.user?.id || 'unknown-bot')
  if (!processedMessagesByBot.has(botId)) {
    processedMessagesByBot.set(botId, new Map())
  }
  return processedMessagesByBot.get(botId)
}

function hasProcessed(sock, id) {
  const map = getBotProcessedMap(sock)
  const entry = map.get(id)
  if (!entry) return false
  if (Date.now() - entry > 5 * 60 * 1000) {
    map.delete(id)
    return false
  }
  return true
}

function markProcessed(sock, id) {
  const map = getBotProcessedMap(sock)
  map.set(id, Date.now())
  setTimeout(() => {
    try { map.delete(id) } catch {}
  }, 5 * 60 * 1000)
}

setInterval(() => {
  const now = Date.now()
  for (const [, botMap] of processedMessagesByBot.entries()) {
    for (const [id, ts] of botMap.entries()) {
      if (now - ts > 5 * 60 * 1000) botMap.delete(id)
    }
  }
}, 60 * 1000)

let plugins = []
let watcher = null
let pluginsLoaded = false

function decodeJid(jid) {
  if (!jid) return ''
  if (typeof jid !== 'string') return ''
  
  try {
    const result = jidDecode(jid)
    if (!result || typeof result !== 'object') {
      return String(jid).replace(/:\d+@/g, '@').replace(/:\d+$/, '').trim()
    }
    const user = result.user ? String(result.user).replace(/:\d+$/, '') : ''
    const server = result.server || ''
    if (user && server) {
      return `${user}@${server}`
    }
    return String(jid).replace(/:\d+@/g, '@').replace(/:\d+$/, '').trim()
  } catch (err) {
    return String(jid).replace(/:\d+@/g, '@').replace(/:\d+$/, '').trim()
  }
}

function jidEqual(a, b) {
  return decodeJid(a) === decodeJid(b)
}

function normalizeJid(jid) {
  if (!jid) return ''
  return String(jid).replace(/:\d+@/g, '@').replace(/:\d+$/, '').trim()
}

function participantMatch(p, jid) {
  if (!p || !jid) return false
  const targets = [
    p.jid,
    p.id,
    p.phoneNumber
  ].filter(Boolean).map(normalizeJid)
  const targetJid = normalizeJid(jid)
  return targets.includes(targetJid)
}

function isAdminParticipant(p) {
  const admin = String(p?.admin || '').replace(/\s/g, '').toLowerCase()
  return admin === 'admin' || admin === 'superadmin'
}

function getContentType(message = {}) {
  return Object.keys(message).find(
    k => k !== 'senderKeyDistributionMessage' && k !== 'messageContextInfo'
  )
}

async function getGroupMetadataSafe(sock, jid) {
  try {
    if (!jid.endsWith('@g.us')) return null
    return await sock.groupMetadata(jid)
  } catch {
    return null
  }
}

function getAdmins(participants = []) {
  return participants
    .filter(p => isAdminParticipant(p))
    .map(p => normalizeJid(p.jid || p.phoneNumber || p.id))
}

async function downloadMediaMessage(message, sock) {
  try {
    if (!message) return null
    let msgObj

    if (message.message) msgObj = message
    else if (message.quoted && message.quoted.message) msgObj = message.quoted
    else if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      const quoted = message.message.extendedTextMessage.contextInfo.quotedMessage
      const type = Object.keys(quoted)[0]
      msgObj = { message: { [type]: quoted[type] }, key: message.key }
    } else return null

    const type = Object.keys(msgObj.message)[0]
    const stream = await downloadContentFromMessage(msgObj.message[type], type.replace('Message', ''))

    let buffer = Buffer.from([])
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
    return buffer
  } catch {
    return null
  }
}

async function types(m, sock) {
  if (!m) return {}

  let media = m
  if (m.quoted) media = m.quoted
  else if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    const quoted = m.message.extendedTextMessage.contextInfo.quotedMessage
    const type = Object.keys(quoted)[0]
    media = { message: { [type]: quoted[type] }, key: m.key, type }
  }

  const type = media.type || Object.keys(media.message || {})[0] || 'conversation'
  const content = media.message ? media.message[type] : null
  const mime = media?.mime || content?.mimetype || ''
  const text = content?.caption || content?.text || content?.conversation || ''
  const download = async () => await downloadMediaMessage(media, sock)

  const isImage    = /image/.test(type)    || /image/.test(mime)
  const isVideo    = /video/.test(type)    || /video/.test(mime)
  const isSticker  = /sticker/.test(type)  || /webp/.test(mime)
  const isAudio    = /audio/.test(type)    || /audio/.test(mime)
  const isDocument = /document/.test(type) || /application/.test(mime)
  const isGif      = /gif/.test(type)      || /gif/.test(mime)
  const isViewOnce  = type === 'viewOnceMessage'
  const isEphemeral = type === 'ephemeralMessage'
  const isMedia = isImage || isVideo || isSticker || isAudio || isDocument || isGif

  return {
    quoted: media,
    type, mime, text, download,
    isMedia, isImage, isVideo, isSticker,
    isAudio, isDocument, isGif, isViewOnce, isEphemeral
  }
}

function isValidPlugin(plugin) {
  return plugin && (
    plugin.command ||
    plugin.help    ||
    plugin.run     ||
    plugin.before  ||
    plugin.after
  )
}

function normalizePlugin(plugin, fileName, filePath) {
  return { ...plugin, __filename: fileName, __filepath: filePath }
}

function addOrUpdatePlugin(filePath, eventType = 'loaded') {
  const fileName = path.basename(filePath)
  if (!fileName.endsWith('.js')) return
  if (fileName === 'MessagesUpsert.js') return
  if (!fs.existsSync(filePath)) return

  try {
    delete require.cache[require.resolve(filePath)]
    const plugin = require(filePath)

    if (!isValidPlugin(plugin)) {
      console.log(`\x1b[31m🚩 Plugin inválido ignorado: ${fileName}\x1b[0m`)
      return
    }

    const normalized = normalizePlugin(plugin, fileName, filePath)
    const index = plugins.findIndex(p => p.__filename === fileName)
    if (index !== -1) plugins[index] = normalized
    else plugins.push(normalized)

    const icon = eventType === 'loaded' ? '📦' : (eventType === 'added' ? '➕' : '🔄')
    console.log(`\x1b[32m${icon} Plugin '${fileName}' ${eventType}.\x1b[0m`)
  } catch (err) {
    console.error(`\x1b[31m🚩 Error en plugin '${fileName}':\x1b[0m`, err.message)
  }
}

function removePlugin(filePath) {
  const fileName = path.basename(filePath)
  const index = plugins.findIndex(p => p.__filename === fileName)
  if (index !== -1) {
    plugins.splice(index, 1)
    console.log(`\x1b[33m🗑️ Plugin '${fileName}' eliminado.\x1b[0m`)
  }
  try { delete require.cache[require.resolve(filePath)] } catch {}
}

function loadPlugins(pluginsPath, opts = {}) {
  try {
    if (!fs.existsSync(pluginsPath)) {
      console.error(`\x1b[31m🚩 Carpeta de plugins no existe: ${pluginsPath}\x1b[0m`)
      return plugins
    }

    const cmdFiles = []
    plugins = []

    function readDirectory(directory) {
      const files = fs.readdirSync(directory)
      for (const file of files) {
        const filePath = path.join(directory, file)
        if (!fs.existsSync(filePath)) continue
        const stat = fs.statSync(filePath)
        if (stat.isDirectory()) {
          readDirectory(filePath)
        } else if (file.endsWith('.js') && file !== 'MessagesUpsert.js') {
          addOrUpdatePlugin(filePath, 'loaded')
          cmdFiles.push(path.relative(pluginsPath, filePath))
        }
      }
    }

    readDirectory(pluginsPath)
    if (opts.array) console.log(cmdFiles)
    if (opts.table) console.table(cmdFiles.map(value => ({ plugin: value })))

    pluginsLoaded = true
    console.log(`\x1b[36m✅ ${plugins.length} plugins cargados correctamente\x1b[0m`)
    return plugins
  } catch (err) {
    console.error(`\x1b[31mError cargando plugins:\x1b[0m`, err.message)
    return plugins
  }
}

function watchPlugins(pluginsPath) {
  if (watcher) return

  console.log(`\x1b[34m👁️ Monitoreando plugins en: ${pluginsPath}\x1b[0m`)
  
  watcher = chokidar.watch(pluginsPath, {
    persistent: true,
    ignoreInitial: true,
    depth: 10
  })

  watcher
    .on('add', filePath => {
      if (!filePath.endsWith('.js')) return
      if (path.basename(filePath) === 'MessagesUpsert.js') return
      addOrUpdatePlugin(filePath, 'agregado')
    })
    .on('change', filePath => {
      if (!filePath.endsWith('.js')) return
      if (path.basename(filePath) === 'MessagesUpsert.js') return
      addOrUpdatePlugin(filePath, 'cambiado')
    })
    .on('unlink', filePath => {
      if (!filePath.endsWith('.js')) return
      if (path.basename(filePath) === 'MessagesUpsert.js') return
      removePlugin(filePath)
    })
    .on('error', err => console.error('\x1b[31m🚩 Watcher error:\x1b[0m', err))
}

function buildLight(sock, light = {}) {
  if (!light.sock) light.sock = sock

  if (!light.sticker) {
    light.sticker = async (jid, sticker, quoted) => {
      try { return await sock.sendMessage(jid, { sticker }, { quoted }) } catch (e) { console.error(e) }
    }
  }

  if (!light.sendMessage) {
    light.sendMessage = async (jid, content, options = {}) => {
      try { return await sock.sendMessage(jid, content, options) } catch {}
    }
  }

  if (!light.reply) {
    light.reply = async (jid, text, quoted) => {
      try { return await sock.sendMessage(jid, { text: String(text) }, { quoted }) } catch {}
    }
  }

  if (!light.react) {
    light.react = async (jid, key, emoji) => {
      try { return await sock.sendMessage(jid, { react: { text: emoji, key } }) } catch {}
    }
  }

  if (!sock.downloadMediaMessage) {
    sock.downloadMediaMessage = async (message) => downloadMediaMessage(message, sock)
  }

  return light
}

function isSubBot(sock) {
  try {
    const clients = global.client || {}
    const keys = Object.keys(clients)
    if (!keys.length) return false
    const botId = decodeJid(sock?.user?.id || '')
    return keys.some(k => jidEqual(k, botId))
  } catch {
    return false
  }
}

function pluginCommands(plugin) {
  if (Array.isArray(plugin.command)) return plugin.command
  if (Array.isArray(plugin.help))    return plugin.help
  if (typeof plugin.command === 'string') return [plugin.command]
  if (typeof plugin.help    === 'string') return [plugin.help]
  return []
}

async function failReply(type, mObj, sock) {
  const from = mObj.from
  const msgs = {
    owner:    '🚩 Este *comando* solo puede usarlo el *Owner*',
    group:    '🚩 Este *comando* solo funciona en *grupos*',
    private:  '🚩 Este *comando* solo funciona en *chat privado*',
    admin:    '🚩 Este *comando* solo puede usarlo un *admin*',
    botAdmin: '🚩 Necesito ser *admin* para usar este *comando*',
    limit:    '🚩 No tienes suficientes *StarCoins*',
    subBot:   '🚩 Este *comando* solo puede usarlo un *Sub Bot*'
  }
  if (!msgs[type]) return

  return await sock.sendMessage(from, { text: msgs[type] }, { quoted: mObj.quoted || mObj })
}

function checkPluginRules(plugin, ctx) {
  if (plugin.owner    && !ctx.isOwner)    return 'owner'
  if (plugin.group    && !ctx.isGroup)    return 'group'
  if (plugin.private  && !ctx.isPrivate)  return 'private'
  if (plugin.admin    && !ctx.isAdmin)    return 'admin'
  if (plugin.botAdmin && !ctx.isBotAdmin) return 'botAdmin'
  if (plugin.subBot   && !ctx.isSubBot)   return 'subBot'
  return null
}

async function lidToJid(sock, lid) {
  try {
    const store = sock.signalRepository?.lidMapping
    if (!store || !lid) return lid
    let jid = await store.getPNForLID(lid)
    return normalizeJid(jid) || lid
  } catch {
    return lid
  }
}

async function getNormalizedJid(sock, id) {
  if (!id) return ''
  if (typeof id === 'string' && id.includes('@lid')) {
    return await lidToJid(sock, id)
  }
  return normalizeJid(id)
}

async function handler(m, sock, light, caches, config, pluginsPath) {
  try {
    if (!pluginsLoaded) {
      console.log('\x1b[35m📂 Cargando plugins desde:', pluginsPath, '\x1b[0m')
      loadPlugins(pluginsPath)
      watchPlugins(pluginsPath)
    }

    light = buildLight(sock, light || {})

    if (!m?.message || !m?.key?.id) return
    if (m.key.fromMe) return
    if (m.key.remoteJid === 'status@broadcast') return
    if (hasProcessed(sock, m.key.id)) return
    markProcessed(sock, m.key.id)

    const from      = String(m.key.remoteJid || '')
    const isGroup   = from.endsWith('@g.us')
    const isPrivate = !isGroup

    const rawSender = isGroup
      ? (m.key.participant || m.participant || '')
      : from   
    
    const decodedRaw = decodeJid(rawSender) || decodeJid(from)
    const sender = await getNormalizedJid(sock, decodedRaw)
    const botNumber = await getNormalizedJid(sock, decodeJid(sock.user?.id || ''))
    const isBaileys = sender === botNumber

    const type = getContentType(m.message)
    if (!type) return

    const msgContent = m.message[type]

    let user = getUser(sender)
    if (!user) {
      user = { exp: 0, limit: 10, coins: 0 }
      if (!db.data.users) db.data.users = {}
      db.data.users[sender] = user
      saveDB()
    }

    const body =
      (type === 'conversation')           ? (m.message.conversation || '') :
      (type === 'imageMessage')           ? (m.message.imageMessage?.caption || '') :
      (type === 'videoMessage')           ? (m.message.videoMessage?.caption || '') :
      (type === 'extendedTextMessage')    ? (m.message.extendedTextMessage?.text || '') :
      (type === 'reactionMessage')        ? (m.message.reactionMessage?.text || '') :
      (type === 'buttonsResponseMessage') ? (m.message.buttonsResponseMessage?.selectedButtonId || '') :
      (type === 'listResponseMessage')    ? (m.message.listResponseMessage?.singleSelectReply?.selectedRowId || '') :
      (type === 'templateButtonReplyMessage') ? (m.message.templateButtonReplyMessage?.selectedId || '') :
      (type === 'interactiveResponseMessage') ? (() => {
        try {
          const params = m.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
          return params ? (JSON.parse(params).id || '') : ''
        } catch { return '' }
      })() :
      (type === 'messageContextInfo') ? (
        m.message.buttonsResponseMessage?.selectedButtonId ||
        m.message.listResponseMessage?.singleSelectReply?.selectedRowId || ''
      ) :
      (type === 'editedMessage') ? (
        m.message.editedMessage?.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text ||
        m.message.editedMessage?.message?.protocolMessage?.editedMessage?.conversation || ''
      ) :
      (type === 'protocolMessage') ? (
        m.message.protocolMessage?.editedMessage?.extendedTextMessage?.text ||
        m.message.protocolMessage?.editedMessage?.conversation ||
        m.message.protocolMessage?.editedMessage?.imageMessage?.caption ||
        m.message.protocolMessage?.editedMessage?.videoMessage?.caption || ''
      ) :
      (type === 'stickerMessage') ? (m.message.stickerMessage?.emoji || 'stickerMessage') :
      ''

    const quoted = await types(m, sock)
    const isQuoted = !!(
      msgContent?.contextInfo?.quotedMessage ||
      m.message?.extendedTextMessage?.contextInfo?.quotedMessage
    )

    let groupMetadata = null
    let participants  = []
    let admins        = []
    let isAdmin       = false
    let isBotAdmin    = false

    if (isGroup) {
      groupMetadata = await getGroupMetadataSafe(sock, from)
      const rawParticipants = groupMetadata?.participants || []
      
      participants = await Promise.all(rawParticipants.map(async (p) => {
        const jid = p.phoneNumber || await getNormalizedJid(sock, p.id)
        return {
          ...p,
          jid: jid,
          lid: p.id || p.lid,
          phoneNumber: p.phoneNumber || jid
        }
      }))
      
      admins        = getAdmins(participants)
      isAdmin       = participants.some(p => participantMatch(p, sender) && isAdminParticipant(p))
      isBotAdmin    = participants.some(p => participantMatch(p, botNumber) && isAdminParticipant(p))
    }

    if (logs && typeof logs === 'function') {
      logs(m, body, sender, isGroup)
    } else {
      console.log(`[MENSAJE] De: ${sender} | Mensaje: ${body.substring(0, 100)}`)
    }

    const mObj = {
      ...m,
      from: isGroup ? from : sender,
      sender,
      pushName:     m.pushName || '',
      body:         String(body || '').trim(),
      type,
      user,
      light,
      db,
      sock,
      isGroup,
      isPrivate,
      isOwner:   config.own_number ? config.own_number.includes(sender) : false,
      isAdmin,
      isBotAdmin,
      isBaileys,
      isQuoted,
      isSubBot:  isSubBot(sock),
      groupMetadata,
      participants,
      admins,
      botNumber,
      quoted:       quoted.quoted || m,
      mime:         quoted?.mime || msgContent?.mimetype || '',
      mentionedJid: msgContent?.contextInfo?.mentionedJid || [],
      isMedia:      quoted?.isMedia    || false,
      isImage:      quoted?.isImage    || false,
      isVideo:      quoted?.isVideo    || false,
      isSticker:    quoted?.isSticker  || false,
      isAudio:      quoted?.isAudio    || false,
      isDocument:   quoted?.isDocument || false,
      isGif:        quoted?.isGif      || false,
      isViewOnce:   quoted?.isViewOnce  || false,
      isEphemeral:  quoted?.isEphemeral || false,
      reply:    async (text, options = {}) => sock.sendMessage(from, { text: String(text) }, { quoted: quoted.quoted || m, ...options }),
      react:    async (emoji) => sock.sendMessage(from, { react: { text: emoji, key: m.key } }),
      download: async () => quoted.download(),
      types:    async () => quoted,
      lidToJid: async (lid) => lidToJid(sock, lid),
      getJid: async (id) => getNormalizedJid(sock, id)
    }

    const safeBody = String(body || '').trim()
    let usedPrefix = '', command = '', args = [], textMsg = ''

    for (const p of config.prefix) {
      if (safeBody.startsWith(p)) {
        usedPrefix = p
        const rest  = safeBody.slice(p.length).trim()
        const parts = rest.split(/\s+/)
        command  = (parts[0] || '').toLowerCase()
        args     = parts.slice(1)
        textMsg  = parts.slice(1).join(' ')
        break
      }
    }

    for (const plugin of plugins) {
      try {
        if (typeof plugin.before === 'function') {
          const stop = await plugin.before(mObj, { command, args, text: textMsg, prefix: usedPrefix, light })
          if (stop === true) return
        }
      } catch {}
    }

    if (!usedPrefix) return

    let matchedPlugin = null
    let executed      = false

    for (const plugin of plugins) {
      try {
        const cmds  = pluginCommands(plugin).map(v => String(v).toLowerCase())
        const match = cmds.includes(command)
        if (!match) continue

        matchedPlugin = plugin

        const ruleFail = checkPluginRules(plugin, mObj)
        if (ruleFail) {
          await failReply(ruleFail, mObj, sock)
          return
        }

        const isOwner = mObj.isOwner

        if (!isOwner && plugin.limit) {
          const need = typeof plugin.limit === 'number' ? plugin.limit : 1
          if (user.limit < need) {
            await failReply('limit', mObj, sock)
            return
          }
        }

        if (typeof plugin.run === 'function') {
          executed = await plugin.run(mObj, {
            command,
            args,
            text: textMsg,
            light,
            prefix: usedPrefix
          })
        }

        if (!isOwner && plugin.limit && executed) {
          const need = typeof plugin.limit === 'number' ? plugin.limit : 1
          if (user.limit >= need) {
            user.limit -= need
            saveDB()
            await sock.sendMessage(from, { text: `🚩 Utilizaste *${need}* StarCoins` }, { quoted: m })
          }
        }

        break
      } catch (err) {
        console.error(`\x1b[31m🚩 Error ejecutando plugin '${plugin.__filename}':\x1b[0m`, err.message)
      }
    }

    for (const plugin of plugins) {
      try {
        if (typeof plugin.after === 'function') {
          await plugin.after(mObj, {
            command, args, text: textMsg,
            prefix: usedPrefix, light,
            plugin: matchedPlugin, executed
          })
        }
      } catch {}
    }

  } catch (err) {
    if (err?.message?.includes('bad mac')) return
    console.error('\x1b[31m[ERROR en handler]\x1b[0m', err?.message)
  }
}

module.exports = handler