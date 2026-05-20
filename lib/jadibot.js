'use strict'
const fs = require('fs')
const path = require('path')
const os = require('os')
const pino = require('pino')
const cron = require('node-cron')
const NodeCache = require('node-cache')
const { exec } = require('child_process')

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')

const handler = require('../starlight.js')
const { bailMessage } = require('./Message')

const config = JSON.parse(fs.readFileSync('./config.json'))

global.client = global.client || Object.create(null)
const retryCaches = Object.create(null)

const uptimeMap = Object.create(null)
const startingBots = new Set()
const reconnectingMap = Object.create(null)
const retryMap = Object.create(null)
const processedMessagesMap = Object.create(null)
const reconnectTimers = Object.create(null)
const cleanupIntervals = Object.create(null)
const openedAtMap = Object.create(null)
const pairingLocks = Object.create(null)

const groupCache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  useClones: false
})

function createBotLogger(from) {
  return pino({ level: 'silent' })
}

process.on('exit', () => {
  for (const from in uptimeMap) {
    if (uptimeMap[from]?.start) {
      uptimeMap[from].total += Date.now() - uptimeMap[from].start
      uptimeMap[from].start = null
    }
  }
})

function normalizeJid(jid) {
  if (!jid) return jid
  if (/:\d+@/gi.test(jid)) {
    const [user] = jid.split('@')[0].split(':')
    return `${user}@s.whatsapp.net`
  }
  return jid
}

function normalizePhone(input) {
  return String(input || '').replace(/[^0-9]/g, '')
}

function ensureProcessedSet(from) {
  if (!processedMessagesMap[from]) processedMessagesMap[from] = new Set()
  return processedMessagesMap[from]
}

function trimSet(set, limit = 1500) {
  if (set.size <= limit) return set
  const arr = Array.from(set)
  return new Set(arr.slice(-limit))
}

function safeReply(m, text) {
  if (!m?.reply) return Promise.resolve()
  return m.reply(text).catch(() => {})
}

function clearReconnectTimer(from) {
  if (reconnectTimers[from]) {
    clearTimeout(reconnectTimers[from])
    delete reconnectTimers[from]
  }
}

function clearSubCleanup(from) {
  if (cleanupIntervals[from]) {
    clearInterval(cleanupIntervals[from])
    delete cleanupIntervals[from]
  }
}

function destroySocket(from) {
  try {
    const sock = global.client[from]
    if (sock) {
      try { sock.ev?.removeAllListeners?.() } catch {}
      try { sock.ws?.close?.() } catch {}
      try { sock.end?.('cleanup') } catch {}
    }
  } catch {}
  delete global.client[from]
}

function cleanupSession(folder) {
  try {
    exec(`rm -rf "${folder}"`)
  } catch {}
}

async function requestPairingOnce(sock, from, m, phoneNumber) {
  if (!pairingLocks[from]) {
    pairingLocks[from] = { sent: false, promise: null }
  }

  const lock = pairingLocks[from]
  if (lock.sent && lock.promise) return lock.promise
  if (lock.promise) return lock.promise

  lock.promise = (async () => {
    let codeBot = await sock.requestPairingCode(phoneNumber, "STARTEAM")
    codeBot = codeBot?.match(/.{1,4}/g)?.join("-") || codeBot

    lock.sent = true
    return codeBot
  })().catch(err => {
    delete pairingLocks[from]
    throw err
  })

  return lock.promise
}

function scheduleReconnect(from, light, m, store, delay) {
  clearReconnectTimer(from)
  reconnectTimers[from] = setTimeout(() => {
    reconnectingMap[from] = false
    startingBots.delete(from)
    Serbot(light, from, m, store).catch(() => {})
  }, delay)
}

function maybeBadMacFix(sock, from) {
  return async function handle(err) {
    const text = String(err?.stack || err?.message || err || '').toLowerCase()
    if (text.includes('bad mac') || (text.includes('mac') && text.includes('invalid'))) {
      try {
        await sock.uploadPreKeysToServerIfRequired?.()
      } catch {}
      return true
    }
    return false
  }
}

async function clearPreKeys(state) {
  try {
    if (state?.keys?.set) {
      await state.keys.set({ preKeys: {} })
    }
  } catch {}
}

