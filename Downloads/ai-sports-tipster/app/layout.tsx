import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ResponsiveNavigation } from "@/components/responsive/responsive-navigation"
import { Footer } from "@/components/footer"

const inter = Inter({ subsets: ["latin"] })

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: 'yes',
  themeColor: '#10b981'
};

export const metadata: Metadata = {
  title: "AI Sports Tipster - Global AI-Powered Betting Predictions",
  description:
    "Get winning sports betting predictions powered by advanced AI algorithms. Join thousands of successful bettors worldwide with our data-driven insights.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AI Tipster",
  },
  generator: 'v0.dev'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <meta name="theme-color" content="#10b981" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${inter.className} overflow-x-hidden`}>
        <ResponsiveNavigation />
        <main className="pb-16 md:pb-0">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
