process.on('uncaughtException', (err) => {
    console.error('[FATAL]', err)
})
process.on('unhandledRejection', (reason) => {
    console.error('[UNHANDLED]', reason)
})

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    isJidBroadcast,
    PHONENUMBER_MCC,
    jidNormalizedUser
} = require('@whiskeysockets/baileys')

const pino = require('pino')
const fs = require('fs')
const path = require('path')
const readline = require('readline')
const NodeCache = require('node-cache')
const cron = require('node-cron')
const os = require('os')

const { logger } = require('./lib/logger.js')
const KeepAlive = require('./lib/keep-alive.js')

const { bailMessage } = require('./lib/Message')
const handler = require('./starlight.js')
const { runOnce } = require('./lib/jadibot')

const config = JSON.parse(fs.readFileSync('./config.json'))

const RECONNECT_BASE_DELAY = config.connection?.reconnectBaseDelay || 3_000
const RECONNECT_MAX_DELAY = config.connection?.reconnectMaxDelay || 120_000
const RECONNECT_MULTIPLIER = 1.8
const MAX_RECONNECT_ATTEMPTS = config.connection?.maxReconnectAttempts || 50

const MEMORY_CHECK_INTERVAL = 15_000
const PROCESSED_MSG_TTL = 5 * 60_000
const DELETED_MSG_TTL = 24 * 60 * 60_000
const GROUP_CACHE_TTL = 10 * 60_000
const GROUP_CACHE_CHECK = 2 * 60_000
const HEALTH_CHECK_INTERVAL = config.connection?.healthCheckInterval || 60_000

const processedMessages = new Set()
const deletedMessages = new Map()
const caches = {}

let sock = null
let state, saveCreds
let keepAlive = null
let reconnecting = false
let reconnectAttempts = 0
let reconnectTimer = null
let isShuttingDown = false
let lastActivity = Date.now()
let connectionStartTime = null

const silentLogger = pino({ level: 'silent' })
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (txt) => new Promise(res => rl.question(txt, res))

const groupCache = new NodeCache({
    stdTTL: GROUP_CACHE_TTL / 1000,
    checkperiod: GROUP_CACHE_CHECK / 1000,
    useClones: false,
    deleteOnExpire: true
})

if (config.debug) {
    groupCache.on('expired', (key, value) => {
        logger.debug('Cache de grupo expirado', { jid: key })
    })
    groupCache.on('flush', () => {
        logger.debug('Cache de grupos limpiada')
    })
}

