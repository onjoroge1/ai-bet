import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ message: 'Signed out' })
  response.cookies.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // Expire immediately
  })
  return response
} 