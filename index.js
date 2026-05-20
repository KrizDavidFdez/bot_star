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
    jidNormalizedUser
} = require('@whiskeysockets/baileys')

const pino = require('pino')
const fs = require('fs')
const path = require('path')
const NodeCache = require('node-cache')
const cron = require('node-cron')
const os = require('os')
const http = require('http')
const url = require('url')

// ============ CARGA DE CONFIGURACIÓN ============
let config = {}
try {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'))
    console.log('✅ Configuración cargada correctamente')
} catch (err) {
    console.error('❌ Error cargando config.json:', err.message)
    process.exit(1)
}

// ============ SERVIDOR HTTP ============
const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
    }
    
    const parsedUrl = url.parse(req.url || '', true)
    const pathname = parsedUrl.pathname || '/'
    
    // Endpoint GET /status
    if (pathname === '/status' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
            success: true,
            registered: sock?.authState?.creds?.registered || false,
            connected: sock?.user ? true : false,
            jid: sock?.user?.jid || null,
            uptime: process.uptime(),
            memory: Math.round(process.memoryUsage().rss / 1024 / 1024),
            node: process.version,
            timestamp: new Date().toISOString()
        }))
        return
    }
    
    // Endpoint GET /health
    if (pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        }))
        return
    }
    
    // Endpoint POST /pair (API principal)
    if (pathname === '/pair' && req.method === 'POST') {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', async () => {
            try {
                const data = JSON.parse(body)
                const { number } = data
                
                if (!number) {
                    res.writeHead(400, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({
                        success: false,
                        error: '❌ Número requerido. Ejemplo: {"number": "51920700424"}'
                    }))
                    return
                }
                
                const cleanNumber = number.toString().replace(/[^0-9]/g, '')
                
                if (!sock || typeof sock.requestPairingCode !== 'function') {
                    res.writeHead(503, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({
                        success: false,
                        error: '❌ Bot no inicializado o método no disponible'
                    }))
                    return
                }
                
                console.log(`🔐 API: Generando código para: ${cleanNumber}`)
                
                const raw_code = await sock.requestPairingCode(cleanNumber, 'STARTEAM')
                const code = raw_code?.match(/.{1,4}/g)?.join('-') || raw_code
                
                console.log(`✅ API: Código generado para ${cleanNumber}: ${code}`)
                
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({
                    success: true,
                    number: cleanNumber,
                    code: code,
                    message: '✅ Usa este código en WhatsApp > Dispositivos vinculados > Vincular dispositivo'
                }))
                
            } catch (error) {
                console.error('❌ Error en API /pair:', error)
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }))
            }
        })
        return
    }
    
    // Endpoint GET / (información)
    if (pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Starlight Bot API</title>
                <style>
                    body { font-family: monospace; max-width: 800px; margin: 50px auto; padding: 20px; }
                    h1 { color: #25D366; }
                    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; }
                    pre { background: #f4f4f4; padding: 15px; border-radius: 4px; overflow-x: auto; }
                    .endpoint { margin: 20px 0; border-left: 3px solid #25D366; padding-left: 15px; }
                </style>
            </head>
            <body>
                <h1>🤖 Starlight Bot API</h1>
                <p>✅ Bot funcionando correctamente</p>
                
                <h2>📡 Endpoints disponibles:</h2>
                
                <div class="endpoint">
                    <h3>GET /status</h3>
                    <pre>curl https://${req.headers.host}/status</pre>
                </div>
                
                <div class="endpoint">
                    <h3>GET /health</h3>
                    <pre>curl https://${req.headers.host}/health</pre>
                </div>
                
                <div class="endpoint">
                    <h3>POST /pair</h3>
                    <pre>curl -X POST https://${req.headers.host}/pair \\
  -H "Content-Type: application/json" \\
  -d '{"number":"51920700424"}'</pre>
                </div>
                
                <hr>
                <p><small>Starlight Bot - ${new Date().toLocaleString()}</small></p>
            </body>
            </html>
        `)
        return
    }
    
    // 404 para rutas no encontradas
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ 
        error: '❌ Endpoint no encontrado',
        available: ['GET /', 'GET /status', 'GET /health', 'POST /pair']
    }))
})

const PORT = process.env.PORT || 8000
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ Servidor HTTP corriendo en puerto ${PORT}`)
    console.log(`📍 Endpoints disponibles:`)
    console.log(`   GET  /        - Información de la API`)
    console.log(`   GET  /status  - Estado del bot`)
    console.log(`   GET  /health  - Health check para Koyeb`)
    console.log(`   POST /pair    - Generar código de emparejamiento\n`)
})

