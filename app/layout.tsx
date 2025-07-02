import "./globals.css"
import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Providers } from "./providers"

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
  title: "SnapBet",
  description: "AI-powered sports betting predictions and tips",
  keywords: ["sports betting", "predictions", "AI", "tips", "football", "basketball", "tennis"],
  authors: [{ name: "SnapBet Team" }],
  creator: "SnapBet",
  publisher: "SnapBet",
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
    title: "SnapBet - AI-Powered Sports Predictions",
    description: "Get accurate sports betting predictions powered by artificial intelligence. Join thousands of users winning with our AI tips.",
    url: "/",
    siteName: "SnapBet",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "SnapBet - AI-Powered Sports Predictions",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SnapBet - AI-Powered Sports Predictions",
    description: "Get accurate sports betting predictions powered by artificial intelligence. Join thousands of users winning with our AI tips.",
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
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <meta name="theme-color" content="#10b981" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`overflow-x-hidden ${inter.className}`} suppressHydrationWarning>
        <Providers>
          <Navigation />
          <main className="pb-16 md:pb-0">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
