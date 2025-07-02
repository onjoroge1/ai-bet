import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // Get featured testimonials with country data
    const testimonials = await prisma.testimonial.findMany({
      where: { 
        isActive: true,
        isFeatured: true 
      },
      include: {
        country: {
          select: {
            name: true,
            flagEmoji: true,
            code: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 8 // Limit to 8 testimonials for homepage
    })

    // Transform the data to match the frontend expectations
    const transformedTestimonials = testimonials.map(testimonial => ({
      id: testimonial.id,
      name: testimonial.userName,
      location: testimonial.country.name,
      flag: testimonial.country.flagEmoji || "🌍",
      rating: testimonial.rating,
      text: testimonial.testimonialText,
      profit: testimonial.profitAmount,
      timeframe: testimonial.timeframe,
      createdAt: testimonial.createdAt
    }))

    return NextResponse.json(transformedTestimonials)
  } catch (error) {
    console.error("Error fetching testimonials:", error)
    return NextResponse.json(
      { error: "Failed to fetch testimonials" },
      { status: 500 }
    )
  }
} 