import "./globals.css"
import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Providers } from "./providers"
import { SkipToMainContent, LiveRegion } from "@/components/ui/accessibility"
import { AllSchemaMarkup } from "@/components/schema-markup"
import { GoogleAnalytics } from "@/components/analytics/google-analytics"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#10b981",
}

export const metadata: Metadata = {
  title: {
    default: "SnapBet AI - AI-Powered Sports Predictions & Betting Tips",
    template: "%s | SnapBet AI"
  },
  description: "Get winning sports predictions powered by AI. Join thousands of successful bettors with our data-driven football, basketball, and tennis tips. Start winning today with confidence scores and expert analysis!",
  keywords: [
    "sports predictions", "AI betting tips", "football predictions", 
    "basketball tips", "tennis predictions", "sports betting", 
    "AI tipster", "winning predictions", "betting advice",
    "sports analysis", "prediction accuracy", "betting strategy",
    "daily football tips", "sports betting predictions", "AI sports analysis",
    "confident betting tips", "professional sports predictions", "winning betting strategy"
  ],
  authors: [{ name: "SnapBet AI Team" }],
  creator: "SnapBet AI",
  publisher: "SnapBet AI",
  category: "Sports & Recreation",
  classification: "Sports Betting",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SnapBet AI - AI-Powered Sports Predictions & Betting Tips",
    description: "Get winning sports predictions powered by AI. Join thousands of successful bettors with our data-driven football, basketball, and tennis tips. Start winning today!",
    url: "/",
    siteName: "SnapBet AI",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "SnapBet AI - AI-Powered Sports Predictions",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SnapBet AI - AI-Powered Sports Predictions & Betting Tips",
    description: "Get winning sports predictions powered by AI. Join thousands of successful bettors with our data-driven football, basketball, and tennis tips. Start winning today!",
    images: ["/og-image.jpg"],
    creator: "@snapbet",
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
  verification: {
    google: "your-google-verification-code", // Add when you have Google Search Console
    yandex: "your-yandex-verification-code", // Add if targeting Russian market
    yahoo: "your-yahoo-verification-code", // Add if needed
  },
  other: {
    "application-name": "SnapBet AI",
    "apple-mobile-web-app-title": "SnapBet AI",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "format-detection": "telephone=no,date=no,address=no,email=no",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#10b981",
    "msapplication-config": "/browserconfig.xml",
    "theme-color": "#10b981",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

  return (
    <html lang="en" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <meta name="theme-color" content="#10b981" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SnapBet AI" />
        <meta name="application-name" content="SnapBet AI" />
        <meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#10b981" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Favicon and app icons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        
        {/* DNS prefetch for performance */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        
        {/* Schema Markup for SEO */}
        <AllSchemaMarkup />
      </head>
      <body className={`overflow-x-hidden ${inter.className}`} suppressHydrationWarning>
        <Providers>
          <SkipToMainContent />
          <LiveRegion announcement="" />
          <Navigation />
          <main id="main-content" className="pb-16 md:pb-0" role="main" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </Providers>
        
        {/* Google Analytics - Only load in production */}
        {GA_MEASUREMENT_ID && process.env.NODE_ENV === 'production' && (
          <GoogleAnalytics GA_MEASUREMENT_ID={GA_MEASUREMENT_ID} />
        )}
      </body>
    </html>
  )
}
