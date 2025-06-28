# AI Sports Tipster 🏆

A comprehensive sports betting prediction platform with AI-powered insights and a sophisticated payment system.

[![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.9.0-2D3748)](https://www.prisma.io/)
[![Stripe](https://img.shields.io/badge/Stripe-Payment%20Gateway-6772E5)](https://stripe.com/)

## 🌟 Features

### 🎯 AI-Powered Predictions
- Machine learning-based sports predictions
- Real-time match analysis and odds calculation
- Confidence scoring and value rating system
- Multi-league support with priority-based data collection

### 💳 Payment System
- **Package-Based Purchases**: Daily, Weekly, Monthly, and Unlimited packages
- **Country-Specific Pricing**: Dynamic pricing based on user location
- **Multiple Payment Methods**: Credit cards, Apple Pay, Google Pay, PayPal
- **Secure Stripe Integration**: Server-side payment processing with webhooks
- **Tip Claiming System**: Users can claim individual tips from purchased packages

### 🌍 Global Support
- Multi-country support with localized pricing
- Currency conversion and formatting
- Country-specific payment method availability
- Localized content and user experience

### 📊 Advanced Analytics
- User prediction tracking and performance metrics
- Real-time statistics and insights
- Referral system with commission tracking
- Comprehensive admin dashboard

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Stripe account
- Resend account (for emails)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/onjoroge1/ai-bet.git
   cd ai-bet
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your configuration:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/ai_sports_tipster"
   
   # NextAuth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-nextauth-secret-key"
   
   # Stripe
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_your_stripe_publishable_key"
   STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key"
   STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"
   
   # Email (Resend)
   RESEND_API_KEY="re_your_resend_api_key"
   
   # Redis (Upstash)
   UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
   UPSTASH_REDIS_REST_TOKEN="your_redis_token"
   
   # External APIs
   FOOTBALL_API_KEY="your_football_api_key"
   FOOTBALL_API_BASE_URL="https://api.football-data.org/v4"
   ```

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

5. **Run the development server**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 💰 Payment System Architecture

### Package Types
- **Daily Package**: 5 tips, 24-hour validity
- **Weekly Package**: 15 tips, 7-day validity  
- **Monthly Package**: 50 tips, 30-day validity
- **Unlimited Package**: Unlimited tips, 30-day validity

### Payment Flow
1. **User Selection**: Choose package or individual tip
2. **Price Calculation**: Dynamic pricing based on user's country
3. **Payment Intent**: Server creates Stripe payment intent
4. **Client Payment**: Stripe Elements handles payment processing
5. **Webhook Processing**: Automatic package/tip creation on success
6. **User Access**: Immediate access to purchased content

### Database Models
```prisma
model PackageOffer {
  id            String   @id @default(cuid())
  name          String
  packageType   String
  tipCount      Int      // -1 for unlimited
  validityDays  Int
  countryPrices PackageOfferCountryPrice[]
  userPackages  UserPackage[]
}

model UserPackage {
  id             String       @id @default(cuid())
  userId         String
  packageOfferId String
  expiresAt      DateTime
  tipsRemaining  Int
  status         String       @default("active")
  // ... other fields
}
```

## 🔧 API Endpoints

### Payment Endpoints
- `POST /api/payments/create-payment-intent` - Create payment intents
- `POST /api/payments/webhook` - Handle Stripe webhooks

### Package Management
- `GET /api/package-offers` - Get available packages with pricing
- `POST /api/user-packages/claim-tip` - Claim tips from packages
- `GET /api/user-packages/claim-tip` - Get user's package status

### Predictions
- `GET /api/predictions` - Get available predictions
- `POST /api/predictions` - Create new predictions
- `GET /api/my-tips` - Get user's claimed tips

## 🛠️ Development

### Scripts
```bash
# Development
npm run dev              # Start development server
npm run dev:server       # Start background server

# Building
npm run build           # Build for production
npm run start           # Start production server

# Database
npx prisma generate     # Generate Prisma client
npx prisma db push      # Push schema changes
npx prisma db seed      # Seed database

# Testing
npm run test            # Run tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage
```

### Project Structure
```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   └── ...
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── dashboard/        # Dashboard components
│   └── ...
├── lib/                  # Utility libraries
│   ├── stripe.ts         # Client-side Stripe
│   ├── stripe-server.ts  # Server-side Stripe
│   └── ...
├── prisma/               # Database schema and migrations
└── scripts/              # Utility scripts
```

## 🔒 Security Features

- **Server-side Payment Processing**: All payment operations handled server-side
- **Webhook Signature Verification**: Secure Stripe webhook handling
- **Environment Variable Protection**: Sensitive data excluded from version control
- **Type Safety**: Full TypeScript implementation with strict mode
- **Input Validation**: Comprehensive validation on all API endpoints

## 🌐 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Set up environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment
```bash
npm run build
npm run start
```

## 📈 Performance Optimizations

- **Database Queries**: Optimized with proper indexing and includes
- **Frontend Performance**: Lazy loading and efficient re-renders
- **Build Optimization**: Code splitting and bundle optimization
- **Caching**: Redis-based caching for frequently accessed data

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@ai-sports-tipster.com or create an issue in this repository.

## 🔮 Roadmap

- [ ] Subscription management for recurring packages
- [ ] Advanced analytics dashboard
- [ ] Mobile app development
- [ ] Multi-language support
- [ ] Advanced AI prediction models
- [ ] Social features and leaderboards

---

**Built with ❤️ using Next.js, TypeScript, Prisma, and Stripe** 