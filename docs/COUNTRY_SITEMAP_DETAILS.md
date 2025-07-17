# Country-Specific Sitemap Details

## Overview

**Yes, country-specific sitemaps DO include country-specific blog posts** in the format `/ke/blog/blog-title`.

## What's Included in Each Country Sitemap

### 1. Country Homepage
- URL: `https://snapbet.ai/ke`
- Priority: 0.9
- Change Frequency: daily

### 2. Country Blog Listing
- URL: `https://snapbet.ai/ke/blog`
- Priority: 0.7
- Change Frequency: daily

### 3. Country FAQ Page
- URL: `https://snapbet.ai/ke/faq`
- Priority: 0.6
- Change Frequency: weekly

### 4. Country-Specific Blog Posts
- URL: `https://snapbet.ai/ke/blog/blog-title`
- Priority: 0.6
- Change Frequency: monthly

## Blog Post Filtering Logic

The country-specific sitemap includes blog posts that are:

1. **Targeted to the specific country** (`geoTarget: { has: 'KE' }`)
2. **Global posts** (`geoTarget: { isEmpty: true }`)

This means each country gets:
- All blog posts specifically written for that country
- All global blog posts that aren't targeted to any specific country

## Example: Kenya Sitemap (`/sitemap-ke.xml`)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://snapbet.ai/ke</loc>
    <lastmod>2024-01-15T00:00:00.000Z</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://snapbet.ai/ke/blog</loc>
    <lastmod>2024-01-15T00:00:00.000Z</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://snapbet.ai/ke/faq</loc>
    <lastmod>2024-01-15T00:00:00.000Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://snapbet.ai/ke/blog/how-ai-predictions-work</loc>
    <lastmod>2024-01-15T00:00:00.000Z</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://snapbet.ai/ke/blog/top-betting-strategies-football</loc>
    <lastmod>2024-01-15T00:00:00.000Z</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <!-- More blog posts... -->
</urlset>
```

## SEO Benefits

1. **Local Content Discovery**: Search engines can easily find country-specific content
2. **Improved Local Rankings**: Country-specific URLs help with local SEO
3. **Better User Experience**: Users see content relevant to their location
4. **Scalable Structure**: Easy to add new countries without affecting existing sitemaps

## Technical Implementation

- **Dynamic Route**: `/sitemap-[country].xml/route.ts`
- **Database Query**: Filters blog posts by `geoTarget` field
- **Caching**: 1-hour cache for performance
- **Error Handling**: Fallback to basic country pages if database fails

## Accessing Country Sitemaps

```bash
# Kenya sitemap
curl https://snapbet.ai/sitemap-ke.xml

# Nigeria sitemap  
curl https://snapbet.ai/sitemap-ng.xml

# UK sitemap
curl https://snapbet.ai/sitemap-gb.xml

# Any supported country
curl https://snapbet.ai/sitemap-{country-code}.xml
```

## Supported Countries

All countries in the `getPrimarySupportedCountries()` function get their own sitemap, including:
- US, GB, NG, KE, ZA, GH, UG, TZ, IN, PH
- CA, AU, DE, FR, IT, ES, BR, MX
- And many more major football nations

This ensures comprehensive SEO coverage for all target markets. 