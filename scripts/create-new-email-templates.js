#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function createNewEmailTemplates() {
  console.log('📧 Creating New Email Templates...\n')

  try {
    // 1. Tip Purchase Confirmation Email
    console.log('1️⃣ Creating Tip Purchase Confirmation Email...')
    const tipPurchaseTemplate = await prisma.emailTemplate.create({
      data: {
        name: 'Tip Purchase Confirmation',
        slug: 'tip-purchase-confirmation',
        subject: 'Tip Purchase Confirmed - {{tipName}}',
        category: 'payment',
        description: 'Sent when a user purchases an individual tip with money',
        isActive: true,
        version: 1,
        htmlContent: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>SnapBet Tip Purchase Confirmation</title>
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
              .tip-details {
                background-color: #1b1f30;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: left;
              }
              .tip-details h3 {
                color: #00ff88;
                margin-top: 0;
              }
              .tip-details p {
                margin: 8px 0;
                color: #cccccc;
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
                padding: 20px;
                text-align: center;
                font-size: 14px;
                color: #6b7280;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">SNAPBET</div>
              </div>

              <div class="banner">TIP PURCHASE CONFIRMED! 🎯</div>

              <div class="main">
                <h1>Tip Purchase Successful!</h1>
                <p>Hi {{userName}}, your tip purchase has been confirmed. Here are the details:</p>

                <div class="tip-details">
                  <h3>📊 Tip Details</h3>
                  <p><strong>Tip Name:</strong> {{tipName}}</p>
                  <p><strong>Match:</strong> {{matchDetails}}</p>
                  <p><strong>Prediction:</strong> {{prediction}}</p>
                  <p><strong>Confidence:</strong> {{confidence}}%</p>
                  <p><strong>Expires:</strong> {{expiresAt}}</p>
                </div>

                <table class="payment-summary">
                  <tr>
                    <th>Item</th>
                    <th>Amount</th>
                  </tr>
                  <tr>
                    <td>{{tipName}}</td>
                    <td>{{currencySymbol}}{{amount}}</td>
                  </tr>
                  <tr>
                    <td><strong>Total</strong></td>
                    <td><strong>{{currencySymbol}}{{amount}}</strong></td>
                  </tr>
                </table>

                <p><strong>Transaction ID:</strong> {{transactionId}}</p>

                <a class="cta-btn" href="{{appUrl}}/dashboard/predictions">VIEW YOUR TIP</a>

                <p>Your tip is now available in your dashboard. Good luck! 🍀</p>
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
          Tip Purchase Successful!

          Hi {{userName}}, your tip purchase has been confirmed. Here are the details:

          TIP DETAILS
          Tip Name: {{tipName}}
          Match: {{matchDetails}}
          Prediction: {{prediction}}
          Confidence: {{confidence}}%
          Expires: {{expiresAt}}

          PAYMENT SUMMARY
          {{tipName}}: {{currencySymbol}}{{amount}}
          Total: {{currencySymbol}}{{amount}}

          Transaction ID: {{transactionId}}

          View your tip: {{appUrl}}/dashboard/predictions

          Your tip is now available in your dashboard. Good luck!

          © 2025 SnapBet. All rights reserved.
          123 Betting Lane, Wager City, WC 54321
          Unsubscribe
        `,
        variables: [
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
            defaultValue: 4.99
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
            name: 'tipName',
            type: 'string',
            description: 'Name of the purchased tip',
            required: true,
            defaultValue: 'Premium Match Tip'
          },
          {
            name: 'matchDetails',
            type: 'string',
            description: 'Match details (teams, date, time)',
            required: true,
            defaultValue: 'Manchester United vs Liverpool - Today 3:00 PM'
          },
          {
            name: 'prediction',
            type: 'string',
            description: 'The prediction made',
            required: true,
            defaultValue: 'Manchester United to win'
          },
          {
            name: 'confidence',
            type: 'number',
            description: 'Confidence percentage',
            required: true,
            defaultValue: 85
          },
          {
            name: 'expiresAt',
            type: 'string',
            description: 'When the tip expires',
            required: true,
            defaultValue: 'Today 2:45 PM'
          },
          {
            name: 'appUrl',
            type: 'string',
            description: 'Application URL',
            required: true,
            defaultValue: 'https://snapbet.com'
          }
        ],
        createdBy: 'system'
      }
    })
    console.log('✅ Tip Purchase Confirmation template created')

    // 2. Credit Claim Confirmation Email
    console.log('\n2️⃣ Creating Credit Claim Confirmation Email...')
    const creditClaimTemplate = await prisma.emailTemplate.create({
      data: {
        name: 'Credit Claim Confirmation',
        slug: 'credit-claim-confirmation',
        subject: 'Tip Claimed with Credits - {{tipName}}',
        category: 'payment',
        description: 'Sent when a user claims a tip using prediction credits',
        isActive: true,
        version: 1,
        htmlContent: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>SnapBet Credit Claim Confirmation</title>
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
              .tip-details {
                background-color: #1b1f30;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: left;
              }
              .tip-details h3 {
                color: #00ff88;
                margin-top: 0;
              }
              .tip-details p {
                margin: 8px 0;
                color: #cccccc;
              }
              .credit-summary {
                background-color: #1b1f30;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
              }
              .credit-summary h3 {
                color: #00ff88;
                margin-top: 0;
              }
              .credit-summary .credits-used {
                font-size: 24px;
                color: #ff6b6b;
                font-weight: bold;
              }
              .credit-summary .credits-remaining {
                font-size: 18px;
                color: #00ff88;
                margin-top: 10px;
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
                padding: 20px;
                text-align: center;
                font-size: 14px;
                color: #6b7280;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">SNAPBET</div>
              </div>

              <div class="banner">TIP CLAIMED WITH CREDITS! 🎯</div>

              <div class="main">
                <h1>Tip Successfully Claimed!</h1>
                <p>Hi {{userName}}, you've successfully claimed a tip using your prediction credits. Here are the details:</p>

                <div class="tip-details">
                  <h3>📊 Tip Details</h3>
                  <p><strong>Tip Name:</strong> {{tipName}}</p>
                  <p><strong>Match:</strong> {{matchDetails}}</p>
                  <p><strong>Prediction:</strong> {{prediction}}</p>
                  <p><strong>Confidence:</strong> {{confidence}}%</p>
                  <p><strong>Expires:</strong> {{expiresAt}}</p>
                </div>

                <div class="credit-summary">
                  <h3>💳 Credit Summary</h3>
                  <div class="credits-used">-{{creditsUsed}} Credits</div>
                  <div class="credits-remaining">Remaining: {{creditsRemaining}} Credits</div>
                </div>

                <a class="cta-btn" href="{{appUrl}}/dashboard/predictions">VIEW YOUR TIP</a>

                <p>Your tip is now available in your dashboard. Good luck! 🍀</p>
                
                <p><small>Want more credits? Take our daily quiz or purchase a premium package!</small></p>
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
          Tip Successfully Claimed!

          Hi {{userName}}, you've successfully claimed a tip using your prediction credits. Here are the details:

          TIP DETAILS
          Tip Name: {{tipName}}
          Match: {{matchDetails}}
          Prediction: {{prediction}}
          Confidence: {{confidence}}%
          Expires: {{expiresAt}}

          CREDIT SUMMARY
          Credits Used: -{{creditsUsed}}
          Remaining Credits: {{creditsRemaining}}

          View your tip: {{appUrl}}/dashboard/predictions

          Your tip is now available in your dashboard. Good luck!

          Want more credits? Take our daily quiz or purchase a premium package!

          © 2025 SnapBet. All rights reserved.
          123 Betting Lane, Wager City, WC 54321
          Unsubscribe
        `,
        variables: [
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
            name: 'tipName',
            type: 'string',
            description: 'Name of the claimed tip',
            required: true,
            defaultValue: 'Premium Match Tip'
          },
          {
            name: 'matchDetails',
            type: 'string',
            description: 'Match details (teams, date, time)',
            required: true,
            defaultValue: 'Manchester United vs Liverpool - Today 3:00 PM'
          },
          {
            name: 'prediction',
            type: 'string',
            description: 'The prediction made',
            required: true,
            defaultValue: 'Manchester United to win'
          },
          {
            name: 'confidence',
            type: 'number',
            description: 'Confidence percentage',
            required: true,
            defaultValue: 85
          },
          {
            name: 'expiresAt',
            type: 'string',
            description: 'When the tip expires',
            required: true,
            defaultValue: 'Today 2:45 PM'
          },
          {
            name: 'creditsUsed',
            type: 'number',
            description: 'Number of credits used',
            required: true,
            defaultValue: 1
          },
          {
            name: 'creditsRemaining',
            type: 'number',
            description: 'Remaining credits after claim',
            required: true,
            defaultValue: 5
          },
          {
            name: 'appUrl',
            type: 'string',
            description: 'Application URL',
            required: true,
            defaultValue: 'https://snapbet.com'
          }
        ],
        createdBy: 'system'
      }
    })
    console.log('✅ Credit Claim Confirmation template created')

    console.log('\n🎉 All new email templates created successfully!')
    console.log('\n📋 Summary:')
    console.log('   • Tip Purchase Confirmation (tip-purchase-confirmation)')
    console.log('   • Credit Claim Confirmation (credit-claim-confirmation)')
    console.log('\n💡 Next steps:')
    console.log('   1. Visit /admin/email to review and customize the templates')
    console.log('   2. Update the NotificationService to use these new templates')
    console.log('   3. Test the email sending functionality')

  } catch (error) {
    console.error('❌ Error creating email templates:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createNewEmailTemplates() 