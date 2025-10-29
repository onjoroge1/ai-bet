import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// DELETE /api/blogs/[id]/team-logos/[logoId] - Remove a team logo from a specific blog
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; logoId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id, logoId } = await params

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

    // Check if team logo exists and belongs to this blog
    const teamLogo = await prisma.blogMedia.findFirst({
      where: {
        id: logoId,
        blogPostId: id,
        type: 'team_logo'
      }
    })

    if (!teamLogo) {
      return NextResponse.json(
        { success: false, error: 'Team logo not found for this blog' },
        { status: 404 }
      )
    }

    // Delete the team logo
    await prisma.blogMedia.delete({
      where: { id: logoId }
    })

    return NextResponse.json({
      success: true,
      message: 'Team logo removed successfully'
    })

  } catch (error) {
    console.error('Error removing team logo from blog:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove team logo' },
      { status: 500 }
    )
  }
}
