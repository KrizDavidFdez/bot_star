const os = require('os')
const EventEmitter = require('events')
const { logger, SystemMonitor } = require('./logger.js')

class KeepAlive extends EventEmitter {
    constructor(sock, config = {}) {
        super()
        this.sock = sock
        this.monitor = new SystemMonitor()
        this.config = {
            pingInterval: config.pingInterval || 15000,
            presenceInterval: config.presenceInterval || 45000,
            healthCheckInterval: config.healthCheckInterval || 60000,
            memoryCheckInterval: 15000,
            ramLimit: config.ramLimit || 1024,
            maxInactiveTime: 300000,
            reconnectBaseDelay: config.reconnectBaseDelay || 3000,
            reconnectMaxDelay: config.reconnectMaxDelay || 120000,
            reconnectMultiplier: 1.8,
            maxReconnectAttempts: config.maxReconnectAttempts || 50
        }
        
        this.timers = {
            ping: null,
            presence: null,
            health: null,
            memory: null,
            activity: null
        }
        
        this.state = {
            isConnected: false,
            isReconnecting: false,
            reconnectAttempts: 0,
            totalReconnects: 0,
            lastActivity: Date.now(),
            lastPingSent: null,
            pingLatency: 0,
            connectionStartTime: null,
            isShuttingDown: false
        }
        
        this.setupProcessHandlers()
    }

