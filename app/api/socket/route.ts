import { NextResponse } from 'next/server'
import { Server as SocketIOServer } from 'socket.io'
import { initSocketServer, getIO } from '@/server/socket-server'
import { EVENT_SYSTEM_METRICS } from '@/types/system-health'

// Force the route to use the Node.js runtime
export const runtime = 'nodejs'

let io: SocketIOServer | null = null

export async function GET() {
  try {
    const io = getIO()
    return NextResponse.json({ status: 'ok', message: 'Socket server is running' })
  } catch (error) {
    return NextResponse.json({ status: 'error', message: 'Socket server not initialized' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { type } = await req.json()

    if (type === 'init-socket') {
      // Get the raw request socket
      const { socket } = req as any
      if (!socket?.server) {
        throw new Error('No HTTP server found')
      }

      if (!io) {
        io = initSocketServer(socket.server)
      }
      return NextResponse.json({ status: 'ok' })
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
  } catch (error) {
    console.error('Socket API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 