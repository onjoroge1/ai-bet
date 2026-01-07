import { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import PublicParlaysClient from "./client"

/**
 * SEO-optimized metadata for Paray Generator page
 * Targeting: "parlay generator", "parlay builder", "AI parlay predictions", etc.
 */
export const metadata: Metadata = {
  title: "Free AI Paray Generator | High-Probability Parlays | SnapBet",
  description: "Use our free AI parlay generator to preview high-probability parlays with edge, risk analysis, and quality filtering. Upgrade for unlimited access.",
  keywords: [
    "parlay generator",
    "parlay builder",
    "AI parlay predictions",
    "parlay recommendations",
    "parlay analysis",
    "sports betting parlays",
    "parlay calculator",
    "best parlay picks",
    "parlay strategies",
    "free parlay generator",
    "premium parlays",
    "parlay odds",
    "parlay betting",
    "multi-leg parlays",
    "parlay tips"
  ].join(", "),
  openGraph: {
    title: "Free AI Paray Generator | Premium Parlay Predictions | SnapBet",
    description: "Generate winning parlays with our free AI parlay generator. Get 2 free premium parlays and upgrade for unlimited access.",
    type: "website",
    url: "https://snapbet.ai/parlays",
    siteName: "SnapBet",
    images: [
      {
        url: "/og-parlay-generator.jpg",
        width: 1200,
        height: 630,
        alt: "SnapBet AI Paray Generator"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI Paray Generator | Premium Parlay Predictions",
    description: "Generate winning parlays with our free AI parlay generator. Get 2 free premium parlays and upgrade for unlimited access.",
    images: ["/og-parlay-generator.jpg"]
  },
  alternates: {
    canonical: "https://snapbet.ai/parlays"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  }
}

/**
 * Server Component - Renders SEO content and passes to client component
 */
export default function ParlaysPage() {
  // Structured Data (JSON-LD) for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "SnapBet AI Paray Generator",
    "description": "Free AI-powered parlay generator with premium predictions and analysis",
    "url": "https://snapbet.ai/parlays",
    "applicationCategory": "SportsBettingApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "description": "Free parlay preview with option to upgrade"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "1247"
    },
    "featureList": [
      "AI-powered parlay predictions",
      "Quality filtering",
      "Risk assessment",
      "Edge calculations",
      "Historical performance tracking"
    ]
  }

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is this parlay generator free?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! You can preview 2 high-quality parlays for free every day. To get unlimited access to all parlays, AI analysis, and premium features, upgrade to Parlay Pro for just $11.99/month (60% off regular price)."
        }
      },
      {
        "@type": "Question",
        "name": "How accurate are AI parlays?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our AI parlay generator uses advanced statistical modeling to calculate win probabilities and edge percentages. We only show tradable parlays that meet strict quality thresholds (minimum 5% edge and 5% probability). While no prediction is guaranteed, our AI analyzes match data, team statistics, odds movements, and historical performance to identify high-quality parlay combinations."
        }
      },
      {
        "@type": "Question",
        "name": "What does 'edge' mean in betting?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Edge (or expected value) measures how much better a bet is compared to the bookmaker's odds. A positive edge means the bet has value - the true probability of winning is higher than what the odds suggest. Our AI parlay generator calculates edge percentages for each parlay, showing only those with positive expected value."
        }
      },
      {
        "@type": "Question",
        "name": "Can I use this without placing bets?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! You can use our free parlay generator to preview parlays and see our AI analysis without placing any bets. The preview shows edge percentages, win probabilities, risk levels, and detailed leg information. You only need to subscribe if you want unlimited access to all parlays."
        }
      },
      {
        "@type": "Question",
        "name": "What makes a good parlay?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "A good parlay has positive edge percentage (value), reasonable combined probability (5%+), quality filtering to avoid correlated legs, and risk assessment. Our AI parlay generator identifies these factors automatically, showing only tradable parlays that meet strict quality thresholds."
        }
      },
      {
        "@type": "Question",
        "name": "How does the AI parlay generator work?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our AI parlay generator analyzes match data, team statistics, odds, and historical performance to create optimal parlay combinations. It filters for quality (tradable parlays only), calculates edge percentages to identify value bets, avoids correlated legs, and prioritizes parlays with the highest realistic win probability."
        }
      }
    ]
  }

  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />

      {/* SEO-optimized content */}
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Hero Section with SEO-friendly content */}
        <section className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Free AI Paray Generator
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 mb-4 max-w-3xl mx-auto">
              Generate high-probability parlays using AI-powered analysis, edge detection, and risk filtering. 
              Preview real premium parlays for free—upgrade only if you want unlimited access.
            </p>
          </div>

          {/* Client Component */}
          <PublicParlaysClient />
        </section>

        {/* SEO Content Section */}
        <section className="max-w-4xl mx-auto px-4 py-12">
          <div className="prose prose-invert max-w-none">
            <h2 className="text-3xl font-bold text-white mb-6 text-left">
              What Is a Paray Generator?
            </h2>
            <p className="text-slate-300 text-lg mb-4 text-left">
              A <strong>parlay generator</strong> is a tool that creates multi-leg betting combinations using data and probability models 
              rather than guesswork. Unlike traditional parlay builders that simply combine user-selected bets, an AI parlay generator 
              evaluates edge, correlation, and win probability to produce higher-quality parlays.
            </p>
            
            <h2 className="text-3xl font-bold text-white mb-6 mt-8 text-left">
              How Our AI Paray Generator Works
            </h2>
            <p className="text-slate-300 text-lg mb-4 text-left">
              Our AI parlay generator uses advanced statistical modeling and machine learning to:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6 text-left pl-6">
              <li>Analyze match data and team performance metrics</li>
              <li>Calculate edge percentages to identify value bets</li>
              <li>Filter for <strong>tradable parlays only</strong> (minimum edge & probability)</li>
              <li>Assess overall parlay risk</li>
              <li>Avoid correlated legs that artificially inflate odds</li>
              <li>Prioritize parlays with the highest realistic win probability</li>
            </ul>

            <h2 className="text-3xl font-bold text-white mb-6 mt-8 text-left">
              Why Use an AI Paray Generator?
            </h2>
            <p className="text-slate-300 text-lg mb-4 text-left">
              Traditional parlay builders rely on manual selection and intuition. Our AI parlay generator removes guesswork by:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6 text-left pl-6">
              <li>Automatically identifying high-quality parlay combinations</li>
              <li>Showing only parlays with positive expected value</li>
              <li>Providing transparent win probability and edge metrics</li>
              <li>Including historical performance context</li>
              <li>Helping bettors avoid low-quality, high-variance parlays</li>
            </ul>

            <h2 className="text-3xl font-bold text-white mb-6 mt-8 text-left">
              Start Free. Upgrade When Ready.
            </h2>
            <p className="text-slate-300 text-lg mb-4 text-left">
              Our free AI parlay generator lets you preview two real premium parlays every day. See the quality of our AI analysis before 
              committing. When you're ready for unlimited access, subscribe to our premium dashboard.
            </p>
          </div>
        </section>

        {/* Subtle Pricing Section */}
        <section className="max-w-4xl mx-auto px-4 py-8" id="pricing">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-2">
                  Ready for Unlimited Access?
                </h3>
                <p className="text-slate-400 text-sm mb-3">
                  Get full access to all parlays, detailed AI analysis, and premium features.
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-white">$11.99</span>
                  <span className="text-slate-400">/month</span>
                  <span className="text-slate-500 line-through text-sm">$29.99</span>
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">60% off</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Link href="/dashboard/parlays">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    View All Parlays
                  </Button>
                </Link>
                <Link href="/pricing?plan=parlay">
                  <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                    View Plans
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="max-w-4xl mx-auto px-4 py-12" id="faq">
          <div className="prose prose-invert max-w-none">
            <h2 className="text-3xl font-bold text-white mb-8 text-left">
              Frequently Asked Questions
            </h2>
            
            <div className="space-y-6">
              <div className="text-left">
                <h3 className="text-xl font-semibold text-white mb-2">
                  Is this parlay generator free?
                </h3>
                <p className="text-slate-300">
                  Yes! You can preview 2 high-quality parlays for free every day. To get unlimited access to all parlays, 
                  AI analysis, and premium features, upgrade to Parlay Pro for just $11.99/month (60% off regular price).
                </p>
              </div>

              <div className="text-left">
                <h3 className="text-xl font-semibold text-white mb-2">
                  How accurate are AI parlays?
                </h3>
                <p className="text-slate-300">
                  Our AI parlay generator uses advanced statistical modeling to calculate win probabilities and edge percentages. 
                  We only show tradable parlays that meet strict quality thresholds (minimum 5% edge and 5% probability). While no 
                  prediction is guaranteed, our AI analyzes match data, team statistics, odds movements, and historical performance 
                  to identify high-quality parlay combinations.
                </p>
              </div>

              <div className="text-left">
                <h3 className="text-xl font-semibold text-white mb-2">
                  What does "edge" mean in betting?
                </h3>
                <p className="text-slate-300">
                  Edge (or expected value) measures how much better a bet is compared to the bookmaker's odds. A positive edge means 
                  the bet has value—the true probability of winning is higher than what the odds suggest. Our AI parlay generator 
                  calculates edge percentages for each parlay, showing only those with positive expected value.
                </p>
              </div>

              <div className="text-left">
                <h3 className="text-xl font-semibold text-white mb-2">
                  Can I use this without placing bets?
                </h3>
                <p className="text-slate-300">
                  Yes! You can use our free parlay generator to preview parlays and see our AI analysis without placing any bets. 
                  The preview shows edge percentages, win probabilities, risk levels, and detailed leg information. You only need to 
                  subscribe if you want unlimited access to all parlays.
                </p>
              </div>

              <div className="text-left">
                <h3 className="text-xl font-semibold text-white mb-2">
                  What makes a good parlay?
                </h3>
                <p className="text-slate-300">
                  A good parlay has positive edge percentage (value), reasonable combined probability (5%+), quality filtering to avoid 
                  correlated legs, and risk assessment. Our AI parlay generator identifies these factors automatically, showing only 
                  tradable parlays that meet strict quality thresholds.
                </p>
              </div>

              <div className="text-left">
                <h3 className="text-xl font-semibold text-white mb-2">
                  How does the AI parlay generator work?
                </h3>
                <p className="text-slate-300">
                  Our AI parlay generator analyzes match data, team statistics, odds, and historical performance to create optimal parlay 
                  combinations. It filters for quality (tradable parlays only), calculates edge percentages to identify value bets, avoids 
                  correlated legs, and prioritizes parlays with the highest realistic win probability.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
