import prisma from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/countries
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const countries = await prisma.country.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        currencyCode: true,
        currencySymbol: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(countries)
  } catch (error) {
    console.error('Error fetching countries:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
} 