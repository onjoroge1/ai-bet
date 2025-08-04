#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function createMissingEmailTemplates() {
  console.log('📧 Creating Missing Email Templates...\n')

  try {
    // 1. Password Reset Email
    console.log('1️⃣ Creating Password Reset Email...')
    await prisma.emailTemplate.create({
      data: {
        name: 'Password Reset',
        slug: 'password-reset',
        subject: 'Reset Your SnapBet Password',
        category: 'security',
        description: 'Sent when a user requests a password reset',
        isActive: true,
        version: 1,
        htmlContent: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>Reset Your SnapBet Password</title>
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
                background-color: #dc2626;
                text-align: center;
                padding: 10px;
                font-weight: bold;
                color: #ffffff;
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
              .reset-btn {
                display: inline-block;
                background: #dc2626;
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

              <div class="banner">PASSWORD RESET REQUESTED</div>

              <div class="main">
                <h1>Reset Your Password</h1>
                <p>Hi {{userName}}, we received a request to reset your SnapBet password.</p>

                <a class="reset-btn" href="{{resetUrl}}">RESET PASSWORD</a>

                <p>This link will expire in 1 hour for security reasons.</p>
                <p>If you didn't request this password reset, please ignore this email.</p>
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
          Reset Your Password

          Hi {{userName}}, we received a request to reset your SnapBet password.

          Reset your password: {{resetUrl}}

          This link will expire in 1 hour for security reasons.

          If you didn't request this password reset, please ignore this email.

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
            name: 'resetUrl',
            type: 'string',
            description: 'Password reset URL with token',
            required: true,
            defaultValue: 'https://snapbet.com/reset-password?token=reset_token_123456'
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
    console.log('✅ Password Reset template created')

    // 2. Email Verification Email
    console.log('\n2️⃣ Creating Email Verification Email...')
    await prisma.emailTemplate.create({
      data: {
        name: 'Email Verification',
        slug: 'email-verification',
        subject: 'Verify Your SnapBet Email Address',
        category: 'security',
        description: 'Sent when users need to verify their email address',
        isActive: true,
        version: 1,
        htmlContent: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>Verify Your SnapBet Email</title>
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
              .verify-btn {
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

              <div class="banner">VERIFY YOUR EMAIL ADDRESS</div>

              <div class="main">
                <h1>Welcome to SnapBet!</h1>
                <p>Hi {{userName}}, please verify your email address to complete your account setup.</p>

                <a class="verify-btn" href="{{verificationUrl}}">VERIFY EMAIL</a>

                <p>This link will expire in 24 hours.</p>
                <p>If you didn't create an account, please ignore this email.</p>
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
          Welcome to SnapBet!

          Hi {{userName}}, please verify your email address to complete your account setup.

          Verify your email: {{verificationUrl}}

          This link will expire in 24 hours.

          If you didn't create an account, please ignore this email.

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
            name: 'verificationUrl',
            type: 'string',
            description: 'Email verification URL with token',
            required: true,
            defaultValue: 'https://snapbet.com/verify-email?token=verify_token_123456'
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
    console.log('✅ Email Verification template created')

    // 3. High-Confidence Prediction Alert
    console.log('\n3️⃣ Creating High-Confidence Prediction Alert...')
    await prisma.emailTemplate.create({
      data: {
        name: 'High-Confidence Prediction Alert',
        slug: 'prediction-alert',
        subject: '⚽ High-Confidence Predictions Available - {{predictionCount}} New Tips',
        category: 'marketing',
        description: 'Sent when new high-confidence predictions are available',
        isActive: true,
        version: 1,
        htmlContent: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>High-Confidence Predictions Available</title>
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
                background-color: #3b82f6;
                text-align: center;
                padding: 10px;
                font-weight: bold;
                color: #ffffff;
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
              .prediction-card {
                background-color: #1b1f30;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: left;
              }
              .prediction-card h3 {
                color: #00ff88;
                margin-top: 0;
              }
              .prediction-details {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                margin: 15px 0;
              }
              .view-btn {
                display: inline-block;
                background: #3b82f6;
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

              <div class="banner">HIGH-CONFIDENCE PREDICTIONS ALERT</div>

              <div class="main">
                <h1>Premium Predictions Available!</h1>
                <p>Hi {{userName}}, we've identified {{predictionCount}} high-confidence prediction{{predictionCount > 1 ? 's' : ''}} that match your preferences.</p>

                {{#each predictions}}
                <div class="prediction-card">
                  <h3>{{match}}</h3>
                  <div class="prediction-details">
                    <div>
                      <strong>Prediction:</strong><br>
                      <span style="color: #00ff88;">{{prediction}}</span>
                    </div>
                    <div>
                      <strong>Confidence:</strong><br>
                      <span style="color: #00ff88;">{{confidence}}%</span>
                    </div>
                    <div>
                      <strong>Odds:</strong><br>
                      <span>{{odds}}</span>
                    </div>
                    <div>
                      <strong>Match Time:</strong><br>
                      <span>{{matchTime}}</span>
                    </div>
                  </div>
                </div>
                {{/each}}

                <a class="view-btn" href="{{appUrl}}/dashboard/predictions">VIEW ALL PREDICTIONS</a>

                <p>Remember to always bet responsibly and never risk more than you can afford to lose.</p>
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
          Premium Predictions Available!

          Hi {{userName}}, we've identified {{predictionCount}} high-confidence prediction{{predictionCount > 1 ? 's' : ''}} that match your preferences.

          {{#each predictions}}
          {{match}}
          Prediction: {{prediction}}
          Confidence: {{confidence}}%
          Odds: {{odds}}
          Match Time: {{matchTime}}
          {{/each}}

          View all predictions: {{appUrl}}/dashboard/predictions

          Remember to always bet responsibly and never risk more than you can afford to lose.

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
            name: 'predictionCount',
            type: 'number',
            description: 'Number of predictions available',
            required: true,
            defaultValue: 3
          },
          {
            name: 'predictions',
            type: 'array',
            description: 'Array of prediction objects',
            required: true,
            defaultValue: [
              {
                match: 'Manchester United vs Liverpool',
                prediction: 'Manchester United to win',
                confidence: 85,
                odds: '2.10',
                matchTime: 'Today 3:00 PM'
              }
            ]
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
    console.log('✅ High-Confidence Prediction Alert template created')

    // 4. Daily Digest Email
    console.log('\n4️⃣ Creating Daily Digest Email...')
    await prisma.emailTemplate.create({
      data: {
        name: 'Daily Digest',
        slug: 'daily-digest',
        subject: '📊 Your Daily SnapBet Digest - {{newPredictions}} New Predictions',
        category: 'marketing',
        description: 'Daily summary of predictions, results, and notifications',
        isActive: true,
        version: 1,
        htmlContent: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>Your Daily SnapBet Digest</title>
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
                background-color: #8b5cf6;
                text-align: center;
                padding: 10px;
                font-weight: bold;
                color: #ffffff;
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
              .section {
                background-color: #1b1f30;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: left;
              }
              .section h3 {
                color: #00ff88;
                margin-top: 0;
              }
              .dashboard-btn {
                display: inline-block;
                background: #8b5cf6;
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

              <div class="banner">YOUR DAILY SNAPBET DIGEST</div>

              <div class="main">
                <h1>Daily Summary</h1>
                <p>Hi {{userName}}, here's your daily summary of what's happening on SnapBet.</p>

                <div class="section">
                  <h3>📈 New Predictions</h3>
                  <p>We've added <strong>{{newPredictions}} new prediction{{newPredictions !== 1 ? 's' : ''}}</strong> to our platform today.</p>
                </div>

                {{#if topPredictions}}
                <div class="section">
                  <h3>🏆 Top Predictions Today</h3>
                  {{#each topPredictions}}
                  <div style="padding: 10px 0; border-bottom: 1px solid #333;">
                    <div style="font-weight: bold;">{{match}}</div>
                    <div style="color: #00ff88;">{{prediction}} • {{confidence}}% confidence</div>
                  </div>
                  {{/each}}
                </div>
                {{/if}}

                {{#if recentResults}}
                <div class="section">
                  <h3>📊 Recent Results</h3>
                  {{#each recentResults}}
                  <div style="padding: 10px 0; border-bottom: 1px solid #333;">
                    <div style="font-weight: bold;">{{match}}</div>
                    <div style="color: {{#if isWin}}#00ff88{{else}}#ff6b6b{{/if}};">{{result}} {{#if isWin}}✅{{else}}❌{{/if}}</div>
                  </div>
                  {{/each}}
                </div>
                {{/if}}

                {{#if unreadNotifications}}
                <div class="section">
                  <h3>🔔 Notifications</h3>
                  <p>You have <strong>{{unreadNotifications}} unread notification{{unreadNotifications !== 1 ? 's' : ''}}</strong>.</p>
                </div>
                {{/if}}

                <a class="dashboard-btn" href="{{appUrl}}/dashboard">GO TO DASHBOARD</a>
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
          Daily Summary

          Hi {{userName}}, here's your daily summary of what's happening on SnapBet.

          NEW PREDICTIONS
          We've added {{newPredictions}} new prediction{{newPredictions !== 1 ? 's' : ''}} to our platform today.

          {{#if topPredictions}}
          TOP PREDICTIONS TODAY
          {{#each topPredictions}}
          {{match}}
          {{prediction}} • {{confidence}}% confidence
          {{/each}}
          {{/if}}

          {{#if recentResults}}
          RECENT RESULTS
          {{#each recentResults}}
          {{match}}
          {{result}} {{#if isWin}}✅{{else}}❌{{/if}}
          {{/each}}
          {{/if}}

          {{#if unreadNotifications}}
          NOTIFICATIONS
          You have {{unreadNotifications}} unread notification{{unreadNotifications !== 1 ? 's' : ''}}.
          {{/if}}

          Go to dashboard: {{appUrl}}/dashboard

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
            name: 'newPredictions',
            type: 'number',
            description: 'Number of new predictions',
            required: true,
            defaultValue: 5
          },
          {
            name: 'topPredictions',
            type: 'array',
            description: 'Array of top predictions',
            required: false,
            defaultValue: [
              {
                match: 'Arsenal vs Chelsea',
                prediction: 'Arsenal to win',
                confidence: 85
              }
            ]
          },
          {
            name: 'recentResults',
            type: 'array',
            description: 'Array of recent results',
            required: false,
            defaultValue: [
              {
                match: 'Manchester United vs Liverpool',
                result: 'Won',
                isWin: true
              }
            ]
          },
          {
            name: 'unreadNotifications',
            type: 'number',
            description: 'Number of unread notifications',
            required: false,
            defaultValue: 3
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
    console.log('✅ Daily Digest template created')

    // 5. Achievement Notification
    console.log('\n5️⃣ Creating Achievement Notification...')
    await prisma.emailTemplate.create({
      data: {
        name: 'Achievement Notification',
        slug: 'achievement-notification',
        subject: '🏆 Achievement Unlocked: {{achievementName}}',
        category: 'marketing',
        description: 'Sent when users unlock achievements',
        isActive: true,
        version: 1,
        htmlContent: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>Achievement Unlocked!</title>
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
                background-color: #f59e0b;
                text-align: center;
                padding: 10px;
                font-weight: bold;
                color: #ffffff;
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
              .achievement-icon {
                font-size: 48px;
                margin-bottom: 20px;
              }
              .points-badge {
                background-color: #fef3c7;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
                display: inline-block;
              }
              .view-btn {
                display: inline-block;
                background: #f59e0b;
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

              <div class="banner">ACHIEVEMENT UNLOCKED!</div>

              <div class="main">
                <h1>Congratulations!</h1>
                <p>Hi {{userName}}, you've earned a new achievement!</p>

                <div class="achievement-icon">🏆</div>
                <h3>{{achievementName}}</h3>
                <p>{{description}}</p>

                {{#if points}}
                <div class="points-badge">
                  <strong style="color: #d97706;">+{{points}} Points Earned!</strong>
                </div>
                {{/if}}

                <a class="view-btn" href="{{appUrl}}/dashboard/achievements">VIEW YOUR ACHIEVEMENTS</a>

                <p>Keep up the great work! Your dedication to making informed predictions is paying off.</p>
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
          Congratulations!

          Hi {{userName}}, you've earned a new achievement!

          🏆 {{achievementName}}
          {{description}}

          {{#if points}}
          +{{points}} Points Earned!
          {{/if}}

          View your achievements: {{appUrl}}/dashboard/achievements

          Keep up the great work! Your dedication to making informed predictions is paying off.

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
            name: 'achievementName',
            type: 'string',
            description: 'Name of the achievement',
            required: true,
            defaultValue: 'First Win'
          },
          {
            name: 'description',
            type: 'string',
            description: 'Achievement description',
            required: true,
            defaultValue: 'You won your first prediction!'
          },
          {
            name: 'points',
            type: 'number',
            description: 'Points earned',
            required: false,
            defaultValue: 100
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
    console.log('✅ Achievement Notification template created')

    // 6. Referral Bonus Email
    console.log('\n6️⃣ Creating Referral Bonus Email...')
    await prisma.emailTemplate.create({
      data: {
        name: 'Referral Bonus',
        slug: 'referral-bonus',
        subject: '👥 Referral Bonus Earned! {{referredUserName}} joined SnapBet',
        category: 'marketing',
        description: 'Sent when users earn referral bonuses',
        isActive: true,
        version: 1,
        htmlContent: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>Referral Bonus Earned!</title>
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
                background-color: #10b981;
                text-align: center;
                padding: 10px;
                font-weight: bold;
                color: #ffffff;
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
              .bonus-card {
                background-color: #1b1f30;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
              }
              .bonus-amount {
                font-size: 32px;
                color: #00ff88;
                font-weight: bold;
                margin: 10px 0;
              }
              .referrals-btn {
                display: inline-block;
                background: #10b981;
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

              <div class="banner">REFERRAL BONUS EARNED!</div>

              <div class="main">
                <h1>Congratulations!</h1>
                <p>Hi {{userName}}, {{referredUserName}} joined SnapBet using your referral code!</p>

                <div class="bonus-card">
                  <h3>You've Earned</h3>
                  <div class="bonus-amount">${{bonusAmount}}</div>
                  <p>Referral bonus has been added to your account!</p>
                </div>

                <a class="referrals-btn" href="{{appUrl}}/dashboard/referrals">VIEW YOUR REFERRALS</a>

                <p>Keep sharing your referral link to earn more bonuses!</p>
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
          Congratulations!

          Hi {{userName}}, {{referredUserName}} joined SnapBet using your referral code!

          You've Earned
          ${{bonusAmount}}
          Referral bonus has been added to your account!

          View your referrals: {{appUrl}}/dashboard/referrals

          Keep sharing your referral link to earn more bonuses!

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
            name: 'referredUserName',
            type: 'string',
            description: 'Name of the referred user',
            required: true,
            defaultValue: 'Jane Smith'
          },
          {
            name: 'bonusAmount',
            type: 'number',
            description: 'Bonus amount earned',
            required: true,
            defaultValue: 10.00
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
    console.log('✅ Referral Bonus template created')

    console.log('\n🎉 All missing email templates created successfully!')
    console.log('\n📋 Summary:')
    console.log('   • Password Reset (password-reset)')
    console.log('   • Email Verification (email-verification)')
    console.log('   • High-Confidence Prediction Alert (prediction-alert)')
    console.log('   • Daily Digest (daily-digest)')
    console.log('   • Achievement Notification (achievement-notification)')
    console.log('   • Referral Bonus (referral-bonus)')
    console.log('\n💡 Next steps:')
    console.log('   1. Visit /admin/email to review and customize the templates')
    console.log('   2. Update the test email endpoint to include these new types')
    console.log('   3. Test the email sending functionality')

  } catch (error) {
    console.error('❌ Error creating email templates:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createMissingEmailTemplates() 