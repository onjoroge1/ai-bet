import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if blog post exists and is AI-generated
    const blogPost = await prisma.blogPost.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        isPublished: true,
        aiGenerated: true
      }
    })

    if (!blogPost) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      )
    }

    if (!blogPost.aiGenerated) {
      return NextResponse.json(
        { error: 'Only AI-generated posts can be published via this endpoint' },
        { status: 400 }
      )
    }

    if (blogPost.isPublished) {
      return NextResponse.json(
        { error: 'Blog post is already published' },
        { status: 400 }
      )
    }

    // Publish the blog post
    const updatedPost = await prisma.blogPost.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date()
      },
      select: {
        id: true,
        title: true,
        slug: true,
        isPublished: true,
        publishedAt: true
      }
    })

    console.log(`Blog post published: ${updatedPost.title} (ID: ${updatedPost.id})`)

    return NextResponse.json({
      message: 'Blog post published successfully',
      post: updatedPost
    })

  } catch (error) {
    console.error('Error publishing blog post:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 