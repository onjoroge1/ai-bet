# ✅ Parlays Backend API Cron Sync Setup

**Date**: January 2, 2026  
**Status**: ✅ **COMPLETED**

---

## 📋 **Summary**

Successfully set up automated cron job to sync parlays from backend V1/V2 APIs into the ParlayConsensus table. The sync button is visible to admins and works correctly, and now there's also an automated sync running every 15 minutes.

---

## ✅ **Implementation Details**

### **1. Updated POST /api/parlays Authentication**

**File**: `app/api/parlays/route.ts`

**Changes**:
- Added support for `CRON_SECRET` authentication (in addition to admin session)
- Allows the endpoint to be called by both:
  - Manual admin requests (with session) - for sync button
  - Automated cron jobs (with CRON_SECRET) - for scheduled sync

**Code**:
```typescript
// Check for CRON_SECRET authentication (for cron jobs)
const authHeader = request.headers.get('authorization')
const cronSecret = process.env.CRON_SECRET
const isCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`

// If not cron request, check for admin session (for manual UI requests)
if (!isCronRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

### **2. Created Cron Endpoint**

**File**: `app/api/admin/parlays/sync-backend-scheduled/route.ts`

**Purpose**: Endpoint called by Vercel Cron for automated parlay sync from backend APIs

**Features**:
- Verifies CRON_SECRET authentication
- Calls POST /api/parlays with `version: 'both'` to sync V1 and V2
- Logs all operations for monitoring
- Returns sync results

### **3. Updated Vercel Cron Configuration**

**File**: `vercel.json`

**Added**:
```json
{
  "path": "/api/admin/parlays/sync-backend-scheduled",
  "schedule": "*/15 * * * *"  // Every 15 minutes
}
```

**Note**: The existing `/api/admin/parlays/sync-scheduled` (for local SGP generation) is still configured but runs every 30 minutes to avoid conflicts.

---

## 🔄 **How It Works**

### **Manual Sync (Admin UI)**
1. Admin clicks "Sync Parlays" button on `/dashboard/parlays` page
2. Frontend calls `POST /api/parlays` with admin session
3. Endpoint syncs parlays from backend V1/V2 APIs
4. Stores in ParlayConsensus table
5. Creates ParlayLeg records
6. Returns sync results

### **Automated Sync (Cron Job)**
1. Vercel Cron triggers every 15 minutes
2. Calls `GET/POST /api/admin/parlays/sync-backend-scheduled`
3. Endpoint verifies CRON_SECRET
4. Calls `POST /api/parlays` with CRON_SECRET auth
5. Syncs parlays from backend V1/V2 APIs
6. Stores in ParlayConsensus table
7. Logs results

---

## 📊 **Data Flow**

```
Backend API (V1/V2)
    ↓
POST /api/parlays (with CRON_SECRET or admin session)
    ↓
ParlayConsensus table (stored)
    ↓
ParlayLeg records (created)
    ↓
GET /api/parlays (filtered by UPCOMING matches)
    ↓
/dashboard/parlays page (displayed to users)
```

---

## ✅ **Confirmation Checklist**

- ✅ **Sync button visible to admin**: Yes, on `/dashboard/parlays` page
- ✅ **Sync button calls POST /api/parlays**: Yes, syncs from backend V1/V2 APIs
- ✅ **Parlays stored in ParlayConsensus table**: Yes, with upsert logic
- ✅ **Filtered by UPCOMING matches**: Yes, GET /api/parlays filters by MarketMatch UPCOMING status
- ✅ **Cron job configured**: Yes, runs every 15 minutes
- ✅ **CRON_SECRET authentication**: Yes, both endpoints support it

---

## ⏰ **Schedule**

**Backend API Sync**: Every 15 minutes (`*/15 * * * *`)
- Syncs parlays from backend V1/V2 APIs
- Stores in ParlayConsensus table

**Local SGP Generation**: Every 30 minutes (`*/30 * * * *`)
- Generates single-game parlays from QuickPurchase data
- Also stores in ParlayConsensus table

---

## 🔒 **Security**

- **CRON_SECRET**: Required for cron job authentication
- **Admin Session**: Required for manual sync button
- Both authentication methods are verified before allowing sync

---

## 📝 **Notes**

- The sync button and cron job both call the same endpoint (`POST /api/parlays`)
- Both methods sync from backend APIs and store in ParlayConsensus table
- GET /api/parlays filters results to only show parlays based on UPCOMING matches
- The existing `/api/admin/parlays/sync-scheduled` endpoint is for local SGP generation (different purpose)

---

**Status**: ✅ **COMPLETED AND CONFIGURED**  
**Next Steps**: Monitor logs to ensure sync is working correctly

