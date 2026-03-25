import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Validate DATABASE_URL is set before initializing Prisma
if (!process.env.DATABASE_URL) {
  throw new Error(
    '❌ DATABASE_URL environment variable is not set. ' +
    'Please ensure you have a .env.local file with DATABASE_URL configured. ' +
    'See env.example for reference.'
  )
}

// Prisma automatically reads DATABASE_URL from environment variables
// No need to explicitly pass it unless we need to override it
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Add connection health check (server-side only)
if (typeof (globalThis as any).window === 'undefined') {
  prisma.$connect()
    .then(() => {
      console.log('✅ Database connected successfully')
    })
    .catch((error) => {
      console.error('❌ Database connection failed:', error)
    })

  // Graceful shutdown — only register once to avoid MaxListenersExceededWarning
  if (!(globalThis as any).__prismaBeforeExitRegistered) {
    (globalThis as any).__prismaBeforeExitRegistered = true
    process.on('beforeExit', async () => {
      await prisma.$disconnect()
    })
  }
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Database connection health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Database connection check failed:', error)
    return false
  }
}

export default prisma