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

const BRAND_NAME = 'SnapBet AI'
const DEFAULT_TITLE = 'AI-Powered Sports Predictions & Betting Tips'
const DEFAULT_DESCRIPTION =
  'Get winning sports predictions powered by AI. Join thousands of successful bettors with our data-driven football, basketball, and tennis tips. Start winning today with confidence scores and expert analysis!'
const TITLE_MAX_LENGTH = 60
const DESCRIPTION_MAX_LENGTH = 155

const BASE_KEYWORDS = [
  'sports predictions',
  'AI betting tips',
  'football predictions',
  'basketball tips',
  'tennis predictions',
  'sports betting',
  'AI tipster',
  'winning predictions',
  'betting advice',
  'sports analysis',
  'prediction accuracy',
  'betting strategy',
  'daily football tips',
  'sports betting predictions',
  'AI sports analysis',
  'confident betting tips',
  'professional sports predictions',
  'winning betting strategy',
]

const resolveBaseUrl = (): string => {
  const fallback = 'https://www.snapbet.bet'
  const envUrl = process.env.NEXTAUTH_URL
  if (!envUrl) {
    return fallback
  }

  try {
    return new URL(envUrl).origin
  } catch {
    return fallback
  }
}

const stripHtmlTags = (value?: string): string => {
  if (!value) {
    return ''
  }

  return value.replace(/<[^>]*>/g, ' ')
}

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

const clampText = (value: string, maxLength: number): string => {
  const normalized = normalizeWhitespace(value)

  if (normalized.length <= maxLength) {
    return normalized
  }

  const truncated = normalized.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')

  if (lastSpace > maxLength * 0.6) {
    return `${truncated.slice(0, lastSpace).trimEnd()}...`
  }

  return `${truncated.trimEnd()}...`
}

const formatTitle = (rawTitle?: string): string => {
  const cleaned = normalizeWhitespace(
    stripHtmlTags(rawTitle)?.replace(/\|\s*SnapBet AI/gi, '') ?? ''
  )

  const baseTitle = cleaned.length > 0 ? cleaned : DEFAULT_TITLE
  const brandSuffix = ` | ${BRAND_NAME}`

  if (baseTitle.toLowerCase().includes(BRAND_NAME.toLowerCase())) {
    return clampText(baseTitle, TITLE_MAX_LENGTH)
  }

  const availableLength = Math.max(
    TITLE_MAX_LENGTH - brandSuffix.length,
    Math.floor(TITLE_MAX_LENGTH * 0.6)
  )
  const truncatedBase = clampText(baseTitle, availableLength)
  return `${truncatedBase}${brandSuffix}`
}

const formatDescription = (rawDescription?: string): string => {
  const sanitized = normalizeWhitespace(
    stripHtmlTags(rawDescription) || DEFAULT_DESCRIPTION
  )

  return clampText(sanitized, DESCRIPTION_MAX_LENGTH)
}

const resolveAbsoluteUrl = (baseUrl: string, pathOrUrl?: string): string => {
  if (!pathOrUrl) {
    return baseUrl
  }

  try {
    const maybeUrl = new URL(pathOrUrl)
    return maybeUrl.toString()
  } catch {
    return new URL(pathOrUrl, baseUrl).toString()
  }
}

export function generateMetadata(options: GenerateMetadataOptions): Metadata {
  const baseUrl = resolveBaseUrl()
  const {
    title,
    description,
    keywords = [],
    image = '/og-image.jpg',
    url,
    type = 'website',
    publishedTime,
    modifiedTime,
    author = `${BRAND_NAME} Team`,
    section,
    tags = [],
  } = options

  const formattedTitle = formatTitle(title)
  const formattedDescription = formatDescription(description)
  const absoluteUrl = resolveAbsoluteUrl(baseUrl, url)
  const openGraphImage = resolveAbsoluteUrl(baseUrl, image)

  const keywordSet = Array.from(new Set([...BASE_KEYWORDS, ...keywords]))

  const metadata: Metadata = {
    title: {
      absolute: formattedTitle,
    },
    description: formattedDescription,
    keywords: keywordSet,
    authors: [{ name: author }],
    creator: BRAND_NAME,
    publisher: BRAND_NAME,
    category: 'Sports & Recreation',
    classification: 'Sports Betting',
    alternates: {
      canonical: absoluteUrl,
    },
    openGraph: {
      title: formattedTitle,
      description: formattedDescription,
      url: absoluteUrl,
      siteName: BRAND_NAME,
      images: [
        {
          url: openGraphImage,
          width: 1200,
          height: 630,
          alt: formattedTitle,
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
      title: formattedTitle,
      description: formattedDescription,
      images: [openGraphImage],
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
  // Use fallback to default OG image (which exists) for immediate X.com compatibility
  // TODO: In the future, implement dynamic OG image generation or pre-generate blog-specific images
  // When blog-specific images are available, switch to: `/blog-images/${slug}-og.jpg`
  // The generateMetadata function will automatically convert this to an absolute URL
  const imagePath = '/og-image.jpg'
  
  return generateMetadata({
    title,
    description,
    url: `/blog/${slug}`,
    type: 'article',
    publishedTime: publishedAt,
    modifiedTime: modifiedAt,
    author,
    tags,
    image: imagePath, // Will be converted to absolute URL by generateMetadata
    keywords: [
      'sports betting blog',
      'betting tips blog',
      'AI predictions blog',
      'football betting blog',
      'sports analysis blog',
      ...tags,
    ],
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
      'country-specific betting tips',
    ],
  })
}