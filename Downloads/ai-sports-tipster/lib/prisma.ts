import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

type PrismaQueryEvent = {
  timestamp: Date
  query: string
  params: string
  duration: number
  target: string
}

type PrismaErrorEvent = {
  timestamp: Date
  message: string
  target: string
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Handle connection errors
if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore - Prisma types are not properly exposed for event handling
  prisma.$on('error', (e: PrismaErrorEvent) => {
    console.error('Prisma Error:', e.message)
  })
} 