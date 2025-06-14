export type SystemHealth = {
    id: string;
    serverStatus: "healthy" | "degraded" | "down";
    apiResponseTime: number;
    databaseStatus: "healthy" | "degraded" | "down";
    errorRate: number;
    activeConnections: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    lastCheckedAt: Date;
    createdAt: Date;
    updatedAt: Date;
};
export declare const EVENT_SYSTEM_METRICS = "system-metrics";
export declare const HEALTH_THRESHOLDS: {
    readonly CPU: {
        readonly warning: 70;
        readonly critical: 90;
    };
    readonly ERROR_RATE: {
        readonly warning: 2;
        readonly critical: 5;
    };
    readonly MEMORY: {
        readonly warning: 80;
        readonly critical: 90;
    };
    readonly DISK: {
        readonly warning: 80;
        readonly critical: 90;
    };
};