function setupMemoryCleanup(sock, from) {
  clearSubCleanup(from)
  cleanupIntervals[from] = setInterval(() => {
    try {
      if (global.gc) global.gc()
      const processed = processedMessagesMap[from]
      if (processed && processed.size > 3000) {
        processedMessagesMap[from] = trimSet(processed, 1200)
      }
      try { groupCache.cleanup() } catch {}
      try { sock.ev?.emit?.('cleanup') } catch {}
    } catch {}
  }, 30000)
}

function shouldIgnoreMessage(msg, from, socketOpenedAt, sock) {
  try {
    if (!msg?.message) return true
    if (!msg?.key?.id) return true
    if (msg.key.remoteJid === 'status@broadcast') return true
    if (msg.key.fromMe) return true
    if (msg.message?.protocolMessage) return true
    if (msg.message?.senderKeyDistributionMessage) return true
    if (msg.key.remoteJid?.endsWith('@g.us')) {
      try {
        const jid = normalizeJid(msg.key.remoteJid)
        if (!groupCache.has(jid)) {
          sock.groupMetadata(jid).then(md => {
            if (md) groupCache.set(jid, md)
          }).catch(() => {})
        }
      } catch {}
    }
    const ts = Number(msg.messageTimestamp || 0) * 1000
    if (ts && socketOpenedAt && socketOpenedAt - ts > 15000) return true
    const processed = ensureProcessedSet(from)
    if (processed.has(msg.key.id)) return true
    return false
  } catch {
    return true
  }
}