// ============ FIN SERVIDOR HTTP ============

// ============ CONFIGURACIÓN DEL BOT ============
const RECONNECT_BASE_DELAY = config.connection?.reconnectBaseDelay || 3000
const RECONNECT_MAX_DELAY = config.connection?.reconnectMaxDelay || 120000
const RECONNECT_MULTIPLIER = 1.8
const MAX_RECONNECT_ATTEMPTS = config.connection?.maxReconnectAttempts || 50

const MEMORY_CHECK_INTERVAL = 15000
const PROCESSED_MSG_TTL = 5 * 60 * 1000
const DELETED_MSG_TTL = 24 * 60 * 60 * 1000
const GROUP_CACHE_TTL = 10 * 60 * 1000
const GROUP_CACHE_CHECK = 2 * 60 * 1000

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
let codeGenerated = false

const silentLogger = pino({ level: 'silent' })

const groupCache = new NodeCache({
    stdTTL: GROUP_CACHE_TTL / 1000,
    checkperiod: GROUP_CACHE_CHECK / 1000,
    useClones: false,
    deleteOnExpire: true
})

// ============ FUNCIONES AUXILIARES ============
async function gracefulShutdown(signal) {
    if (isShuttingDown) return
    isShuttingDown = true
    
    console.log(`\n🛑 Señal ${signal} recibida. Cerrando bot...`)
    
    clearTimeout(reconnectTimer)
    
    if (keepAlive) {
        try { keepAlive.stop() } catch {}
    }
    
    if (sock) {
        try { await sock.logout() } catch {}
        try { sock.end() } catch {}
    }
    
    groupCache.close()
    server.close(() => {
        console.log('👋 Bot cerrado correctamente')
        setTimeout(() => process.exit(0), 1000)
    })
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

function getReconnectDelay(attempt) {
    const base = Math.min(
        RECONNECT_BASE_DELAY * Math.pow(RECONNECT_MULTIPLIER, attempt),
        RECONNECT_MAX_DELAY
    )
    const jitter = base * 0.2 * Math.random()
    return Math.floor(base + jitter)
}

function flushMemory(force = false) {
    try {
        if (global.gc && (force || process.memoryUsage().rss > 512 * 1024 * 1024)) {
            global.gc()
        }
        
        const now = Date.now()
        for (const [id, data] of deletedMessages.entries()) {
            if (now - data.timestamp > DELETED_MSG_TTL) {
                deletedMessages.delete(id)
            }
        }
    } catch (e) {
        console.error('Error en flushMemory:', e)
    }
}

async function getGroupMetadata(jid) {
    try {
        const normalizedJid = jidNormalizedUser(jid)?.replace(/:\\d+@/g, '@')
        if (!normalizedJid || !normalizedJid.endsWith('@g.us')) return null
        
        let metadata = groupCache.get(normalizedJid)
        if (metadata) return metadata
        
        metadata = await sock.groupMetadata(normalizedJid).catch(() => null)
        if (metadata) groupCache.set(normalizedJid, metadata)
        return metadata
    } catch (e) {
        return null
    }
}

// ============ CONEXIÓN PRINCIPAL ============
async function connectSock() {
    if (isShuttingDown) return
    
    connectionStartTime = Date.now()
    
    if (sock) {
        try { sock.ev.removeAllListeners() } catch {}
        try { sock.end('Reconnecting') } catch {}
        sock = null
    }
    
    try {
        const auth = await useMultiFileAuthState('./session')
        state = auth.state
        saveCreds = auth.saveCreds
        
        console.log(`📂 Estado de autenticación: ${state.creds?.registered ? '✅ Registrado' : '❌ No registrado'}`)
        
        const msgRetryCounterCache = new NodeCache({ stdTTL: 60 })
        const { version, isLatest } = await fetchLatestBaileysVersion()
        
        console.log(`📦 Versión de Baileys: ${version.join('.')}`)
        
        sock = makeWASocket({
            version,
            logger: silentLogger,
            printQRInTerminal: false,
            browser: ['StarlightBot', 'Chrome', '121.0.6167.159'],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, silentLogger)
            },
            cachedGroupMetadata: getGroupMetadata,
            msgRetryCounterCache,
            generateHighQualityLinkPreview: true,
            getMessage: async () => null,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 30000,
            keepAliveIntervalMs: 30000,
            retryRequestDelayMs: 1000,
            maxMsgRetryCount: 5,
            fireInitQueries: true,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            shouldSyncHistoryMessage: () => false,
            shouldIgnoreJid: (jid) => isJidBroadcast(jid),
            maxRetries: 5,
        })
        
        // Importar KeepAlive después de crear sock
        const KeepAlive = require('./lib/keep-alive.js')
        keepAlive = new KeepAlive(sock, {
            pingInterval: config.connection?.pingInterval || 15000,
            presenceInterval: config.connection?.presenceInterval || 45000,
            healthCheckInterval: config.connection?.healthCheckInterval || 60000,
            ramLimit: config.ram_limit || 1024,
            reconnectBaseDelay: RECONNECT_BASE_DELAY,
            reconnectMaxDelay: RECONNECT_MAX_DELAY,
            maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS
        })
        
        const { bailMessage } = require('./lib/Message')
        const light = bailMessage(sock)
        
        // ============ EVENTOS ============
        sock.ev.on('creds.update', async (creds) => {
            await saveCreds(creds)
            lastActivity = Date.now()
            if (keepAlive) keepAlive.updateActivity(lastActivity)
        })
        
        // ============ GENERAR CÓDIGO DE PAREAMIENTO ============
        if (!sock.authState.creds.registered && !codeGenerated) {
            codeGenerated = true
            
            console.log('\n' + '='.repeat(60))
            console.log('🔐 BOT NO REGISTRADO - GENERANDO CÓDIGO DE PAREAMIENTO')
            console.log('='.repeat(60))
            
            const defaultNumber = config.numbot || "51920700424"
            const cleanNumber = defaultNumber.toString().replace(/[^0-9]/g, '')
            
            console.log(`📱 Número configurado: ${cleanNumber}`)
            console.log(`💡 También puedes usar: POST /pair con {"number":"tu_numero"}\n`)
            
            if (typeof sock.requestPairingCode === 'function') {
                try {
                    // Esperar a que la conexión se estabilice
                    await new Promise(resolve => setTimeout(resolve, 3000))
                    
                    const raw_code = await sock.requestPairingCode(cleanNumber, 'STARTEAM')
                    const code = raw_code?.match(/.{1,4}/g)?.join('-') || raw_code
                    
                    console.log('\n' + '🚨'.repeat(20))
                    console.log(`🎯 CÓDIGO DE PAREAMIENTO: ${code}`)
                    console.log('🚨'.repeat(20))
                    console.log('\n📱 INSTRUCCIONES:')
                    console.log('   1. Abre WhatsApp en tu teléfono')
                    console.log('   2. Ve a Ajustes/Configuración')
                    console.log('   3. Dispositivos vinculados')
                    console.log('   4. Toca "Vincular dispositivo"')
                    console.log(`   5. Ingresa el código: ${code}`)
                    console.log('\n⏰ El código expira en 2 minutos\n')
                    
                } catch (error) {
                    console.error('❌ Error generando código:', error.message)
                }
            }
        } else if (sock.authState.creds.registered) {
            console.log('\n✅ BOT YA ESTÁ REGISTRADO Y FUNCIONANDO\n')
        }
        
        // ============ MANEJO DE MENSAJES ============
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return
            
            lastActivity = Date.now()
            if (keepAlive) keepAlive.updateActivity(lastActivity)
            
            for (const msg of messages) {
                if (!msg.message) continue
                if (isJidBroadcast(msg.key.remoteJid ?? '')) continue
                
                if (processedMessages.has(msg.key.id)) continue
                processedMessages.add(msg.key.id)
                setTimeout(() => processedMessages.delete(msg.key.id), PROCESSED_MSG_TTL)
                
                try {
                    const handler = require('./starlight.js')
                    await handler(msg, sock, light, caches, config, path.join(__dirname, 'plugins'))
                } catch (e) {
                    console.error('Error procesando mensaje:', e)
                }
            }
        })
        
        // ============ MANEJO DE CONEXIÓN ============
        sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
            if (connection === 'open') {
                reconnecting = false
                reconnectAttempts = 0
                clearTimeout(reconnectTimer)
                
                console.log(`\n✅ ${config.name_bot || 'Starlight'} conectado correctamente`)
                console.log(`📱 Número: ${sock.user?.jid?.split('@')[0]}`)
                console.log(`⏰ Tiempo de conexión: ${Date.now() - connectionStartTime}ms\n`)
                
                await keepAlive.start()
                
                try {
                    const { runOnce } = require('./lib/jadibot')
                    await runOnce().catch(e => console.error('Error en runOnce:', e))
                } catch {}
                return
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode
                const errorMsg = lastDisconnect?.error?.message || 'Desconocido'
                
                console.log(`\n🔌 Conexión cerrada [${statusCode}]: ${errorMsg}`)
                
                if (keepAlive) keepAlive.state.isConnected = false
                
                const permanentCodes = [DisconnectReason.loggedOut, DisconnectReason.forbidden, DisconnectReason.badSession]
                if (permanentCodes.includes(statusCode)) {
                    console.log('\n⛔ Desconexión permanente')
                    console.log('💡 Solución: Borra la carpeta "./session" y reinicia el bot\n')
                    isShuttingDown = true
                    return
                }
                
                if (!reconnecting && !isShuttingDown) {
                    reconnecting = true
                    const delay = getReconnectDelay(reconnectAttempts)
                    reconnectAttempts = Math.min(reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS)
                    
                    console.log(`🔄 Reconectando en ${(delay / 1000).toFixed(1)}s (intento ${reconnectAttempts})\n`)
                    
                    reconnectTimer = setTimeout(() => {
                        reconnecting = false
                        connectSock()
                    }, delay)
                }
            }
        })
        
        // Monitoreo de memoria
        setInterval(() => {
            const rssMB = process.memoryUsage().rss / 1048576
            if (rssMB > (config.ram_limit || 512)) flushMemory(true)
        }, MEMORY_CHECK_INTERVAL)
        
    } catch (err) {
        console.error('❌ Error fatal en conexión:', err.message)
        
        if (!isShuttingDown) {
            const delay = getReconnectDelay(reconnectAttempts)
            reconnectAttempts = Math.min(reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS)
            
            console.log(`❌ Error de conexión. Reintentando en ${(delay / 1000).toFixed(1)}s...`)
            reconnectTimer = setTimeout(connectSock, delay)
        }
    }
}

// ============ INICIO ============
async function start() {
    console.log('\n' + '='.repeat(60))
    console.log('🤖 Iniciando Starlight Bot...')
    console.log('='.repeat(60))
    console.log(`💻 Sistema: ${os.type()} ${os.release()}`)
    console.log(`🧠 Memoria: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`)
    console.log(`🔧 Node.js: ${process.version}`)
    console.log(`🌐 Puerto API: ${PORT}\n`)
    
    await connectSock()
}

start()
