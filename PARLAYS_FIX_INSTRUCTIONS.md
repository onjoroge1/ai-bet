# Fix for Parlays API Errors

## Problem
The Prisma client hasn't been regenerated after adding the new parlay models, causing errors like:
- `Cannot read properties of undefined (reading 'upsert')`
- `Cannot read properties of undefined (reading 'findMany')`

## Solution

### Step 1: Stop the Dev Server
Stop your Next.js dev server (Ctrl+C in the terminal where it's running)

### Step 2: Regenerate Prisma Client
Run this command:
```bash
npx prisma generate
```

### Step 3: Restart Dev Server
Start your dev server again:
```bash
npm run dev
```

## Why This Happens
After running `prisma db push` to update the database schema, the Prisma TypeScript client needs to be regenerated to include the new models (`ParlayConsensus`, `ParlayLeg`, `ParlayPurchase`, `ParlayPerformance`). 

The file lock error occurs because the dev server is using the Prisma client files, so you need to stop it first.

## Verification
After restarting, the `/api/parlays` endpoint should work correctly. You can test by:
1. Going to `/dashboard/parlays`
2. Clicking "Sync Parlays" (if you're an admin)
3. The parlays should load without errors

