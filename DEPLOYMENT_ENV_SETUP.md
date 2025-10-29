# 🚀 **Production Environment Variables Setup**

## **Issue**
The `/api/market` endpoint returns empty data in production because the `BACKEND_API_URL` environment variable is not set in your Vercel deployment.

## **Current Behavior**
- **Local**: Works because it defaults to `http://localhost:8000`
- **Production**: Fails because `BACKEND_API_URL` is undefined, falling back to `http://localhost:8000` which doesn't exist in production

## **Solution: Add Environment Variables to Vercel**

### **Step 1: Access Vercel Dashboard**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (`ai-sports-tipster` or similar)
3. Click on **Settings** tab
4. Click on **Environment Variables** in the left sidebar

### **Step 2: Add Required Environment Variables**

Add these environment variables:

```bash
# Backend API Configuration (REQUIRED FOR MATCH DATA)
BACKEND_API_URL=https://bet-genius-ai-onjoroge1.replit.app
NEXT_PUBLIC_MARKET_KEY=betgenius_secure_key_2024
```

### **Step 3: Apply to All Environments**
When adding each variable:
- ✅ Check **Production**
- ✅ Check **Preview**
- ✅ Check **Development** (if you want)

### **Step 4: Redeploy**
After adding the environment variables:
1. Go to **Deployments** tab
2. Click on the most recent deployment
3. Click the **"..."** menu
4. Select **Redeploy**
5. Wait for deployment to complete

## **Verification**

After redeployment, test the endpoint:
```
https://your-vercel-domain.vercel.app/api/market?status=upcoming&limit=2
```

It should return match data instead of an empty array.

## **Additional Environment Variables You Should Have**

While you're at it, ensure these are also set in Vercel:

### **Database**
- `DATABASE_URL` - Your PostgreSQL connection string

### **Authentication**
- `JWT_SECRET` - Your JWT signing secret
- `NEXTAUTH_URL` - Your production URL
- `NEXTAUTH_SECRET` - Your NextAuth secret

### **Stripe (for payments)**
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Your Stripe webhook secret

### **Email (Resend)**
- `RESEND_API_KEY` - Your Resend API key
- `FROM_EMAIL` - Your sender email
- `SUPPORT_EMAIL` - Your support email

### **Redis (if using)**
- `UPSTASH_REDIS_REST_URL` - Your Upstash Redis URL
- `UPSTASH_REDIS_REST_TOKEN` - Your Upstash token

## **Environment Variable Naming**

Note the difference in naming:
- `BACKEND_API_URL` - Used in API routes (server-side only)
- `NEXT_PUBLIC_MARKET_KEY` - Has `NEXT_PUBLIC_` prefix (available to client-side code)

## **Troubleshooting**

### **Issue: Still getting empty data**
1. Check Vercel logs: Go to Deployment → Functions → `/api/market`
2. Look for: `Fetching from: ...` to see what URL it's trying
3. If it shows `http://localhost:8000`, the env var isn't loaded
4. Try a hard redeploy by pushing a new commit

### **Issue: Environment variables not updating**
- Vercel caches environment variables
- Try deleting and re-adding the variables
- Redeploy after making changes

### **Issue: CORS errors**
- Make sure your backend API (Replit) allows requests from your Vercel domain
- Check backend CORS configuration

## **Testing Locally**

To test with production-like environment locally:

1. Create `.env.local` file (never commit this):
```bash
BACKEND_API_URL=https://bet-genius-ai-onjoroge1.replit.app
NEXT_PUBLIC_MARKET_KEY=betgenius_secure_key_2024
```

2. Restart your dev server:
```bash
npm run dev
```

3. Test the endpoint:
```
http://localhost:3000/api/market?status=upcoming&limit=2
```

## **Security Notes**

- ⚠️ Never commit `.env.local` to Git
- ⚠️ Use different API keys for dev/staging/production
- ⚠️ Rotate secrets regularly
- ⚠️ Use environment-specific URLs (don't mix dev and prod)

## **Quick Checklist**

- [ ] Added `BACKEND_API_URL` to Vercel
- [ ] Added `NEXT_PUBLIC_MARKET_KEY` to Vercel
- [ ] Applied to Production environment
- [ ] Applied to Preview environment
- [ ] Redeployed the application
- [ ] Tested the `/api/market` endpoint
- [ ] Verified match data is returned

---

**After completing this setup, your production API should work correctly!** 🎉