    setupProcessHandlers() {
        process.on('uncaughtException', (error) => {
            logger.fatal('Excepción no capturada', error, {
                type: 'uncaughtException',
                origin: error.origin || 'unknown'
            })
            this.monitor.incrementErrors()
            
            setTimeout(() => {
                if (!this.state.isShuttingDown) {
                    this.gracefulShutdown('uncaughtException')
                }
            }, 5000)
        })

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Promesa rechazada no manejada', reason, {
                type: 'unhandledRejection'
            })
            this.monitor.incrementErrors()
        })

        process.on('warning', (warning) => {
            logger.warn('Advertencia del proceso', {
                name: warning.name,
                message: warning.message
            })
        })
    }

    async start() {
        logger.info('🚀 KeepAlive Manager iniciado', {
            config: this.config,
            system: {
                platform: os.platform(),
                cpus: os.cpus().length,
                memory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`
            }
        })
        
        console.log('🛡️  Sistema Keep-Alive activado')
        console.log('📊 Monitoreo de salud cada', this.config.healthCheckInterval / 1000, 'segundos')
        console.log('🏓 Ping cada', this.config.pingInterval / 1000, 'segundos')
        
        this.startPingSystem()
        this.startPresenceKeepAlive()
        this.startHealthCheck()
        this.startMemoryMonitor()
        this.startActivityMonitor()
        
        this.emit('started')
    }

    startPingSystem() {
        this.timers.ping = setInterval(async () => {
            try {
                if (!this.sock?.ws || this.sock.ws.readyState !== 1) {
                    logger.debug('Ping saltado - WebSocket no disponible', {
                        wsState: this.sock?.ws?.readyState || 'no-socket'
                    })
                    return
                }
                
                const pingStart = Date.now()
                this.state.lastPingSent = pingStart
                
                await this.sock.sendNode({
                    tag: 'iq',
                    attrs: {
                        id: `ping-${Date.now()}`,
                        to: 's.whatsapp.net',
                        type: 'get',
                        xmlns: 'w:p',
                    },
                    content: [{ tag: 'ping', attrs: {} }]
                })
                
                const latency = Date.now() - pingStart
                this.state.pingLatency = latency
                
                if (latency > 5000) {
                    logger.warn('⚠️ Latencia alta detectada', {
                        latency: `${latency}ms`
                    })
                }
                
            } catch (error) {
                logger.warn('Error en ping', {
                    error: error.message,
                    connected: this.state.isConnected
                })
            }
        }, this.config.pingInterval)
    }

    startPresenceKeepAlive() {
        this.timers.presence = setInterval(async () => {
            try {
                if (!this.sock?.ws || this.sock.ws.readyState !== 1) return
                
                await this.sock.sendNode({
                    tag: 'presence',
                    attrs: { 
                        type: 'available'
                    }
                })
                
            } catch (error) {
            }
        }, this.config.presenceInterval)
    }

    startHealthCheck() {
        this.timers.health = setInterval(() => {
            try {
                const healthStatus = {
                    connection: {
                        isConnected: this.state.isConnected,
                        wsState: this.sock?.ws?.readyState || -1,
                        inactiveTime: Date.now() - this.state.lastActivity,
                        pingLatency: this.state.pingLatency
                    },
                    memory: {
                        rss: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
                        heapUsed: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
                        usagePercent: ((process.memoryUsage().heapUsed / os.totalmem()) * 100).toFixed(1)
                    },
                    reconnects: this.state.totalReconnects,
                    uptime: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`
                }
                
                const issues = []
                
                if (healthStatus.connection.wsState !== 1 && this.state.isConnected) {
                    issues.push('WebSocket no conectado')
                }
                
                if (healthStatus.connection.inactiveTime > this.config.maxInactiveTime) {
                    issues.push(`Inactivo por ${Math.floor(healthStatus.connection.inactiveTime / 1000)}s`)
                }
                
                if (parseFloat(healthStatus.memory.usagePercent) > 90) {
                    issues.push('Uso de memoria crítico')
                    
                    if (global.gc) {
                        global.gc()
                        logger.info('🗑️ Garbage collection forzada')
                    }
                }
                
                if (issues.length > 0) {
                    logger.warn('⚠️ Problemas de salud detectados', { issues })
                    this.monitor.metrics.healthFailures++
                } else {
                    this.monitor.metrics.healthChecks++
                }
                
                if (this.monitor.metrics.healthChecks % 5 === 0) {
                    logger.health('OK', healthStatus)
                }
                
            } catch (error) {
                logger.error('Error en health check', error)
            }
        }, this.config.healthCheckInterval)
    }

    startMemoryMonitor() {
        this.timers.memory = setInterval(() => {
            const memMB = process.memoryUsage().rss / 1024 / 1024
            
            if (memMB > this.config.ramLimit) {
                logger.warn('⚠️ Límite de memoria excedido', {
                    actual: `${memMB.toFixed(2)}MB`,
                    limite: `${this.config.ramLimit}MB`
                })
                
                this.freeUpMemory()
            }
        }, this.config.memoryCheckInterval)
    }

    startActivityMonitor() {
        this.timers.activity = setInterval(() => {
            const inactiveTime = Date.now() - this.state.lastActivity
            
            if (inactiveTime > this.config.maxInactiveTime && this.state.isConnected) {
                logger.warn('⚠️ Inactividad prolongada detectada', {
                    tiempo: `${Math.floor(inactiveTime / 1000)}s`
                })
                
                // Enviar ping manual para verificar conexión
                if (this.sock?.ws?.readyState === 1) {
                    this.sock.sendNode({
                        tag: 'iq',
                        attrs: {
                            id: `wake-${Date.now()}`,
                            to: 's.whatsapp.net',
                            type: 'get',
                            xmlns: 'w:p',
                        },
                        content: [{ tag: 'ping', attrs: {} }]
                    }).catch(() => {})
                }
            }
        }, 30000)
    }

    freeUpMemory() {
        try {
            const before = (process.memoryUsage().rss / 1024 / 1024).toFixed(2)
            
            if (global.gc) {
                global.gc()
            }
            
            if (this.sock?.chats?.clear) this.sock.chats.clear()
            if (this.sock?.groups?.clear) this.sock.groups.clear()
            if (this.sock?.messages?.clear) this.sock.messages.clear()
            
            const after = (process.memoryUsage().rss / 1024 / 1024).toFixed(2)
            logger.info('🧹 Memoria liberada', {
                antes: `${before}MB`,
                despues: `${after}MB`,
                liberado: `${(before - after).toFixed(2)}MB`
            })
            
        } catch (error) {
            logger.error('Error liberando memoria', error)
        }
    }

    updateActivity(timestamp = Date.now()) {
        this.state.lastActivity = timestamp
    }

    getReconnectDelay(attempt) {
        const base = Math.min(
            this.config.reconnectBaseDelay * Math.pow(this.config.reconnectMultiplier, attempt),
            this.config.reconnectMaxDelay
        )
        const jitter = base * 0.3 * Math.random()
        return Math.floor(base + jitter)
    }

    getMetrics() {
        return {
            ...this.monitor.getSystemInfo(),
            connection: {
                isConnected: this.state.isConnected,
                reconnectAttempts: this.state.reconnectAttempts,
                totalReconnects: this.state.totalReconnects,
                pingLatency: `${this.state.pingLatency}ms`,
                lastActivity: `${Math.floor((Date.now() - this.state.lastActivity) / 1000)}s ago`
            }
        }
    }

    stop() {
        Object.values(this.timers).forEach(timer => {
            if (timer) clearInterval(timer)
        })
        logger.info('KeepAlive Manager detenido')
    }

    async gracefulShutdown(reason) {
        if (this.state.isShuttingDown) return
        this.state.isShuttingDown = true
        
        logger.info('🛑 Apagado graceful iniciado', { reason })
        
        this.stop()
        
        if (this.sock) {
            try {
                await this.sock.logout()
            } catch {
                try { this.sock.end() } catch {}
            }
        }
        
        const finalMetrics = this.getMetrics()
        logger.info('📊 Métricas finales', finalMetrics)
        
        setTimeout(() => process.exit(0), 2000)
    }
}

module.exports = KeepAlive