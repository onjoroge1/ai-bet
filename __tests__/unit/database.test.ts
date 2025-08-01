import { checkDatabaseConnection } from '@/lib/db'
import { userDb } from '@/lib/database'

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    $queryRaw: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  }
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  }
})

// Mock neon
jest.mock('@neondatabase/serverless', () => {
  const mockSql = jest.fn()
  return {
    neon: jest.fn(() => mockSql),
  }
})

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb'

describe('Database Client', () => {
  let mockPrismaClient: any
  let mockSql: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked instances
    const { PrismaClient } = require('@prisma/client')
    const { neon } = require('@neondatabase/serverless')
    
    mockPrismaClient = new PrismaClient()
    mockSql = neon()
  })

  describe('checkDatabaseConnection', () => {
    it('should return true when database is connected', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([{ '?column?': 1 }])

      const result = await checkDatabaseConnection()
      
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledWith(expect.any(Object))
      expect(result).toBe(true)
    })

    it('should return false when database connection fails', async () => {
      mockPrismaClient.$queryRaw.mockRejectedValue(new Error('Connection failed'))

      const result = await checkDatabaseConnection()
      
      expect(result).toBe(false)
    })

    it('should return false when database times out', async () => {
      mockPrismaClient.$queryRaw.mockRejectedValue(new Error('Connection timeout'))

      const result = await checkDatabaseConnection()
      
      expect(result).toBe(false)
    })

    it('should return false when connection pool is exhausted', async () => {
      mockPrismaClient.$queryRaw.mockRejectedValue(new Error('Connection pool exhausted'))

      const result = await checkDatabaseConnection()
      
      expect(result).toBe(false)
    })

    it('should return false when database is in maintenance mode', async () => {
      mockPrismaClient.$queryRaw.mockRejectedValue(new Error('Database maintenance'))

      const result = await checkDatabaseConnection()
      
      expect(result).toBe(false)
    })
  })

  describe('userDb.findByEmail', () => {
    it('should find user by email successfully', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'user',
        countryName: 'United States',
        currencySymbol: '$',
        currencyCode: 'USD',
        flagEmoji: '🇺🇸',
      }

      mockSql.mockResolvedValue([mockUser])

      const result = await userDb.findByEmail('test@example.com')
      
      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('SELECT u.*, c.name as countryName'),
          expect.stringContaining('FROM "User" u'),
          expect.stringContaining('LEFT JOIN "Country" c'),
          expect.stringContaining('WHERE u.email ='),
          expect.stringContaining('AND u."isActive" = true')
        ]),
        'test@example.com'
      )
      expect(result).toEqual(mockUser)
    })

    it('should return null when user not found', async () => {
      mockSql.mockResolvedValue([])

      const result = await userDb.findByEmail('nonexistent@example.com')
      
      expect(result).toBeNull()
    })

    it('should return null when user is inactive', async () => {
      mockSql.mockResolvedValue([])

      const result = await userDb.findByEmail('inactive@example.com')
      
      expect(result).toBeNull()
    })

    it('should handle database errors', async () => {
      mockSql.mockRejectedValue(new Error('Database error'))

      await expect(userDb.findByEmail('test@example.com')).rejects.toThrow('Database error')
    })

    it('should handle connection errors', async () => {
      mockSql.mockRejectedValue(new Error('Connection error'))

      await expect(userDb.findByEmail('test@example.com')).rejects.toThrow('Connection error')
    })
  })

  describe('userDb.updateLastLogin', () => {
    it('should update last login time successfully', async () => {
      mockSql.mockResolvedValue([{ rowCount: 1 }])

      const result = await userDb.updateLastLogin('user123')
      
      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('UPDATE "User"'),
          expect.stringContaining('SET "lastLoginAt" = NOW()'),
          expect.stringContaining('WHERE id =')
        ]),
        'user123'
      )
      expect(result).toEqual([{ rowCount: 1 }])
    })

    it('should handle user not found', async () => {
      mockSql.mockResolvedValue([{ rowCount: 0 }])

      const result = await userDb.updateLastLogin('nonexistent-user')
      
      expect(result).toEqual([{ rowCount: 0 }])
    })

    it('should handle database errors', async () => {
      mockSql.mockRejectedValue(new Error('Database error'))

      await expect(userDb.updateLastLogin('user123')).rejects.toThrow('Database error')
    })

    it('should handle connection errors', async () => {
      mockSql.mockRejectedValue(new Error('Connection error'))

      await expect(userDb.updateLastLogin('user123')).rejects.toThrow('Connection error')
    })
  })

  describe('Error handling', () => {
    it('should handle missing DATABASE_URL', () => {
      const originalUrl = process.env.DATABASE_URL
      delete process.env.DATABASE_URL

      // The neon function should handle this gracefully
      expect(() => {
        require('@/lib/database')
      }).not.toThrow()

      // Restore the URL
      process.env.DATABASE_URL = originalUrl
    })
  })
}) 