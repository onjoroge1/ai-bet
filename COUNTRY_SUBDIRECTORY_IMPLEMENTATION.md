# 🌍 Country Subdirectory Implementation Guide

## Overview

SnapBet AI now supports country-specific subdirectories instead of domain extensions. This approach provides better SEO, easier management, and improved user experience.

## URL Structure

### Before (Domain Extensions)
- `snapbet.ke` - Kenya
- `snapbet.ng` - Nigeria
- `snapbet.ug` - Uganda

### After (Subdirectories)
- `snapbet.bet/ke` - Kenya
- `snapbet.bet/ng` - Nigeria
- `snapbet.bet/ug` - Uganda
- `snapbet.bet/br` - Brazil
- `snapbet.bet/ar` - Argentina
- `snapbet.bet/za` - South Africa

## Benefits

### 1. **SEO Advantages**
- **Single Domain Authority**: All SEO value stays on one domain
- **Better Link Building**: Easier to build backlinks to one domain
- **Simplified Analytics**: All traffic tracked under one property
- **Faster Indexing**: Google treats it as one site, not multiple domains

### 2. **Technical Benefits**
- **Easier Management**: One SSL certificate, one hosting setup
- **Cost Effective**: No need to purchase multiple domains
- **Simplified DNS**: Single domain management
- **Better Performance**: No cross-domain requests needed

### 3. **User Experience**
- **Consistent Branding**: Same domain across all countries
- **Easier Sharing**: Users can share links without confusion
- **Trust Building**: Single trusted domain builds credibility

## Implementation Details

### 1. **Country-Specific Pages**

#### Homepage (`/[country]/page.tsx`)
- Dynamic country detection and validation
- Country-specific metadata and SEO optimization
- Localized pricing and content
- Automatic fallback for unsupported countries

#### Blog (`/[country]/blog/page.tsx`)
- Country-specific blog content filtering
- Localized blog metadata
- Country-specific navigation links
- Fallback to global blog if no local content

#### FAQ (`/[country]/faq/page.tsx`)
- Country-specific FAQ content
- Localized pricing information
- Country-specific payment methods
- Local support information

### 2. **Middleware Integration**

The middleware now handles:
- Country path validation
- Automatic redirects for invalid countries
- Country information in request headers
- Logging for country-specific access

### 3. **Sitemap Generation**

The sitemap automatically includes:
- All country-specific homepages
- All country-specific blog pages
- All country-specific FAQ pages
- Proper priorities and change frequencies

## Supported Countries

### Primary Markets (100+ Countries)
- **Africa**: Kenya, Nigeria, South Africa, Ghana, Uganda, Tanzania
- **South America**: Brazil, Argentina, Colombia, Chile, Peru, Venezuela, Uruguay, Paraguay, Bolivia, Ecuador
- **Europe**: Germany, France, Italy, Spain, Netherlands, Portugal, Belgium, Austria, Switzerland, Sweden, Norway, Denmark, Finland, Poland, Czech Republic, Hungary, Romania, Bulgaria, Croatia, Serbia, Slovenia, Slovakia, Ireland, Turkey
- **Asia**: India, Philippines, Thailand, Malaysia, Singapore, Indonesia, Vietnam, South Korea, Japan, China, Hong Kong, Taiwan, UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman, Jordan, Lebanon, Israel
- **Americas**: US, Canada, Mexico, Costa Rica, Panama, Guatemala, El Salvador, Honduras, Nicaragua, Belize, Jamaica, Trinidad & Tobago, Barbados, and all Caribbean nations
- **Oceania**: Australia, New Zealand, and Pacific Island nations

## Technical Implementation

### 1. **File Structure**
```
app/
├── [country]/
│   ├── page.tsx (country homepage)
│   ├── blog/
│   │   └── page.tsx (country blog)
│   └── faq/
│       └── page.tsx (country FAQ)
├── sitemap.ts (updated with country pages)
└── middleware.ts (country routing logic)
```

### 2. **Country Detection Logic**
```typescript
// Priority order:
// 1. URL path (/ke, /ng, etc.)
// 2. User profile preference
// 3. IP geolocation
// 4. Default (US)
```

### 3. **SEO Optimization**
- Country-specific meta titles and descriptions
- Localized keywords and content
- Proper canonical URLs
- Country-specific Open Graph tags
- Localized schema markup

## Usage Examples

### 1. **Accessing Country Pages**
```bash
# Kenya homepage
https://snapbet.bet/ke

# Nigeria blog
https://snapbet.bet/ng/blog

# Brazil FAQ
https://snapbet.bet/br/faq
```

### 2. **Country Detection**
```typescript
// Middleware automatically detects country from URL
// and adds to request headers
const countryCode = request.headers.get('x-country-code')
const countryName = request.headers.get('x-country-name')
```

### 3. **Content Filtering**
```typescript
// Blog posts are filtered by country
const blogPosts = await getBlogPosts(countryCode)
// Returns worldwide + country-specific posts
```

## SEO Benefits

### 1. **Local Search Rankings**
- Country-specific content improves local SEO
- Local keywords and phrases
- Country-specific meta descriptions
- Local business schema markup

### 2. **Content Targeting**
- Country-specific blog posts
- Localized pricing information
- Regional payment methods
- Local support and contact information

### 3. **User Experience**
- Localized content and pricing
- Country-specific navigation
- Local payment methods
- Regional support

## Analytics and Tracking

### 1. **Country-Specific Metrics**
- Page views by country
- Conversion rates by region
- User engagement by location
- Content performance by market

### 2. **SEO Performance**
- Search rankings by country
- Organic traffic by region
- Click-through rates by market
- Local search visibility

## Future Enhancements

### 1. **Automatic Redirects**
- IP-based country detection
- Automatic redirect to local subdirectory
- User preference settings
- Language-based routing

### 2. **Advanced Localization**
- Local language support
- Regional content variations
- Cultural adaptations
- Local payment integrations

### 3. **Performance Optimization**
- Country-specific caching
- Local CDN distribution
- Regional server deployment
- Optimized loading for local markets

## Migration Strategy

### 1. **From Domain Extensions**
- Set up 301 redirects from old domains
- Update all internal links
- Notify search engines of changes
- Monitor traffic and rankings

### 2. **Content Migration**
- Migrate country-specific content
- Update all URLs and links
- Optimize for new structure
- Test all functionality

### 3. **SEO Migration**
- Submit new sitemap to search engines
- Update Google Search Console
- Monitor for any ranking changes
- Optimize based on performance

## Monitoring and Maintenance

### 1. **Regular Checks**
- Country page accessibility
- Content freshness
- SEO performance
- User engagement metrics

### 2. **Content Updates**
- Regular blog posts for each country
- Updated pricing information
- Local news and updates
- Regional promotions

### 3. **Technical Maintenance**
- URL structure validation
- Redirect monitoring
- Performance optimization
- Security updates

## Conclusion

The country subdirectory approach provides significant advantages over domain extensions:

- **Better SEO**: Single domain authority and easier link building
- **Easier Management**: One domain, one SSL certificate, simplified DNS
- **Improved UX**: Consistent branding and easier sharing
- **Cost Effective**: No need for multiple domain purchases
- **Scalable**: Easy to add new countries without technical complexity

This implementation positions SnapBet AI for global growth while maintaining strong local market presence and SEO performance. 