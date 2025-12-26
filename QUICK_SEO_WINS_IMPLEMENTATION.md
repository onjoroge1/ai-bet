# ⚡ Quick SEO Wins - Implementation Guide

**Priority**: High Impact, Low Effort  
**Time to Implement**: 1-2 days  
**Expected Impact**: +15-30% organic traffic in 1-3 months

---

## 🎯 **1. Internal Linking System**

### **1.1 Add Related Articles to Blog Posts**

**File**: `app/blog/[slug]/page.tsx`

```typescript
// Add this function to fetch related articles
async function getRelatedArticles(
  currentSlug: string,
  category: string,
  tags: string[],
  limit: number = 5
) {
  return await prisma.blogPost.findMany({
    where: {
      slug: { not: currentSlug },
      isPublished: true,
      isActive: true,
      OR: [
        { category: category },
        { tags: { hasSome: tags } },
      ],
    },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      publishedAt: true,
    },
    orderBy: {
      publishedAt: 'desc',
    },
    take: limit,
  })
}

// In your blog post component
const relatedArticles = await getRelatedArticles(
  slug,
  post.category,
  post.tags || []
)

// Render related articles section
<section className="mt-12">
  <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
  <div className="grid gap-4">
    {relatedArticles.map((article) => (
      <Link 
        href={`/blog/${article.slug}`}
        className="block p-4 border rounded-lg hover:bg-slate-50"
      >
        <h3 className="font-semibold">{article.title}</h3>
        <p className="text-sm text-gray-600">{article.excerpt}</p>
      </Link>
    ))}
  </div>
</section>
```

### **1.2 Link Match Pages to Relevant Blog Posts**

**File**: `app/match/[match_id]/page.tsx`

```typescript
// Add function to fetch related blog posts
async function getRelatedBlogPosts(matchId: string, league: string) {
  return await prisma.blogPost.findMany({
    where: {
      isPublished: true,
      isActive: true,
      OR: [
        { category: league },
        { tags: { has: league } },
        { 
          // If you have matchId in blog posts
          marketMatchId: matchId 
        },
      ],
    },
    select: {
      slug: true,
      title: true,
      excerpt: true,
    },
    take: 3,
  })
}

// Add to match page
const relatedPosts = await getRelatedBlogPosts(matchId, matchData.league.name)

// Render section
{relatedPosts.length > 0 && (
  <section className="mt-8">
    <h3 className="text-xl font-bold mb-4">Related Analysis</h3>
    <div className="space-y-3">
      {relatedPosts.map((post) => (
        <Link 
          href={`/blog/${post.slug}`}
          className="block text-blue-600 hover:underline"
        >
          {post.title}
        </Link>
      ))}
    </div>
  </section>
)}
```

### **1.3 Add Breadcrumbs**

**Create**: `components/breadcrumbs.tsx`

```typescript
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href: string
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center space-x-2 text-sm">
        <li>
          <Link href="/" className="text-gray-500 hover:text-gray-700">
            Home
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />
            {index === items.length - 1 ? (
              <span className="text-gray-900 font-medium">{item.label}</span>
            ) : (
              <Link 
                href={item.href}
                className="text-gray-500 hover:text-gray-700"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

// Add schema markup
export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.label,
      "item": `https://snapbet.ai${item.href}`
    }))
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

**Usage in blog post**:
```typescript
<Breadcrumbs items={[
  { label: 'Blog', href: '/blog' },
  { label: post.category, href: `/blog/category/${post.category}` },
  { label: post.title, href: `/blog/${post.slug}` },
]} />
<BreadcrumbSchema items={[...]} />
```

---

## 🏷️ **2. Enhanced Schema Markup**

### **2.1 Article Schema for Blog Posts**

**File**: `app/blog/[slug]/page.tsx`

