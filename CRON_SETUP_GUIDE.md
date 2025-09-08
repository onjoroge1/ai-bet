# 🕐 Cron Scheduler Setup Guide

## Environment Variables Required

Add this to your `.env.local` file:

```bash
# Cron Security
CRON_SECRET="749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb"
```

## Vercel Cron Configuration

The `vercel.json` file has been updated with:

```json
{
  "crons": [
    {
      "path": "/api/admin/predictions/enrich-scheduled",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

## How It Works

### **Manual "Smart" Button** (Existing)
- **Purpose**: Process only pending matches
- **Query**: `predictionData: null OR predictionData: Prisma.JsonNull`
- **Use Case**: Manual admin operations

### **Cron Scheduler** (New)
- **Purpose**: Refresh ALL upcoming matches for freshness
- **Query**: `matchId: { not: null } AND isPredictionActive: true AND matchData.date >= now()`
- **Use Case**: Automated freshness maintenance for upcoming matches only
- **Schedule**: Every 30 minutes

## Key Differences

| Feature | Manual Smart Button | Cron Scheduler |
|---------|-------------------|----------------|
| **Scope** | Pending matches only | ALL upcoming matches |
| **Purpose** | New predictions | Freshness maintenance |
| **Frequency** | On-demand | Every 30 minutes |
| **Authentication** | Admin session | Cron secret |
| **Logging** | Manual enrichment | Cron enrichment |

## Expected Results

With cron running every 30 minutes:

1. **Fresh Data**: All matches get updated predictions
2. **Complete Coverage**: No stale predictions
3. **Automatic Maintenance**: No manual intervention needed
4. **Quality Assurance**: Full analysis data maintained

## Testing

Test the cron endpoint manually:

```bash
curl -X GET "https://your-domain.com/api/admin/predictions/enrich-scheduled" \
  -H "Authorization: Bearer 749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb"
```

## Monitoring

Check Vercel function logs for:
- `🕐 CRON: Starting scheduled enrichment`
- `✅ CRON: Scheduled enrichment completed`
- Error logs if issues occur
