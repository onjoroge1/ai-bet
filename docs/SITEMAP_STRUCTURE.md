# Sitemap Structure Documentation

## Overview

SnapBet AI implements a comprehensive, scalable sitemap system designed for optimal SEO performance across multiple countries and content types. The system uses a sitemap index pattern to organize content efficiently and improve search engine crawling.

## Sitemap Architecture

### 1. Main Sitemap Index (`/sitemap.xml`)
The main sitemap serves as an index that references all other sitemaps:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://snapbet.ai/sitemap-main.xml</loc>
    <lastmod>2024-01-15T00:00:00.000Z</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://snapbet.ai/sitemap-countries.xml</loc>
    <lastmod>2024-01-15T00:00:00.000Z</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://snapbet.ai/sitemap-blog.xml</loc>
    <lastmod>2024-01-15T00:00:00.000Z</lastmod>
  </sitemap>
</sitemapindex>
```

### 2. Main Sitemap (`/sitemap-main.xml`)
Contains all static pages and core functionality:

- Homepage (`/`)
- Daily Tips (`/daily-tips`)
- Weekly Specials (`/weekly-specials`)
- Live Predictions (`/live-predictions`)
- Blog (`/blog`)
- FAQ (`/faq`)
- Support (`/support`)
- Authentication pages (`/signin`, `/signup`)
- Dashboard (`/dashboard`)
- Tips History (`/tips-history`)
- SnapBet Quiz (`/snapbet-quiz`)
- Geo Demo (`/geo-demo`)

### 3. Countries Sitemap (`/sitemap-countries.xml`)
Lists all country-specific pages for supported countries:

- Country Homepage (`/{country}`)
- Country Blog (`/{country}/blog`)
- Country FAQ (`/{country}/faq`)

**Supported Countries Include:**
- US, GB, NG, KE, ZA, GH, UG, TZ, IN, PH
- CA, AU, DE, FR, IT, ES, BR, MX
- And many more major football nations

### 4. Blog Sitemap (`/sitemap-blog.xml`)
Dynamic sitemap containing:

- Main blog listing (`/blog`)
- Individual blog posts (`/blog/{slug}`)
- Country-specific blog posts (`/{country}/blog/{slug}`)

### 5. Country-Specific Sitemaps (`/sitemap-{country}.xml`)
Individual sitemaps for each supported country containing:

- Country homepage
- Country blog listing
- Country FAQ
- All blog posts relevant to that country

## SEO Benefits

### 1. **Improved Crawling Efficiency**
- Search engines can crawl specific content types more efficiently
- Reduces server load by distributing crawling across multiple sitemaps
- Faster discovery of new content

### 2. **Better Content Organization**
- Clear separation between static pages, blog content, and country-specific content
- Easier for search engines to understand site structure
- Improved content targeting for different regions

### 3. **Enhanced Local SEO**
- Country-specific sitemaps improve local search rankings
- Better targeting of geo-specific keywords
- Improved visibility in local search results

### 4. **Scalability**
- System can handle thousands of blog posts without performance issues
- Easy to add new countries without affecting existing sitemaps
- Modular structure allows for future expansion

### 5. **Fresh Content Discovery**
- Blog sitemap updates frequently with new posts
- Country sitemaps reflect local content changes
- Search engines can prioritize fresh content

## Technical Implementation

### File Structure
```
app/
├── sitemap.ts                    # Main sitemap index
├── sitemap-main.xml/
│   └── route.ts                  # Static pages sitemap
├── sitemap-countries.xml/
│   └── route.ts                  # Countries overview sitemap
├── sitemap-blog.xml/
│   └── route.ts                  # Blog content sitemap
└── sitemap-[country].xml/
    └── route.ts                  # Dynamic country sitemaps
```

### Key Features

1. **Automatic Content Discovery**
   - Blog sitemap automatically includes all published posts
   - Country-specific blog posts are filtered by geoTarget
   - Fallback mechanisms for database errors

2. **Caching Strategy**
   - All sitemaps are cached for 1 hour
   - Reduces database load
   - Improves response times

3. **Error Handling**
   - Graceful fallbacks if database is unavailable
   - Proper HTTP status codes
   - Logging for debugging

4. **SEO Optimization**
   - Proper priority values for different content types
   - Appropriate change frequencies
   - Accurate last modified dates

## Usage Examples

### Accessing Sitemaps

```bash
# Main sitemap index
curl https://snapbet.ai/sitemap.xml

# Main static pages
curl https://snapbet.ai/sitemap-main.xml

# All country pages
curl https://snapbet.ai/sitemap-countries.xml

# All blog content
curl https://snapbet.ai/sitemap-blog.xml

# Nigeria-specific sitemap
curl https://snapbet.ai/sitemap-ng.xml

# Kenya-specific sitemap
curl https://snapbet.ai/sitemap-ke.xml
```

### Robots.txt Integration
The robots.txt file automatically references the main sitemap index:

```txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
...

Sitemap: https://snapbet.ai/sitemap.xml
Host: https://snapbet.ai
```

## Performance Considerations

### Database Queries
- Blog sitemap uses optimized queries with specific field selection
- Country filtering reduces unnecessary data transfer
- Pagination support for large content sets

### Caching
- 1-hour cache duration balances freshness with performance
- CDN-friendly cache headers
- Graceful degradation on cache misses

### Scalability
- Modular design allows independent scaling of different sitemap types
- Country-specific sitemaps can be cached separately
- Easy to add new content types without affecting existing sitemaps

## Monitoring and Maintenance

### Health Checks
- Monitor sitemap generation times
- Track database query performance
- Alert on sitemap generation failures

### Content Updates
- Blog posts automatically appear in sitemaps when published
- Country additions automatically create new sitemaps
- No manual intervention required for content updates

### SEO Monitoring
- Track sitemap submission success rates
- Monitor crawl statistics in Google Search Console
- Analyze country-specific search performance

## Future Enhancements

### Planned Features
1. **Image Sitemaps**: Include optimized images for blog posts
2. **Video Sitemaps**: Support for video content
3. **News Sitemaps**: Special handling for time-sensitive content
4. **Mobile Sitemaps**: Mobile-specific content targeting
5. **AMP Sitemaps**: Accelerated Mobile Pages support

### Performance Optimizations
1. **Incremental Updates**: Only update changed content
2. **Compression**: Gzip compression for large sitemaps
3. **CDN Integration**: Global sitemap distribution
4. **Analytics Integration**: Track sitemap usage and effectiveness

## Best Practices

### Content Management
- Keep blog posts up to date with accurate metadata
- Use appropriate geoTarget values for country-specific content
- Maintain consistent URL structures

### SEO Optimization
- Submit sitemaps to major search engines
- Monitor crawl errors and fix issues promptly
- Use appropriate priority and change frequency values

### Technical Maintenance
- Regular monitoring of sitemap generation performance
- Database optimization for sitemap queries
- Backup and recovery procedures for sitemap data

This sitemap structure provides a solid foundation for SnapBet AI's SEO strategy, ensuring optimal search engine visibility across all supported countries and content types. 