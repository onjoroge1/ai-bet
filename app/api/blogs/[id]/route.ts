import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/blogs/[id] - Get a specific blog post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const blogPost = await prisma.blogPost.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        author: true,
        category: true,
        tags: true,
        geoTarget: true,
        featured: true,
        publishedAt: true,
        viewCount: true,
        shareCount: true,
        readTime: true,
        seoTitle: true,
        seoDescription: true,
        seoKeywords: true,
        isPublished: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        media: {
          select: {
            id: true,
            type: true,
            url: true,
            filename: true,
            size: true,
            alt: true,
            caption: true,
            uploadedAt: true
          },
          orderBy: {
            uploadedAt: 'asc'
          }
        }
      }
    })

    if (!blogPost) {
      return NextResponse.json(
        { success: false, error: 'Blog post not found' },
        { status: 404 }
      )
    }

    // Increment view count for published posts
    if (blogPost.isPublished && blogPost.isActive) {
      await prisma.blogPost.update({
        where: { id },
        data: { viewCount: { increment: 1 } } 
      })
    }

    return NextResponse.json(blogPost)

  } catch (error) {
    console.error('Error fetching blog post:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch blog post' },
      { status: 500 }
    )
  }
}

// PUT /api/blogs/[id] - Update a blog post (admin only)
export async function PUT(
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

    // Check if blog post exists
    const existingPost = await prisma.blogPost.findUnique({
      where: { id }
    })

    if (!existingPost) {
      return NextResponse.json(
        { success: false, error: 'Blog post not found' },
        { status: 404 }
      )
    }

    // Check if slug is being changed and if it already exists
    if (body.slug && body.slug !== existingPost.slug) {
      const slugExists = await prisma.blogPost.findUnique({
        where: { slug: body.slug }
      })

      if (slugExists) {
        return NextResponse.json(
          { success: false, error: 'Blog post with this slug already exists' },
          { status: 409 }
        )
      }
    }

    // Start a transaction to update blog post and media
    const result = await prisma.$transaction(async (tx) => {
      // Update blog post
      const updatedPost = await tx.blogPost.update({
        where: { id },
        data: {
          title: body.title,
          slug: body.slug,
          excerpt: body.excerpt,
          content: body.content,
          author: body.author,
          category: body.category,
          tags: body.tags,
          geoTarget: body.geoTarget,
          featured: body.featured,
          readTime: body.readTime,
          seoTitle: body.seoTitle,
          seoDescription: body.seoDescription,
          seoKeywords: body.seoKeywords,
          isPublished: body.isPublished,
          isActive: body.isActive,
        }
      })

      // Handle media updates if provided
      if (body.media !== undefined) {
        // Remove existing media
        await tx.blogMedia.deleteMany({
          where: { blogPostId: id }
        })

        // Add new media if any
        if (body.media && body.media.length > 0) {
          const mediaData = body.media.map((item: any) => ({
            blogPostId: id,
            type: item.type,
            url: item.url,
            filename: item.filename,
            size: item.size,
            alt: item.alt || null,
            caption: item.caption || null,
            uploadedAt: item.uploadedAt ? new Date(item.uploadedAt) : new Date()
          }))

          await tx.blogMedia.createMany({
            data: mediaData
          })
        }
      }

      return updatedPost
    })

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error updating blog post:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update blog post' },
      { status: 500 }
    )
  }
}

// DELETE /api/blogs/[id] - Delete a blog post (admin only)
export async function DELETE(
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
    const existingPost = await prisma.blogPost.findUnique({
      where: { id }
    })

    if (!existingPost) {
      return NextResponse.json(
        { success: false, error: 'Blog post not found' },
        { status: 404 }
      )
    }

    // Hard delete - permanently remove from database
    await prisma.blogPost.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Blog post deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting blog post:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete blog post' },
      { status: 500 }
    )
  }
} 