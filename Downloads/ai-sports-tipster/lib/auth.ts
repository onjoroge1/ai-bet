import { jwtVerify, SignJWT } from 'jose'
import * as bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"

// Use environment variables for secrets
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set')
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

export function setTokenCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set({
    name: 'token',
    value: token,
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
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
  }
  
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: string
    }
  }
}

export const authOptions = {
  secret: JWT_SECRET,
  session: {
    strategy: "jwt" as const,
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  jwt: {
    maxAge: 7 * 24 * 60 * 60, // 7 days
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
        if (!credentials?.email || !credentials.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email,
          },
          select: {
            id: true,
            email: true,
            password: true,
            fullName: true,
            role: true,
          },
        })

        if (!user || !user.password) {
          return null
        }

        try {
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
          if (!isPasswordValid) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.fullName,
            role: user.role,
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
        // Initial sign in
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.role = user.role
      }
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token) {
        session.user.id = token.id
        session.user.email = token.email
        session.user.name = token.name
        session.user.role = token.role
      }
      return session
    },
  },
  debug: process.env.NODE_ENV === 'development',
}

export default NextAuth(authOptions) 