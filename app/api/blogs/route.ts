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

    if (slug) {
      const blog = await prisma.blogPost.findFirst({
        where: {
          slug,
          isPublished: true,
          isActive: true
        }
      })
      if (!blog) {
        return NextResponse.json({ success: false, error: 'Blog post not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true, data: blog })
    }

    const blogs = await prisma.blogPost.findMany({
      where: {
        isPublished: true,
        isActive: true
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

    // Create blog post
    const blogPost = await prisma.blogPost.create({
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

    return NextResponse.json(blogPost)
  } catch (error) {
    console.error("Error creating blog post:", error)
    return NextResponse.json({ error: "Failed to create blog post" }, { status: 500 })
  }
} 