async function Serbot(light, from, m = {}, store) {
  const existing = global.client[from]
  if (existing?.user?.id && existing?.ws?.readyState === 1) {
    return existing
  }
  if (startingBots.has(from)) {
    return existing || null
  }

  startingBots.add(from)
  retryMap[from] = retryMap[from] || 0
  ensureProcessedSet(from)

  const sessionPath = path.join('./atem', from)

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    const { version } = await fetchLatestBaileysVersion()
    destroySocket(from)
    clearReconnectTimer(from)
    if (!retryCaches[from]) {
      retryCaches[from] = new NodeCache({
        stdTTL: 0,
        checkperiod: 0,
        useClones: false
      })
    }

    const botLogger = createBotLogger(from)

    const sock = makeWASocket({
      version,
      logger: botLogger,
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '122.0.0.0'],
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, botLogger)
      },
      msgRetryCounterCache: retryCaches[from],
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      emitOwnEvents: false,
      getMessage: async () => null,
      cachedGroupMetadata: async (jid) => {
  try {
    jid = normalizeJid(jid)
    let metadata = groupCache.get(jid)
    if (metadata) return metadata
    metadata = await sock.groupMetadata(jid).catch(() => null)
    if (metadata) {
      groupCache.set(jid, metadata)
      return metadata
    }
    return undefined 
  } catch {
    return undefined
  }
},
      retryRequestDelayMs: 250,
      maxMsgRetryCount: 5,
      fireInitQueries: true,
      shouldSyncHistoryMessage: () => false,
      shouldIgnoreJid: (jid) => {
        return jid === 'status@broadcast'
      }
    })
    global.client[from] = sock
    
    const subLight = bailMessage(sock)
    sock.ev.on('groups.update', (updates) => {
  try {
    for (const update of updates) {
      const id = normalizeJid(update.id)
      const prev = groupCache.get(id) || {}
      groupCache.set(id, { ...prev, ...update })
    }
  } catch {}
})

 sock.ev.on('group-participants.update', async ({ id }) => {
  try {
    id = normalizeJid(id)
    const metadata = await sock.groupMetadata(id).catch(() => null)
    if (metadata) groupCache.set(id, metadata)
  } catch {}
  })
    const credsHandler = async (creds) => {
      if (global.client[from] !== sock) return
      try {
        await saveCreds(creds)
      } catch {}
    }
    sock.ev.on('creds.update', credsHandler)
    
    const badMacFix = maybeBadMacFix(sock, from)
    
    if (!state.creds.registered) {
      let pairingRequested = false
      sock.ev.on('connection.update', async (update) => {
        try {
          const { connection } = update || {}

          if (connection === 'connecting' && !pairingRequested) {
            pairingRequested = true

            setTimeout(async () => {
              try {
                if (global.client[from] !== sock) return
                if (state.creds.registered) return

                const phone = normalizePhone(from)
                if (!phone) return
               const pretty = await requestPairingOnce(sock, from, m, phone)
                let txt = `> 🚩 *Vincula tu cuenta usando el codigo.*

* 𓇼   ୨  🐾 𝟹  나 *Mas opciones*
* 𓇼   ୨  🌱 𝟹  나 *Dispositivos vinculados*
* 𓇼   ୨  🌸 𝟹  나 *Vincular nuevo dispositivo*
* 𓇼   ୨  🧩 𝟹 나  *Vincular usando numero*`
                await safeReply(m, txt)
                await safeReply(m, `${pretty}`)
              } catch (e) {
                pairingRequested = false
              }
            }, 1200)
          }
        } catch {}
      })
    }
    const messagesHandler = async ({ messages, type }) => {
      try {
        if (type !== 'notify') return
        if (global.client[from] !== sock) return

        const socketOpenedAt = openedAtMap[from] || Date.now()
        const processed = ensureProcessedSet(from)

        for (const msg of messages) {
          try {
            if (shouldIgnoreMessage(msg, from, socketOpenedAt)) continue

            processed.add(msg.key.id)
            setTimeout(() => processed.delete(msg.key.id), 5 * 60 * 1000)

            await handler(
              msg,
              sock,
              subLight,
              store || {},
              config,
              path.join(__dirname, '../plugins')
            )
          } catch (e) {
            await badMacFix(e)
          }
        }

        if (processed.size > 3000) {
          processedMessagesMap[from] = trimSet(processed, 1200)
        }
      } catch (e) {
        await badMacFix(e)
      }
    }
    sock.ev.on('messages.upsert', messagesHandler)
    const connectionHandler = async (update) => {
      try {
        const { connection, lastDisconnect } = update || {}
        
        if (connection === 'open') {
          const now = Date.now()

          if (!uptimeMap[from]) {
            uptimeMap[from] = { start: now, total: 0 }
          } else {
            if (uptimeMap[from].start) {
              uptimeMap[from].total += now - uptimeMap[from].start
            }
            uptimeMap[from].start = now
          }

          startingBots.delete(from)
          reconnectingMap[from] = false
          retryMap[from] = 0
          clearReconnectTimer(from)

          setupMemoryCleanup(sock, from)
          await clearPreKeys(state)

          await safeReply(m, '🚩 Sub bot conectado correctamente')
          return
        }

        if (connection === 'close') {
          if (global.client[from] !== sock) return
          const reason =
            lastDisconnect?.error?.output?.statusCode ||
            lastDisconnect?.error?.statusCode ||
            lastDisconnect?.error?.cause?.statusCode

          const shouldReconnect = reason !== DisconnectReason.loggedOut
          
          if (uptimeMap[from]?.start) {
            uptimeMap[from].total += Date.now() - uptimeMap[from].start
            uptimeMap[from].start = null
          }
          
          try { sock.ev?.removeAllListeners?.() } catch {}
          
          destroySocket(from)
          clearSubCleanup(from)

          if (!shouldReconnect) {
            startingBots.delete(from)
            reconnectingMap[from] = false
            delete retryMap[from]
            delete openedAtMap[from]
            delete pairingLocks[from]
            delete uptimeMap[from]
            delete retryCaches[from]
            cleanupSession(sessionPath)
            await safeReply(m, '🚩 Ya no eres un sub bot')
            return
          }

          if (reconnectingMap[from]) return
          reconnectingMap[from] = true
          retryMap[from] = (retryMap[from] || 0) + 1

          let delay = 3000
          if (reason === 408 || reason === 503) delay = 10000
          if (retryMap[from] >= 3) delay = 15000
          if (retryMap[from] >= 5) delay = 20000

          if (retryMap[from] >= 6) {
            cleanupSession(sessionPath)
            retryMap[from] = 0
          }

          scheduleReconnect(from, light, m, store, delay)
        }
      } catch (e) {
        await badMacFix(e)
      }
    }
    sock.ev.on('connection.update', connectionHandler)
    const errorHandler = async (err) => {
      if (global.client[from] !== sock) return
      const fixed = await badMacFix(err)
      if (fixed) {
        clearReconnectTimer(from)
        scheduleReconnect(from, light, m, store, 3000)
      }
    }
    sock.ev.on('error', errorHandler)
    return sock
  } catch (e) {
    startingBots.delete(from)
    reconnectingMap[from] = false

    clearReconnectTimer(from)
    scheduleReconnect(from, light, m, store, 7000)
    return null
  }
}

