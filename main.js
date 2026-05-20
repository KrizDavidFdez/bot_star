const { fork } = require('child_process')
const path = require('path')

let botProcess = null
let restartCount = 0
let lastRestartTime = 0

const MIN_RESTART_INTERVAL = 10000
const RESTART_DELAY = 5000

function startBot() {
    const now = Date.now()

    if (now - lastRestartTime < MIN_RESTART_INTERVAL) {
        setTimeout(startBot, MIN_RESTART_INTERVAL - (now - lastRestartTime))
        return
    }

    if (botProcess && !botProcess.killed) {
        return
    }

    restartCount++
    lastRestartTime = Date.now()

    try {
        botProcess = fork(path.join(__dirname, 'index.js'), [], {
            stdio: 'inherit',
            env: { ...process.env, FORKED: 'true' }
        })

        botProcess.on('exit', (code, signal) => {
            botProcess = null

            if (Date.now() - lastRestartTime < 10000) {
                setTimeout(startBot, 30000)
            } else {
                setTimeout(startBot, RESTART_DELAY)
            }
        })

        botProcess.on('error', (err) => {
            botProcess = null
            setTimeout(startBot, RESTART_DELAY)
        })

    } catch (error) {
        setTimeout(startBot, 10000)
    }
}

setInterval(() => {
    if (!botProcess || botProcess.killed) {
        startBot()
    }
}, 30000)

process.on('SIGTERM', () => {})
process.on('SIGINT', () => {})
process.on('uncaughtException', (err) => {})

startBot()