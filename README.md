# 🎯 SnapBet AI - AI-Powered Sports Prediction Platform

**Live Demo**: [ai-bet-ruby.vercel.app](https://ai-bet-ruby.vercel.app)  
**Repository**: [https://github.com/onjoroge1/ai-bet.git](https://github.com/onjoroge1/ai-bet.git)

---

## 🚀 **Recent Major Updates**

### ✅ **Match Detail Page, SEO & Betting Slip (February 2026)** 🆕

**Status**: ✅ **COMPLETE - Production Ready**

Comprehensive session that built the full match detail experience, overhauled SEO infrastructure, implemented premium content gating, and created an interactive betting slip with sportsbook integration.

**Key Accomplishments**:
- **Match Detail Page** (`/match/[slug]`): Full-featured analysis page with SEO-friendly slugs (`teamA-vs-teamB-prediction`)
- **SEO Infrastructure**: Dynamic OG images, JSON-LD structured data (SportsEvent, BreadcrumbList, FAQPage), dynamic sitemap, `robots.ts`
- **Premium Content Gating**: Blur overlay on premium fields (Edge %, Fair Odds, Value Rating, Risk Tier, Confidence Score, Parlay Compatibility, Suggested Bet Structure) — automatically unlocked for finished matches
- **Interactive Betting Slip**: Users can select picks from Match Result, Advanced Markets, and Correct Scores; copy slip to clipboard; deep-link to FanDuel, DraftKings, BetMGM, etc.
- **Smart Value Picks**: Engine using edge, EV, and CLV calculations to surface recommended bets
- **Live Match Support**: WebSocket integration for real-time score and stats updates
- **Finished Match Handling**: Score validation prevents misleading "0-0"; API auto-persists scores from external API
- **Shared Component Library**: `ConfidenceRing`, `SkeletonCard`, and helpers extracted to `components/match/shared.tsx`
- **Dashboard & Matches Redesign**: Modern gradient UI, server-side filtering, optimized data loading

**New Files Created**:
- `app/match/[slug]/page.tsx` — Match detail page (client component)
- `app/match/[slug]/layout.tsx` — Server layout with metadata, JSON-LD, OG image
- `app/match/[slug]/opengraph-image.tsx` — Dynamic OG image with team logos
- `app/match/[slug]/BetSlip.tsx` — Interactive betting slip component
- `components/match/shared.tsx` — Shared components and helpers
- `components/match/FinishedMatchStats.tsx` — Finished match display
- `lib/match-slug.ts` — Client-safe slug utilities
- `lib/match-slug-server.ts` — Server-only slug resolution (with PostgreSQL `unaccent()`)
- `lib/market-match-helpers.ts` — MarketMatch → API response transforms
- `app/api/match/[match_id]/route.ts` — Match data API with caching and fallback
- `app/sitemap-matches.xml/route.ts` — Dynamic sitemap with SEO slugs
- `app/robots.ts` — Programmatic robots.txt

**Documentation**: [SESSION_HANDOFF_FEBRUARY_2026.md](./SESSION_HANDOFF_FEBRUARY_2026.md)

### ✅ **GitHub CI/CD Fixes & Dashboard Enhancements (September 2025)**

**Status**: ✅ **COMPLETE - Production Ready**

**Key Accomplishments**:
- **GitHub CI/CD Resolution**: Fixed all failing checks (TypeScript errors, unused variables, JSON syntax)
- **Dashboard Matches Enhancement**: Improved filtering, removed completed matches, enhanced analysis display
- **My-Tips Page Redesign**: Time-based organization, enhanced prediction modal, removed incorrect pricing
- **League Management Fix**: Resolved `setSyncStatus is not defined` error in admin interface

**Documentation**: [SESSION_SUMMARY_SEPTEMBER_14_2025.md](./SESSION_SUMMARY_SEPTEMBER_14_2025.md)

### ⚠️ **Cron Job Removal & Sync/Enrich Integration (September 2025)**

**Status**: ⚠️ **PARTIALLY COMPLETE - Sync & Enrich needs fixing**

**Documentation**: [DEVELOPMENT_SESSION_SUMMARY.md](./DEVELOPMENT_SESSION_SUMMARY.md)

### ✅ **Prediction Details Modal & Email System (August–September 2025)**

**Status**: ✅ **COMPLETE - Production Ready**

- Enhanced prediction details modal with comprehensive betting information
- Complete email system: password reset, email verification, bulk sending, template management

**Documentation**: [PREDICTION_DETAILS_MODAL_ENHANCEMENT.md](./PREDICTION_DETAILS_MODAL_ENHANCEMENT.md) | [EMAIL_SYSTEM_IMPLEMENTATION_SUMMARY.md](./EMAIL_SYSTEM_IMPLEMENTATION_SUMMARY.md)

---

## 📋 **Project Overview**

SnapBet AI is a comprehensive sports prediction platform that combines artificial intelligence with real-time data analysis to deliver accurate sports predictions. The platform features a complete user management system, payment processing, and automated content generation.

### **Core Features**

- 🤖 **AI-Powered Predictions**: Machine learning algorithms for sports predictions
- 💳 **Payment System**: Stripe integration with dynamic pricing
- 📧 **Email System**: Complete email management with templates and bulk sending
- 📊 **Analytics Dashboard**: Comprehensive user and platform analytics
- 🌍 **Multi-Country Support**: Localized pricing and content for 120+ countries
- 📝 **Blog Automation**: AI-generated content from RSS feeds
- 🎯 **Quiz System**: Interactive quiz with credit rewards
- 🔔 **Notification System**: Real-time notifications and email alerts

---

## 🏗️ **Architecture & Technology Stack**

### **Frontend**
- **Next.js 14** with App Router
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **Lucide React** for icons

### **Backend**
- **Next.js API Routes** for server-side logic
- **Prisma ORM** for database management
- **PostgreSQL** for data storage
- **Redis** for caching and session management
- **NextAuth.js** for authentication

### **External Services**
- **Stripe** for payment processing
- **Resend** for email delivery
- **OpenAI** for AI content generation
- **Upstash Redis** for caching
- **Vercel** for deployment

---

## 📊 **Performance Metrics**

### **API Response Times**
| Endpoint | Response Time | Improvement |
|----------|---------------|-------------|
| Homepage Free Tip | <500ms | 50%+ faster |
| Notifications | <300ms | 50%+ faster |
| Predictions Timeline | <300ms | 50%+ faster |
| Overall Homepage | <1.5s | 40%+ faster |
| Email Sending | <3s | New Feature |

### **Database Performance**
- **Index Coverage**: 95% of queries use indexes
- **Cache Hit Rate**: 80% for frequently accessed data
- **Connection Pooling**: Optimized database connections

---

## 🗄️ **Database Schema**

### **Core Models**
```prisma
model User {
  id                    String   @id @default(cuid())
  email                 String   @unique
  fullName              String?
  emailVerified         Boolean  @default(false)
  emailVerificationToken String? @unique
  emailVerificationExpires DateTime?
  passwordResetToken    String?  @unique
  passwordResetExpires  DateTime?
  // ... other fields
}

model EmailTemplate {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  subject     String
  htmlContent String
  isActive    Boolean  @default(true)
  // ... other fields
}

model PackageOffer {
  id           String   @id @default(cuid())
  name         String
  packageType  String
  tipCount     Int
  validityDays Int
  // ... other fields
}
```

---

## 🔧 **Development Setup**

### **Prerequisites**
- Node.js 18+ 
- PostgreSQL database
- Redis instance
- Stripe account
- Resend account

### **Installation**
```bash
# Clone repository
git clone https://github.com/onjoroge1/ai-bet.git
cd ai-bet

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Set up database
npx prisma generate
npx prisma db push

# Start development server
npm run dev
```

### **Environment Variables**
```env
# Database
DATABASE_URL="postgresql://..."

# Authentication
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

# Backend API (external prediction service)
BACKEND_API_URL="https://your-backend-api.com"

# Email (Resend)
RESEND_API_KEY="your-resend-api-key"

# Payments (Stripe)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# AI (OpenAI)
OPENAI_API_KEY="sk-..."

# Redis
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```

---

## 📁 **Project Structure**

```
├── app/                          # Next.js app directory
│   ├── api/                     # API routes
│   │   ├── auth/                # Authentication APIs
│   │   ├── admin/               # Admin APIs
│   │   ├── match/[match_id]/    # Match detail API (data + purchase status)
│   │   ├── quick-purchases/     # QuickPurchase listing API
│   │   ├── payments/            # Payment processing
│   │   ├── predictions/         # Prediction APIs
│   │   └── ...
│   ├── match/[slug]/            # Match detail page (SEO slug route)
│   │   ├── page.tsx             # Client-side match page
│   │   ├── layout.tsx           # Server layout (metadata, JSON-LD, OG)
│   │   ├── opengraph-image.tsx  # Dynamic OG image generation
│   │   └── BetSlip.tsx          # Interactive betting slip
│   ├── matches/                 # Public matches browse page
│   ├── dashboard/               # User dashboard
│   │   ├── matches/             # Dashboard matches page
│   │   └── my-tips/             # Purchased tips page
│   ├── sitemap-matches.xml/     # Dynamic match sitemap
│   ├── robots.ts                # Programmatic robots.txt
│   ├── admin/                   # Admin interface
│   └── ...
├── components/                  # React components
│   ├── ui/                      # Base UI components (Shadcn)
│   ├── match/                   # Match-specific shared components
│   │   ├── shared.tsx           # ConfidenceRing, SkeletonCard, helpers
│   │   └── FinishedMatchStats.tsx # Finished match display
│   ├── admin/                   # Admin components
│   ├── auth/                    # Authentication components
│   └── ...
├── lib/                         # Utility libraries
│   ├── db.ts                    # Prisma client singleton
│   ├── match-slug.ts            # Client-safe slug utilities
│   ├── match-slug-server.ts     # Server-only slug resolution (unaccent)
│   ├── market-match-helpers.ts  # MarketMatch → API response transforms
│   ├── clv-calculator.ts        # CLV calculations
│   ├── odds.ts                  # Edge/EV calculations
│   ├── email-service.ts         # Email functionality
│   ├── stripe.ts                # Payment processing
│   ├── ai/                      # AI content generation
│   └── ...
├── prisma/                      # Database schema
├── scripts/                     # Utility scripts
└── docs/                        # Documentation
```

---

## 🚀 **Deployment**

### **Vercel Deployment**
1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### **Production Checklist**
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Email templates created
- [ ] Stripe webhooks configured
- [ ] SSL certificates installed
- [ ] Monitoring set up

---

## 📈 **Recent Improvements**

### **Week 1 (July 2025)**
- ✅ Removed all false claims and hardcoded data
- ✅ Implemented real-time data integration
- ✅ Added Redis caching (50%+ performance improvement)
- ✅ Created interactive quiz section
- ✅ Implemented credit reward system

### **Week 2 (August 2025)**
- ✅ Complete email system implementation
- ✅ Password reset and email verification
- ✅ Bulk email sending capabilities
- ✅ Admin interface for email management
- ✅ Database schema updates
- ✅ TypeScript compliance and build fixes

---

## 🎯 **Current Status**

### ✅ **Completed Features**
- [x] AI prediction system
- [x] Payment processing with Stripe
- [x] Multi-country support
- [x] User authentication and management
- [x] Email system (password reset, verification, bulk sending)
- [x] Blog automation system
- [x] Quiz system with rewards
- [x] Notification system
- [x] Admin dashboard
- [x] Performance optimization
- [x] **Match detail page** (`/match/[slug]`) with full analysis, premium gating, betting slip
- [x] **SEO infrastructure** (dynamic OG images, JSON-LD, sitemaps, robots.txt)
- [x] **Shared component library** (ConfidenceRing, SkeletonCard, helpers)
- [x] **Live match support** via WebSocket
- [x] **Finished match handling** with score validation and auto-persistence
- [x] **Interactive betting slip** with sportsbook deep-links
- [x] **Modern dashboard & matches UI** redesign
- [x] Comprehensive documentation

### 🔄 **In Progress**
- [ ] **Finished match score backfill** — ~371 matches need score data populated
- [ ] **Sync & Enrich Integration Fix** — Debug why integrated functionality isn't working
- [ ] **Design system extension** — Apply modern gradient design to remaining pages
- [ ] User analytics implementation

### 📋 **Planned Features**
- [ ] Referral system implementation
- [ ] Advanced prediction algorithms
- [ ] Mobile app development
- [ ] Social features
- [ ] Advanced analytics
- [ ] Performance monitoring (Vercel Analytics, Sentry)

---

## 📚 **Documentation**

### **System Documentation**
- [SESSION_HANDOFF_FEBRUARY_2026.md](./SESSION_HANDOFF_FEBRUARY_2026.md) - **Latest session: Match detail page, SEO, betting slip, shared components**
- [development_plan.md](./development_plan.md) - Full development plan with completed and pending items
- [DEVELOPMENT_SESSION_SUMMARY.md](./DEVELOPMENT_SESSION_SUMMARY.md) - Previous session summary
- [EMAIL_SYSTEM_IMPLEMENTATION_SUMMARY.md](./EMAIL_SYSTEM_IMPLEMENTATION_SUMMARY.md) - Complete email system overview
- [EMAIL_TEMPLATES_PROJECT_SUMMARY.md](./EMAIL_TEMPLATES_PROJECT_SUMMARY.md) - Email template system
- [REFERRAL_SYSTEM_ROADMAP.md](./REFERRAL_SYSTEM_ROADMAP.md) - Referral system planning
- [PACKAGE_PRICING_FIX.md](./PACKAGE_PRICING_FIX.md) - Package pricing fixes
- [QUIZ_CREDITS_FIX.md](./QUIZ_CREDITS_FIX.md) - Quiz credits system

### **API Documentation**
- [API Routes](./app/api/) - Complete API documentation
- [Database Schema](./prisma/schema.prisma) - Database structure
- [Component Library](./components/) - UI component documentation

---

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### **Development Guidelines**
- Follow TypeScript best practices
- Use conventional commit messages
- Write comprehensive tests
- Update documentation for new features
- Ensure build passes before submitting PR

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 **Support**

- **Email**: support@snapbet.ai
- **Documentation**: [Project Documentation](./docs/)
- **Issues**: [GitHub Issues](https://github.com/onjoroge1/ai-bet/issues)

---

## 🎉 **Acknowledgments**

- **Next.js Team** for the amazing framework
- **Vercel** for seamless deployment
- **Stripe** for payment processing
- **OpenAI** for AI capabilities
- **Resend** for email delivery

---

**SnapBet AI** - Empowering sports predictions with AI, real-time optimization, and automated content generation 🚀

*Last updated: February 17, 2026* 