async function StopSub(light, from, m = {}) {
  clearReconnectTimer(from)
  clearSubCleanup(from)
  destroySocket(from)

  delete processedMessagesMap[from]
  delete reconnectingMap[from]
  delete retryMap[from]
  delete uptimeMap[from]
  delete openedAtMap[from]
  delete pairingLocks[from]
  delete retryCaches[from]
  startingBots.delete(from)

  cleanupSession(path.join('./atem', from))

  if (m?.reply) return m.reply('🚩 Ya no eres un sub bot')
}

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [
    days ? `${days}d` : '',
    hours ? `${hours}h` : '',
    minutes ? `${minutes}m` : '',
    `${seconds}s`
  ].filter(Boolean).join(' ')
}

async function SubsList(light, m) {
  let total = 0
  let list = ''
  for (const [jid, jadibot] of Object.entries(global.client)) {
    if (jadibot?.user?.id) {
      total++
      const data = uptimeMap[jid]
      let uptime = '0s'
      if (data) {
        const current = data.start ? (Date.now() - data.start) : 0
        uptime = formatUptime(data.total + current)
      }
      const name =
        jadibot.user?.name ||
        jadibot.user?.notify ||
        'ᗝ᳢ㅤㅤׄㅤㅤ𖹭᪲ㅤ 𝗦𝘁𝖺⃨𝗋𝗅𝗂𝗴ׄ𝗁𝗍  𝗕𑄝ꯨ𝗍ㅤ 🧁 ꒱ㅤ꒱'
      const number = jid.split('@')[0]
      list += `\n* • ${name}* (${number}) 🎂 ${uptime}`
    }
  }
  const teks = total === 0
    ? '🚩 No hay *sub bots* disponibles'
    : `݄ㅤ☆ㅤׁㅤ🍟̸̷ ︲ *Lı𝗌ƚ* - *S𝗎𝖻𝗌*݁︲ ⛾ㅤׅㅤയㅤ

* 𓇼   ୨  🌵 𝟹  나  S𝗎𝖻𝗌 C𝗈ⴖᧉ𝖼ƚ⍺𝖽𝗈𝗌 :  *${total}*
* 𓇼   ୨  🍙 𝟹  나  B𝗈ƚ Prıⴖ𝖼ı𝗉⍺l : *1*

🥪 *Sub bots activos:*${list}
`

  return m.reply(teks)
}

async function runOnce(light, store) {
  const folder = './atem'
  if (!fs.existsSync(folder)) return

  const dirs = fs.readdirSync(folder)

  for (const dir of dirs) {
    const credsPath = path.join(folder, dir, 'creds.json')
    if (!fs.existsSync(credsPath)) continue
    if (global.client[dir]?.user?.id) continue
    if (startingBots.has(dir)) continue

    try {
      await Serbot(light, dir, {}, store)
      // ✅ FIX: Delay más largo entre conexiones para evitar race conditions
      await new Promise(r => setTimeout(r, 3000))
    } catch {}
  }
}

cron.schedule('*/30 * * * * *', async () => {
  try {
    if (global.gc) global.gc()

    for (const id of Object.keys(processedMessagesMap)) {
      const set = processedMessagesMap[id]
      if (set && set.size > 3000) {
        processedMessagesMap[id] = trimSet(set, 1200)
      }
    }

    groupCache.cleanup()
    void os.freemem()
  } catch {}
})

setInterval(() => {
  try {
    if (global.gc) global.gc()

    for (const id of Object.keys(processedMessagesMap)) {
      const set = processedMessagesMap[id]
      if (set && set.size > 3000) {
        processedMessagesMap[id] = trimSet(set, 1200)
      }
    }
  } catch {}
}, 60000)

module.exports = {
  runOnce,
  Serbot,
  StopSub,
  SubsList
}