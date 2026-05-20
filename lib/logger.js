const pino = require('pino')
const fs = require('fs')
const path = require('path')
const os = require('os')

const logsDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
}

class LogRotator {
    constructor(logPath, maxSize = 10 * 1024 * 1024, maxFiles = 7) {
        this.logPath = logPath
        this.maxSize = maxSize
        this.maxFiles = maxFiles
        this.checkRotation()
    }

    checkRotation() {
        try {
            if (fs.existsSync(this.logPath)) {
                const stats = fs.statSync(this.logPath)
                if (stats.size > this.maxSize) {
                    this.rotate()
                }
            }
        } catch (err) {
            console.error('[LogRotator] Error:', err.message)
        }
    }

    rotate() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            const rotatedPath = this.logPath.replace('.log', `-${timestamp}.log`)
            
            fs.renameSync(this.logPath, rotatedPath)
            
            const logDir = path.dirname(this.logPath)
            const baseName = path.basename(this.logPath, '.log')
            const files = fs.readdirSync(logDir)
                .filter(f => f.startsWith(baseName) && f.endsWith('.log'))
                .map(f => ({
                    name: f,
                    path: path.join(logDir, f),
                    time: fs.statSync(path.join(logDir, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time)

            files.slice(this.maxFiles).forEach(file => {
                fs.unlinkSync(file.path)
            })
        } catch (err) {
            console.error('[LogRotator] Error rotando:', err.message)
        }
    }
}

const createFileTransport = (logPath) => ({
    write: (data) => {
        try {
            const logEntry = typeof data === 'object' 
                ? JSON.stringify(data) + '\n'
                : data + '\n'
            fs.appendFileSync(logPath, logEntry, 'utf8')
        } catch (err) {
            console.error('[LoggerTransport] Error:', err.message)
        }
    }
})

const rotators = {
    main: new LogRotator(path.join(logsDir, 'bot-main.log')),
    error: new LogRotator(path.join(logsDir, 'bot-error.log')),
    connection: new LogRotator(path.join(logsDir, 'bot-connection.log')),
    health: new LogRotator(path.join(logsDir, 'bot-health.log')),
    messages: new LogRotator(path.join(logsDir, 'bot-messages.log')),
    debug: new LogRotator(path.join(logsDir, 'bot-debug.log')),
    performance: new LogRotator(path.join(logsDir, 'bot-performance.log'))
}

// Logger principal
const mainLogger = pino({
    level: 'info',
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    formatters: {
        level(label) {
            return { level: label.toUpperCase() }
        }
    }
}, pino.multistream([
    { 
        stream: createFileTransport(path.join(logsDir, 'bot-main.log')),
        level: 'info'
    },
    {
        stream: createFileTransport(path.join(logsDir, 'bot-error.log')),
        level: 'error'
    },
    {
        stream: process.stdout,
        level: 'info'
    }
]))

const connectionLogger = pino({
    level: 'debug',
    timestamp: () => `,"time":"${new Date().toISOString()}"`
}, createFileTransport(path.join(logsDir, 'bot-connection.log')))

const healthLogger = pino({
    level: 'debug',
    timestamp: () => `,"time":"${new Date().toISOString()}"`
}, createFileTransport(path.join(logsDir, 'bot-health.log')))

const messageLogger = pino({
    level: 'debug',
    timestamp: () => `,"time":"${new Date().toISOString()}"`
}, createFileTransport(path.join(logsDir, 'bot-messages.log')))

const performanceLogger = pino({
    level: 'info',
    timestamp: () => `,"time":"${new Date().toISOString()}"`
}, createFileTransport(path.join(logsDir, 'bot-performance.log')))

class SystemMonitor {
    constructor() {
        this.startTime = Date.now()
        this.metrics = {
            messagesProcessed: 0,
            errors: 0,
            reconnects: 0,
            healthChecks: 0,
            healthFailures: 0
        }
    }

    getSystemInfo() {
        const memUsage = process.memoryUsage()
        return {
            timestamp: new Date().toISOString(),
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            memory: {
                rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`,
                heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
                heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
                external: `${(memUsage.external / 1024 / 1024).toFixed(2)}MB`,
                usagePercent: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1)
            },
            cpu: {
                loadAvg: os.loadavg(),
                cpus: os.cpus().length
            },
            system: {
                totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`,
                freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)}GB`,
                uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version
            },
            metrics: this.metrics
        }
    }

    logHealth() {
        const info = this.getSystemInfo()
        this.metrics.healthChecks++
        const memPercent = parseFloat(info.memory.usagePercent)
        if (memPercent > 90) {
            this.metrics.healthFailures++
            mainLogger.error('CRITICAL: Memory usage critical', info)
        } else if (memPercent > 70) {
            mainLogger.warn('WARNING: High memory usage', info)
        }
        
        healthLogger.info(info, 'Health check')
    }

    logPerformance(operation, duration) {
        performanceLogger.info({
            operation,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
        })
    }

    incrementMessages() {
        this.metrics.messagesProcessed++
    }

    incrementErrors() {
        this.metrics.errors++
    }

    incrementReconnects() {
        this.metrics.reconnects++
    }
}

const logger = {
    info: (message, context = {}) => {
        const data = {
            event: message,
            ...context,
            timestamp: new Date().toISOString()
        }
        mainLogger.info(data)
        rotators.main.checkRotation()
    },
    
    debug: (message, context = {}) => {
        const data = {
            event: message,
            ...context,
            timestamp: new Date().toISOString()
        }
        mainLogger.debug(data)
        rotators.debug.checkRotation()
    },
    
    warn: (message, context = {}) => {
        const data = {
            event: message,
            ...context,
            timestamp: new Date().toISOString()
        }
        mainLogger.warn(data)
        rotators.main.checkRotation()
    },
    
    error: (message, error = null, context = {}) => {
        const data = {
            event: message,
            error: error ? {
                message: error.message,
                stack: error.stack,
                code: error.code || error.statusCode
            } : null,
            ...context,
            timestamp: new Date().toISOString()
        }
        mainLogger.error(data)
        rotators.main.checkRotation()
        rotators.error.checkRotation()
    },
    
    fatal: (message, error = null, context = {}) => {
        const data = {
            event: `FATAL: ${message}`,
            error: error ? {
                message: error.message,
                stack: error.stack
            } : null,
            ...context,
            timestamp: new Date().toISOString(),
            severity: 'CRITICAL'
        }
        mainLogger.fatal(data)
        rotators.main.checkRotation()
        rotators.error.checkRotation()
    },
    
    connection: (state, context = {}) => {
        const icons = {
            connecting: '🔗',
            open: '✅',
            close: '🔌',
            reconnecting: '🔄',
            error: '❌'
        }
        
        const data = {
            state,
            icon: icons[state] || '📡',
            ...context,
            timestamp: new Date().toISOString()
        }
        connectionLogger.info(data)
        rotators.connection.checkRotation()
    },
    
    health: (status, context = {}) => {
        const data = {
            status,
            ...context,
            timestamp: new Date().toISOString()
        }
        healthLogger.info(data)
        rotators.health.checkRotation()
    },
    
    message: (type, context = {}) => {
        const data = {
            type,
            ...context,
            timestamp: new Date().toISOString()
        }
        messageLogger.info(data)
        rotators.messages.checkRotation()
    }
}

module.exports = { 
    logger,
    SystemMonitor,
    mainLogger,
    connectionLogger,
    healthLogger,
    messageLogger,
    performanceLogger
}