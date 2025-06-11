import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword, generateToken, setTokenCookie } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const { name, email, password, country } = await request.json()

    // Validate required fields
    if (!name || !email || !password || !country) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    // Find country by code
    const countryRecord = await prisma.country.findUnique({
      where: { code: country.toLowerCase() }
    })

    if (!countryRecord) {
      return NextResponse.json(
        { error: 'Invalid country code' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Create user in database
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName: name,
        countryId: countryRecord.id,
        role: 'user'
      }
    })

    // Generate JWT token
    const token = await generateToken({ 
      userId: user.id, 
      email: user.email,
      role: user.role 
    })

    // Create response
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        country: countryRecord.code,
        role: user.role
      }
    })

    // Set token in cookie
    setTokenCookie(response, token)

    return response
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 