import { jwtVerify, SignJWT } from 'jose'
import * as bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import prisma from "@/lib/db"

// Use environment variables for secrets
// NextAuth can use either NEXTAUTH_SECRET or JWT_SECRET, but prefers NEXTAUTH_SECRET
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET or NEXTAUTH_SECRET environment variable must be set')
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const secretKey = encoder.encode(JWT_SECRET)
    
    await jwtVerify(token, secretKey)
    return true
  } catch (error) {
    console.error('Token verification failed:', error)
    return false
  }
}

export async function comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

interface TokenPayload {
  userId: string
  email: string
  role: string
  [key: string]: string
}

/**
 * @deprecated This function is for legacy/API-only use, not for web session auth.
 * For web authentication, use NextAuth's signIn() which handles token generation automatically.
 * This helper may be used for stateless API tokens or other non-web flows.
 */
export async function generateToken(payload: TokenPayload): Promise<string> {
  const encoder = new TextEncoder()
  const secretKey = encoder.encode(JWT_SECRET)
  
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey)
    
  return token
}

export async function getTokenPayload(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET), {
      algorithms: ['HS256'],
    });
    return payload as TokenPayload;
  } catch (error) {
    // This can happen if the token is invalid, expired, etc.
    console.error("Failed to get token payload", { error: error as Error });
    return null;
  }
}

/**
 * @deprecated This function is for legacy/API-only use, not for web session auth.
 * For web authentication, NextAuth handles cookie setting automatically via its session system.
 * This helper may be used for stateless API tokens or other non-web flows.
 */
export function setTokenCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set({
    name: 'token',
    value: token,
    httpOnly: true,
    path: '/',
    maxAge: 24 * 60 * 60, // 24 hours
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  })
  return response
}

declare module "next-auth" {
  interface User {
    id: string
    email: string
    fullName?: string | null
    role: string
    referralCode?: string | null
  }
  
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: string
      referralCode?: string | null
    }
  }
}

export const authOptions = {
  secret: NEXTAUTH_SECRET,
  session: {
    strategy: "jwt" as const,
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // Update session every hour
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' 
        ? '__Secure-next-auth.session-token' 
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60, // 24 hours
      },
    },
  },
  pages: {
    signIn: "/signin",
  },
  providers: [
    CredentialsProvider({
      name: "Sign in",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "example@example.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Explicit validation: ensure credentials exist and are not empty strings
        if (!credentials?.email || !credentials.password) {
          console.log('NextAuth authorize: Missing credentials', { 
            hasEmail: !!credentials?.email, 
            hasPassword: !!credentials?.password 
          })
          return null
        }

        // Trim and validate email/password are not just whitespace
        const trimmedEmail = credentials.email.trim()
        const trimmedPassword = credentials.password.trim()

        if (!trimmedEmail || !trimmedPassword) {
          console.log('NextAuth authorize: Empty credentials after trim', { 
            emailLength: trimmedEmail.length, 
            passwordLength: trimmedPassword.length 
          })
          return null
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(trimmedEmail)) {
          console.log('NextAuth authorize: Invalid email format', { email: trimmedEmail })
          return null
        }

        console.log('NextAuth authorize: Validating credentials for user', { email: trimmedEmail })

        const user = await prisma.user.findUnique({
          where: {
            email: trimmedEmail,
          },
          select: {
            id: true,
            email: true,
            password: true,
            fullName: true,
            role: true,
            referralCodes: {
              where: { isActive: true },
              select: { code: true },
              take: 1
            },
          },
        })

        if (!user || !user.password) {
          console.log('NextAuth authorize: User not found or no password', { 
            userFound: !!user, 
            hasPassword: !!user?.password 
          })
          return null
        }

        try {
          console.log('NextAuth authorize: Comparing password for user', { userId: user.id, email: user.email })
          const isPasswordValid = await bcrypt.compare(trimmedPassword, user.password)
          if (!isPasswordValid) {
            console.log('NextAuth authorize: Password mismatch for user', { userId: user.id, email: user.email })
            return null
          }

          console.log('NextAuth authorize: Authentication successful', { userId: user.id, email: user.email, role: user.role })
          return {
            id: user.id,
            email: user.email,
            name: user.fullName,
            role: user.role,
            referralCode: user.referralCodes[0]?.code || null,
          }
        } catch (error) {
          console.error('Error comparing passwords:', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }: { token: any; user: any; account: any }) {
      if (user) {
        // Initial sign in - only log in development
        if (process.env.NODE_ENV === 'development') {
          console.log('NextAuth JWT callback - Creating new token for user', {
            userId: user.id,
            email: user.email,
            role: user.role,
          })
        }
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.role = user.role
        token.referralCode = user.referralCode
      }
      // Token refresh - no logging (happens frequently, expected behavior)
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token) {
        // Session callback runs on every /api/auth/session call (expected with server-side first architecture)
        // Only log errors or important events, not every invocation
        session.user.id = token.id
        session.user.email = token.email
        session.user.name = token.name
        session.user.role = token.role
        session.user.referralCode = token.referralCode
      } else {
        // Only log if there's an issue (no token when expected)
        if (process.env.NODE_ENV === 'development') {
          console.warn('NextAuth Session callback - No token available (user may not be authenticated)')
        }
      }
      return session
    },
  },
  debug: process.env.NODE_ENV === 'development',
}

export default NextAuth(authOptions) 