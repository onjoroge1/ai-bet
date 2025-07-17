import { Metadata } from 'next'

interface GenerateMetadataOptions {
  title?: string
  description?: string
  keywords?: string[]
  image?: string
  url?: string
  type?: 'website' | 'article'
  publishedTime?: string
  modifiedTime?: string
  author?: string
  section?: string
  tags?: string[]
}

export function generateMetadata(options: GenerateMetadataOptions): Metadata {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://snapbet.ai'
  const {
    title,
    description,
    keywords = [],
    image = '/og-image.jpg',
    url,
    type = 'website',
    publishedTime,
    modifiedTime,
    author = 'SnapBet AI Team',
    section,
    tags = []
  } = options

  const fullTitle = title 
    ? `${title} | SnapBet AI`
    : 'SnapBet AI - AI-Powered Sports Predictions & Betting Tips'
  
  const fullDescription = description || 
    'Get winning sports predictions powered by AI. Join thousands of successful bettors with our data-driven football, basketball, and tennis tips. Start winning today with confidence scores and expert analysis!'
  
  const fullUrl = url ? `${baseUrl}${url}` : baseUrl
  const fullImage = image.startsWith('http') ? image : `${baseUrl}${image}`

  const metadata: Metadata = {
    title: fullTitle,
    description: fullDescription,
    keywords: [
      'sports predictions', 'AI betting tips', 'football predictions', 
      'basketball tips', 'tennis predictions', 'sports betting', 
      'AI tipster', 'winning predictions', 'betting advice',
      'sports analysis', 'prediction accuracy', 'betting strategy',
      'daily football tips', 'sports betting predictions', 'AI sports analysis',
      'confident betting tips', 'professional sports predictions', 'winning betting strategy',
      ...keywords
    ],
    authors: [{ name: author }],
    creator: 'SnapBet AI',
    publisher: 'SnapBet AI',
    category: 'Sports & Recreation',
    classification: 'Sports Betting',
    alternates: {
      canonical: fullUrl,
    },
    openGraph: {
      title: fullTitle,
      description: fullDescription,
      url: fullUrl,
      siteName: 'SnapBet AI',
      images: [
        {
          url: fullImage,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
      locale: 'en_US',
      type,
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
      ...(author && { authors: [author] }),
      ...(section && { section }),
      ...(tags.length > 0 && { tags }),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: fullDescription,
      images: [fullImage],
      creator: '@snapbet',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }

  return metadata
}

// Helper for blog posts
export function generateBlogMetadata(
  title: string,
  description: string,
  slug: string,
  publishedAt?: string,
  modifiedAt?: string,
  author?: string,
  tags: string[] = []
) {
  return generateMetadata({
    title,
    description,
    url: `/blog/${slug}`,
    type: 'article',
    publishedTime: publishedAt,
    modifiedTime: modifiedAt,
    author,
    tags,
    keywords: [
      'sports betting blog',
      'betting tips blog',
      'AI predictions blog',
      'football betting blog',
      'sports analysis blog',
      ...tags
    ]
  })
}

// Helper for country-specific pages
export function generateCountryMetadata(
  title: string,
  description: string,
  countryCode: string,
  path: string = ''
) {
  const countryPath = `/${countryCode.toLowerCase()}${path}`
  return generateMetadata({
    title,
    description,
    url: countryPath,
    keywords: [
      `${countryCode} sports betting`,
      `${countryCode} football tips`,
      `${countryCode} betting predictions`,
      'local sports betting',
      'country-specific betting tips'
    ]
  })
} 