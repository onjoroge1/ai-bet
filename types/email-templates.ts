// Email Template System Types

// Core Template Types
export interface EmailTemplate {
  id: string
  name: string
  slug: string
  subject: string
  htmlContent: string
  textContent?: string
  category: EmailTemplateCategory
  isActive: boolean
  version: number
  variables?: EmailVariable[]
  createdAt: Date
  updatedAt: Date
  createdBy: string
  description?: string
}

export interface EmailTemplateVersion {
  id: string
  templateId: string
  version: number
  htmlContent: string
  textContent?: string
  subject: string
  variables?: EmailVariable[]
  createdAt: Date
  createdBy: string
}

export interface EmailLog {
  id: string
  templateId: string
  recipient: string
  subject: string
  status: EmailStatus
  sentAt: Date
  errorMessage?: string
  metadata?: Record<string, any>
}

// Template Categories
export type EmailTemplateCategory = 
  | 'payment' 
  | 'security' 
  | 'marketing' 
  | 'system'

// Email Status
export type EmailStatus = 'sent' | 'failed' | 'pending'

// Variable System
export interface EmailVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object'
  description: string
  required: boolean
  defaultValue?: any
  validation?: ValidationRule[]
  category?: string
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'email' | 'url'
  value?: any
  message?: string
}

// Template Creation/Update
export interface CreateTemplateData {
  name: string
  slug: string
  subject: string
  htmlContent: string
  textContent?: string
  category: EmailTemplateCategory
  variables?: EmailVariable[]
  description?: string
  createdBy: string
}

export interface UpdateTemplateData {
  name?: string
  slug?: string
  subject?: string
  htmlContent?: string
  textContent?: string
  category?: EmailTemplateCategory
  variables?: EmailVariable[]
  description?: string
  isActive?: boolean
}

// Template Filters
export interface TemplateFilters {
  category?: EmailTemplateCategory
  isActive?: boolean
  search?: string
  createdBy?: string
}

