import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { logger } from '@/lib/logger'

let io: SocketIOServer | null = null

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  })

  io.on('connection', (socket) => {
    logger.info('Client connected to socket server', {
      tags: ['socket', 'connection'],
      data: { socketId: socket.id }
    })

    socket.on('disconnect', () => {
      logger.info('Client disconnected from socket server', {
        tags: ['socket', 'disconnection'],
        data: { socketId: socket.id }
      })
    })
  })

  return io
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket server not initialized')
  }
  return io
} 