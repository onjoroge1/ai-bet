# 🕐 Smart Cron Schedule Design

## 📊 **Dynamic Scheduling Based on Match Timing**

### **Schedule Logic**

| Match Timing | Frequency | Schedule | Reason |
|-------------|-----------|----------|---------|
| **Weekend Peak** (Sat-Sun, 6AM-10PM) | Every 30 minutes | `*/30 * * * *` | High match volume, frequent updates needed |
| **Weekday Peak** (Mon-Fri, 6AM-10PM) | Every 2 hours | `0 */2 * * *` | Regular match volume, moderate updates |
| **Off-Peak** (All days, 10PM-6AM) | Every 6 hours | `0 */6 * * *` | Low match volume, minimal updates needed |

### **Alternative: Match Proximity-Based Schedule**

| Match Proximity | Frequency | Schedule | Reason |
|----------------|-----------|----------|---------|
| **T-24h to T-6h** | Every 30 minutes | `*/30 * * * *` | Critical period, frequent updates |
| **T-72h to T-24h** | Every 2 hours | `0 */2 * * *` | Important period, regular updates |
| **T-168h to T-72h** | Every 6 hours | `0 */6 * * *` | Early period, minimal updates |
| **T-168h+** | Every 12 hours | `0 */12 * * *` | Very early, minimal updates |

## 🚀 **Recommended Implementation**

### **Option 1: Time-Based Schedule (Simpler)**
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

### **Option 2: Multiple Cron Jobs (More Flexible)**
```json
{
  "crons": [
    {
      "path": "/api/admin/predictions/enrich-scheduled?frequency=high",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/admin/predictions/enrich-scheduled?frequency=medium", 
      "schedule": "0 */2 * * *"
    },
    {
      "path": "/api/admin/predictions/enrich-scheduled?frequency=low",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

### **Option 3: Smart Single Cron (Recommended)**
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

## 🎯 **Smart Cron Endpoint Logic**

The cron endpoint will determine the appropriate processing frequency based on:

1. **Current time and day**
2. **Match proximity to kickoff**
3. **Match volume in database**

### **Processing Logic**

```typescript
// Inside the cron endpoint
const getProcessingFrequency = () => {
  const now = new Date()
  const hour = now.getHours()
  const day = now.getDay()
  
  // Weekend peak hours
  if ((day === 0 || day === 6) && hour >= 6 && hour <= 22) {
    return 'high' // Process all matches
  }
  
  // Weekday peak hours  
  if (hour >= 6 && hour <= 22) {
    return 'medium' // Process matches within 72h
  }
  
  // Off-peak hours
  return 'low' // Process matches within 24h
}
```

## 📈 **Expected Benefits**

### **Performance Optimization**
- **Reduced API calls** during off-peak hours
- **Focused processing** on relevant matches
- **Better resource utilization**

### **Data Freshness**
- **High frequency** for critical matches (T-24h)
- **Moderate frequency** for important matches (T-72h)
- **Low frequency** for early matches (T-168h+)

### **Cost Efficiency**
- **Fewer unnecessary API calls**
- **Reduced backend load**
- **Optimized database queries**

## 🔧 **Implementation Steps**

1. **Update cron endpoint** with smart processing logic
2. **Configure Vercel cron** with appropriate schedule
3. **Test different frequencies** in development
4. **Monitor performance** in production
5. **Adjust schedule** based on real-world usage

## 📊 **Monitoring & Metrics**

Track these metrics to optimize the schedule:
- **API call frequency** by time of day
- **Match processing success rate**
- **Data freshness** by match proximity
- **Backend response times**
- **Database query performance**
