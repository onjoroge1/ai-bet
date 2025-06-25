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
  title: "AI Sports Tipster",
  description: "AI-powered sports predictions and betting tips",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AI Tipster",
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
