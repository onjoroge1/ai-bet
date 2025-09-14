# 🎯 SnapBet AI - AI-Powered Sports Prediction Platform

**Live Demo**: [ai-bet-ruby.vercel.app](https://ai-bet-ruby.vercel.app)  
**Repository**: [https://github.com/onjoroge1/ai-bet.git](https://github.com/onjoroge1/ai-bet.git)

---

## 🚀 **Recent Major Updates (September 2025)**

### ✅ **GitHub CI/CD Fixes & Dashboard Enhancements** 🆕

**Status**: ✅ **COMPLETE - Production Ready**

Comprehensive session focused on resolving GitHub CI/CD failures, enhancing dashboard user experience, and fixing critical technical issues in the prediction system.

**Key Accomplishments**:
- **GitHub CI/CD Resolution**: Fixed all failing checks (TypeScript errors, unused variables, JSON syntax)
- **Dashboard Matches Enhancement**: Improved filtering, removed completed matches, enhanced analysis display
- **My-Tips Page Redesign**: Time-based organization, enhanced prediction modal, removed incorrect pricing
- **League Management Fix**: Resolved `setSyncStatus is not defined` error in admin interface
- **Data Processing Fixes**: Resolved NaN values in Additional Markets, corrected confidence display

**Technical Fixes**:
- Fixed 6+ TypeScript `any` type violations across enrichment files
- Corrected property name mismatches in frontend data access
- Enhanced prediction details modal with comprehensive betting information
- Improved API data extraction and transformation logic

**Documentation**: [SESSION_SUMMARY_SEPTEMBER_14_2025.md](./SESSION_SUMMARY_SEPTEMBER_14_2025.md)

### ✅ **Cron Job Removal & Sync/Enrich Integration** 🆕

**Status**: ⚠️ **PARTIALLY COMPLETE - Needs Fixing**

We've successfully removed the automated cron job functionality and integrated its prediction enrichment logic into the admin "Sync Matches" section. However, the integration is not working correctly and needs debugging.

**Completed**:
- **Cron Job Removal**: Deleted automated scheduled tasks and related scripts
- **UI Updates**: Modified admin interface to show "Sync & Enrich Matches" functionality
- **Code Cleanup**: Removed unused cron job files and configurations
- **Enhanced Logging**: Added comprehensive debugging throughout the enrichment process

**Current Issues**:
- ❌ **Sync & Enrich Not Working**: The integrated functionality is not calling the `/predict` endpoint
- ❌ **0 Enriched Records**: Despite processing 44 matches, no enrichment occurs
- ✅ **Separate Enrich Works**: "Enrich All Predictions (Smart)" button works perfectly

**Documentation**: [DEVELOPMENT_SESSION_SUMMARY.md](./DEVELOPMENT_SESSION_SUMMARY.md)

### ✅ **Prediction Details Modal Enhancement** ✅

**Status**: ✅ **COMPLETE - Production Ready**

Enhanced the prediction details modal in `/dashboard/my-tips` to display comprehensive betting information from the database payload, enabling users to make informed betting decisions.

**Key Features**:
- **Rich Data Display**: All prediction data from database payload now displayed
- **Additional Markets**: Total Goals, Asian Handicap, and Both Teams to Score with accurate percentages
- **Professional UI**: Modern card-based layout with proper information architecture
- **Data Processing Fixes**: Resolved NaN values and property name mismatches

**Technical Achievements**:
- Fixed API data extraction logic for `predictionData`
- Corrected frontend property access for additional markets
- Maintained full TypeScript compliance with zero build errors
- Comprehensive modal with all betting intelligence sections

**Documentation**: [PREDICTION_DETAILS_MODAL_ENHANCEMENT.md](./PREDICTION_DETAILS_MODAL_ENHANCEMENT.md)

### ✅ **Complete Email System Implementation** ✅

**Status**: ✅ **COMPLETE - Production Ready**

We've successfully implemented a comprehensive email system that includes:

- **Password Reset System**: Secure token-based password reset with email notifications
- **Email Verification**: Automatic email verification for new user signups
- **Bulk Email Sending**: Admin interface for sending emails to user segments
- **Email Template Management**: Database-driven templates with variable substitution
- **Admin Interface**: Complete bulk email operations with recipient filtering

**Key Features**:
- 6 new API endpoints for email operations
- 5 new UI components for authentication flows
- Database schema updates for email verification
- Comprehensive error handling and logging
- TypeScript compliance with zero build errors

**Documentation**: [EMAIL_SYSTEM_IMPLEMENTATION_SUMMARY.md](./EMAIL_SYSTEM_IMPLEMENTATION_SUMMARY.md)

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
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication APIs
│   │   ├── admin/         # Admin APIs
│   │   ├── payments/      # Payment processing
│   │   ├── predictions/   # Prediction APIs
│   │   └── ...
│   ├── admin/            # Admin interface
│   ├── dashboard/        # User dashboard
│   └── ...
├── components/           # React components
│   ├── ui/              # Base UI components
│   ├── admin/           # Admin components
│   ├── auth/            # Authentication components
│   └── ...
├── lib/                 # Utility libraries
│   ├── email-service.ts # Email functionality
│   ├── stripe.ts        # Payment processing
│   ├── ai/             # AI content generation
│   └── ...
├── prisma/             # Database schema
├── scripts/            # Utility scripts
└── docs/              # Documentation
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
- [x] Comprehensive documentation

### 🔄 **In Progress**
- [ ] **Sync & Enrich Integration Fix** - Debug why integrated functionality isn't working
- [ ] Real-time features with WebSocket
- [ ] Advanced caching strategies
- [ ] User analytics implementation

### 📋 **Planned Features**
- [ ] Referral system implementation
- [ ] Advanced prediction algorithms
- [ ] Mobile app development
- [ ] Social features
- [ ] Advanced analytics

---

## 📚 **Documentation**

### **System Documentation**
- [DEVELOPMENT_SESSION_SUMMARY.md](./DEVELOPMENT_SESSION_SUMMARY.md) - **Latest session summary with current issues**
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

*Last updated: September 11, 2025* 