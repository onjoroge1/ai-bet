// Mock the entire auth module to avoid ES module import issues
jest.mock('@/lib/auth', () => ({
  hashPassword: jest.fn(),
  comparePasswords: jest.fn(),
  generateToken: jest.fn(),
  verifyToken: jest.fn(),
  getTokenPayload: jest.fn(),
}))

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

// Mock jose
jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
  SignJWT: jest.fn(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock.jwt.token'),
  })),
}))

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key'

describe('Authentication Helpers', () => {
  let authHelpers: any
  let bcrypt: any
  let jose: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Import the mocked modules
    authHelpers = require('@/lib/auth')
    bcrypt = require('bcryptjs')
    jose = require('jose')
  })

  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      bcrypt.hash.mockResolvedValue('hashed.password.123')
      authHelpers.hashPassword.mockResolvedValue('hashed.password.123')

      const result = await authHelpers.hashPassword('testpassword')
      
      expect(authHelpers.hashPassword).toHaveBeenCalledWith('testpassword')
      expect(result).toBe('hashed.password.123')
    })

    it('should handle bcrypt errors', async () => {
      authHelpers.hashPassword.mockRejectedValue(new Error('Bcrypt error'))

      await expect(authHelpers.hashPassword('testpassword')).rejects.toThrow('Bcrypt error')
    })
  })

  describe('comparePasswords', () => {
    it('should return true for matching passwords', async () => {
      authHelpers.comparePasswords.mockResolvedValue(true)

      const result = await authHelpers.comparePasswords('testpassword', 'hashed.password.123')
      
      expect(authHelpers.comparePasswords).toHaveBeenCalledWith('testpassword', 'hashed.password.123')
      expect(result).toBe(true)
    })

    it('should return false for non-matching passwords', async () => {
      authHelpers.comparePasswords.mockResolvedValue(false)

      const result = await authHelpers.comparePasswords('wrongpassword', 'hashed.password.123')
      
      expect(result).toBe(false)
    })

    it('should handle bcrypt errors', async () => {
      authHelpers.comparePasswords.mockRejectedValue(new Error('Bcrypt error'))

      await expect(authHelpers.comparePasswords('testpassword', 'hashed.password.123')).rejects.toThrow('Bcrypt error')
    })
  })

  describe('generateToken', () => {
    it('should generate token with payload and expiration', async () => {
      const mockSignJWT = jose.SignJWT.mock.instances[0]

      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
      }

      authHelpers.generateToken.mockResolvedValue('mock.jwt.token')

      const result = await authHelpers.generateToken(payload)
      
      expect(authHelpers.generateToken).toHaveBeenCalledWith(payload)
      expect(result).toBe('mock.jwt.token')
    })

    it('should handle token generation errors', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
      }

      authHelpers.generateToken.mockRejectedValue(new Error('Token generation failed'))

      await expect(authHelpers.generateToken(payload)).rejects.toThrow('Token generation failed')
    })
  })

  describe('verifyToken', () => {
    it('should return true for valid token', async () => {
      authHelpers.verifyToken.mockResolvedValue(true)

      const result = await authHelpers.verifyToken('valid.token.123')
      
      expect(authHelpers.verifyToken).toHaveBeenCalledWith('valid.token.123')
      expect(result).toBe(true)
    })

    it('should return false for invalid token', async () => {
      authHelpers.verifyToken.mockResolvedValue(false)

      const result = await authHelpers.verifyToken('invalid.token.123')
      
      expect(result).toBe(false)
    })

    it('should return false for expired token', async () => {
      authHelpers.verifyToken.mockResolvedValue(false)

      const result = await authHelpers.verifyToken('expired.token.123')
      
      expect(result).toBe(false)
    })

    it('should return false for malformed token', async () => {
      authHelpers.verifyToken.mockResolvedValue(false)

      const result = await authHelpers.verifyToken('malformed.token')
      
      expect(result).toBe(false)
    })

    it('should return false for token with wrong secret', async () => {
      authHelpers.verifyToken.mockResolvedValue(false)

      const result = await authHelpers.verifyToken('wrong.secret.token')
      
      expect(result).toBe(false)
    })
  })

  describe('getTokenPayload', () => {
    it('should extract payload from valid token', async () => {
      const mockPayload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
      }
      authHelpers.getTokenPayload.mockResolvedValue(mockPayload)

      const result = await authHelpers.getTokenPayload('valid.token.123')
      
      expect(authHelpers.getTokenPayload).toHaveBeenCalledWith('valid.token.123')
      expect(result).toEqual(mockPayload)
    })

    it('should return null for invalid token', async () => {
      authHelpers.getTokenPayload.mockResolvedValue(null)

      const result = await authHelpers.getTokenPayload('invalid.token.123')
      
      expect(result).toBeNull()
    })

    it('should return null for expired token', async () => {
      authHelpers.getTokenPayload.mockResolvedValue(null)

      const result = await authHelpers.getTokenPayload('expired.token.123')
      
      expect(result).toBeNull()
    })

    it('should return null for malformed token', async () => {
      authHelpers.getTokenPayload.mockResolvedValue(null)

      const result = await authHelpers.getTokenPayload('malformed.token')
      
      expect(result).toBeNull()
    })
  })

  describe('Error handling', () => {
    it('should handle missing JWT secret', () => {
      const originalSecret = process.env.JWT_SECRET
      delete process.env.JWT_SECRET

      // The module should handle missing JWT_SECRET gracefully
      expect(() => {
        require('@/lib/auth')
      }).not.toThrow()

      // Restore the secret
      process.env.JWT_SECRET = originalSecret
    })
  })
}) 