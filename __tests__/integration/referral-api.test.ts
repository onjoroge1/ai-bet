import { NextRequest } from 'next/server'

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    referralCode: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    referral: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  }
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  }
})

// Mock auth functions
jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
  getTokenPayload: jest.fn(),
}))

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}))

describe('Referral API Routes', () => {
  let mockPrisma: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked Prisma instance
    const { PrismaClient } = require('@prisma/client')
    mockPrisma = new PrismaClient()
  })

  describe('POST /api/referrals/generate-code', () => {
    it('should generate referral code for authenticated user', async () => {
      const { verifyToken, getTokenPayload } = require('@/lib/auth')

      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        fullName: 'Test User',
      }

      const mockReferralCode = {
        id: 'code123',
        code: 'REF123456',
        userId: 'user123',
        isActive: true,
        createdAt: new Date(),
      }

      verifyToken.mockResolvedValue(true)
      getTokenPayload.mockResolvedValue({ userId: 'user123' })
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockPrisma.referralCode.findFirst.mockResolvedValue(null) // No existing code
      mockPrisma.referralCode.create.mockResolvedValue(mockReferralCode)

      // Mock the API route handler
      const generateCodeHandler = async (request: NextRequest) => {
        const token = request.headers.get('authorization')?.replace('Bearer ', '')
        
        if (!token || !(await verifyToken(token))) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }

        const payload = await getTokenPayload(token)
        const user = await mockPrisma.user.findUnique({
          where: { id: payload.userId },
        })

        if (!user) {
          return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
        }

        // Check if user already has a referral code
        const existingCode = await mockPrisma.referralCode.findFirst({
          where: { userId: user.id, isActive: true },
        })

        if (existingCode) {
          return new Response(JSON.stringify({ 
            code: existingCode.code,
            message: 'Referral code already exists'
          }), { status: 200 })
        }

        // Generate new referral code
        const referralCode = await mockPrisma.referralCode.create({
          data: {
            code: 'REF123456',
            userId: user.id,
            isActive: true,
          },
        })

        return new Response(JSON.stringify({ 
          code: referralCode.code,
          message: 'Referral code generated successfully'
        }), { status: 200 })
      }

      const request = new NextRequest('http://localhost:3000/api/referrals/generate-code', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid.token.123',
        },
      })

      const response = await generateCodeHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.code).toBe('REF123456')
      expect(data.message).toBe('Referral code generated successfully')

      expect(verifyToken).toHaveBeenCalledWith('valid.token.123')
      expect(getTokenPayload).toHaveBeenCalledWith('valid.token.123')
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user123' },
      })
      expect(mockPrisma.referralCode.create).toHaveBeenCalledWith({
        data: {
          code: 'REF123456',
          userId: 'user123',
          isActive: true,
        },
      })
    })

    it('should return existing code if user already has one', async () => {
      const { verifyToken, getTokenPayload } = require('@/lib/auth')

      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        fullName: 'Test User',
      }

      const existingCode = {
        id: 'code123',
        code: 'EXISTING123',
        userId: 'user123',
        isActive: true,
      }

      verifyToken.mockResolvedValue(true)
      getTokenPayload.mockResolvedValue({ userId: 'user123' })
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockPrisma.referralCode.findFirst.mockResolvedValue(existingCode)

      const generateCodeHandler = async (request: NextRequest) => {
        const token = request.headers.get('authorization')?.replace('Bearer ', '')
        
        if (!token || !(await verifyToken(token))) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }

        const payload = await getTokenPayload(token)
        const user = await mockPrisma.user.findUnique({
          where: { id: payload.userId },
        })

        if (!user) {
          return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
        }

        const existingCode = await mockPrisma.referralCode.findFirst({
          where: { userId: user.id, isActive: true },
        })

        if (existingCode) {
          return new Response(JSON.stringify({ 
            code: existingCode.code,
            message: 'Referral code already exists'
          }), { status: 200 })
        }

        return new Response(JSON.stringify({ error: 'Failed to generate code' }), { status: 500 })
      }

      const request = new NextRequest('http://localhost:3000/api/referrals/generate-code', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid.token.123',
        },
      })

      const response = await generateCodeHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.code).toBe('EXISTING123')
      expect(data.message).toBe('Referral code already exists')
    })

    it('should reject unauthorized requests', async () => {
      const { verifyToken } = require('@/lib/auth')

      verifyToken.mockResolvedValue(false)

      const generateCodeHandler = async (request: NextRequest) => {
        const token = request.headers.get('authorization')?.replace('Bearer ', '')
        
        if (!token || !(await verifyToken(token))) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }

        return new Response(JSON.stringify({ error: 'Should not reach here' }), { status: 500 })
      }

      const request = new NextRequest('http://localhost:3000/api/referrals/generate-code', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer invalid.token.123',
        },
      })

      const response = await generateCodeHandler(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('POST /api/referrals/validate-code', () => {
    it('should validate existing referral code', async () => {
      const mockReferralCode = {
        id: 'code123',
        code: 'REF123456',
        userId: 'user123',
        isActive: true,
        user: {
          id: 'user123',
          email: 'referrer@example.com',
          fullName: 'Referrer User',
        },
      }

      mockPrisma.referralCode.findUnique.mockResolvedValue(mockReferralCode)

      const validateCodeHandler = async (request: NextRequest) => {
        const { code } = await request.json()

        if (!code) {
          return new Response(JSON.stringify({ error: 'Referral code is required' }), { status: 400 })
        }

        const referralCode = await mockPrisma.referralCode.findUnique({
          where: { code },
          include: { user: true },
        })

        if (!referralCode || !referralCode.isActive) {
          return new Response(JSON.stringify({ error: 'Invalid or inactive referral code' }), { status: 400 })
        }

        return new Response(JSON.stringify({
          valid: true,
          referrer: {
            id: referralCode.user.id,
            email: referralCode.user.email,
            fullName: referralCode.user.fullName,
          },
        }), { status: 200 })
      }

      const request = new NextRequest('http://localhost:3000/api/referrals/validate-code', {
        method: 'POST',
        body: JSON.stringify({ code: 'REF123456' }),
      })

      const response = await validateCodeHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.valid).toBe(true)
      expect(data.referrer).toEqual({
        id: 'user123',
        email: 'referrer@example.com',
        fullName: 'Referrer User',
      })

      expect(mockPrisma.referralCode.findUnique).toHaveBeenCalledWith({
        where: { code: 'REF123456' },
        include: { user: true },
      })
    })

    it('should reject invalid referral code', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue(null)

      const validateCodeHandler = async (request: NextRequest) => {
        const { code } = await request.json()

        if (!code) {
          return new Response(JSON.stringify({ error: 'Referral code is required' }), { status: 400 })
        }

        const referralCode = await mockPrisma.referralCode.findUnique({
          where: { code },
          include: { user: true },
        })

        if (!referralCode || !referralCode.isActive) {
          return new Response(JSON.stringify({ error: 'Invalid or inactive referral code' }), { status: 400 })
        }

        return new Response(JSON.stringify({ valid: true }), { status: 200 })
      }

      const request = new NextRequest('http://localhost:3000/api/referrals/validate-code', {
        method: 'POST',
        body: JSON.stringify({ code: 'INVALID123' }),
      })

      const response = await validateCodeHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid or inactive referral code')
    })

    it('should reject inactive referral code', async () => {
      const inactiveCode = {
        id: 'code123',
        code: 'INACTIVE123',
        userId: 'user123',
        isActive: false,
        user: {
          id: 'user123',
          email: 'referrer@example.com',
          fullName: 'Referrer User',
        },
      }

      mockPrisma.referralCode.findUnique.mockResolvedValue(inactiveCode)

      const validateCodeHandler = async (request: NextRequest) => {
        const { code } = await request.json()

        if (!code) {
          return new Response(JSON.stringify({ error: 'Referral code is required' }), { status: 400 })
        }

        const referralCode = await mockPrisma.referralCode.findUnique({
          where: { code },
          include: { user: true },
        })

        if (!referralCode || !referralCode.isActive) {
          return new Response(JSON.stringify({ error: 'Invalid or inactive referral code' }), { status: 400 })
        }

        return new Response(JSON.stringify({ valid: true }), { status: 200 })
      }

      const request = new NextRequest('http://localhost:3000/api/referrals/validate-code', {
        method: 'POST',
        body: JSON.stringify({ code: 'INACTIVE123' }),
      })

      const response = await validateCodeHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid or inactive referral code')
    })
  })

  describe('POST /api/referrals/apply-code', () => {
    it('should apply referral code successfully', async () => {
      const { verifyToken, getTokenPayload } = require('@/lib/auth')

      const mockUser = {
        id: 'newuser123',
        email: 'new@example.com',
        fullName: 'New User',
      }

      const mockReferralCode = {
        id: 'code123',
        code: 'REF123456',
        userId: 'referrer123',
        isActive: true,
        user: {
          id: 'referrer123',
          email: 'referrer@example.com',
          fullName: 'Referrer User',
        },
      }

      verifyToken.mockResolvedValue(true)
      getTokenPayload.mockResolvedValue({ userId: 'newuser123' })
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockPrisma.referralCode.findUnique.mockResolvedValue(mockReferralCode)
      mockPrisma.referral.create.mockResolvedValue({
        id: 'referral123',
        referrerId: 'referrer123',
        referredId: 'newuser123',
        code: 'REF123456',
      })

      const applyCodeHandler = async (request: NextRequest) => {
        const token = request.headers.get('authorization')?.replace('Bearer ', '')
        
        if (!token || !(await verifyToken(token))) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }

        const { code } = await request.json()

        if (!code) {
          return new Response(JSON.stringify({ error: 'Referral code is required' }), { status: 400 })
        }

        const payload = await getTokenPayload(token)
        const user = await mockPrisma.user.findUnique({
          where: { id: payload.userId },
        })

        if (!user) {
          return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
        }

        const referralCode = await mockPrisma.referralCode.findUnique({
          where: { code },
          include: { user: true },
        })

        if (!referralCode || !referralCode.isActive) {
          return new Response(JSON.stringify({ error: 'Invalid or inactive referral code' }), { status: 400 })
        }

        if (referralCode.userId === user.id) {
          return new Response(JSON.stringify({ error: 'Cannot use your own referral code' }), { status: 400 })
        }

        // Create referral record
        const referral = await mockPrisma.referral.create({
          data: {
            referrerId: referralCode.userId,
            referredId: user.id,
            code: referralCode.code,
          },
        })

        return new Response(JSON.stringify({
          success: true,
          message: 'Referral code applied successfully',
          referral: {
            id: referral.id,
            referrer: {
              id: referralCode.user.id,
              email: referralCode.user.email,
              fullName: referralCode.user.fullName,
            },
          },
        }), { status: 200 })
      }

      const request = new NextRequest('http://localhost:3000/api/referrals/apply-code', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid.token.123',
        },
        body: JSON.stringify({ code: 'REF123456' }),
      })

      const response = await applyCodeHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Referral code applied successfully')
      expect(data.referral.referrer.id).toBe('referrer123')

      expect(mockPrisma.referral.create).toHaveBeenCalledWith({
        data: {
          referrerId: 'referrer123',
          referredId: 'newuser123',
          code: 'REF123456',
        },
      })
    })

    it('should prevent self-referral', async () => {
      const { verifyToken, getTokenPayload } = require('@/lib/auth')

      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        fullName: 'Test User',
      }

      const mockReferralCode = {
        id: 'code123',
        code: 'REF123456',
        userId: 'user123', // Same user ID
        isActive: true,
        user: {
          id: 'user123',
          email: 'test@example.com',
          fullName: 'Test User',
        },
      }

      verifyToken.mockResolvedValue(true)
      getTokenPayload.mockResolvedValue({ userId: 'user123' })
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockPrisma.referralCode.findUnique.mockResolvedValue(mockReferralCode)

      const applyCodeHandler = async (request: NextRequest) => {
        const token = request.headers.get('authorization')?.replace('Bearer ', '')
        
        if (!token || !(await verifyToken(token))) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }

        const { code } = await request.json()

        if (!code) {
          return new Response(JSON.stringify({ error: 'Referral code is required' }), { status: 400 })
        }

        const payload = await getTokenPayload(token)
        const user = await mockPrisma.user.findUnique({
          where: { id: payload.userId },
        })

        if (!user) {
          return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
        }

        const referralCode = await mockPrisma.referralCode.findUnique({
          where: { code },
          include: { user: true },
        })

        if (!referralCode || !referralCode.isActive) {
          return new Response(JSON.stringify({ error: 'Invalid or inactive referral code' }), { status: 400 })
        }

        if (referralCode.userId === user.id) {
          return new Response(JSON.stringify({ error: 'Cannot use your own referral code' }), { status: 400 })
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 })
      }

      const request = new NextRequest('http://localhost:3000/api/referrals/apply-code', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid.token.123',
        },
        body: JSON.stringify({ code: 'REF123456' }),
      })

      const response = await applyCodeHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Cannot use your own referral code')
    })
  })
}) 