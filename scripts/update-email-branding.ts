import prisma from '../lib/db'

const NEW_PAYMENT_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SnapBet Premium Confirmation</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #0c0f1a; color: #ffffff; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background-color: #131a26; border-radius: 10px; overflow: hidden; }
    .header { display: flex; justify-content: space-between; align-items: center; background-color: #101520; padding: 20px; }
    .header .logo { font-size: 24px; font-weight: bold; color: #00ff88; }
    .header nav a { margin-left: 20px; color: #ffffff; text-decoration: none; font-size: 14px; border: 1px solid #ffffff44; padding: 5px 10px; border-radius: 5px; }
    .banner { background-color: #0a3d62; text-align: center; padding: 10px; font-weight: bold; color: #00ff88; font-size: 16px; }
    .main { padding: 20px; text-align: center; }
    .main h1 { color: #00ff88; font-size: 24px; margin-bottom: 10px; }
    .main p { font-size: 16px; line-height: 1.5; }
    .payment-summary { margin: 20px auto; border-collapse: collapse; width: 80%; }
    .payment-summary th, .payment-summary td { border: 1px solid #333; padding: 12px; text-align: center; }
    .payment-summary th { background-color: #0c0f1a; }
    .payment-summary td { background-color: #1b1f30; }
    .cta-btn { display: inline-block; background: #0057ff; color: #ffffff; padding: 15px 25px; margin: 20px 0; text-decoration: none; font-weight: bold; border-radius: 30px; font-size: 16px; }
    .footer { background: #101520; text-align: center; padding: 15px; font-size: 12px; color: #888; }
    .social-icons img { width: 24px; margin: 0 8px; }
    h3 { color: #00aaff; }
    .highlight { color: #00ff88; font-weight: bold; }
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
      <h1>💥 PAYMENT CONFIRMED – YOU’RE IN!</h1>
      <p>Hey {{userName}},</p>
      <p>You’ve officially unlocked <span class="highlight">{{packageName}}</span> on SnapBet! Your game just leveled up—betting strategies and insider insights are now at your fingertips.</p>
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
`;

const NEW_WELCOME_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Welcome to SnapBet</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #0c0f1a; color: #ffffff; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background-color: #131a26; border-radius: 10px; overflow: hidden; }
    .header { display: flex; justify-content: space-between; align-items: center; background-color: #101520; padding: 20px; }
    .header .logo { font-size: 24px; font-weight: bold; color: #00ff88; }
    .header nav a { margin-left: 20px; color: #ffffff; text-decoration: none; font-size: 14px; border: 1px solid #ffffff44; padding: 5px 10px; border-radius: 5px; }
    .banner { background-color: #0a3d62; text-align: center; padding: 10px; font-weight: bold; color: #00ff88; font-size: 16px; }
    .main { padding: 20px; text-align: center; }
    .main h1 { color: #00ff88; font-size: 24px; margin-bottom: 10px; }
    .main p { font-size: 16px; line-height: 1.5; }
    .cta-btn { display: inline-block; background: #0057ff; color: #ffffff; padding: 15px 25px; margin: 20px 0; text-decoration: none; font-weight: bold; border-radius: 30px; font-size: 16px; }
    .footer { background: #101520; text-align: center; padding: 15px; font-size: 12px; color: #888; }
    .social-icons img { width: 24px; margin: 0 8px; }
    h3 { color: #00aaff; }
    .highlight { color: #00ff88; font-weight: bold; }
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
`;

async function updateEmailBranding() {
  const updates = [
    {
      slug: 'payment-successful',
      htmlContent: NEW_PAYMENT_HTML,
    },
    {
      slug: 'welcome-email',
      htmlContent: NEW_WELCOME_HTML,
    },
  ];

  for (const { slug, htmlContent } of updates) {
    const template = await prisma.emailTemplate.findUnique({ where: { slug } });
    if (template) {
      await prisma.emailTemplate.update({
        where: { slug },
        data: { htmlContent },
      });
      console.log(`✅ Updated template: ${slug}`);
    } else {
      console.log(`⚠️ Template not found: ${slug}`);
    }
  }
  await prisma.$disconnect();
}

updateEmailBranding().catch((err) => {
  console.error('Error updating email branding:', err);
  process.exit(1);
}); 