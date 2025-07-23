# SnapBet AI Sports Tipster – Engineering Handoff

## 1. Project Overview

SnapBet is a Next.js/TypeScript-based sports prediction platform featuring:
- AI-powered predictions
- Payment and subscription system
- Admin dashboard
- Email template management
- Blog and content management

---

## 2. Major Work Completed

### A. TypeScript & Linting Improvements
- Replaced most `any` types with strict interfaces (see `types/api.ts`, `types/email-templates.ts`).
- Fixed 200+ linting errors (unused vars, missing deps, JSX issues).
- Enforced ESLint + Prettier conventions.

### B. Email Template System
- **Database:** Added `EmailTemplate`, `EmailTemplateVersion`, and `EmailLog` models to Prisma schema.
- **Backend:** Created `lib/email-template-service.ts` for CRUD/versioning of templates.
- **API:** Built `/api/admin/email-templates` endpoints for admin management.
- **Frontend:** `/admin/emails` page for listing, editing, and previewing templates.
- **Rich Text Editor:** Integrated TipTap with SSR/hydration and dark mode fixes.
- **Seeding:** Default templates for “Payment Successful” and “Welcome Email”.
- **Integration:** Welcome email is sent on signup, payment email on successful payment (webhook).
- **Branding:** Updated HTML for both emails to match new SnapBet brand.
- **Script:** Added `scripts/update-email-branding.ts` to update live templates.

### C. Blog System
- **Admin:** `/admin/blogs` for creating, editing, and deleting blog posts.
- **Public:** `/blog` and `/blog/[slug]` for listing and viewing posts.
- **API:** `/api/blogs` and `/api/blogs/[id]` endpoints support filtering, limiting, and single post fetch.
- **Type Safety:** Ensured all required fields (author, category, tags, etc.) are set on creation.

### D. General API & Database Fixes
- Fixed Next.js 15 `params` handling in API routes.
- Removed references to non-existent fields in Prisma models.
- Regenerated Prisma client after schema changes.

---

## 3. Key Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| Prisma client not recognizing new models | Ran `npx prisma generate` and `npx prisma db push` after schema changes. |
| API returning HTML (login page) instead of JSON | Identified as an authentication middleware redirect; tested with a public endpoint. |
| PrismaClient browser error | Ensured all data fetching in admin UI is via API, not direct Prisma calls in the browser. |
| SSR hydration mismatch in TipTap | Set `immediatelyRender: false` and used client-only rendering. |
| Rich text editor white-on-white | Added explicit CSS for dark text on white background. |
| TypeScript errors in email template types | Replaced `any` with strict interfaces and updated usages. |
| Payment email not sent on success | Added trigger in Stripe webhook handler. |
| Email branding not updating in admin | Added script to update live DB templates. |
| Credits not showing after payment | Investigated package/credit logic in webhook and eligibility API. |

---

## 4. Known Issues & Pending Items

### A. Email System
- [ ] **Welcome/Payment emails not always sent:**
    - Check for missing/invalid `RESEND_API_KEY` or `FROM_EMAIL` in `.env`.
    - Review logs for `Failed to send welcome email` or `RESEND_API_KEY not configured`.
- [ ] **Email branding in admin UI:**
    - Run `scripts/update-email-branding.ts` to update existing DB templates.
    - Manual edits via `/admin/emails` may be needed if script fails.

### B. Credits & Packages
- [ ] **Credits not appearing after payment:**
    - Confirm `userPackage` is created with correct `tipsRemaining` and `status: active`.
    - Check for logic errors in `createUserPackage` (webhook) for package type parsing.
    - Inspect DB for orphaned or inactive packages.
- [ ] **Eligibility API returns 0 credits:**
    - Ensure `userPackage` is not expired and has `tipsRemaining > 0`.
    - Check for cache issues in `/api/credits/balance` and `/api/credits/check-eligibility`.

### C. Payment Webhook
- [ ] **Webhook not always firing or updating DB:**
    - Confirm Stripe webhook endpoint and secret are correct.
    - Check logs for errors in `handlePaymentSuccess`.
    - Add more logging if needed.

### D. General
- [ ] **Test coverage:**
    - Add/expand tests for email, payment, and credit flows.
- [ ] **Production environment:**
    - Double-check all `.env` values in prod/staging.
    - Monitor logs for silent failures.

---

## 5. Recommendations for Next Agent

- **Start with the logs:** Most issues (email, credits, webhook) will show up in server logs. Always check logs after any user action.
- **Check DB state:** Use Prisma Studio or direct SQL to inspect `userPackage`, `EmailTemplate`, and `User` tables for expected values.
- **Test end-to-end:** Simulate signup, payment, and tip claim flows in a local/dev environment.
- **Review environment variables:** Ensure all required keys are set and valid in `.env` and `.env.local`.
- **Keep scripts up to date:** Re-run seeding or update scripts after any template or schema change.
- **Add debug logging:** If an issue is hard to trace, add more logs (especially in webhook and email flows).
- **Document fixes:** Update this handoff doc with any new findings or changes for future agents.

---

**Status:** 🚧 Some critical issues remain (credits, email delivery). See above for next steps.

**Priority:** 🔥 High – User-facing features (credits, email) must be reliable for launch.

**Contact:** If you need more context, review the following files:
- `EMAIL_TEMPLATE_SYSTEM_ROADMAP.md`
- `DEVELOPMENT_PLAN.md`
- `SEO_ROADMAP.md`
- `types/email-templates.ts`
- `app/api/payments/webhook/route.ts`
- `app/api/credits/check-eligibility/route.ts`

---

*This document is intended to help the next engineer quickly get up to speed and address the most pressing issues in SnapBet.* 