async function gracefulShutdown(signal) {
    if (isShuttingDown) return
    isShuttingDown = true
    
    logger.info('🛑 Iniciando apagado graceful', { signal })
    console.log(`\n🛑 Señal ${signal} recibida. Cerrando bot...`)
    
    clearTimeout(reconnectTimer)
    
    if (keepAlive) {
        keepAlive.stop()
    }
    
    if (sock) {
        try {
            await sock.logout()
            logger.info('✅ Socket cerrado correctamente')
        } catch {
            try { sock.end() } catch {}
        }
    }
    
    groupCache.close()
    rl.close()
    
    console.log('👋 Bot cerrado correctamente')
    setTimeout(() => process.exit(0), 1000)
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

function getReconnectDelay(attempt) {
    const base = Math.min(
        RECONNECT_BASE_DELAY * Math.pow(RECONNECT_MULTIPLIER, attempt),
        RECONNECT_MAX_DELAY
    )
    const jitter = base * 0.2 * Math.random()
    const delay = Math.floor(base + jitter)
    
    logger.info('📊 Delay de reconexión calculado', {
        intento: attempt,
        delay: `${(delay / 1000).toFixed(1)}s`
    })
    
    return delay
}

function flushMemory(force = false) {
    try {
        const before = (process.memoryUsage().rss / 1048576).toFixed(1)
        
        if (global.gc && (force || process.memoryUsage().rss > 512 * 1024 * 1024)) {
            global.gc()
            logger.info('🗑️ Garbage collection ejecutada', {
                forzada: force,
                memoriaAntes: `${before}MB`
            })
        }
        
        if (sock?.chats?.clear) sock.chats.clear()
        if (sock?.groups?.clear) sock.groups.clear()
        if (sock?.messages?.clear) sock.messages.clear()
        
        const now = Date.now()
        for (const [id, data] of deletedMessages.entries()) {
            if (now - data.timestamp > DELETED_MSG_TTL) {
                deletedMessages.delete(id)
            }
        }
        
        sock?.ev?.emit('cleanup')
        
        if (config.debug) {
            const memAfter = (process.memoryUsage().rss / 1048576).toFixed(1)
            logger.debug('🧹 Limpieza de memoria', {
                antes: `${before}MB`,
                despues: `${memAfter}MB`
            })
        }
    } catch (e) {
        logger.error('Error en flushMemory', e)
    }
}

function formatUptime() {
    const seconds = Math.floor(process.uptime())
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${days}d ${hours}h ${minutes}m ${secs}s`
}

async function getGroupMetadata(jid) {
    try {
        const normalizedJid = jidNormalizedUser(jid)?.replace(/:\\d+@/g, '@')
        if (!normalizedJid || !normalizedJid.endsWith('@g.us')) return null
        
        let metadata = groupCache.get(normalizedJid)
        if (metadata) {
            if (config.debug) logger.debug('✅ Cache hit de grupo', { jid: normalizedJid })
            return metadata
        }
        
        if (config.debug) logger.debug('❌ Cache miss de grupo', { jid: normalizedJid })
        
        metadata = await sock.groupMetadata(normalizedJid).catch((err) => {
            logger.error('Error obteniendo metadata de grupo', err, { jid: normalizedJid })
            return null
        })
        
        if (metadata) {
            groupCache.set(normalizedJid, metadata)
            logger.info('💾 Metadata de grupo cacheada', {
                jid: normalizedJid,
                subject: metadata.subject,
                participantes: metadata.participants?.length || 0
            })
        }
        
        return metadata
    } catch (e) {
        logger.error('Error en getGroupMetadata', e, { jid })
        return null
    }
}

async function connectSock() {
    if (isShuttingDown) {
        logger.warn('⚠️ Conexión abortada - bot cerrándose')
        return
    }
    
    connectionStartTime = Date.now()
    logger.connection('connecting', {
        intento: reconnectAttempts,
        timestamp: new Date().toISOString()
    })
    
    if (sock) {
        try { sock.ev.removeAllListeners() } catch {}
        try { sock.end('Reconnecting') } catch {}
        sock = null
    }
    
    try {
        const auth = await useMultiFileAuthState('./session')
        state = auth.state
        saveCreds = auth.saveCreds
        
        logger.info('📂 Estado de autenticación cargado', {
            registrado: state.creds?.registered
        })
        
        const msgRetryCounterCache = new NodeCache({ stdTTL: 60 })
        const { version, isLatest } = await fetchLatestBaileysVersion()
        
        logger.info('📦 Versión de Baileys', { version, esUltima: isLatest })
        keepAlive = new KeepAlive(sock, {
            pingInterval: config.connection?.pingInterval || 15000,
            presenceInterval: config.connection?.presenceInterval || 45000,
            healthCheckInterval: config.connection?.healthCheckInterval || 60000,
            ramLimit: config.ram_limit || 1024,
            reconnectBaseDelay: RECONNECT_BASE_DELAY,
            reconnectMaxDelay: RECONNECT_MAX_DELAY,
            maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS
        })
        
        sock = makeWASocket({
            version,
            logger: silentLogger,
            printQRInTerminal: false,
            browser: ['Mac OS', 'chrome', '121.0.6167.159'],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, silentLogger)
            },
            cachedGroupMetadata: async (jid) => {
                return getGroupMetadata(jid)
            },
            msgRetryCounterCache,
            generateHighQualityLinkPreview: true,
            getMessage: async () => null,
            connectTimeoutMs: 120000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            retryRequestDelayMs: 1000,
            maxMsgRetryCount: 5,
            fireInitQueries: true,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            shouldSyncHistoryMessage: () => false,
            shouldIgnoreJid: (jid) => isJidBroadcast(jid),
            maxRetries: 10,
        })
        
        const light = bailMessage(sock)
        
        sock.ev.on('groups.update', (updates) => {
            try {
                for (const update of updates) {
                    const id = update.id?.replace(/:\d+@/g, '@')
                    if (!id) continue
                    
                    const prev = groupCache.get(id) || {}
                    const merged = { ...prev, ...update }
                    groupCache.set(id, merged)
                    
                    logger.info('🔄 Grupo actualizado', {
                        jid: id,
                        cambios: Object.keys(update).join(', ')
                    })
                }
            } catch (e) {
                logger.error('Error en groups.update', e)
            }
        })
        
        sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
            try {
                const normalizedId = id?.replace(/:\\d+@/g, '@')
                if (!normalizedId) return
                
                groupCache.del(normalizedId)
                logger.info('👥 Participantes de grupo actualizados', {
                    jid: normalizedId,
                    accion: action,
                    cantidad: participants.length
                })
                
                const metadata = await sock.groupMetadata(normalizedId).catch((err) => {
                    logger.error('Error actualizando metadata de grupo', err, { jid: normalizedId })
                    return null
                })
                
                if (metadata) {
                    groupCache.set(normalizedId, metadata)
                }
            } catch (e) {
                logger.error('Error en group-participants.update', e)
            }
        })
        
        sock.ev.on('creds.update', async (creds) => {
            try {
                await saveCreds(creds)
                lastActivity = Date.now()
                if (keepAlive) keepAlive.updateActivity(lastActivity)
                logger.debug('🔐 Credenciales actualizadas')
            } catch (e) {
                logger.error('Error guardando credenciales', e)
            }
        })
        /*if (!sock.authState.creds.registered) {
            console.log('\n🔐 Bot no registrado - Generando código de emparejamiento...\n')
            
            const raw = (await question('🚩 Ingresa tu número (ej: 51910*****): ')) || config.numbot
            const number = raw.replace(/[^0-9]/g, '')
            
            if (typeof sock.requestPairingCode === 'function') {
                const raw_code = await sock.requestPairingCode(number, 'STARTEAM')
                const code = raw_code?.match(/.{1,4}/g)?.join('-') || raw_code
                
                logger.info('🔑 Código de emparejamiento generado', {
                    numero: number.replace(/(\d{3})(\d{4})(\d+)/, '$1****$3')
                })
                
                console.log('🚩 Código de emparejamiento:', code)
                console.log('\n📱 Abre WhatsApp > Dispositivos vinculados > Vincular dispositivo')
                console.log('✍️  Ingresa el código mostrado arriba\n')
            }
        }*/
        if (!sock.authState.creds.registered) {
    console.log('\n🔐 Bot no registrado - Generando código de emparejamiento...\n')
    
    const number = '51920700424'  // Número fijo
    
    if (typeof sock.requestPairingCode === 'function') {
        const raw_code = await sock.requestPairingCode(number, 'STARTEAM')
        const code = raw_code?.match(/.{1,4}/g)?.join('-') || raw_code
        
        logger.info('🔑 Código de emparejamiento generado', {
            numero: number.replace(/(\d{3})(\d{4})(\d+)/, '$1****$3')
        })
        
        console.log('🚩 Código de emparejamiento:', code)
        console.log('\n📱 Abre WhatsApp > Dispositivos vinculados > Vincular dispositivo')
        console.log('✍️  Ingresa el código mostrado arriba\n')
    }
}
        
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return
            
            const processStart = Date.now()
            lastActivity = Date.now()
            if (keepAlive) keepAlive.updateActivity(lastActivity)
            
            logger.info('📨 Mensajes recibidos', {
                cantidad: messages.length,
                tipo: type
            })
            
            for (const msg of messages) {
                if (msg.key.remoteJid?.endsWith('@g.us')) {
                    const jid = msg.key.remoteJid.replace(/:\\d+@/g, '@')
                    if (!groupCache.has(jid)) {
                        getGroupMetadata(jid).catch(() => {})
                    }
                }
                
                if (!msg.message) continue
                if (isJidBroadcast(msg.key.remoteJid ?? '')) continue
                
                if (msg.key.remoteJid?.endsWith('@g.us')) {
                    deletedMessages.set(msg.key.id, { message: msg, timestamp: Date.now() })
                    if (deletedMessages.size > 1000) {
                        const firstKey = deletedMessages.keys().next().value
                        deletedMessages.delete(firstKey)
                    }
                }
                
                if (processedMessages.has(msg.key.id)) continue
                processedMessages.add(msg.key.id)
                setTimeout(() => processedMessages.delete(msg.key.id), PROCESSED_MSG_TTL)
                
                try {
                    await handler(msg, sock, light, caches, config, path.join(__dirname, 'plugins'))
                    
                    const processTime = Date.now() - processStart
                    if (processTime > 1000) {
                        logger.warn('⚠️ Procesamiento lento de mensaje', {
                            id: msg.key.id,
                            tiempo: `${processTime}ms`
                        })
                    }
                } catch (e) {
                    logger.error('Error procesando mensaje', e, {
                        id: msg.key.id,
                        jid: msg.key.remoteJid
                    })
                }
            }
        })
        
        sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
            if (keepAlive) {
                keepAlive.state.isConnected = connection === 'open'
            }
            
            if (connection === 'connecting') {
                logger.connection('connecting')
                console.log('🚩 Conectando...')
                return
            }
            
            if (connection === 'open') {
                reconnecting = false
                reconnectAttempts = 0
                clearTimeout(reconnectTimer)
                lastActivity = Date.now()
                
                logger.connection('open', {
                    jid: sock.user?.jid,
                    tiempoConexion: `${Date.now() - connectionStartTime}ms`
                })
                
                console.log(`\n✅ ${config.name_bot} conectado correctamente`)
                console.log(`📱 Número: ${sock.user?.jid?.split('@')[0]}`)
                console.log(`⏰ Tiempo de conexión: ${Date.now() - connectionStartTime}ms\n`)
                
                // Iniciar KeepAlive
                await keepAlive.start()
                
                try {
                    const chats = await sock.groupFetchAllParticipating?.().catch(() => ({}))
                    if (chats) {
                        for (const [jid, metadata] of Object.entries(chats)) {
                            groupCache.set(jid, metadata)
                        }
                        logger.info('👥 Grupos precargados', {
                            cantidad: Object.keys(chats).length
                        })
                        console.log(`👥 ${Object.keys(chats).length} grupos precargados\n`)
                    }
                } catch (err) {
                    logger.error('Error precargando grupos', err)
                }
                
                await runOnce().catch(e => logger.error('Error en runOnce', e))
                return
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode
                const reason = DisconnectReason
                const errorMsg = lastDisconnect?.error?.message || 'Desconocido'
                
                logger.connection('close', {
                    statusCode,
                    error: errorMsg
                })
                
                console.log(`\n🔌 Conexión cerrada [${statusCode}]: ${errorMsg}`)
                
                if (keepAlive) {
                    keepAlive.state.isConnected = false
                    keepAlive.monitor.incrementReconnects()
                }
                
                const permanentCodes = new Set([
                    reason.loggedOut,
                    reason.forbidden,
                    reason.badSession,
                ])
                
                if (permanentCodes.has(statusCode)) {
                    logger.error('⛔ Desconexión permanente', null, { statusCode })
                    console.log(`\n⛔ Desconexión permanente (código ${statusCode})`)
                    console.log('💡 Solución: Borra la carpeta "./session" y reinicia el bot\n')
                    isShuttingDown = true
                    return
                }
                
                if (!reconnecting && !isShuttingDown) {
                    reconnecting = true
                    const delay = getReconnectDelay(reconnectAttempts)
                    
                    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        reconnectAttempts++
                    } else {
                        logger.warn(`⚠️ Más de ${MAX_RECONNECT_ATTEMPTS} intentos de reconexión`)
                    }
                    
                    console.log(`🔄 Reconectando en ${(delay / 1000).toFixed(1)}s (intento ${reconnectAttempts})…\n`)
                    
                    reconnectTimer = setTimeout(async () => {
                        reconnecting = false
                        await connectSock()
                    }, delay)
                }
            }
        })
        
        sock.ev.on('CB:stream:error', (node) => {
            lastActivity = Date.now()
            if (keepAlive) keepAlive.updateActivity(lastActivity)
            logger.warn('⚠️ Error de stream', { node })
        })
        
        cron.schedule(`*/${config.intervalo || 30} * * * * *`, () => {
            try {
                const totalMB = os.totalmem() / 1_048_576
                const freeMB = os.freemem() / 1_048_576
                const usedMB = totalMB - freeMB
                
                if (usedMB > (config.ram_limit || 1024)) {
                    logger.warn('⚠️ Memoria del sistema alta', {
                        usado: `${usedMB.toFixed(0)}MB`,
                        total: `${totalMB.toFixed(0)}MB`
                    })
                    flushMemory(true)
                }
            } catch (err) {
                logger.error('Error en CRON de monitoreo', err)
            }
        })
        
        return sock
        
    } catch (err) {
        logger.error('Error fatal en conexión', err, {
            intento: reconnectAttempts
        })
        
        if (!isShuttingDown) {
            const delay = getReconnectDelay(reconnectAttempts)
            reconnectAttempts = Math.min(reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS)
            
            console.log(`❌ Error de conexión. Reintentando en ${(delay / 1000).toFixed(1)}s...`)
            
            reconnectTimer = setTimeout(connectSock, delay)
        }
    }
}

setInterval(() => {
    try {
        const rssMB = process.memoryUsage().rss / 1_048_576
        if (rssMB > (config.ram_limit || 512)) {
            flushMemory(true)
        }
    } catch (err) {
        logger.error('Error en monitoreo de memoria', err)
    }
}, MEMORY_CHECK_INTERVAL)

async function start() {
    console.log('\n🤖 Iniciando Starlight Bot...\n')
    console.log(`💻 Sistema: ${os.type()} ${os.release()}`)
    console.log(`🧠 Memoria: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`)
    console.log(`🔧 Node.js: ${process.version}\n`)
    
    logger.info('🚀 Bot iniciado', {
        sistema: os.type(),
        memoria: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`,
        node: process.version,
        timestamp: new Date().toISOString()
    })
    
    await connectSock()
}

start()
