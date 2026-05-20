const { fork } = require('child_process')
const path = require('path')
const http = require('http')

let botProcess = null
let restartCount = 0
let lastRestartTime = 0
const PORT = process.env.PORT || 8000

const MIN_RESTART_INTERVAL = 10000
const RESTART_DELAY = 5000

// Servidor HTTP para Koyeb (keep-alive)
const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
            status: 'alive', 
            botRunning: botProcess !== null && !botProcess.killed,
            restarts: restartCount,
            timestamp: Date.now()
        }))
    } else {
        res.writeHead(404)
        res.end()
    }
})

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor health check corriendo en puerto ${PORT}`)
})

function startBot() {
    const now = Date.now()

    if (now - lastRestartTime < MIN_RESTART_INTERVAL) {
        console.log(`⏳ Esperando ${MIN_RESTART_INTERVAL - (now - lastRestartTime)}ms para reiniciar...`)
        setTimeout(startBot, MIN_RESTART_INTERVAL - (now - lastRestartTime))
        return
    }

    if (botProcess && !botProcess.killed) {
        console.log('⚠️ Bot ya está corriendo')
        return
    }

    restartCount++
    lastRestartTime = Date.now()
    console.log(`🚀 Iniciando bot (intento #${restartCount})...`)

    try {
        botProcess = fork(path.join(__dirname, 'index.js'), [], {
            stdio: 'inherit',
            env: { ...process.env, FORKED: 'true' }
        })

        botProcess.on('exit', (code, signal) => {
            console.log(`❌ Bot finalizado. Código: ${code}, Señal: ${signal}`)
            botProcess = null

            if (Date.now() - lastRestartTime < 10000) {
                console.log('🔄 Reinicio rápido detectado, esperando 30s...')
                setTimeout(startBot, 30000)
            } else {
                console.log(`🔄 Reiniciando en ${RESTART_DELAY/1000}s...`)
                setTimeout(startBot, RESTART_DELAY)
            }
        })

        botProcess.on('error', (err) => {
            console.error('💥 Error en proceso hijo:', err)
            botProcess = null
            setTimeout(startBot, RESTART_DELAY)
        })

        console.log('✅ Bot iniciado correctamente')

    } catch (error) {
        console.error('🔥 Error al iniciar bot:', error)
        setTimeout(startBot, 10000)
    }
}

setInterval(() => {
    if (!botProcess || botProcess.killed) {
        console.log('🔍 Proceso hijo no detectado, iniciando...')
        startBot()
    } else {
        console.log('💚 Bot funcionando correctamente')
    }
}, 30000)

// Manejadores de señal limpios
process.on('SIGTERM', () => {
    console.log('📴 Recibido SIGTERM, cerrando...')
    if (botProcess && !botProcess.killed) {
        botProcess.kill('SIGTERM')
    }
    server.close(() => process.exit(0))
})

process.on('SIGINT', () => {
    console.log('📴 Recibido SIGINT, cerrando...')
    if (botProcess && !botProcess.killed) {
        botProcess.kill('SIGINT')
    }
    server.close(() => process.exit(0))
})

process.on('uncaughtException', (err) => {
    console.error('💣 Excepción no capturada:', err)
})

console.log(`🎯 Main process iniciado en puerto ${PORT}`)
startBot()
