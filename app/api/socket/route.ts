import { NextResponse } from 'next/server'
import { initSocketServer, getIO } from '@/server/socket-server'
import type { SocketRequest, SocketResponse } from '@/types/api'
import type { Server as SocketIOServer } from 'socket.io'
import type { Server as HTTPServer } from 'http'

// Force the route to use the Node.js runtime
export const runtime = 'nodejs'

let io: SocketIOServer | null = null

interface RequestWithSocket extends Request {
  socket?: {
    server?: HTTPServer
  }
}

export async function GET() {
  try {
    const io = getIO()
    return NextResponse.json({ status: 'ok', connected: true } as SocketResponse)
  } catch (error) {
    console.error('Socket GET error:', error)
    return NextResponse.json({ error: 'Socket server not initialized' } as SocketResponse, { status: 500 })
  }
}

export async function POST(req: RequestWithSocket) {
  try {
    const { type } = await req.json() as SocketRequest

    if (type === 'init-socket') {
      // Get the raw request socket
      const { socket } = req
      if (!socket?.server) {
        throw new Error('No HTTP server found')
      }

      if (!io) {
        io = initSocketServer(socket.server)
      }
      return NextResponse.json({ status: 'ok' } as SocketResponse)
    }

    return NextResponse.json({ error: 'Invalid request type' } as SocketResponse, { status: 400 })
  } catch (error) {
    console.error('Socket API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' } as SocketResponse,
      { status: 500 }
    )
  }
} 