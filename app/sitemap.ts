import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://www.snapbet.bet'
  const currentDate = new Date()

  // Main sitemap index that references all other sitemaps
  return [
    {
      url: `${baseUrl}/sitemap-main.xml`,
      lastModified: currentDate,
      changeFrequency: 'daily' as const,
    },
    {
      url: `${baseUrl}/sitemap-countries.xml`,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
    },
    {
      url: `${baseUrl}/sitemap-blog.xml`,
      lastModified: currentDate,
      changeFrequency: 'daily' as const,
    },
    {
      url: `${baseUrl}/sitemap-news.xml`,
      lastModified: currentDate,
      changeFrequency: 'hourly' as const, // News sitemap updates frequently
    },
    {
      url: `${baseUrl}/sitemap-matches.xml`,
      lastModified: currentDate,
      changeFrequency: 'daily' as const, // Finished matches sitemap
    },
  ]
} 