import { NextRequest } from 'next/server'
import { POST as signinHandler } from '@/app/api/auth/signin/route'
import { POST as signupHandler } from '@/app/api/auth/signup/route'

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    country: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  }
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  }
})

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))

// Mock auth functions
jest.mock('@/lib/auth', () => ({
  generateToken: jest.fn().mockResolvedValue('mock.jwt.token'),
}))

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

// Mock countries
jest.mock('@/lib/countries', () => ({
  getCountryByCode: jest.fn(() => ({
    code: 'US',
    name: 'United States',
    isSupported: true,
    flagEmoji: '🇺🇸',
    currencyCode: 'USD',
    currencySymbol: '$',
  })),
  isValidCountryCode: jest.fn(() => true),
}))

// Mock email service
jest.mock('@/lib/email-service', () => ({
  EmailService: {
    sendWelcomeEmail: jest.fn(),
  },
}))

// Mock database
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    country: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}))

describe('Auth API Routes', () => {
  let mockPrisma: any
  let mockDb: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked Prisma instance
    const { PrismaClient } = require('@prisma/client')
    mockPrisma = new PrismaClient()
    
    // Get the mocked database instance
    mockDb = require('@/lib/db').default
  })

  describe('POST /api/auth/signin', () => {
    it('should authenticate user with valid credentials', async () => {
      const bcrypt = require('bcryptjs')
      const { generateToken } = require('@/lib/auth')

      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        password: 'hashedPassword',
        fullName: 'Test User',
        role: 'user',
        subscriptionPlan: 'free',
        subscriptionExpiresAt: new Date('2024-12-31'),
        totalWinnings: 1000,
        winStreak: 5,
        country: {
          code: 'US',
          name: 'United States',
          currencySymbol: '$',
          currencyCode: 'USD',
          flagEmoji: '🇺🇸',
        },
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)
      generateToken.mockResolvedValue('mock.jwt.token')

      const request = new NextRequest('http://localhost:3000/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      })

      const response = await signinHandler(request)
      const data = await response.json()

      // Debug: Log the actual response
      console.log('Response status:', response.status)
      console.log('Response data:', data)

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user).toEqual({
        id: 'user123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'user',
        countryId: 'US',
        countryName: 'United States',
        currencySymbol: '$',
        currencyCode: 'USD',
        flagEmoji: '🇺🇸',
        subscriptionPlan: 'free',
        subscriptionExpiresAt: mockUser.subscriptionExpiresAt,
        totalWinnings: 1000,
        winStreak: 5,
      })

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: { country: true },
      })
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword')
      expect(generateToken).toHaveBeenCalledWith({
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
      })
    })

    it('should reject invalid credentials', async () => {
      const bcrypt = require('bcryptjs')

      mockPrisma.user.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({
          email: 'wrong@example.com',
          password: 'wrongpassword',
        }),
      })

      const response = await signinHandler(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid email or password')
    })

    it('should reject wrong password', async () => {
      const bcrypt = require('bcryptjs')

      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        password: 'hashedPassword',
        fullName: 'Test User',
        role: 'user',
        country: null,
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(false)

      const request = new NextRequest('http://localhost:3000/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      })

      const response = await signinHandler(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid email or password')
    })

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          // Missing password
        }),
      })

      const response = await signinHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Email and password are required')
    })

    it('should handle database errors', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      })

      const response = await signinHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Authentication failed')
    })
  })

  describe('POST /api/auth/signup', () => {
    it('should create new user successfully', async () => {
      const bcrypt = require('bcryptjs')
      const { generateToken } = require('@/lib/auth')
      const { getCountryByCode, isValidCountryCode } = require('@/lib/countries')

      const mockUser = {
        id: 'newuser123',
        email: 'new@example.com',
        fullName: 'New User',
        role: 'user',
        subscriptionPlan: 'free',
        subscriptionExpiresAt: null,
        totalWinnings: 0,
        winStreak: 0,
        country: {
          code: 'US',
          name: 'United States',
          currencySymbol: '$',
          currencyCode: 'USD',
          flagEmoji: '🇺🇸',
        },
      }

      mockDb.user.findUnique.mockResolvedValue(null) // No existing user
      mockDb.country.findFirst.mockResolvedValue(null) // No existing country
      mockDb.country.create.mockResolvedValue({ id: 'country123' })
      mockDb.user.create.mockResolvedValue(mockUser)
      bcrypt.hash.mockResolvedValue('hashedPassword')
      generateToken.mockResolvedValue('mock.jwt.token')

      const request = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New User',
          email: 'new@example.com',
          password: 'password123',
          countryCode: 'US',
        }),
      })

      const response = await signupHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user).toEqual({
        id: 'newuser123',
        email: 'new@example.com',
        fullName: 'New User',
        role: 'user',
        countryId: 'US',
        countryName: 'United States',
        currencySymbol: '$',
        currencyCode: 'USD',
        flagEmoji: '🇺🇸',
        subscriptionPlan: 'free',
        subscriptionExpiresAt: null,
        totalWinnings: 0,
        winStreak: 0,
      })

      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'new@example.com' },
        select: { id: true },
      })
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10)
    })

    it('should reject duplicate email', async () => {
      const existingUser = {
        id: 'existing123',
      }

      mockDb.user.findUnique.mockResolvedValue(existingUser)

      const request = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Existing User',
          email: 'existing@example.com',
          password: 'password123',
          countryCode: 'US',
        }),
      })

      const response = await signupHandler(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe('An account with this email already exists')
    })

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          // Missing name, password, and countryCode
        }),
      })

      const response = await signupHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })

    it('should handle database errors', async () => {
      mockDb.user.findUnique.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          countryCode: 'US',
        }),
      })

      const response = await signupHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Registration failed')
    })
  })

  describe('Cookie handling', () => {
    it('should set token cookie on successful signin', async () => {
      const bcrypt = require('bcryptjs')
      const { generateToken } = require('@/lib/auth')

      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        password: 'hashedPassword',
        fullName: 'Test User',
        role: 'user',
        subscriptionPlan: 'free',
        subscriptionExpiresAt: null,
        totalWinnings: 0,
        winStreak: 0,
        country: null,
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)
      generateToken.mockResolvedValue('mock.jwt.token')

      const request = new NextRequest('http://localhost:3000/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      })

      const response = await signinHandler(request)

      expect(response.status).toBe(200)
      
      // Check if cookie is set
      const setCookieHeader = response.headers.get('set-cookie')
      expect(setCookieHeader).toContain('token=')
      expect(setCookieHeader).toContain('HttpOnly')
      expect(setCookieHeader).toContain('Path=/')
    })
  })
}) 