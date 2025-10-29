import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/admin/team-logos - Get all saved team logos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const logos = await prisma.blogMedia.findMany({
      where: {
        type: 'team_logo'
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: logos
    })

  } catch (error) {
    console.error('Error fetching team logos:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch team logos' },
      { status: 500 }
    )
  }
}

// POST /api/admin/team-logos - Save a team logo
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { teamId, teamName, logoUrl, country } = body

    if (!teamId || !teamName || !logoUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if logo already exists for this team
    const existingLogo = await prisma.blogMedia.findFirst({
      where: {
        type: 'team_logo',
        filename: teamName,
        url: logoUrl
      }
    })

    if (existingLogo) {
      return NextResponse.json(
        { success: false, error: 'Logo already exists for this team' },
        { status: 409 }
      )
    }

    // Save the logo to BlogMedia table
    const savedLogo = await prisma.blogMedia.create({
      data: {
        type: 'team_logo',
        url: logoUrl,
        filename: teamName,
        alt: `${teamName} logo`,
        caption: `Team logo for ${teamName}${country ? ` (${country})` : ''}`,
        size: 0, // We don't know the size from API-Football
        uploadedAt: new Date(),
        // blogPostId is null for team logos (not linked to specific blog)
      }
    })

    return NextResponse.json({
      success: true,
      data: savedLogo,
      message: `Logo saved for ${teamName}`
    })

  } catch (error) {
    console.error('Error saving team logo:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save team logo' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/team-logos - Delete a team logo
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const logoId = searchParams.get('id')

    if (!logoId) {
      return NextResponse.json(
        { success: false, error: 'Logo ID is required' },
        { status: 400 }
      )
    }

    // Check if logo exists
    const existingLogo = await prisma.blogMedia.findUnique({
      where: { id: logoId }
    })

    if (!existingLogo) {
      return NextResponse.json(
        { success: false, error: 'Logo not found' },
        { status: 404 }
      )
    }

    // Delete the logo
    await prisma.blogMedia.delete({
      where: { id: logoId }
    })

    return NextResponse.json({
      success: true,
      message: 'Logo deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting team logo:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete team logo' },
      { status: 500 }
    )
  }
}
