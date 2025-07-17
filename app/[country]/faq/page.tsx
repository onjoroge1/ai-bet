import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCountryByCode, getPrimarySupportedCountries } from '@/lib/countries'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { FAQSchema } from '@/components/schema-markup'
import { 
  Search, 
  HelpCircle, 
  MapPin,
  MessageCircle,
  Mail,
  Phone,
  Globe
} from 'lucide-react'
import Link from 'next/link'

interface FAQCategory {
  id: string
  title: string
  description: string
  questions: FAQItem[]
}

interface FAQItem {
  question: string
  answer: string
}

interface CountryFAQPageProps {
  params: {
    country: string
  }
}

export async function generateMetadata({ params }: CountryFAQPageProps): Promise<Metadata> {
  const { country } = await params
  const countryCode = country.toUpperCase()
  const countryData = getCountryByCode(countryCode)
  
  if (!countryData || !countryData.isSupported) {
    return {
      title: 'Country Not Found | SnapBet AI',
      description: 'This country is not currently supported by SnapBet AI.'
    }
  }

  return {
    title: `FAQ - Frequently Asked Questions for ${countryData.name} | SnapBet AI`,
    description: `Find answers to common questions about AI sports predictions, betting tips, payment methods, and how SnapBet AI works in ${countryData.name}. Get help with your account and predictions.`,
    keywords: [
      'FAQ', 'frequently asked questions', 'sports betting help', 'AI predictions help',
      'betting tips support', 'payment methods', 'account help',
      countryData.name.toLowerCase(), `${countryData.name} sports betting`, `${countryData.name} predictions`,
      'customer support', 'help center'
    ],
    openGraph: {
      title: `FAQ - Frequently Asked Questions for ${countryData.name} | SnapBet AI`,
      description: `Find answers to common questions about AI sports predictions, betting tips, payment methods, and how SnapBet AI works in ${countryData.name}.`,
      locale: countryData.locale || 'en_US',
      images: [
        {
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: `SnapBet AI FAQ - Help for ${countryData.name}`
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: `FAQ - Frequently Asked Questions for ${countryData.name} | SnapBet AI`,
      description: `Find answers to common questions about AI sports predictions, betting tips, payment methods, and how SnapBet AI works in ${countryData.name}.`,
      images: ['/og-image.jpg']
    },
    alternates: {
      canonical: `https://snapbet.bet/${countryCode.toLowerCase()}/faq`
    }
  }
}

export async function generateStaticParams() {
  const supportedCountries = getPrimarySupportedCountries()
  
  return supportedCountries.map((country) => ({
    country: country.code.toLowerCase(),
  }))
}

// FAQ data with country-specific content
const getFAQData = (countryCode: string): FAQCategory[] => {
  const country = getCountryByCode(countryCode)
  const currencySymbol = country?.currencySymbol || '$'
  const currencyCode = country?.currencyCode || 'USD'
  
  return [
    {
      id: 'ai-predictions',
      title: 'AI Predictions',
      description: 'How our AI-powered predictions work',
      questions: [
        {
          question: 'How accurate are SnapBet AI predictions?',
          answer: `Our AI predictions have shown consistent accuracy rates of 75-85% across different sports and markets. We use advanced machine learning algorithms that analyze thousands of data points including team form, head-to-head records, player statistics, and market trends to generate predictions with confidence scores.`
        },
        {
          question: 'What is a confidence score?',
          answer: 'A confidence score indicates how certain our AI is about a prediction, ranging from 1-10. Higher scores (8-10) indicate stronger confidence, while lower scores (1-3) suggest more uncertainty. We recommend focusing on predictions with confidence scores of 6 or higher for better success rates.'
        },
        {
          question: 'How often are predictions updated?',
          answer: 'Predictions are updated in real-time as new data becomes available. We typically refresh our predictions every 2-4 hours leading up to matches, with final updates 1-2 hours before kickoff to ensure the most current information is used.'
        }
      ]
    },
    {
      id: 'packages-purchases',
      title: 'Packages & Purchases',
      description: 'Understanding our pricing and packages',
      questions: [
        {
          question: `What are the current prices in ${country?.name}?`,
          answer: `Our pricing in ${country?.name} is optimized for local purchasing power. Single predictions start from ${currencySymbol}2-${currencySymbol}5, while package deals offer significant discounts. Weekend passes (5 predictions) cost around ${currencySymbol}15-${currencySymbol}25, and monthly subscriptions (30 predictions) are priced at ${currencySymbol}50-${currencySymbol}100 depending on your location.`
        },
        {
          question: 'How do I claim my purchased tips?',
          answer: 'After purchasing a package, you can claim your tips from your dashboard. Go to "My Predictions" and click "Claim New Tip" to access your purchased predictions. Tips are available immediately after purchase and remain valid for 30 days.'
        },
        {
          question: 'Can I get a refund if predictions are wrong?',
          answer: 'While we cannot guarantee 100% accuracy, we offer a satisfaction guarantee. If you\'re not satisfied with our service within the first 7 days, we provide a full refund. Additionally, we offer free tips periodically to help you evaluate our service before making a purchase.'
        }
      ]
    },
    {
      id: 'payment-security',
      title: 'Payment & Security',
      description: 'Secure payment methods and data protection',
      questions: [
        {
          question: `What payment methods are accepted in ${country?.name}?`,
          answer: `We accept multiple payment methods in ${country?.name} including credit/debit cards (Visa, Mastercard), mobile money (M-Pesa, Airtel Money, MTN Mobile Money), bank transfers, and digital wallets. All payments are processed securely through our trusted payment partners.`
        },
        {
          question: 'Is my payment information secure?',
          answer: 'Yes, we use industry-standard SSL encryption and PCI DSS compliance to protect your payment information. We never store your full credit card details on our servers. All transactions are processed through secure, certified payment gateways.'
        },
        {
          question: 'Can I use cryptocurrency for payments?',
          answer: 'Currently, we accept Bitcoin and Ethereum for international payments. However, for local payments in most countries, we recommend using traditional payment methods for faster processing and better support.'
        }
      ]
    },
    {
      id: 'global-support',
      title: 'Global Support',
      description: 'Worldwide support and localization',
      questions: [
        {
          question: `Is SnapBet AI available in ${country?.name}?`,
          answer: `Yes! SnapBet AI is fully available in ${country?.name} with localized pricing in ${currencyCode} (${currencySymbol}). We offer country-specific content, local payment methods, and customer support in your local language.`
        },
        {
          question: 'Do you offer support in local languages?',
          answer: `We provide customer support in English and are expanding to include local languages. For ${country?.name}, we're working on adding support in local languages. Currently, our support team can assist you in English and we're developing automated translations for common queries.`
        },
        {
          question: 'What are your customer support hours?',
          answer: 'Our customer support team is available 24/7 to assist you with any questions or issues. You can reach us through live chat, email, or phone support. Response times are typically under 2 hours for urgent matters.'
        }
      ]
    },
    {
      id: 'betting-strategy',
      title: 'Betting Strategy',
      description: 'How to use our predictions effectively',
      questions: [
        {
          question: 'How should I use AI predictions in my betting strategy?',
          answer: 'AI predictions should be used as part of a comprehensive betting strategy. We recommend: 1) Never betting more than you can afford to lose, 2) Using our predictions to inform your decisions rather than blindly following them, 3) Combining multiple predictions for accumulator bets, 4) Keeping detailed records of your betting performance.'
        },
        {
          question: 'What is the best way to manage my betting bankroll?',
          answer: 'Effective bankroll management is crucial. We recommend: 1) Never risking more than 1-2% of your total bankroll on a single bet, 2) Setting daily/weekly betting limits, 3) Using our confidence scores to adjust bet sizes (higher confidence = larger bets), 4) Taking breaks after losing streaks.'
        },
        {
          question: 'Should I follow all predictions or be selective?',
          answer: 'Be selective! Focus on predictions with confidence scores of 6 or higher, and consider factors like your own knowledge of the teams/leagues. We recommend starting with 2-3 predictions per day and gradually increasing as you become more comfortable with our system.'
        }
      ]
    },
    {
      id: 'technical-support',
      title: 'Technical Support',
      description: 'Website and app troubleshooting',
      questions: [
        {
          question: 'The website is loading slowly. What should I do?',
          answer: 'Try refreshing the page or clearing your browser cache. If the issue persists, check your internet connection or try accessing the site from a different device. You can also contact our support team for assistance.'
        },
        {
          question: 'I can\'t log into my account. Help!',
          answer: 'First, ensure you\'re using the correct email and password. If you\'ve forgotten your password, use the "Forgot Password" link to reset it. If you\'re still having issues, contact our support team with your email address and we\'ll help you regain access.'
        },
        {
          question: 'Are there mobile apps available?',
          answer: 'Yes! We have mobile apps for both iOS and Android devices. You can download them from the App Store or Google Play Store. Our mobile apps offer the same features as the website with optimized mobile experience and push notifications for new predictions.'
        }
      ]
    }
  ]
}

export default async function CountryFAQPage({ params }: CountryFAQPageProps) {
  const { country: countryParam } = await params
  const countryCode = countryParam.toUpperCase()
  const countryData = getCountryByCode(countryCode)
  
  if (!countryData || !countryData.isSupported) {
    logger.warn('Invalid country FAQ access attempt', {
      tags: ['country-faq', 'invalid-country'],
      data: { countryCode, requestedCountry: countryParam }
    })
    notFound()
  }

  const faqData = getFAQData(countryCode)

  logger.info('Country FAQ page accessed', {
    tags: ['country-faq', 'access'],
    data: { 
      countryCode, 
      countryName: countryData.name,
      categoryCount: faqData.length
    }
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Schema Markup */}
      <FAQSchema faqs={faqData.flatMap(category => category.questions)} />
      
      {/* Breadcrumb Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <HelpCircle className="w-12 h-12 text-emerald-400" />
            <MapPin className="w-6 h-6 text-emerald-400" />
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              {countryData.flagEmoji} {countryData.name}
            </Badge>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            FAQ - {countryData.name}
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
            Find answers to common questions about AI sports predictions, betting tips, and how SnapBet AI works in {countryData.name}. Get help with your account, payments, and predictions.
          </p>
          
          {/* Search */}
          <div className="max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="Search FAQ..."
                className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
              />
            </div>
          </div>
        </div>

        {/* FAQ Categories */}
        <div className="space-y-8">
          {faqData.map((category) => (
            <Card key={category.id} className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-3">
                  <HelpCircle className="w-6 h-6 text-emerald-400" />
                  {category.title}
                </CardTitle>
                <p className="text-slate-400">{category.description}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {category.questions.map((faq, index) => (
                    <div key={index} className="border-b border-slate-700 pb-6 last:border-b-0">
                      <h3 className="text-lg font-semibold text-white mb-3">
                        {faq.question}
                      </h3>
                      <p className="text-slate-300 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Help */}
        <div className="mt-16">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-center">
                Still Need Help?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div className="flex flex-col items-center gap-3">
                  <MessageCircle className="w-8 h-8 text-emerald-400" />
                  <h4 className="font-semibold text-white">Live Chat</h4>
                  <p className="text-slate-400 text-sm">Get instant help from our support team</p>
                  <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                    Start Chat
                  </Button>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <Mail className="w-8 h-8 text-emerald-400" />
                  <h4 className="font-semibold text-white">Email Support</h4>
                  <p className="text-slate-400 text-sm">Send us a detailed message</p>
                  <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                    Send Email
                  </Button>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <Phone className="w-8 h-8 text-emerald-400" />
                  <h4 className="font-semibold text-white">Phone Support</h4>
                  <p className="text-slate-400 text-sm">Call us for urgent assistance</p>
                  <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                    Call Now
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="mt-12 text-center">
          <h3 className="text-xl font-semibold text-white mb-6">Quick Links</h3>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href={`/${countryCode.toLowerCase()}`}>
              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                <Globe className="w-4 h-4 mr-2" />
                Homepage
              </Button>
            </Link>
            <Link href={`/${countryCode.toLowerCase()}/blog`}>
              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                Blog
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 