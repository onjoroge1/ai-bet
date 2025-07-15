import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ - Frequently Asked Questions | SnapBet AI',
  description: 'Find answers to common questions about AI sports predictions, betting tips, payment methods, and how SnapBet AI works. Get help with your account and predictions.',
  keywords: ['FAQ', 'frequently asked questions', 'AI predictions help', 'betting tips FAQ', 'sports predictions support'],
  openGraph: {
    title: 'FAQ - Frequently Asked Questions | SnapBet AI',
    description: 'Find answers to common questions about AI sports predictions and betting tips.',
    type: 'website',
    url: 'https://snapbet.ai/faq',
  },
}

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 