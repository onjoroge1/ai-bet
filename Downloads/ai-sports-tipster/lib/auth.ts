import { jwtVerify, SignJWT } from 'jose'
import { compare, hash } from 'bcryptjs'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

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
  return compare(plainPassword, hashedPassword)
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12)
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

export function setTokenCookie(response: Response, token: string): void {
  response.headers.set(
    'Set-Cookie',
    `token=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  )
} 