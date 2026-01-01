# Parlays Auto-Sync Setup

## ✅ **Auto-Sync Implementation**

### **1. Scheduled Sync Endpoint**
- **Path**: `/api/admin/parlays/sync-scheduled`
- **Method**: GET
- **Authentication**: CRON_SECRET (Bearer token)
- **Frequency**: Every 15 minutes (configured in `vercel.json`)

### **2. How It Works**
- Automatically syncs parlays from both V1 and V2 APIs
- Runs every 15 minutes via Vercel Cron
- Marks expired parlays automatically
- Logs all sync operations for monitoring

### **3. Configuration**

**Vercel Cron (vercel.json):**
```json
{
  "crons": [
    {
      "path": "/api/admin/parlays/sync-scheduled",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

**Environment Variable:**
```env
CRON_SECRET=749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb
```

### **4. Manual Testing**

Test the endpoint manually:
```bash
curl -X GET "http://localhost:3000/api/admin/parlays/sync-scheduled" \
  -H "Authorization: Bearer 749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb"
```

### **5. Monitoring**

Check logs for:
- `🕐 CRON: Starting scheduled parlay sync`
- `🕐 CRON: Completed syncing parlays from v1/v2`
- `🕐 CRON: Scheduled parlay sync completed`

### **6. Sync Frequency**

**Current**: Every 15 minutes (`*/15 * * * *`)

**Options:**
- Every 15 minutes: `*/15 * * * *` (current)
- Every 30 minutes: `*/30 * * * *`
- Every hour: `0 * * * *`
- Every 2 hours: `0 */2 * * *`

### **7. What Gets Synced**

- ✅ All active parlays from V1 API
- ✅ All active parlays from V2 API
- ✅ Individual legs for each parlay
- ✅ Automatic expiration marking
- ✅ Version tracking (V1/V2)

---

**Status**: ✅ **AUTO-SYNC ENABLED**  
**Frequency**: Every 15 minutes  
**Last Updated**: December 12, 2025



