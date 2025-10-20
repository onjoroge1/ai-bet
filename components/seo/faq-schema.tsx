"use client"

export interface FAQItem {
  question: string
  answer: string
}

interface FAQSchemaProps {
  faqs: FAQItem[]
  className?: string
}

/**
 * FAQ Schema component for structured data
 * Implements FAQPage schema for better search engine understanding
 */
export function FAQSchema({ faqs, className }: FAQSchemaProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
  }

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      {/* Visual FAQ */}
      <div className={className}>
        <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <div key={index} className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                {faq.question}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/**
 * Common FAQ data for sports betting
 */
export const commonFAQs: FAQItem[] = [
  {
    question: "How accurate are SnapBet AI's sports predictions?",
    answer: "Our AI-powered predictions achieve an average accuracy of 75-85% across major sports leagues. We use advanced machine learning algorithms that analyze thousands of data points including team form, player statistics, head-to-head records, and market conditions to provide highly accurate predictions."
  },
  {
    question: "What sports does SnapBet AI cover?",
    answer: "We cover all major sports including football (soccer), basketball, tennis, American football, baseball, hockey, and more. Our AI continuously learns and adapts to provide predictions for both popular and niche sports leagues worldwide."
  },
  {
    question: "How does the AI prediction system work?",
    answer: "Our AI system analyzes historical data, current team form, player statistics, weather conditions, injury reports, and market sentiment. It uses machine learning models trained on millions of past matches to identify patterns and predict outcomes with high confidence scores."
  },
  {
    question: "Can I trust SnapBet AI for betting decisions?",
    answer: "While our predictions are highly accurate, we always recommend responsible betting. Our tips are based on data analysis and AI algorithms, but sports outcomes can be unpredictable. Only bet what you can afford to lose and use our predictions as guidance, not guarantees."
  },
  {
    question: "How often are predictions updated?",
    answer: "Predictions are updated in real-time as new data becomes available. We provide daily tips, live match predictions, and pre-match analysis. Our system continuously monitors team news, injuries, and other factors that could affect outcomes."
  },
  {
    question: "What is the difference between free and premium predictions?",
    answer: "Free predictions provide basic analysis and confidence scores. Premium predictions include detailed AI analysis, multiple betting markets, higher confidence scores, and exclusive insights from our advanced algorithms. Premium users also get priority support and early access to new features."
  },
  {
    question: "How do I get started with SnapBet AI?",
    answer: "Simply sign up for a free account to access basic predictions. For premium features, choose a subscription plan that suits your needs. You can start with our free daily tips to see the quality of our predictions before upgrading to premium."
  },
  {
    question: "Is my personal data safe with SnapBet AI?",
    answer: "Yes, we take data security seriously. All personal information is encrypted and stored securely. We never share your data with third parties and comply with all relevant data protection regulations including GDPR."
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer: "Yes, you can cancel your subscription at any time from your account settings. Your access to premium features will continue until the end of your current billing period. No cancellation fees apply."
  },
  {
    question: "Do you offer refunds?",
    answer: "We offer a 30-day money-back guarantee for new subscribers. If you're not satisfied with our predictions within the first 30 days, contact our support team for a full refund. This guarantee applies to your first subscription only."
  }
]
