'use client'

import { useEffect } from 'react'

interface RichSnippetProps {
  type: 'sports-event' | 'product' | 'review' | 'faq' | 'how-to' | 'article' | 'breadcrumb'
  data: any
}

/**
 * Advanced Rich Snippets component
 * Implements various schema markup types for better search visibility
 */
export function RichSnippets({ type, data }: RichSnippetProps) {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const generateSchema = () => {
      switch (type) {
        case 'sports-event':
          return generateSportsEventSchema(data)
        case 'product':
          return generateProductSchema(data)
        case 'review':
          return generateReviewSchema(data)
        case 'faq':
          return generateFAQSchema(data)
        case 'how-to':
          return generateHowToSchema(data)
        case 'article':
          return generateArticleSchema(data)
        case 'breadcrumb':
          return generateBreadcrumbSchema(data)
        default:
          return null
      }
    }

    const schema = generateSchema()
    if (!schema) return

    // Remove existing schema of this type
    const existingSchema = document.querySelector(`script[data-schema="${type}"]`)
    if (existingSchema) {
      existingSchema.remove()
    }

    // Add new schema
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-schema', type)
    script.textContent = JSON.stringify(schema)
    document.head.appendChild(script)
  }, [type, data])

  return null
}

/**
 * Sports Event Schema for match predictions
 */
function generateSportsEventSchema(data: {
  name: string
  startDate: string
  location: string
  homeTeam: string
  awayTeam: string
  sport: string
  league: string
  description?: string
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": data.name,
    "startDate": data.startDate,
    "location": {
      "@type": "Place",
      "name": data.location
    },
    "homeTeam": {
      "@type": "SportsTeam",
      "name": data.homeTeam
    },
    "awayTeam": {
      "@type": "SportsTeam",
      "name": data.awayTeam
    },
    "sport": data.sport,
    "description": data.description || `${data.homeTeam} vs ${data.awayTeam} - ${data.league}`,
    "eventStatus": "https://schema.org/EventScheduled",
    "organizer": {
      "@type": "Organization",
      "name": data.league
    }
  }
}

/**
 * Product Schema for betting tips/packages
 */
function generateProductSchema(data: {
  name: string
  description: string
  price: number
  currency: string
  availability: string
  category: string
  brand?: string
  image?: string
  rating?: number
  reviewCount?: number
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": data.name,
    "description": data.description,
    "brand": {
      "@type": "Brand",
      "name": data.brand || "SnapBet AI"
    },
    "offers": {
      "@type": "Offer",
      "price": data.price,
      "priceCurrency": data.currency,
      "availability": `https://schema.org/${data.availability}`,
      "seller": {
        "@type": "Organization",
        "name": "SnapBet AI"
      }
    },
    "category": data.category,
    "image": data.image,
    "aggregateRating": data.rating ? {
      "@type": "AggregateRating",
      "ratingValue": data.rating,
      "reviewCount": data.reviewCount || 0
    } : undefined
  }
}

/**
 * Review Schema for user testimonials
 */
function generateReviewSchema(data: {
  itemName: string
  rating: number
  reviewBody: string
  author: string
  datePublished: string
  bestRating?: number
  worstRating?: number
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    "itemReviewed": {
      "@type": "Thing",
      "name": data.itemName
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": data.rating,
      "bestRating": data.bestRating || 5,
      "worstRating": data.worstRating || 1
    },
    "reviewBody": data.reviewBody,
    "author": {
      "@type": "Person",
      "name": data.author
    },
    "datePublished": data.datePublished
  }
}

/**
 * FAQ Schema for frequently asked questions
 */
function generateFAQSchema(data: {
  questions: Array<{
    question: string
    answer: string
  }>
}) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": data.questions.map(qa => ({
      "@type": "Question",
      "name": qa.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": qa.answer
      }
    }))
  }
}

/**
 * How-To Schema for guides and tutorials
 */
