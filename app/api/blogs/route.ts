import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"
import type { ApiResponse } from "@/types/api"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : undefined

    // Check if user is admin
    const session = await getServerSession(authOptions)
    const isAdmin = session?.user?.role === 'admin'

    if (slug) {
      const whereClause = isAdmin 
        ? { slug } 
        : { slug, isPublished: true, isActive: true }
      
      const blog = await prisma.blogPost.findFirst({
        where: whereClause,
        include: {
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
      if (!blog) {
        return NextResponse.json({ success: false, error: 'Blog post not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true, data: blog })
    }

    // For admin users, return all posts (published and drafts)
    // For public users, only return published posts
    const whereClause = isAdmin 
      ? { isActive: true } 
      : { isPublished: true, isActive: true }

    const blogs = await prisma.blogPost.findMany({
      where: whereClause,
      include: {
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
      },
      orderBy: {
        createdAt: 'desc'
      },
      ...(limit ? { take: limit } : {})
    })

    return NextResponse.json({ success: true, data: blogs })
  } catch (error) {
    console.error("Error fetching blogs:", error)
    return NextResponse.json({ error: "Failed to fetch blogs" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await request.json()
    
    // Validate required fields
    if (!data.title || !data.content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 })
    }

    // Start a transaction to create blog post and media
    const result = await prisma.$transaction(async (tx) => {
      // Create blog post
      const blogPost = await tx.blogPost.create({
        data: {
          title: data.title,
          content: data.content,
          slug: data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          excerpt: data.excerpt || data.content.substring(0, 150) + '...',
          author: session.user.name || session.user.email || 'SnapBet AI Team',
          category: data.category || 'predictions',
          tags: Array.isArray(data.tags) ? data.tags : [],
          geoTarget: Array.isArray(data.geoTarget) ? data.geoTarget : ['worldwide'],
          featured: !!data.featured,
          readTime: typeof data.readTime === 'number' ? data.readTime : 5,
          seoTitle: data.seoTitle || '',
          seoDescription: data.seoDescription || '',
          seoKeywords: Array.isArray(data.seoKeywords) ? data.seoKeywords : [],
          isPublished: data.isPublished ?? false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Add media if provided
      if (data.media && data.media.length > 0) {
        const mediaData = data.media.map((item: any) => ({
          blogPostId: blogPost.id,
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

      return blogPost
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("Error creating blog post:", error)
    return NextResponse.json({ error: "Failed to create blog post" }, { status: 500 })
  }
} 