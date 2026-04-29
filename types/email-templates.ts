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
  | 'support'

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
  },
  support: {
    name: 'Support',
    icon: '🆘',
    description: 'Customer support and help emails',
    color: 'text-purple-600'
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
  ],
  support: [
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
      name: 'issueDescription',
      type: 'string',
      description: 'Description of the support issue',
      required: true,
      defaultValue: 'I need help with my account'
    },
    {
      name: 'screenshotUrl',
      type: 'string',
      description: 'URL of a screenshot for technical issues',
      required: false,
      defaultValue: ''
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
  },
  {
    name: 'Nightly Briefing',
    slug: 'nightly-briefing',
    subject: '🎯 Tomorrow\'s Edge — Your AI Briefing for {{briefingDate}}',
    category: 'marketing',
    description: 'Daily promo email at 19:00 UTC. Per-pick variables computed server-side from getSnapBetPicks(); LLM bullets via OpenAI gpt-4o-mini.',
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>SnapBet Nightly Briefing</title>
  <style>
    @media only screen and (max-width: 640px) {
      .container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
      .content-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .hero-title { font-size: 30px !important; line-height: 37px !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
      .mobile-card { margin-bottom: 12px !important; }
      .hide-mobile { display: none !important; }
      .pick-main { padding-left: 0 !important; padding-top: 14px !important; }
      .pick-stats { padding-top: 14px !important; }
      .cta-button { width: 100% !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:#03070d; font-family:Arial, Helvetica, sans-serif; color:#ffffff;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">Tomorrow's AI-powered betting briefing: top picks, CLV watch, confidence scores, and risk notes.</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#03070d; padding:28px 0;"><tr><td align="center" style="padding:0 12px;">
    <table class="container" width="680" cellpadding="0" cellspacing="0" border="0" style="width:680px; max-width:680px; background:#07111d; border:1px solid #17283a; border-radius:20px; overflow:hidden; box-shadow:0 24px 70px rgba(0,0,0,0.55);">

      <!-- Gradient accent -->
      <tr><td style="height:6px; background:#7CFC00; background:linear-gradient(90deg,#7CFC00 0%,#00D4FF 70%,#7CFC00 100%); font-size:0; line-height:0;">&nbsp;</td></tr>

      <!-- Header -->
      <tr><td class="content-padding" style="padding:28px 32px; background:#081722; background:linear-gradient(135deg,#0d231b 0%,#071321 55%,#062030 100%); border-bottom:1px solid #162638;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle">
            <table cellpadding="0" cellspacing="0" border="0"><tr>
              <td valign="middle" style="padding-right:14px;">
                <img src="https://www.snapbet.bet/uploads/image/snapbet_logo.png" alt="SnapBet" width="56" height="56" style="display:block; width:56px; height:56px; border:0; outline:none; text-decoration:none;" />
              </td>
              <td valign="middle">
                <div style="font-size:28px; line-height:32px; font-weight:900; color:#7CFC00; letter-spacing:-0.6px;">SnapBet</div>
                <div style="font-size:11px; line-height:16px; color:#d7dee8; text-transform:uppercase; letter-spacing:3px; padding-top:5px;">Tomorrow's Edge · {{briefingDate}}</div>
              </td>
            </tr></table>
          </td>
          <td align="right" valign="middle">
            <span style="display:inline-block; padding:10px 16px; border:1px solid #00D4FF; color:#5beeff; border-radius:999px; font-size:12px; line-height:12px; font-weight:900; text-transform:uppercase; letter-spacing:1.5px;">AI Briefing</span>
          </td>
        </tr></table>
      </td></tr>

      <!-- Hero -->
      <tr><td class="content-padding" style="padding:34px 32px 20px 32px; background:#07111d;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td class="mobile-stack" width="58%" valign="top">
            <div style="font-size:18px; line-height:24px; font-weight:700; color:#ffffff; margin-bottom:8px;">Hi {{firstName}},</div>
            <div class="hero-title" style="font-size:36px; line-height:43px; font-weight:900; color:#ffffff; letter-spacing:-1px;">Tomorrow's slate has<br /><span style="color:#7CFC00;">{{edgeCount}} AI-flagged</span> opportunities.</div>
            <div style="font-size:15px; line-height:24px; color:#b8c5d8; margin-top:13px;">{{briefingHeadline}}</div>
          </td>
          <td class="mobile-stack hide-mobile" width="42%" align="right" valign="middle">
            <div style="width:230px; height:150px; border-radius:22px; background:radial-gradient(circle at center,#0c3d32 0%,#082132 42%,#07111d 75%); border:1px solid rgba(0,212,255,0.18);">
              <div style="font-size:58px; line-height:150px; text-align:center; color:#7CFC00; text-shadow:0 0 22px rgba(124,252,0,0.55);">↗</div>
            </div>
          </td>
        </tr></table>
      </td></tr>

      <!-- Stats row -->
      <tr><td class="content-padding" style="padding:0 32px 22px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td class="mobile-stack mobile-card" width="33.33%" style="padding-right:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c1724; border:1px solid #26384b; border-radius:14px;"><tr><td style="padding:16px 18px;">
              <div style="font-size:12px; color:#c7d1de; font-weight:900; text-transform:uppercase; letter-spacing:1.4px;">Top Picks</div>
              <div style="font-size:32px; line-height:36px; color:#7CFC00; font-weight:900;">{{topPickCount}}</div>
            </td></tr></table>
          </td>
          <td class="mobile-stack mobile-card" width="33.33%" style="padding-left:4px; padding-right:4px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c1724; border:1px solid #26384b; border-radius:14px;"><tr><td style="padding:16px 18px;">
              <div style="font-size:12px; color:#c7d1de; font-weight:900; text-transform:uppercase; letter-spacing:1.4px;">Avg Confidence</div>
              <div style="font-size:32px; line-height:36px; color:#5beeff; font-weight:900;">{{avgConfidence}}%</div>
            </td></tr></table>
          </td>
          <td class="mobile-stack mobile-card" width="33.33%" style="padding-left:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c1724; border:1px solid #26384b; border-radius:14px;"><tr><td style="padding:16px 18px;">
              <div style="font-size:12px; color:#c7d1de; font-weight:900; text-transform:uppercase; letter-spacing:1.4px;">CLV Watch</div>
              <div style="font-size:32px; line-height:36px; color:#7CFC00; font-weight:900;">{{clvWatchCount}}</div>
            </td></tr></table>
          </td>
        </tr></table>
      </td></tr>

      <!-- AI Read -->
      <tr><td class="content-padding" style="padding:0 32px 22px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#061c1e; border:1px solid rgba(124,252,0,0.45); border-radius:16px;"><tr><td style="padding:22px;">
          <div style="font-size:13px; line-height:18px; font-weight:900; color:#7CFC00; text-transform:uppercase; letter-spacing:2px; margin-bottom:12px;">🧠 Tonight's AI Read</div>
          <div style="font-size:15px; line-height:25px; color:#e0e8f2;">{{briefingBulletsHtml}}</div>
        </td></tr></table>
      </td></tr>

      <!-- Top Picks header -->
      <tr><td class="content-padding" style="padding:0 32px 10px 32px;">
        <div style="font-size:18px; line-height:24px; color:#ffffff; font-weight:900; letter-spacing:2px; text-transform:uppercase;">⭐ Top Picks</div>
      </td></tr>

      <!-- Pick 1 -->
      <tr><td class="content-padding" style="padding:0 32px 10px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c1724; border:1px solid #243548; border-radius:15px;"><tr><td style="padding:18px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td class="mobile-stack" width="20%" valign="middle" style="border-right:1px solid #26384b; padding-right:16px;">
              <div style="font-size:13px; line-height:19px; color:#ffffff; font-weight:800;">{{pick1League}}</div>
              <div style="font-size:13px; line-height:19px; color:#a9b8ca;">{{pick1Kickoff}}</div>
            </td>
            <td class="mobile-stack pick-main" width="43%" valign="middle" style="padding-left:18px;">
              <div style="font-size:19px; line-height:24px; color:#ffffff; font-weight:900;">{{pick1Matchup}}</div>
              <div style="font-size:15px; line-height:22px; color:#7CFC00; font-weight:900;">AI Pick: {{pick1MarketPick}}</div>
              <div style="font-size:13px; line-height:19px; color:#c8d4e4; margin-top:4px;">{{pick1Reason}}</div>
            </td>
            <td class="mobile-stack" width="17%" align="center" valign="middle">
              <div style="display:inline-block; border:1px solid rgba(124,252,0,0.5); background:#07170e; border-radius:16px; padding:10px 14px;">
                <div style="font-size:24px; line-height:26px; color:#7CFC00; font-weight:900;">{{pick1Confidence}}%</div>
                <div style="font-size:10px; line-height:13px; color:#b9ff70; font-weight:900; text-transform:uppercase;">Confidence</div>
              </div>
            </td>
            <td class="mobile-stack pick-stats" width="20%" valign="middle" style="border-left:1px solid #26384b; padding-left:18px;">
              <div style="font-size:12px; line-height:18px; color:#b7c5d8;">Model Edge <span style="float:right; color:#7CFC00; font-weight:900;">{{pick1ModelEdge}}</span></div>
              <div style="font-size:12px; line-height:18px; color:#b7c5d8;">Risk <span style="float:right; color:#ffc400; font-weight:900;">{{pick1Risk}}</span></div>
              <div style="font-size:12px; line-height:18px; color:#b7c5d8;">Market <span style="float:right; color:#7CFC00; font-weight:900;">{{pick1MarketSignal}}</span></div>
            </td>
          </tr></table>
        </td></tr></table>
      </td></tr>

      <!-- Pick 2 -->
      <tr><td class="content-padding" style="padding:0 32px 10px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c1724; border:1px solid #243548; border-radius:15px;"><tr><td style="padding:18px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td class="mobile-stack" width="20%" valign="middle" style="border-right:1px solid #26384b; padding-right:16px;">
              <div style="font-size:13px; line-height:19px; color:#ffffff; font-weight:800;">{{pick2League}}</div>
              <div style="font-size:13px; line-height:19px; color:#a9b8ca;">{{pick2Kickoff}}</div>
            </td>
            <td class="mobile-stack pick-main" width="43%" valign="middle" style="padding-left:18px;">
              <div style="font-size:19px; line-height:24px; color:#ffffff; font-weight:900;">{{pick2Matchup}}</div>
              <div style="font-size:15px; line-height:22px; color:#7CFC00; font-weight:900;">AI Pick: {{pick2MarketPick}}</div>
              <div style="font-size:13px; line-height:19px; color:#c8d4e4; margin-top:4px;">{{pick2Reason}}</div>
            </td>
            <td class="mobile-stack" width="17%" align="center" valign="middle">
              <div style="display:inline-block; border:1px solid rgba(124,252,0,0.5); background:#07170e; border-radius:16px; padding:10px 14px;">
                <div style="font-size:24px; line-height:26px; color:#7CFC00; font-weight:900;">{{pick2Confidence}}%</div>
                <div style="font-size:10px; line-height:13px; color:#b9ff70; font-weight:900; text-transform:uppercase;">Confidence</div>
              </div>
            </td>
            <td class="mobile-stack pick-stats" width="20%" valign="middle" style="border-left:1px solid #26384b; padding-left:18px;">
              <div style="font-size:12px; line-height:18px; color:#b7c5d8;">Model Edge <span style="float:right; color:#7CFC00; font-weight:900;">{{pick2ModelEdge}}</span></div>
              <div style="font-size:12px; line-height:18px; color:#b7c5d8;">Risk <span style="float:right; color:#ffc400; font-weight:900;">{{pick2Risk}}</span></div>
              <div style="font-size:12px; line-height:18px; color:#b7c5d8;">Market <span style="float:right; color:#7CFC00; font-weight:900;">{{pick2MarketSignal}}</span></div>
            </td>
          </tr></table>
        </td></tr></table>
      </td></tr>

      <!-- Pick 3 -->
      <tr><td class="content-padding" style="padding:0 32px 18px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c1724; border:1px solid #243548; border-radius:15px;"><tr><td style="padding:18px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td class="mobile-stack" width="20%" valign="middle" style="border-right:1px solid #26384b; padding-right:16px;">
              <div style="font-size:13px; line-height:19px; color:#ffffff; font-weight:800;">{{pick3League}}</div>
              <div style="font-size:13px; line-height:19px; color:#a9b8ca;">{{pick3Kickoff}}</div>
            </td>
            <td class="mobile-stack pick-main" width="43%" valign="middle" style="padding-left:18px;">
              <div style="font-size:19px; line-height:24px; color:#ffffff; font-weight:900;">{{pick3Matchup}}</div>
              <div style="font-size:15px; line-height:22px; color:#7CFC00; font-weight:900;">AI Pick: {{pick3MarketPick}}</div>
              <div style="font-size:13px; line-height:19px; color:#c8d4e4; margin-top:4px;">{{pick3Reason}}</div>
            </td>
            <td class="mobile-stack" width="17%" align="center" valign="middle">
              <div style="display:inline-block; border:1px solid rgba(124,252,0,0.5); background:#07170e; border-radius:16px; padding:10px 14px;">
                <div style="font-size:24px; line-height:26px; color:#7CFC00; font-weight:900;">{{pick3Confidence}}%</div>
                <div style="font-size:10px; line-height:13px; color:#b9ff70; font-weight:900; text-transform:uppercase;">Confidence</div>
              </div>
            </td>
            <td class="mobile-stack pick-stats" width="20%" valign="middle" style="border-left:1px solid #26384b; padding-left:18px;">
              <div style="font-size:12px; line-height:18px; color:#b7c5d8;">Model Edge <span style="float:right; color:#7CFC00; font-weight:900;">{{pick3ModelEdge}}</span></div>
              <div style="font-size:12px; line-height:18px; color:#b7c5d8;">Risk <span style="float:right; color:#ffc400; font-weight:900;">{{pick3Risk}}</span></div>
              <div style="font-size:12px; line-height:18px; color:#b7c5d8;">Market <span style="float:right; color:#ffc400; font-weight:900;">{{pick3MarketSignal}}</span></div>
            </td>
          </tr></table>
        </td></tr></table>
      </td></tr>

      <!-- Parlay + CLV row -->
      <tr><td class="content-padding" style="padding:0 32px 22px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td class="mobile-stack mobile-card" width="50%" valign="top" style="padding-right:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#071b17; border:1px solid rgba(124,252,0,0.55); border-radius:16px;"><tr><td style="padding:20px;">
              <div style="font-size:14px; line-height:20px; color:#7CFC00; font-weight:900; letter-spacing:1.6px; text-transform:uppercase;">🔥 Hot Parlay Watch</div>
              <div style="font-size:17px; line-height:23px; color:#ffffff; font-weight:900; margin-top:12px;">{{parlayTitle}}</div>
              <div style="font-size:13px; line-height:19px; color:#aebccd; margin-top:4px;">{{parlaySummary}}</div>
              <div style="margin-top:12px;">
                <div style="font-size:14px; line-height:24px; color:#ffffff;"><span style="display:inline-block; background:#7CFC00; color:#07100a; border-radius:999px; width:20px; height:20px; text-align:center; line-height:20px; font-size:12px; font-weight:900;">1</span>&nbsp;{{parlayLeg1}}</div>
                <div style="font-size:14px; line-height:24px; color:#ffffff;"><span style="display:inline-block; background:#7CFC00; color:#07100a; border-radius:999px; width:20px; height:20px; text-align:center; line-height:20px; font-size:12px; font-weight:900;">2</span>&nbsp;{{parlayLeg2}}</div>
                <div style="font-size:14px; line-height:24px; color:#ffffff;"><span style="display:inline-block; background:#7CFC00; color:#07100a; border-radius:999px; width:20px; height:20px; text-align:center; line-height:20px; font-size:12px; font-weight:900;">3</span>&nbsp;{{parlayLeg3}}</div>
              </div>
              <div style="margin-top:14px;"><a href="{{parlayUrl}}" style="font-size:14px; line-height:20px; color:#7CFC00; font-weight:900; text-decoration:none;">View Parlay Breakdown →</a></div>
            </td></tr></table>
          </td>
          <td class="mobile-stack" width="50%" valign="top" style="padding-left:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#12140d; border:1px solid rgba(255,196,0,0.65); border-radius:16px;"><tr><td style="padding:20px;">
              <div style="font-size:14px; line-height:20px; color:#ffc400; font-weight:900; letter-spacing:1.6px; text-transform:uppercase;">📈 CLV Watch</div>
              <div style="font-size:18px; line-height:24px; color:#ffffff; font-weight:900; margin-top:12px;">Are you beating the closing line?</div>
              <div style="font-size:14px; line-height:21px; color:#d7dee8; margin-top:10px;">Closing Line Value is one of the best signals for whether your entries are beating the market. {{clvOpportunityLine}}</div>
              <div style="margin-top:16px;"><a href="{{clvTrackerUrl}}" style="font-size:14px; line-height:20px; color:#ffc400; font-weight:900; text-decoration:none;">Open the CLV Tracker →</a></div>
            </td></tr></table>
          </td>
        </tr></table>
      </td></tr>

      <!-- CTA -->
      <tr><td class="content-padding" align="center" style="padding:0 32px 26px 32px;">
        <a class="cta-button" href="{{briefingUrl}}" style="display:inline-block; background:#7CFC00; color:#07100a; font-size:19px; line-height:22px; font-weight:900; text-decoration:none; padding:17px 52px; border-radius:12px; box-shadow:0 0 28px rgba(124,252,0,0.45);">View Full Briefing →</a>
        <div style="font-size:13px; line-height:20px; color:#aebccd; margin-top:12px;">Includes full reasoning, market movement, and risk notes.</div>
      </td></tr>

      <!-- Responsible Betting -->
      <tr><td class="content-padding" style="padding:0 32px 24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#081321; border:1px solid #223247; border-radius:12px;"><tr><td style="padding:15px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle" style="font-size:13px; line-height:20px; color:#b8c5d8;">🛡️ &nbsp; Bet responsibly. Gambling involves risk. Only wager what you can afford to lose.</td>
            <td align="right" valign="middle" style="font-size:13px; line-height:20px; color:#5beeff; font-weight:900;">21+</td>
          </tr></table>
        </td></tr></table>
      </td></tr>

      <!-- Footer -->
      <tr><td align="center" style="padding:24px 32px 28px 32px; background:#06101b; border-top:1px solid #17283a;">
        <div style="font-size:12px; line-height:19px; color:#8fa1b8;">You're receiving this because you opted into SnapBet briefings.</div>
        <div style="font-size:12px; line-height:19px; margin-top:9px;">
          <a href="{{preferencesUrl}}" style="color:#7CFC00; text-decoration:underline;">Manage preferences</a>
          <span style="color:#4d5c70;"> &nbsp; · &nbsp; </span>
          <a href="{{unsubscribeUrl}}" style="color:#7CFC00; text-decoration:underline;">Unsubscribe</a>
        </div>
        <div style="font-size:11px; line-height:18px; color:#63728a; margin-top:15px;">SnapBet · AI-powered sports predictions · 21+ only · Bet responsibly</div>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`,
    textContent: `Hi {{firstName}},

Tomorrow's slate has {{edgeCount}} AI-flagged opportunities.
{{briefingHeadline}}

TONIGHT'S AI READ
{{briefingBulletsText}}

TOP PICKS
1) {{pick1Matchup}} ({{pick1League}}, {{pick1Kickoff}})
   AI Pick: {{pick1MarketPick}} · {{pick1Confidence}}% confidence
   {{pick1Reason}}
2) {{pick2Matchup}} ({{pick2League}}, {{pick2Kickoff}})
   AI Pick: {{pick2MarketPick}} · {{pick2Confidence}}% confidence
   {{pick2Reason}}
3) {{pick3Matchup}} ({{pick3League}}, {{pick3Kickoff}})
   AI Pick: {{pick3MarketPick}} · {{pick3Confidence}}% confidence
   {{pick3Reason}}

HOT PARLAY WATCH
{{parlayTitle}}
{{parlayLeg1}}
{{parlayLeg2}}
{{parlayLeg3}}

CLV WATCH
Closing Line Value is one of the best signals for whether your entries are beating the market. {{clvOpportunityLine}}

View full briefing: {{briefingUrl}}
Open the CLV Tracker: {{clvTrackerUrl}}

—
Manage preferences: {{preferencesUrl}}
Unsubscribe: {{unsubscribeUrl}}

SnapBet · 21+ only · Bet responsibly`,
    variables: [
      { name: 'firstName', description: 'User first name', type: 'string', required: true, example: 'Alex' },
      { name: 'briefingDate', description: 'Date label, e.g. "Apr 30"', type: 'string', required: true, example: 'Apr 30' },
      { name: 'briefingHeadline', description: 'One-sentence summary line', type: 'string', required: true, example: '12 matches across 4 leagues with 3 picks worth your attention.' },
      { name: 'edgeCount', description: 'Number of AI-flagged opportunities', type: 'string', required: true, example: '3' },
      { name: 'topPickCount', description: 'Total surfaced picks today', type: 'string', required: true, example: '12' },
      { name: 'avgConfidence', description: 'Average confidence across surfaced picks', type: 'string', required: true, example: '78' },
      { name: 'clvWatchCount', description: 'CLV opportunities found', type: 'string', required: true, example: '5' },
      { name: 'briefingBulletsHtml', description: 'Pre-rendered HTML for AI bullets', type: 'string', required: true, example: '<div>...</div>' },
      { name: 'briefingBulletsText', description: 'Plain-text fallback', type: 'string', required: false, example: '- ...' },
      { name: 'pick1League', description: 'Pick 1 league name', type: 'string', required: true, example: 'Premier League' },
      { name: 'pick1Kickoff', description: 'Pick 1 kickoff (relative)', type: 'string', required: true, example: 'in 21h' },
      { name: 'pick1Matchup', description: 'Pick 1 home vs away', type: 'string', required: true, example: 'Arsenal vs Chelsea' },
      { name: 'pick1MarketPick', description: 'Pick 1 market pick', type: 'string', required: true, example: 'Arsenal Win' },
      { name: 'pick1Reason', description: 'Pick 1 short reason', type: 'string', required: true, example: 'Strong home form, V1+V3 agree' },
      { name: 'pick1Confidence', description: 'Pick 1 confidence %', type: 'string', required: true, example: '78' },
      { name: 'pick1ModelEdge', description: 'Pick 1 model edge vs market', type: 'string', required: true, example: '+5.2%' },
      { name: 'pick1Risk', description: 'Pick 1 risk: Low/Med/High', type: 'string', required: true, example: 'Low' },
      { name: 'pick1MarketSignal', description: 'Pick 1 market alignment: Sharp/Aligned/Mixed', type: 'string', required: true, example: 'Sharp' },
      { name: 'pick2League', description: 'Pick 2 league', type: 'string', required: true, example: 'La Liga' },
      { name: 'pick2Kickoff', description: 'Pick 2 kickoff', type: 'string', required: true, example: 'in 22h' },
      { name: 'pick2Matchup', description: 'Pick 2 home vs away', type: 'string', required: true, example: 'Real vs Atletico' },
      { name: 'pick2MarketPick', description: 'Pick 2 market pick', type: 'string', required: true, example: 'Draw' },
      { name: 'pick2Reason', description: 'Pick 2 short reason', type: 'string', required: true, example: 'Tight derby, model favors low-scoring' },
      { name: 'pick2Confidence', description: 'Pick 2 confidence %', type: 'string', required: true, example: '64' },
      { name: 'pick2ModelEdge', description: 'Pick 2 model edge', type: 'string', required: true, example: '+3.1%' },
      { name: 'pick2Risk', description: 'Pick 2 risk', type: 'string', required: true, example: 'Med' },
      { name: 'pick2MarketSignal', description: 'Pick 2 market signal', type: 'string', required: true, example: 'Aligned' },
      { name: 'pick3League', description: 'Pick 3 league', type: 'string', required: true, example: 'Bundesliga' },
      { name: 'pick3Kickoff', description: 'Pick 3 kickoff', type: 'string', required: true, example: 'in 1d 4h' },
      { name: 'pick3Matchup', description: 'Pick 3 home vs away', type: 'string', required: true, example: 'Bayern vs Dortmund' },
      { name: 'pick3MarketPick', description: 'Pick 3 market pick', type: 'string', required: true, example: 'Bayern Win' },
      { name: 'pick3Reason', description: 'Pick 3 short reason', type: 'string', required: true, example: 'Home favorites, 12-game form leader' },
      { name: 'pick3Confidence', description: 'Pick 3 confidence %', type: 'string', required: true, example: '71' },
      { name: 'pick3ModelEdge', description: 'Pick 3 model edge', type: 'string', required: true, example: '+4.0%' },
      { name: 'pick3Risk', description: 'Pick 3 risk', type: 'string', required: true, example: 'Low' },
      { name: 'pick3MarketSignal', description: 'Pick 3 market signal', type: 'string', required: true, example: 'Sharp' },
      { name: 'parlayTitle', description: 'Hot parlay headline', type: 'string', required: true, example: '3-leg cross-league play' },
      { name: 'parlaySummary', description: 'Parlay summary line', type: 'string', required: true, example: 'Combined +22% edge, 5.88x payout' },
      { name: 'parlayLeg1', description: 'Parlay leg 1 description', type: 'string', required: true, example: 'Sporting CP — Home Win' },
      { name: 'parlayLeg2', description: 'Parlay leg 2', type: 'string', required: true, example: 'Atletico — Draw No Bet' },
      { name: 'parlayLeg3', description: 'Parlay leg 3', type: 'string', required: true, example: 'Liverpool — Over 2.5' },
      { name: 'parlayUrl', description: 'Parlay deep link', type: 'string', required: true, example: 'https://www.snapbet.bet/dashboard/parlays' },
      { name: 'clvOpportunityLine', description: 'One-line CLV teaser', type: 'string', required: true, example: 'Today the model spotted Bayern as a value opportunity.' },
      { name: 'clvTrackerUrl', description: 'CLV tracker URL', type: 'string', required: true, example: 'https://www.snapbet.bet/dashboard/clv' },
      { name: 'briefingUrl', description: 'Full briefing URL', type: 'string', required: true, example: 'https://www.snapbet.bet/dashboard' },
      { name: 'preferencesUrl', description: 'Email preferences URL', type: 'string', required: true, example: 'https://www.snapbet.bet/dashboard/settings?tab=notifications' },
      { name: 'unsubscribeUrl', description: 'One-click unsubscribe URL with HMAC token', type: 'string', required: true, example: 'https://www.snapbet.bet/unsubscribe?email=...&token=...' },
    ],
    createdBy: 'system'
  },
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