```typescript
export function ArticleSchema({ post }: { post: BlogPost }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.excerpt || post.seoDescription,
    "image": post.featuredImage || `${baseUrl}/og-image.jpg`,
    "author": {
      "@type": "Organization",
      "name": "SnapBet AI",
      "url": baseUrl
    },
    "publisher": {
      "@type": "Organization",
      "name": "SnapBet AI",
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/logo.png`
      }
    },
    "datePublished": post.publishedAt?.toISOString(),
    "dateModified": post.updatedAt.toISOString(),
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${baseUrl}/blog/${post.slug}`
    },
    "articleSection": post.category,
    "keywords": post.tags?.join(', ') || post.seoKeywords?.join(', ')
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

### **2.2 SportsEvent Schema for Match Pages**

**File**: `app/match/[match_id]/page.tsx`

```typescript
export function SportsEventSchema({ match }: { match: MatchData }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": `${match.home.name} vs ${match.away.name}`,
    "startDate": match.kickoff_at,
    "location": {
      "@type": "Place",
      "name": match.venue || "Football Stadium"
    },
    "sport": "Soccer",
    "competitor": [
      {
        "@type": "SportsTeam",
        "name": match.home.name
      },
      {
        "@type": "SportsTeam",
        "name": match.away.name
      }
    ],
    "organizer": {
      "@type": "Organization",
      "name": match.league.name
    }
  }

  // Add result if match is finished
  if (match.status === 'FINISHED' && match.final_result) {
    schema['result'] = {
      "@type": "SportsEventResult",
      "homeScore": match.final_result.score.home,
      "awayScore": match.final_result.score.away
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

### **2.3 AggregateRating Schema**

**File**: `components/rating-schema.tsx`

```typescript
export function RatingSchema({ 
  rating, 
  reviewCount 
}: { 
  rating: number
  reviewCount: number 
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SnapBet AI",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": rating.toString(),
      "reviewCount": reviewCount.toString(),
      "bestRating": "5",
      "worstRating": "1"
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

// Add to homepage or footer
<RatingSchema rating={4.5} reviewCount={150} />
```

---

## 🖼️ **3. Image SEO Optimization**

### **3.1 Image Sitemap**

**Create**: `app/sitemap-images.xml/route.ts`

```typescript
import { NextRequest } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://www.snapbet.bet'

  try {
    // Get blog posts with images
    const blogPosts = await prisma.blogPost.findMany({
      where: {
        isPublished: true,
        isActive: true,
        featuredImage: { not: null },
      },
      select: {
        slug: true,
        featuredImage: true,
        title: true,
      },
    })

    const imageUrls = blogPosts.flatMap((post) => {
      if (!post.featuredImage) return []
      
      return {
        loc: `${baseUrl}/blog/${post.slug}`,
        image: {
          loc: post.featuredImage.startsWith('http') 
            ? post.featuredImage 
            : `${baseUrl}${post.featuredImage}`,
          title: post.title,
          caption: post.title,
        },
      }
    })

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${imageUrls.map((item) => `  <url>
    <loc>${item.loc}</loc>
    <image:image>
      <image:loc>${item.image.loc}</image:loc>
      <image:title>${item.image.title}</image:title>
      <image:caption>${item.image.caption}</image:caption>
    </image:image>
  </url>`).join('\n')}
</urlset>`

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, s-maxage=3600',
      },
    })
  } catch (error) {
    console.error('Error generating image sitemap:', error)
    return new Response('Error generating sitemap', { status: 500 })
  }
}
```

**Add to main sitemap index**:
```typescript
// app/sitemap.ts
{
  url: `${baseUrl}/sitemap-images.xml`,
  lastModified: currentDate,
  changeFrequency: 'weekly' as const,
}
```

### **3.2 Optimized Image Component**

**Create**: `components/optimized-image.tsx`

```typescript
import Image from 'next/image'
import { useState } from 'react'

interface OptimizedImageProps {
  src: string
  alt: string
  width: number
  height: number
  className?: string
  priority?: boolean
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
}: OptimizedImageProps) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div 
        className={`bg-gray-200 flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <span className="text-gray-400">Image not available</span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      onError={() => setError(true)}
      loading={priority ? undefined : 'lazy'}
      quality={85}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  )
}
```

---

## 🔗 **4. Content Update System**

### **4.1 Last Updated Date**

**Add to blog posts**:
```typescript
// In blog post metadata
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await getBlogPost(params.slug)
  
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(), // Important for freshness
      authors: ['SnapBet AI'],
    },
  }
}

// Display in blog post
<div className="text-sm text-gray-500 mb-4">
  Published: {new Date(post.publishedAt).toLocaleDateString()}
  {post.updatedAt > post.publishedAt && (
    <span className="ml-4">
      Updated: {new Date(post.updatedAt).toLocaleDateString()}
    </span>
  )}
</div>
```

### **4.2 Auto-Update Match Pages**

**File**: `app/match/[match_id]/page.tsx`

```typescript
// Add function to update match page metadata when status changes
useEffect(() => {
  if (matchData?.status) {
    // Update page title based on status
    const statusText = {
      'UPCOMING': 'Prediction',
      'LIVE': 'Live',
      'FINISHED': 'Result',
    }[matchData.status] || 'Match'

    document.title = `${matchData.home.name} vs ${matchData.away.name} - ${statusText} | SnapBet AI`
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      metaDescription.setAttribute(
        'content',
        `AI prediction for ${matchData.home.name} vs ${matchData.away.name}. ${statusText.toLowerCase()} analysis, odds, and betting tips.`
      )
    }
  }
}, [matchData?.status])
```

---

## 📊 **5. Analytics Tracking**

### **5.1 Track Content Performance**

**Add to blog posts**:
```typescript
// Track blog post views
useEffect(() => {
  if (post?.id) {
    // Track view
    fetch(`/api/blogs/${post.id}/view`, {
      method: 'POST',
    }).catch(console.error)

    // Track time on page
    const startTime = Date.now()
    return () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000)
      if (timeSpent > 10) { // Only track if user spent > 10 seconds
        fetch(`/api/blogs/${post.id}/engagement`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeSpent }),
        }).catch(console.error)
      }
    }
  }
}, [post?.id])
```

### **5.2 Track Match Page Engagement**

```typescript
// Track which match pages get most traffic
useEffect(() => {
  if (matchId) {
    fetch(`/api/matches/${matchId}/view`, {
      method: 'POST',
    }).catch(console.error)
  }
}, [matchId])
```

---

## 🚀 **Implementation Priority**

### **Day 1 (4-6 hours)**
1. ✅ Add related articles to blog posts
2. ✅ Add breadcrumbs
3. ✅ Add Article schema to blog posts
4. ✅ Add SportsEvent schema to match pages

### **Day 2 (4-6 hours)**
1. ✅ Optimize images (alt text, compression)
2. ✅ Create image sitemap
3. ✅ Add last updated dates
4. ✅ Link match pages to blog posts

### **Week 1 (Ongoing)**
1. ✅ Daily social media posting
2. ✅ Update 1 old blog post
3. ✅ Internal linking audit
4. ✅ Schema markup testing

---

## 📈 **Expected Results**

### **Week 1-2**
- Better internal linking structure
- Rich snippets in search results
- Improved image search visibility

### **Month 1**
- +10-15% increase in page views
- +5-10% increase in CTR from search
- Better crawl depth

### **Month 2-3**
- +20-30% organic traffic
- Improved keyword rankings
- Better user engagement

---

**Remember**: These are quick wins that compound over time. Implement them systematically and measure the results!

