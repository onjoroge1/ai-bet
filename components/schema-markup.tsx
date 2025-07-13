import React from 'react'

export function OrganizationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SnapBet AI",
    "url": "https://snapbet.ai",
    "logo": "https://snapbet.ai/logo.png",
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
    "url": "https://snapbet.ai",
    "description": "AI-powered sports betting predictions and tips",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://snapbet.ai/search?q={search_term_string}"
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

export function AllSchemaMarkup() {
  return (
    <>
      <OrganizationSchema />
      <WebSiteSchema />
    </>
  )
} 