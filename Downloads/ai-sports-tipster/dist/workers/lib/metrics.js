"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemMetrics = getSystemMetrics;
const _os = __importStar(require("os"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const system_health_1 = require("../types/system-health");
const client_1 = require("@prisma/client");
// Runtime guard for Node.js built-ins
const os = (_os && typeof _os.cpus === 'function') ? _os : null;
if (!os) {
    throw new Error('Node "os" module unavailable – worker built for browser?');
}
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// Singleton Prisma instance
const prisma = globalThis.prisma ?? new client_1.PrismaClient();
if (process.env.NODE_ENV !== 'production')
    globalThis.prisma = prisma;
// Helper to round numbers to 2 decimal places
const round = (n) => Number(n.toFixed(2));
async function getSystemMetrics() {
    try {
        // Get CPU usage
        const cpus = os.cpus();
        const cpuUsage = round(cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b);
            const idle = cpu.times.idle;
            return acc + ((total - idle) / total) * 100;
        }, 0) / cpus.length);
        // Get memory usage
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memoryUsage = round(((totalMem - freeMem) / totalMem) * 100);
        // Get disk usage (cross-platform)
        let diskUsage = 0;
        try {
            if (process.platform === 'win32') {
                const { stdout } = await execAsync('powershell -Command "Get-PSDrive -PSProvider FileSystem | ' +
                    'Select-Object Used,Free | ConvertTo-Json"');
                const drives = JSON.parse(stdout);
                const totals = drives.reduce((a, d) => ({
                    used: a.used + d.Used,
                    free: a.free + d.Free
                }), { used: 0, free: 0 });
                diskUsage = round((totals.used / (totals.used + totals.free)) * 100);
            }
            else {
                const { stdout } = await execAsync('df -kP /');
                const [, size, used] = stdout.trim().split('\n')[1].split(/\s+/);
                diskUsage = round((+used / +size) * 100);
            }
        }
        catch (error) {
            console.error('Error getting disk usage:', error);
        }
        // Get active connections from Socket.IO if available
        // Note: This should be moved to the main thread or passed via message
        const activeConnections = globalThis.io?.engine?.clientsCount ?? 0;
        // Calculate API response time (simplified for now)
        // TODO: Replace with real API monitoring in production
        const apiResponseTime = process.env.NODE_ENV === 'production'
            ? 0
            : round(Math.random() * 100);
        // Calculate error rate (simplified for now)
        // TODO: Replace with real error tracking in production
        const errorRate = process.env.NODE_ENV === 'production'
            ? 0
            : round(Math.random() * 5);
        // Determine status based on metrics
        const getStatus = (value, thresholds) => {
            if (value >= thresholds.critical)
                return 'down';
            if (value >= thresholds.warning)
                return 'degraded';
            return 'healthy';
        };
        const serverStatus = getStatus(cpuUsage, system_health_1.HEALTH_THRESHOLDS.CPU);
        const databaseStatus = getStatus(errorRate, system_health_1.HEALTH_THRESHOLDS.ERROR_RATE);
        try {
            // Use Prisma's create instead of raw SQL
            const result = await prisma.$queryRaw `
        INSERT INTO "SystemHealth" (
          "id",
          "serverStatus",
          "apiResponseTime",
          "databaseStatus",
          "errorRate",
          "activeConnections",
          "cpuUsage",
          "memoryUsage",
          "diskUsage",
          "lastCheckedAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          gen_random_uuid(),
          ${serverStatus},
          ${apiResponseTime},
          ${databaseStatus},
          ${errorRate},
          ${activeConnections},
          ${cpuUsage},
          ${memoryUsage},
          ${diskUsage},
          ${new Date()},
          ${new Date()},
          ${new Date()}
        )
        RETURNING *
      `;
            return result[0];
        }
        catch (error) {
            console.error('Error saving system metrics:', error);
            // Return metrics without saving to database
            return {
                id: 'temp-' + Date.now(),
                serverStatus,
                apiResponseTime,
                databaseStatus,
                errorRate,
                activeConnections,
                cpuUsage,
                memoryUsage,
                diskUsage,
                lastCheckedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }
    }
    catch (error) {
        console.error('Error in getSystemMetrics:', error);
        throw error; // Let the worker handle the retry logic
    }
}
//# sourceMappingURL=metrics.js.map