function generateHowToSchema(data: {
  name: string
  description: string
  steps: Array<{
    name: string
    text: string
    image?: string
    url?: string
  }>
  totalTime?: string
  estimatedCost?: string
  supply?: string[]
  tool?: string[]
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": data.name,
    "description": data.description,
    "totalTime": data.totalTime,
    "estimatedCost": data.estimatedCost ? {
      "@type": "MonetaryAmount",
      "currency": "USD",
      "value": data.estimatedCost
    } : undefined,
    "supply": data.supply?.map(item => ({
      "@type": "HowToSupply",
      "name": item
    })),
    "tool": data.tool?.map(item => ({
      "@type": "HowToTool",
      "name": item
    })),
    "step": data.steps.map((step, index) => ({
      "@type": "HowToStep",
      "position": index + 1,
      "name": step.name,
      "text": step.text,
      "image": step.image,
      "url": step.url
    }))
  }
}

/**
 * Article Schema for blog posts
 */
function generateArticleSchema(data: {
  headline: string
  description: string
  author: string
  datePublished: string
  dateModified: string
  image: string
  wordCount: number
  readingTime: number
  keywords: string[]
  section: string
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": data.headline,
    "description": data.description,
    "image": data.image,
    "author": {
      "@type": "Person",
      "name": data.author
    },
    "publisher": {
      "@type": "Organization",
      "name": "SnapBet AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.snapbet.bet/logo.png"
      }
    },
    "datePublished": data.datePublished,
    "dateModified": data.dateModified,
    "wordCount": data.wordCount,
    "timeRequired": `PT${data.readingTime}M`,
    "keywords": data.keywords.join(', '),
    "articleSection": data.section,
    "inLanguage": "en-US"
  }
}

/**
 * Breadcrumb Schema for navigation
 */
function generateBreadcrumbSchema(data: {
  items: Array<{
    name: string
    url?: string
    position: number
  }>
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": data.items.map(item => ({
      "@type": "ListItem",
      "position": item.position,
      "name": item.name,
      "item": item.url
    }))
  }
}

/**
 * Organization Schema for company information
 */
export function OrganizationSchema() {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const schema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "SnapBet AI",
      "url": "https://www.snapbet.bet",
      "logo": "https://www.snapbet.bet/logo.png",
      "description": "AI-powered sports predictions and betting tips with advanced analytics and machine learning",
      "foundingDate": "2024",
      "founders": [
        {
          "@type": "Person",
          "name": "SnapBet AI Team"
        }
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer service",
        "email": "support@snapbet.bet"
      },
      "sameAs": [
        "https://twitter.com/snapbet",
        "https://facebook.com/snapbet",
        "https://linkedin.com/company/snapbet"
      ],
      "address": {
        "@type": "PostalAddress",
        "addressCountry": "US"
      },
      "areaServed": "Worldwide",
      "serviceType": "Sports Betting Predictions",
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Sports Prediction Services",
        "itemListElement": [
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Daily Football Tips",
              "description": "AI-powered daily football predictions"
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Live Predictions",
              "description": "Real-time sports predictions during matches"
            }
          }
        ]
      }
    }

    // Remove existing organization schema
    const existingSchema = document.querySelector('script[data-schema="organization"]')
    if (existingSchema) {
      existingSchema.remove()
    }

    // Add new organization schema
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-schema', 'organization')
    script.textContent = JSON.stringify(schema)
    document.head.appendChild(script)
  }, [])

  return null
}

/**
 * WebSite Schema for search functionality
 */
export function WebSiteSchema() {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const schema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "SnapBet AI",
      "url": "https://www.snapbet.bet",
      "description": "AI-powered sports predictions and betting tips",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://www.snapbet.bet/search?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      },
      "publisher": {
        "@type": "Organization",
        "name": "SnapBet AI",
        "logo": {
          "@type": "ImageObject",
          "url": "https://www.snapbet.bet/logo.png"
        }
      }
    }

    // Remove existing website schema
    const existingSchema = document.querySelector('script[data-schema="website"]')
    if (existingSchema) {
      existingSchema.remove()
    }

    // Add new website schema
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-schema', 'website')
    script.textContent = JSON.stringify(schema)
    document.head.appendChild(script)
  }, [])

  return null
}