// Template Rendering
export interface RenderedEmail {
  subject: string
  html: string
  text?: string
  variables: Record<string, any>
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

// Variable Categories
export interface VariableCategory {
  name: string
  description: string
  variables: EmailVariable[]
}

// Sample Data for Preview
export interface SampleData {
  [key: string]: any
}

// Email Template Categories with Icons and Descriptions
export const EMAIL_TEMPLATE_CATEGORIES = {
  payment: {
    name: 'Payment',
    icon: '💳',
    description: 'Payment-related email templates',
    color: 'text-green-600'
  },
  security: {
    name: 'Security',
    icon: '🔒',
    description: 'Security and authentication emails',
    color: 'text-red-600'
  },
  marketing: {
    name: 'Marketing',
    icon: '📢',
    description: 'Marketing and promotional emails',
    color: 'text-blue-600'
  },
  system: {
    name: 'System',
    icon: '⚙️',
    description: 'System and administrative emails',
    color: 'text-gray-600'
  }
} as const

// Predefined Email Variables by Category
export const EMAIL_VARIABLES: Record<EmailTemplateCategory, EmailVariable[]> = {
  payment: [
    {
      name: 'userName',
      type: 'string',
      description: 'User\'s display name',
      required: true,
      defaultValue: 'John Doe'
    },
    {
      name: 'userEmail',
      type: 'string',
      description: 'User\'s email address',
      required: true,
      defaultValue: 'john@example.com'
    },
    {
      name: 'amount',
      type: 'number',
      description: 'Payment amount',
      required: true,
      defaultValue: 29.99
    },
    {
      name: 'currency',
      type: 'string',
      description: 'Currency code (USD, EUR, etc.)',
      required: true,
      defaultValue: 'USD'
    },
    {
      name: 'currencySymbol',
      type: 'string',
      description: 'Currency symbol ($, €, etc.)',
      required: true,
      defaultValue: '$'
    },
    {
      name: 'transactionId',
      type: 'string',
      description: 'Payment transaction ID',
      required: true,
      defaultValue: 'txn_123456789'
    },
    {
      name: 'packageName',
      type: 'string',
      description: 'Package or product name',
      required: true,
      defaultValue: 'Weekly Premium Package'
    },
    {
      name: 'tipsCount',
      type: 'number',
      description: 'Number of tips included',
      required: false,
      defaultValue: 15
    }
  ],
  security: [
    {
      name: 'userName',
      type: 'string',
      description: 'User\'s display name',
      required: true,
      defaultValue: 'John Doe'
    },
    {
      name: 'userEmail',
      type: 'string',
      description: 'User\'s email address',
      required: true,
      defaultValue: 'john@example.com'
    },
    {
      name: 'resetToken',
      type: 'string',
      description: 'Password reset token',
      required: false,
      defaultValue: 'reset_token_123456'
    },
    {
      name: 'verificationToken',
      type: 'string',
      description: 'Email verification token',
      required: false,
      defaultValue: 'verify_token_123456'
    },
    {
      name: 'deviceInfo',
      type: 'object',
      description: 'Device information for security alerts',
      required: false,
      defaultValue: {
        browser: 'Chrome',
        os: 'Windows',
        ip: '192.168.1.1',
        location: 'New York, US'
      }
    }
  ],
  marketing: [
    {
      name: 'userName',
      type: 'string',
      description: 'User\'s display name',
      required: true,
      defaultValue: 'John Doe'
    },
    {
      name: 'userEmail',
      type: 'string',
      description: 'User\'s email address',
      required: true,
      defaultValue: 'john@example.com'
    },
    {
      name: 'predictionCount',
      type: 'number',
      description: 'Number of new predictions',
      required: false,
      defaultValue: 5
    },
    {
      name: 'confidenceScore',
      type: 'number',
      description: 'Prediction confidence score',
      required: false,
      defaultValue: 85
    },
    {
      name: 'matchDetails',
      type: 'string',
      description: 'Match details for predictions',
      required: false,
      defaultValue: 'Manchester United vs Liverpool'
    },
    {
      name: 'achievementName',
      type: 'string',
      description: 'Achievement name',
      required: false,
      defaultValue: 'First Win'
    },
    {
      name: 'pointsEarned',
      type: 'number',
      description: 'Points earned from achievement',
      required: false,
      defaultValue: 100
    }
  ],
  system: [
    {
      name: 'userName',
      type: 'string',
      description: 'User\'s display name',
      required: true,
      defaultValue: 'John Doe'
    },
    {
      name: 'userEmail',
      type: 'string',
      description: 'User\'s email address',
      required: true,
      defaultValue: 'john@example.com'
    },
    {
      name: 'appUrl',
      type: 'string',
      description: 'Application URL',
      required: true,
      defaultValue: 'https://snapbet.ai'
    },
    {
      name: 'supportEmail',
      type: 'string',
      description: 'Support email address',
      required: true,
      defaultValue: 'support@snapbet.ai'
    },
    {
      name: 'currentDate',
      type: 'date',
      description: 'Current date',
      required: true,
      defaultValue: new Date().toISOString()
    },
    {
      name: 'maintenanceDuration',
      type: 'string',
      description: 'Maintenance duration',
      required: false,
      defaultValue: '2 hours'
    }
  ]
}

// Default Email Templates
export const DEFAULT_EMAIL_TEMPLATES: CreateTemplateData[] = [
  {
    name: 'Payment Successful',
    slug: 'payment-successful',
    subject: 'Payment Confirmed - {{packageName}}',
    category: 'payment',
    description: 'Sent when payment is processed successfully',
    htmlContent: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>SnapBet Premium Confirmation</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #0c0f1a;
            color: #ffffff;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #131a26;
            border-radius: 10px;
            overflow: hidden;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #101520;
            padding: 20px;
          }
          .header .logo {
            font-size: 24px;
            font-weight: bold;
            color: #00ff88;
          }
          .header nav a {
            margin-left: 20px;
            color: #ffffff;
            text-decoration: none;
            font-size: 14px;
            border: 1px solid #ffffff44;
            padding: 5px 10px;
            border-radius: 5px;
          }
          .banner {
            background-color: #0a3d62;
            text-align: center;
            padding: 10px;
            font-weight: bold;
            color: #00ff88;
            font-size: 16px;
          }
          .main {
            padding: 20px;
            text-align: center;
          }
          .main h1 {
            color: #00ff88;
            font-size: 24px;
            margin-bottom: 10px;
          }
          .main p {
            font-size: 16px;
            line-height: 1.5;
          }
          .payment-summary {
            margin: 20px auto;
            border-collapse: collapse;
            width: 80%;
          }
          .payment-summary th, .payment-summary td {
            border: 1px solid #333;
            padding: 12px;
            text-align: center;
          }
          .payment-summary th {
            background-color: #0c0f1a;
          }
          .payment-summary td {
            background-color: #1b1f30;
          }
          .cta-btn {
            display: inline-block;
            background: #0057ff;
            color: #ffffff;
            padding: 15px 25px;
            margin: 20px 0;
            text-decoration: none;
            font-weight: bold;
            border-radius: 30px;
            font-size: 16px;
          }
          .footer {
            background: #101520;
            text-align: center;
            padding: 15px;
            font-size: 12px;
            color: #888;
          }
          .social-icons img {
            width: 24px;
            margin: 0 8px;
          }
          h3 {
            color: #00aaff;
          }
          .highlight {
            color: #00ff88;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏆 SnapBet</div>
            <nav>
              <a href="https://www.snapbet.bet/dashboard/matches">Predictions</a>
              <a href="https://www.snapbet.bet/signin">Sign In</a>
            </nav>
          </div>

          <div class="banner">WELCOME TO THE BIG LEAGUE! 🏆</div>

          <div class="main">
            <h1>💥 PAYMENT CONFIRMED – YOU'RE IN!</h1>
            <p>Hey {{userName}},</p>
            <p>You've officially unlocked <span class="highlight">{{packageName}}</span> on SnapBet! Your game just leveled up—betting strategies and insider insights are now at your fingertips.</p>

            <h3>PAYMENT SUMMARY</h3>
            <table class="payment-summary">
              <tr>
                <th>Amount</th>
                <th>Plan</th>
                <th>Transaction</th>
              </tr>
              <tr>
                <td>{{currencySymbol}}{{amount}}</td>
                <td>{{packageName}}</td>
                <td>{{transactionId}}</td>
              </tr>
            </table>

            <a class="cta-btn" href="https://www.snapbet.bet/dashboard">🔥 ACCESS DASHBOARD</a>

            <p>Ready to smash your bets? Start browsing exclusive predictions and let the wins roll in! ⚽🏀🏈</p>

            <h3>🎯 STAY IN THE GAME</h3>
            <p>Follow us for hot picks, betting tips, and live updates:</p>
            <div class="social-icons">
              <a href="#"><img src="https://img.icons8.com/ios-filled/50/ffffff/twitter--v1.png"/></a>
              <a href="#"><img src="https://img.icons8.com/ios-filled/50/ffffff/facebook--v1.png"/></a>
              <a href="#"><img src="https://img.icons8.com/ios-filled/50/ffffff/instagram-new.png"/></a>
            </div>
          </div>

          <div class="footer">
            © 2025 SnapBet. All rights reserved.<br/>
            123 Betting Lane, Wager City, WC 54321<br/>
            <a href="#" style="color: #00ff88;">Unsubscribe</a>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: `
      PAYMENT CONFIRMED – YOU’RE IN!

      Hey {{userName}},

      You’ve officially unlocked {{packageName}} on SnapBet! Your game just leveled up—betting strategies and insider insights are now at your fingertips.

      PAYMENT SUMMARY
      Amount: {{currencySymbol}}{{amount}}
      Plan: {{packageName}}
      Transaction: {{transactionId}}

      Access your dashboard: https://www.snapbet.bet/dashboard

      Ready to smash your bets? Start browsing exclusive predictions and let the wins roll in!

      STAY IN THE GAME
      Follow us for hot picks, betting tips, and live updates:
      Twitter | Facebook | Instagram

      © 2025 SnapBet. All rights reserved.
      123 Betting Lane, Wager City, WC 54321
      Unsubscribe
    `,
    variables: EMAIL_VARIABLES.payment,
    createdBy: 'system'
  },
  {
    name: 'Welcome Email',
    slug: 'welcome-email',
    subject: 'Welcome to SnapBet, {{userName}}! 🎉',
    category: 'marketing',
    description: 'Sent to new users after sign-up',
    htmlContent: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Welcome to SnapBet</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #0c0f1a;
            color: #ffffff;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #131a26;
            border-radius: 10px;
            overflow: hidden;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #101520;
            padding: 20px;
          }
          .header .logo {
            font-size: 24px;
            font-weight: bold;
            color: #00ff88;
          }
          .header nav a {
            margin-left: 20px;
            color: #ffffff;
            text-decoration: none;
            font-size: 14px;
            border: 1px solid #ffffff44;
            padding: 5px 10px;
            border-radius: 5px;
          }
          .banner {
            background-color: #0a3d62;
            text-align: center;
            padding: 10px;
            font-weight: bold;
            color: #00ff88;
            font-size: 16px;
          }
          .main {
            padding: 20px;
            text-align: center;
          }
          .main h1 {
            color: #00ff88;
            font-size: 24px;
            margin-bottom: 10px;
          }
          .main p {
            font-size: 16px;
            line-height: 1.5;
          }
          .cta-btn {
            display: inline-block;
            background: #0057ff;
            color: #ffffff;
            padding: 15px 25px;
            margin: 20px 0;
            text-decoration: none;
            font-weight: bold;
            border-radius: 30px;
            font-size: 16px;
          }
          .footer {
            background: #101520;
            text-align: center;
            padding: 15px;
            font-size: 12px;
            color: #888;
          }
          .social-icons img {
            width: 24px;
            margin: 0 8px;
          }
          h3 {
            color: #00aaff;
          }
          .highlight {
            color: #00ff88;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏆 SnapBet</div>
            <nav>
              <a href="{{appUrl}}/dashboard/matches">Predictions</a>
              <a href="{{appUrl}}/signin">Sign In</a>
            </nav>
          </div>

          <div class="banner">WELCOME TO SNAPBET! 🎉</div>

          <div class="main">
            <h1>Welcome, {{userName}}!</h1>
            <p>We’re thrilled to have you join the SnapBet community. You’re now part of a winning team that combines AI-powered insights, expert analysis, and a passion for sports betting.</p>

            <h3>GETTING STARTED</h3>
            <ul style="color: #6b7280; line-height: 1.8; text-align: left; display: inline-block; margin: 0 auto;">
              <li>Explore daily free tips and premium packages</li>
              <li>Take our quiz to earn credits</li>
              <li>Join community discussions and leaderboards</li>
              <li>Track your progress and claim achievements</li>
            </ul>

            <a class="cta-btn" href="{{appUrl}}/dashboard">🚀 GO TO DASHBOARD</a>

            <p>Have questions or need help? Our support team is always here for you: <a href="mailto:{{supportEmail}}" style="color: #00ff88;">{{supportEmail}}</a></p>

            <h3>🎯 STAY CONNECTED</h3>
            <p>Follow us for the latest tips, updates, and exclusive offers:</p>
            <div class="social-icons">
              <a href="#"><img src="https://img.icons8.com/ios-filled/50/ffffff/twitter--v1.png"/></a>
              <a href="#"><img src="https://img.icons8.com/ios-filled/50/ffffff/facebook--v1.png"/></a>
              <a href="#"><img src="https://img.icons8.com/ios-filled/50/ffffff/instagram-new.png"/></a>
            </div>
          </div>

          <div class="footer">
            © 2025 SnapBet. All rights reserved.<br/>
            123 Betting Lane, Wager City, WC 54321<br/>
            <a href="#" style="color: #00ff88;">Unsubscribe</a>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: `
      Welcome, {{userName}}!

      We’re thrilled to have you join the SnapBet community. You’re now part of a winning team that combines AI-powered insights, expert analysis, and a passion for sports betting.

      GETTING STARTED
      - Explore daily free tips and premium packages
      - Take our quiz to earn credits
      - Join community discussions and leaderboards
      - Track your progress and claim achievements

      Go to your dashboard: {{appUrl}}/dashboard

      Have questions or need help? Contact us at {{supportEmail}}

      STAY CONNECTED
      Follow us for the latest tips, updates, and exclusive offers:
      Twitter | Facebook | Instagram

      © 2025 SnapBet. All rights reserved.
      123 Betting Lane, Wager City, WC 54321
      Unsubscribe
    `,
    variables: EMAIL_VARIABLES.marketing,
    createdBy: 'system'
  }
]

// API Response Types
export interface EmailTemplateResponse {
  success: boolean
  data?: EmailTemplate
  error?: string
}

export interface EmailTemplateListResponse {
  success: boolean
  data?: EmailTemplate[]
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface EmailLogResponse {
  success: boolean
  data?: EmailLog[]
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
} 