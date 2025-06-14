import { SystemHealth } from '../types/system-health';
import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
declare global {
    var prisma: PrismaClient | undefined;
    var io: SocketIOServer | null;
}
export declare function getSystemMetrics(): Promise<SystemHealth>;
