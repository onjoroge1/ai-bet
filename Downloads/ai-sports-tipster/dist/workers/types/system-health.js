"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HEALTH_THRESHOLDS = exports.EVENT_SYSTEM_METRICS = void 0;
exports.EVENT_SYSTEM_METRICS = 'system-metrics';
exports.HEALTH_THRESHOLDS = {
    CPU: { warning: 70, critical: 90 },
    ERROR_RATE: { warning: 2, critical: 5 },
    MEMORY: { warning: 80, critical: 90 },
    DISK: { warning: 80, critical: 90 }
};
//# sourceMappingURL=system-health.js.map