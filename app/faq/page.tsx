'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { 
  Search, 
  HelpCircle, 
  BookOpen,
  Target,
  Shield,
  CreditCard,
  TrendingUp,
  Users,
  Zap,
  Globe
} from 'lucide-react'
import Link from 'next/link'
import { FAQSchema } from '@/components/schema-markup'

const faqs = [
  {
    category: 'AI Predictions',
    icon: Target,
    questions: [
      {
        question: 'How do AI predictions work?',
        answer: 'Our AI system analyzes thousands of data points including historical performance, current form, head-to-head records, injuries, weather conditions, and market odds. The algorithm uses machine learning to identify patterns and calculate confidence scores for each prediction. We provide predictions with confidence scores ranging from 0-100% to help you make informed decisions.'
      },
      {
        question: 'What is a confidence score?',
        answer: 'A confidence score is a percentage (0-100%) that indicates how certain our AI is about a particular prediction. Scores of 90-100% indicate very high confidence with strong historical support. Scores of 75-89% show high confidence with clear indicators. Scores of 60-74% represent medium confidence with some uncertainty. Scores below 60% indicate higher risk but potentially higher reward.'
      },
      {
        question: 'How accurate are your predictions?',
        answer: 'Our AI-powered predictions have shown consistent accuracy across different sports and markets. However, sports betting always involves risk, and we recommend responsible gambling. We provide confidence scores to help you assess risk levels and make informed decisions. Past performance doesn\'t guarantee future results.'
      },
      {
        question: 'What sports do you cover?',
        answer: 'We currently focus on football (soccer) predictions with plans to expand to basketball, tennis, and other major sports. Our AI system is designed to adapt to different sports and can be trained on new data as we expand our coverage.'
      },
      {
        question: 'What is value betting?',
        answer: 'Value betting occurs when our AI calculates a higher probability for an outcome than what the bookmaker odds suggest. Our system identifies these value opportunities by comparing our predictions with market odds, helping you find bets with positive expected value.'
      }
    ]
  },
  {
    category: 'Packages & Purchases',
    icon: CreditCard,
    questions: [
      {
        question: 'What package types do you offer?',
        answer: 'We offer four main package types: Daily Package (5 tips, 24-hour validity), Weekly Package (15 tips, 7-day validity), Monthly Package (50 tips, 30-day validity), and Unlimited Package (unlimited tips, 30-day validity). Each package provides access to our AI-powered predictions with different tip counts and validity periods.'
      },
      {
        question: 'How do I claim tips from my package?',
        answer: 'Once you purchase a package, you can claim individual tips by clicking the "Claim Tip" button on any prediction. Credits are deducted automatically from your package, and you\'ll receive immediate access to the prediction details. You can track your remaining tips in your dashboard.'
      },
      {
        question: 'Do package prices vary by country?',
        answer: 'Yes, we offer country-specific pricing to ensure fair pricing for users worldwide. Our system automatically detects your location and adjusts prices accordingly. We support multiple currencies and local payment methods including M-Pesa for Kenyan users.'
      },
      {
        question: 'Can I purchase individual tips?',
        answer: 'Yes, you can purchase individual tips without buying a full package. Each tip can be purchased separately, and you\'ll receive a detailed receipt with match information, prediction details, and payment confirmation.'
      },
      {
        question: 'What happens when my package expires?',
        answer: 'When your package expires, you\'ll lose access to any remaining tips. We recommend using all your tips before expiration. You can purchase a new package at any time to continue accessing our predictions.'
      }
    ]
  },
  {
    category: 'Quiz & Credits',
    icon: BookOpen,
    questions: [
      {
        question: 'How does the quiz section work?',
        answer: 'Our interactive quiz section tests your sports knowledge and helps you understand betting concepts. You can earn credits by answering questions correctly - typically 50 points per correct answer. These credits can be converted to claim tips from our AI predictions.'
      },
      {
        question: 'How do I earn more credits?',
        answer: 'You can earn credits by participating in our quiz section, purchasing credit packages, or through our referral program. Quiz participation typically awards 50 points per correct answer, which can be converted to credits for claiming tips.'
      },
      {
        question: 'What can I do with my credits?',
        answer: 'Credits can be used to claim individual tips from our AI predictions. Each tip requires a certain number of credits depending on the prediction type and confidence level. Credits never expire and can be used at any time.'
      },
      {
        question: 'Is the quiz free to participate?',
        answer: 'Yes, the quiz section is completely free to participate. You can take quizzes as often as you like to earn credits and improve your sports knowledge. No payment is required to access the quiz features.'
      }
    ]
  },
  {
    category: 'Account & Credits',
    icon: Users,
    questions: [
      {
        question: 'How do I claim tips with credits?',
        answer: 'You can claim tips using credits earned from quiz participation, package purchases, or direct credit purchases. Simply click the "Claim Tip" button on any prediction and confirm your purchase. Credits are deducted automatically, and you\'ll receive immediate access to the prediction details.'
      },
      {
        question: 'Can I cancel my subscription?',
        answer: 'Yes, you can cancel your subscription at any time from your account settings. You\'ll continue to have access to your purchased content until the end of your current billing period. No questions asked.'
      },
      {
        question: 'How do I update my account information?',
        answer: 'You can update your account information, including email, password, and profile details, from your dashboard settings page. All changes are applied immediately and securely stored.'
      },
      {
        question: 'How do I track my betting performance?',
        answer: 'Your dashboard provides comprehensive tracking of your claimed tips, win/loss records, and performance metrics. You can view your history, track your success rate, and analyze your betting patterns over time.'
      }
    ]
  },
  {
    category: 'Payment & Security',
    icon: Shield,
    questions: [
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept major credit cards (Visa, Mastercard, American Express), Apple Pay, Google Pay, PayPal, and local payment methods including M-Pesa for Kenyan users. All payments are processed securely through Stripe, and we never store your payment information.'
      },
      {
        question: 'Is my data secure?',
        answer: 'Yes, we take data security seriously. We use industry-standard encryption (SSL/TLS) for all data transmission, secure cloud hosting, and follow GDPR compliance guidelines. Your personal information and payment details are never shared with third parties.'
      },
      {
        question: 'Do you offer refunds?',
        answer: 'We offer a 7-day money-back guarantee for new subscribers. For other refund requests, please contact our support team. We evaluate each request individually and aim to provide fair solutions for our users.'
      },
      {
        question: 'Are my betting activities tracked?',
        answer: 'We only track your prediction claims and quiz participation for account management purposes. We do not track your actual betting activities on external platforms. Your privacy is important to us.'
      },
      {
        question: 'How do you handle currency conversion?',
        answer: 'Our system automatically detects your location and displays prices in your local currency. We use real-time exchange rates for accurate pricing. All transactions are processed in your local currency for transparency.'
      }
    ]
  },
  {
    category: 'Global Support',
    icon: Globe,
    questions: [
      {
        question: 'Do you support users worldwide?',
        answer: 'Yes, we support users from around the world with localized pricing, multiple currencies, and country-specific payment methods. Our platform automatically adapts to your location to provide the best experience.'
      },
      {
        question: 'What currencies do you support?',
        answer: 'We support multiple currencies including USD, EUR, GBP, KES (Kenyan Shillings), NGN (Nigerian Naira), ZAR (South African Rand), and more. Prices are automatically converted based on your location.'
      },
      {
        question: 'Are there country-specific features?',
        answer: 'Yes, we offer country-specific features including local payment methods (like M-Pesa for Kenya), localized pricing, and region-specific content. Our system automatically detects your location and provides relevant features.'
      },
      {
        question: 'Do you offer customer support in multiple languages?',
        answer: 'Currently, we provide support in English, with plans to expand to other languages. Our platform interface supports multiple languages, and we\'re working on expanding our support team to cover more languages.'
      }
    ]
  },
  {
    category: 'Betting Strategy',
    icon: TrendingUp,
    questions: [
      {
        question: 'How should I use AI predictions?',
        answer: 'Use our AI predictions as a tool to inform your betting decisions, not as guaranteed outcomes. Start with high-confidence predictions (75%+), practice proper bankroll management, and never bet more than you can afford to lose. Combine AI insights with your own research for best results.'
      },
      {
        question: 'How do I manage my bankroll?',
        answer: 'We recommend betting 1-5% of your total bankroll per bet, setting daily/weekly loss limits, and having clear win goals. Never chase losses with emotional decisions, and always bet with money you can afford to lose.'
      },
      {
        question: 'Should I use accumulators?',
        answer: 'Accumulators can multiply your winnings but also increase risk. We recommend keeping accumulators to 2-4 selections, using only high-confidence predictions, and never exceeding 5% of your bankroll on accumulators.'
      },
      {
        question: 'What is the best betting strategy?',
        answer: 'The best strategy combines our AI predictions with proper bankroll management. Focus on high-confidence predictions, bet consistently small amounts, and maintain discipline. Remember that no betting strategy guarantees profits.'
      }
    ]
  },
  {
    category: 'Technical Support',
    icon: HelpCircle,
    questions: [
      {
        question: 'The website is not loading properly',
        answer: 'Try refreshing the page, clearing your browser cache, or using a different browser. If the issue persists, check your internet connection and try accessing the site from a different device. Contact support if problems continue.'
      },
      {
        question: 'I can\'t log into my account',
        answer: 'First, ensure you\'re using the correct email and password. If you\'ve forgotten your password, use the "Forgot Password" link on the login page. Check that your email is verified, and contact support if you continue having issues.'
      },
      {
        question: 'Predictions are not updating',
        answer: 'Our predictions are updated regularly throughout the day. If you\'re not seeing updates, try refreshing the page or logging out and back in. Predictions are based on available data and may not be available for all matches.'
      },
      {
        question: 'How do I contact support?',
        answer: 'You can contact our support team through the contact form on our website, via email at support@snapbet.ai, or through the support section in your dashboard. We typically respond within 24 hours.'
      },
      {
        question: 'Are there mobile apps available?',
        answer: 'Currently, our platform is optimized for mobile browsers and provides a responsive design that works great on all devices. We\'re working on native mobile apps for iOS and Android, which will be available soon.'
      }
    ]
  }
]

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // Filter FAQs based on search query
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) {
      return faqs
    }

    const query = searchQuery.toLowerCase()
    return faqs.map(category => {
      const filteredQuestions = category.questions.filter(faq => 
        faq.question.toLowerCase().includes(query) || 
        faq.answer.toLowerCase().includes(query)
      )
      
      if (filteredQuestions.length === 0) {
        return null
      }

      return {
        ...category,
        questions: filteredQuestions
      }
    }).filter((category): category is NonNullable<typeof category> => category !== null)
  }, [searchQuery])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Schema Markup */}
      <FAQSchema faqs={faqs.flatMap(category => category.questions)} />
      
      {/* Breadcrumb Navigation */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <HelpCircle className="w-12 h-12 text-emerald-400 mr-3" />
            <h1 className="text-4xl md:text-5xl font-bold text-white">FAQ</h1>
          </div>
          <p className="text-xl text-slate-300 mb-8">
            Find answers to the most common questions about SnapBet AI
          </p>
          
          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
            />
          </div>
        </div>
      </div>

      {/* FAQ Categories */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {filteredFaqs.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No results found</h3>
            <p className="text-slate-400 mb-4">
              Try searching with different keywords or browse all categories below.
            </p>
            <Button 
              variant="outline" 
              onClick={() => setSearchQuery('')}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Clear Search
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredFaqs.map((category, categoryIndex) => {
              const IconComponent = category.icon
              return (
                <Card key={categoryIndex} className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <IconComponent className="w-6 h-6 text-emerald-400" />
                      </div>
                      <CardTitle className="text-white text-2xl">{category.category}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {category.questions.map((faq, questionIndex) => (
                        <div key={questionIndex} className="border-b border-slate-700 last:border-b-0 pb-6 last:pb-0">
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
              )
            })}
          </div>
        )}
      </div>

      {/* Additional Help Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <BookOpen className="w-8 h-8 text-emerald-400" />
              <h2 className="text-2xl font-bold text-white">Still Need Help?</h2>
            </div>
            <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
              Can't find the answer you're looking for? Our support team is here to help you with any questions or issues.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dashboard/support">
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Contact Support
                </Button>
              </Link>
              <Link href="/blog">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Read Our Blog
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
            <CardContent className="p-6 text-center">
              <Target className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">AI Predictions</h3>
              <p className="text-slate-300 mb-4">Learn how our AI system works and how to use predictions effectively.</p>
              <Link href="/blog/how-ai-predictions-work">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  Learn More
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
            <CardContent className="p-6 text-center">
              <CreditCard className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Packages & Pricing</h3>
              <p className="text-slate-300 mb-4">Explore our flexible package options and country-specific pricing.</p>
              <Link href="/pricing">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  View Packages
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
            <CardContent className="p-6 text-center">
              <BookOpen className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Quiz & Credits</h3>
              <p className="text-slate-300 mb-4">Test your knowledge and earn credits to claim tips.</p>
              <Link href="/snapbet-quiz">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  Take Quiz
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Betting Strategy</h3>
              <p className="text-slate-300 mb-4">Master the art of sports betting with proven strategies and tips.</p>
              <Link href="/blog/top-betting-strategies-football">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  Read Guide
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
            <CardContent className="p-6 text-center">
              <Globe className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Global Support</h3>
              <p className="text-slate-300 mb-4">Learn about our worldwide support and localized features.</p>
              <Link href="/about">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  About Us
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
            <CardContent className="p-6 text-center">
              <Zap className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Get Started</h3>
              <p className="text-slate-300 mb-4">Ready to start winning? Join thousands of successful bettors.</p>
              <Link href="/signup">
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  Start Now
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 