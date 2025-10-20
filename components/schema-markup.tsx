import React from 'react'

export function OrganizationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SnapBet AI",
    "url": "https://www.snapbet.bet",
    "logo": "https://www.snapbet.bet/logo.png",
    "description": "AI-powered sports betting predictions and tips platform",
    "foundingDate": "2024",
    "sameAs": [
      "https://twitter.com/snapbet",
      "https://facebook.com/snapbet",
      "https://instagram.com/snapbet"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "email": "support@snapbet.ai"
    },
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "Global"
    }
  }
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function WebSiteSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "SnapBet AI",
    "url": "https://www.snapbet.bet",
    "description": "AI-powered sports betting predictions and tips",
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
      "name": "SnapBet AI"
    }
  }
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function SportsEventSchema({ 
  eventName, 
  startDate, 
  endDate, 
  location, 
  homeTeam, 
  awayTeam 
}: {
  eventName: string
  startDate: string
  endDate: string
  location: string
  homeTeam: string
  awayTeam: string
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": eventName,
    "startDate": startDate,
    "endDate": endDate,
    "location": {
      "@type": "Place",
      "name": location
    },
    "competitor": [
      {
        "@type": "SportsTeam",
        "name": homeTeam
      },
      {
        "@type": "SportsTeam",
        "name": awayTeam
      }
    ],
    "sport": "Football",
    "organizer": {
      "@type": "Organization",
      "name": "SnapBet AI"
    }
  }
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function FAQSchema({ faqs }: { faqs: Array<{ question: string; answer: string }> }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  }
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function BreadcrumbListSchema({ items }: { items: Array<{ name: string; url: string }> }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  }
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function ProductSchema({ 
  name, 
  description, 
  price, 
  currency = "USD",
  availability = "InStock"
}: {
  name: string
  description: string
  price: number
  currency?: string
  availability?: string
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": name,
    "description": description,
    "offers": {
      "@type": "Offer",
      "price": price,
      "priceCurrency": currency,
      "availability": `https://schema.org/${availability}`,
      "seller": {
        "@type": "Organization",
        "name": "SnapBet AI"
      }
    }
  }
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function NewsArticleSchema({ 
  headline, 
  description, 
  image, 
  datePublished, 
  dateModified, 
  author, 
  publisher, 
  articleSection,
  articleBody
}: { 
  headline: string
  description: string
  image?: string
  datePublished: string
  dateModified?: string
  author: string
  publisher: string
  articleSection?: string
  articleBody?: string
}) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://www.snapbet.bet'
  
  const schema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": headline,
    "description": description,
    "image": image ? `${baseUrl}${image}` : `${baseUrl}/og-image.jpg`,
    "datePublished": datePublished,
    "dateModified": dateModified || datePublished,
    "author": {
      "@type": "Person",
      "name": author
    },
    "publisher": {
      "@type": "Organization",
      "name": publisher,
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/logo.png`
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${baseUrl}/blog/${headline.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    },
    ...(articleSection && { "articleSection": articleSection }),
    ...(articleBody && { "articleBody": articleBody })
  }
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function AllSchemaMarkup() {
  return (
    <>
      <OrganizationSchema />
      <WebSiteSchema />
    </>
  )
} 