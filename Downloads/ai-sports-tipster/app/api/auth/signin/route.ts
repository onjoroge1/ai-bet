import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { comparePasswords } from '@/lib/auth'
import { generateToken, setTokenCookie } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  return withRateLimit('signin', async () => {
    try {
      const body = await request.json()
      const { email, password } = body

      if (!email || !password) {
        return NextResponse.json(
          { error: 'Email and password are required' },
          { status: 400 }
        )
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email }
      })

      if (!user) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      // Verify password
      const isValid = await comparePasswords(password, user.password)
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      // Generate token
      const token = await generateToken({
        userId: user.id,
        email: user.email,
        role: user.role
      })

      // Set cookie
      const response = NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      })

      response.cookies.set('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      })

      logger.info('Successful signin', { data: { email, userId: user.id } })
      return response
    } catch (error) {
      logger.error('Sign in error', { error: error as Error })
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
} 