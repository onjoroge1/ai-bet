import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/blogs/[id]/team-logos - Get team logos for a specific blog
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Check if blog post exists
    const blogPost = await prisma.blogPost.findUnique({
      where: { id }
    })

    if (!blogPost) {
      return NextResponse.json(
        { success: false, error: 'Blog post not found' },
        { status: 404 }
      )
    }

    // Get team logos for this blog post
    const teamLogos = await prisma.blogMedia.findMany({
      where: {
        blogPostId: id,
        type: 'team_logo'
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: teamLogos
    })

  } catch (error) {
    console.error('Error fetching blog team logos:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch team logos' },
      { status: 500 }
    )
  }
}

// POST /api/blogs/[id]/team-logos - Add a team logo to a specific blog
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { teamId, teamName, logoUrl, country } = body

    console.log('Team logo POST request:', { id, teamId, teamName, logoUrl, country })

    if (!teamId || !teamName || !logoUrl) {
      console.log('Missing required fields:', { teamId: !!teamId, teamName: !!teamName, logoUrl: !!logoUrl })
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if blog post exists
    const blogPost = await prisma.blogPost.findUnique({
      where: { id }
    })

    if (!blogPost) {
      return NextResponse.json(
        { success: false, error: 'Blog post not found' },
        { status: 404 }
      )
    }

    // Check if logo already exists for this team in this blog
    const existingLogo = await prisma.blogMedia.findFirst({
      where: {
        blogPostId: id,
        type: 'team_logo',
        filename: teamName
      }
    })

    if (existingLogo) {
      return NextResponse.json(
        { success: false, error: 'Team logo already exists for this blog' },
        { status: 409 }
      )
    }

    // Add the team logo to this specific blog post
    const teamLogo = await prisma.blogMedia.create({
      data: {
        type: 'team_logo',
        url: logoUrl,
        filename: teamName,
        alt: `${teamName} logo`,
        caption: `Team logo for ${teamName}${country ? ` (${country})` : ''}`,
        size: 0, // We don't know the size from API-Football
        uploadedAt: new Date(),
        blogPostId: id, // Link to specific blog post
      }
    })

    return NextResponse.json({
      success: true,
      data: teamLogo,
      message: `Team logo added for ${teamName}`
    })

  } catch (error) {
    console.error('Error adding team logo to blog:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add team logo' },
      { status: 500 }
    )
  }
}
