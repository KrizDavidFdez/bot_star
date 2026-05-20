const { fork } = require('child_process');
const path = require('path');
const http = require('http');
const os = require('os');

class BotManager {
    constructor(options = {}) {

        this.botScript = options.script || path.join(__dirname, 'index.js');
        this.port = process.env.PORT || 8000;
        this.targetRam = options.targetRam || 70;
        this.maxRamParent = options.maxRamParent || 150;
        this.maxRamChild = options.maxRamChild || 120; 

        this.restartDelay = 5000;
        this.crashCooldown = 30000;
        this.preventiveRestartMs = (options.preventiveRestartHours || 6) * 60 * 60 * 1000;

        this.process = null;
        this.isShuttingDown = false;
        this.restartCount = 0;
        this.lastStart = 0;
      
        this.gcInterval = null;
        this.preventiveTimer = null;
        this.monitorInterval = null;

        this.init();
    }

    init() {
        this.startHealthServer();
        this.startGarbageCollector();
        this.startPreventiveRestart();
        this.spawnBot();
        
        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
        process.on('SIGINT', () => this.shutdown('SIGINT'));
        process.on('uncaughtException', (err) => this.handleError('Uncaught Exception', err));
        process.on('unhandledRejection', (reason) => this.handleError('Unhandled Rejection', reason));
    }


    startHealthServer() {
        const server = http.createServer((req, res) => {
            const mem = process.memoryUsage();
            const response = {
                status: 'ok',
                uptime: process.uptime(),
                restarts: this.restartCount,
                memory: {
                    heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
                    rss: (mem.rss / 1024 / 1024).toFixed(2) + ' MB'
                },
                botActive: this.process !== null && !this.process.killed
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
        });

        server.listen(this.port, '0.0.0.0', () => {
            this.log(`🚀 Supervisor activo en puerto ${this.port}`);
        });
    }

    startGarbageCollector() {
        if (global.gc) {
            this.gcInterval = setInterval(() => {
                global.gc();
            }, 60000);
        } else {
        }
    }

    startPreventiveRestart() {
        this.preventiveTimer = setInterval(() => {
            if (!this.isShuttingDown && this.process) {
                this.log(`⏰ Reinicio preventivo programado (Limpieza de RAM)`);
                this.killProcess('PREVENTIVE_RESTART');
            }
        }, this.preventiveRestartMs);
    }

    spawnBot() {
        if (this.isShuttingDown) return;
        const now = Date.now();
        if (now - this.lastStart < this.crashCooldown) {
            this.log(`⚠️ Crash loop detectado. Esperando ${this.crashCooldown/1000}s...`);
            setTimeout(() => this.spawnBot(), this.crashCooldown);
            return;
        }

        this.lastStart = now;
        this.restartCount++;
        this.log(`📦 Iniciando Bot (Intento #${this.restartCount})...`);

        try {
            this.process = fork(this.botScript, [], {
                stdio: 'inherit',
                execArgv: ['--expose-gc'], 
                env: { ...process.env, IS_FORKED: 'true' }
            });

            this.process.on('exit', (code, signal) => {
                this.process = null;
                this.log(`❌ Bot terminado. Código: ${code}, Señal: ${signal}`);
                
                if (!this.isShuttingDown) {
                    const delay = (signal === 'SIGKILL' && code === null) ? this.restartDelay : this.crashCooldown;
                    setTimeout(() => this.spawnBot(), delay);
                }
            });

            this.process.on('error', (err) => {
                this.log(`💥 Error al iniciar proceso hijo: ${err.message}`);
                this.process = null;
                setTimeout(() => this.spawnBot(), this.crashCooldown);
            });

        } catch (e) {
            this.log(`🔥 Error crítico en spawn: ${e.message}`);
            setTimeout(() => this.spawnBot(), this.crashCooldown);
        }
    }

    killProcess(reason) {
        if (this.process && !this.process.killed) {
            this.log(`💀 Matando bot por: ${reason}`);
            this.process.kill('SIGKILL'); 
        }
    }


    monitorMemory() {
        const mb = process.memoryUsage().heapUsed / 1024 / 1024;
      
        if (mb > this.maxRamParent) {
            console.error(`🚨 CRÍTICO: Supervisor usando ${mb.toFixed(2)}MB. Reiniciando todo...`);
            process.exit(1); 
        }
    }

    handleError(context, error) {
        console.error(`💣 [${context}]`, error);
    }

    shutdown(signal) {
        this.log(`📴 Apagado ordenado (${signal})...`);
        this.isShuttingDown = true;
        
        clearInterval(this.gcInterval);
        clearInterval(this.preventiveTimer);
        
        if (this.process) this.process.kill('SIGTERM');
        
        setTimeout(() => process.exit(0), 5000);
    }

    log(msg) {
        console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
    }
}

new BotManager({
    targetRam: 70,
    preventiveRestartHours: 6 
});
