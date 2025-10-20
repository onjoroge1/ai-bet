/**
 * SEO Metadata Utilities
 * Provides dynamic metadata generation for different page types
 */

export interface PageMetadata {
  title: string
  description: string
  keywords?: string[]
  canonical?: string
  ogImage?: string
  noIndex?: boolean
}

/**
 * Generate metadata for different page types
 */
export function generatePageMetadata({
  title,
  description,
  keywords = [],
  canonical,
  ogImage = "/og-image.jpg",
  noIndex = false,
}: PageMetadata) {
  const baseUrl = process.env.NEXTAUTH_URL || "https://www.snapbet.bet"
  
  return {
    title,
    description,
    keywords: [
      "sports predictions",
      "AI betting tips", 
      "football predictions",
      "basketball tips",
      "tennis predictions",
      "sports betting",
      "AI tipster",
      "winning predictions",
      "betting advice",
      "sports analysis",
      "prediction accuracy",
      "betting strategy",
      ...keywords
    ],
    openGraph: {
      title,
      description,
      url: canonical || baseUrl,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
          type: "image/jpeg",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical: canonical || baseUrl,
    },
  }
}

/**
 * Generate blog post metadata
 */
export function generateBlogMetadata({
  title,
  description,
  slug,
  publishedAt,
  author = "SnapBet AI Team",
  tags = [],
}: {
  title: string
  description: string
  slug: string
  publishedAt: string
  author?: string
  tags?: string[]
}) {
  const baseUrl = process.env.NEXTAUTH_URL || "https://www.snapbet.bet"
  const canonical = `${baseUrl}/blog/${slug}`
  
  return {
    title,
    description,
    keywords: [
      "sports predictions",
      "AI betting tips",
      "football analysis",
      "betting strategy",
      "sports betting tips",
      ...tags
    ],
    authors: [{ name: author }],
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      publishedTime: publishedAt,
      authors: [author],
      tags: tags,
      images: [
        {
          url: `/blog-images/${slug}-og.jpg`,
          width: 1200,
          height: 630,
          alt: title,
          type: "image/jpeg",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/blog-images/${slug}-og.jpg`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical,
    },
  }
}

/**
 * Generate country-specific metadata
 */
export function generateCountryMetadata({
  countryName,
  countryCode,
  description,
  keywords = [],
}: {
  countryName: string
  countryCode: string
  description: string
  keywords?: string[]
}) {
  const baseUrl = process.env.NEXTAUTH_URL || "https://www.snapbet.bet"
  const canonical = `${baseUrl}/${countryCode.toLowerCase()}`
  
  return {
    title: `SnapBet AI - ${countryName} Sports Predictions & Betting Tips`,
    description,
    keywords: [
      "sports predictions",
      "AI betting tips",
      `${countryName} sports betting`,
      `${countryName} football predictions`,
      `${countryName} basketball tips`,
      "sports betting",
      "AI tipster",
      "winning predictions",
      ...keywords
    ],
    openGraph: {
      title: `SnapBet AI - ${countryName} Sports Predictions & Betting Tips`,
      description,
      url: canonical,
      locale: getLocaleFromCountry(countryCode),
      images: [
        {
          url: `/og-images/${countryCode.toLowerCase()}-og.jpg`,
          width: 1200,
          height: 630,
          alt: `SnapBet AI - ${countryName} Sports Predictions`,
          type: "image/jpeg",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `SnapBet AI - ${countryName} Sports Predictions & Betting Tips`,
      description,
      images: [`/og-images/${countryCode.toLowerCase()}-og.jpg`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical,
    },
  }
}

/**
 * Get locale from country code
 */
function getLocaleFromCountry(countryCode: string): string {
  const localeMap: Record<string, string> = {
    'US': 'en_US',
    'GB': 'en_GB',
    'CA': 'en_CA',
    'AU': 'en_AU',
    'DE': 'de_DE',
    'FR': 'fr_FR',
    'ES': 'es_ES',
    'IT': 'it_IT',
    'PT': 'pt_PT',
    'BR': 'pt_BR',
    'MX': 'es_MX',
    'AR': 'es_AR',
    'CL': 'es_CL',
    'CO': 'es_CO',
    'PE': 'es_PE',
    'VE': 'es_VE',
    'NG': 'en_NG',
    'ZA': 'en_ZA',
    'KE': 'en_KE',
    'GH': 'en_GH',
    'EG': 'ar_EG',
    'MA': 'ar_MA',
    'TN': 'ar_TN',
    'DZ': 'ar_DZ',
    'LY': 'ar_LY',
    'SD': 'ar_SD',
    'ET': 'am_ET',
    'UG': 'en_UG',
    'TZ': 'sw_TZ',
    'RW': 'en_RW',
    'BI': 'en_BI',
    'DJ': 'fr_DJ',
    'ER': 'en_ER',
    'SO': 'so_SO',
    'SS': 'en_SS',
    'CF': 'fr_CF',
    'TD': 'fr_TD',
    'CM': 'fr_CM',
    'GQ': 'es_GQ',
    'GA': 'fr_GA',
    'CG': 'fr_CG',
    'CD': 'fr_CD',
    'AO': 'pt_AO',
    'ZM': 'en_ZM',
    'ZW': 'en_ZW',
    'BW': 'en_BW',
    'NA': 'en_NA',
    'SZ': 'en_SZ',
    'LS': 'en_LS',
    'MG': 'mg_MG',
    'MU': 'en_MU',
    'SC': 'en_SC',
    'KM': 'ar_KM',
    'YT': 'fr_YT',
    'RE': 'fr_RE',
    'MZ': 'pt_MZ',
    'MW': 'en_MW',
  }
  
  return localeMap[countryCode] || 'en_US'
}
