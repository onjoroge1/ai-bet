# League Management System

## Overview

The League Management System provides comprehensive control over which leagues to collect data from, how frequently to sync, and how to prioritize data collection. This system allows administrators to efficiently manage multiple leagues without manual intervention.

## Features

### 🎯 **Data Collection Control**
- Enable/disable data collection per league
- Set collection priorities (higher numbers = higher priority)
- Configure sync frequencies (hourly, daily, weekly)
- Set match limits per sync operation

### 🔄 **Sync Management**
- Manual sync triggers
- Connection testing
- Real-time sync status monitoring
- Automatic sync health tracking

### 📊 **Analytics & Monitoring**
- League performance statistics
- Sync success/failure tracking
- Match and team counts
- Prediction accuracy metrics

### 🛠️ **Admin Interface**
- Full CRUD operations for leagues
- Bulk operations support
- Real-time status indicators
- Search and filtering capabilities

## Database Schema

### Enhanced League Table

```sql
League {
  id: string PK
  name: string unique
  countryCode: string?
  sport: string default "football"
  isActive: boolean default true
  logoUrl: string?
  
  -- Data Collection Fields
  externalLeagueId: string?  -- External API league ID
  isDataCollectionEnabled: boolean default true
  dataCollectionPriority: integer default 0
  lastDataSync: timestamp?
  syncFrequency: string default "daily"
  matchLimit: integer default 10
  isPredictionEnabled: boolean default true
  
  -- Timestamps
  createdAt: timestamp default now()
  updatedAt: timestamp updated on change
  
  -- Relations
  matches: Match[]
  teams: Team[]
}
```

## API Endpoints

### Core League Management
- `GET /api/admin/leagues` - List all leagues
- `POST /api/admin/leagues` - Create new league
- `PUT /api/admin/leagues` - Update league
- `DELETE /api/admin/leagues?id={id}` - Delete league

### Sync Operations
- `GET /api/admin/leagues/{id}/sync` - Test connection
- `POST /api/admin/leagues/{id}/sync` - Manual sync
- `GET /api/admin/leagues/{id}/stats` - Get league statistics

## Usage Examples

### Adding a New League

1. Navigate to Admin Panel → League Management
2. Click "Add League"
3. Fill in the required fields:
   - **League Name**: "Premier League"
   - **Country Code**: "EN"
   - **External League ID**: "39" (from your data provider)
   - **Data Collection Priority**: 10 (highest priority)
   - **Sync Frequency**: "daily"
   - **Match Limit**: 20

### Managing Data Collection

#### Enable/Disable Collection
```typescript
// Via API
await fetch('/api/admin/leagues', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'league-id',
    isDataCollectionEnabled: false
  })
})
```

#### Set Priority
```typescript
// Higher priority = collected first
await fetch('/api/admin/leagues', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'league-id',
    dataCollectionPriority: 15
  })
})
```

### Manual Sync Operations

#### Test Connection
```typescript
const response = await fetch('/api/admin/leagues/{id}/sync')
const result = await response.json()
// Returns connection status and test results
```

#### Trigger Manual Sync
```typescript
const response = await fetch('/api/admin/leagues/{id}/sync', {
  method: 'POST'
})
const result = await response.json()
// Returns sync results and match count
```

## Integration with Existing APIs

### Enhanced Upcoming Matches API

The existing `/api/predictions/upcoming` endpoint now respects league settings:

```typescript
// Only returns matches from leagues with data collection enabled
const response = await fetch('/api/predictions/upcoming?league_id=39')
```

### Prediction API Integration

The `/api/predictions/predictions-with-matchid` endpoint checks league settings:

```typescript
// Only processes predictions for enabled leagues
const response = await fetch('/api/predictions/predictions-with-matchid?match_id=123')
```

## Sync Health Monitoring

### Health Status Indicators

- 🟢 **Healthy**: Last sync within expected timeframe
- 🟡 **Warning**: Last sync approaching limit
- 🔴 **Critical**: Last sync overdue
- ⚪ **Unknown**: No sync data available

### Sync Frequency Thresholds

- **Hourly**: Healthy ≤ 1h, Warning ≤ 2h, Critical > 2h
- **Daily**: Healthy ≤ 24h, Warning ≤ 48h, Critical > 48h  
- **Weekly**: Healthy ≤ 168h, Warning ≤ 336h, Critical > 336h

## Best Practices

### 1. **Priority Management**
- Set high priorities (8-10) for major leagues
- Medium priorities (4-7) for secondary leagues
- Low priorities (1-3) for minor leagues

### 2. **Sync Frequency**
- Use "daily" for most leagues
- Use "hourly" only for high-priority, active leagues
- Use "weekly" for minor or inactive leagues

### 3. **Match Limits**
- Set higher limits (15-20) for major leagues
- Lower limits (5-10) for minor leagues
- Consider API rate limits when setting limits

### 4. **Monitoring**
- Regularly check sync health indicators
- Monitor failed sync attempts
- Review league statistics periodically

## Troubleshooting

### Common Issues

#### Sync Failures
1. Check external league ID is correct
2. Verify API credentials are valid
3. Check network connectivity
4. Review API rate limits

#### Data Not Appearing
1. Ensure league is active
2. Verify data collection is enabled
3. Check prediction settings
4. Review sync frequency settings

#### Performance Issues
1. Reduce match limits
2. Lower sync frequency
3. Adjust collection priorities
4. Monitor API response times

### Debug Commands

```bash
# Test league connection
curl -X GET "http://localhost:3000/api/admin/leagues/{id}/sync"

# Manual sync
curl -X POST "http://localhost:3000/api/admin/leagues/{id}/sync"

# Get league stats
curl -X GET "http://localhost:3000/api/admin/leagues/{id}/stats"
```

## Migration Guide

### From Existing System

1. **Database Migration**: Run the provided migration
2. **Update Existing Leagues**: Set appropriate external IDs
3. **Configure Priorities**: Set collection priorities
4. **Test Connections**: Verify all leagues can connect
5. **Monitor**: Watch sync health indicators

### Sample Migration Script

```typescript
// Update existing leagues with external IDs
const leagues = await prisma.league.findMany()
for (const league of leagues) {
  await prisma.league.update({
    where: { id: league.id },
    data: {
      externalLeagueId: getExternalId(league.name),
      isDataCollectionEnabled: true,
      dataCollectionPriority: getPriority(league.name),
      syncFrequency: 'daily',
      matchLimit: 10
    }
  })
}
```

## Future Enhancements

### Planned Features
- **Automated Sync Scheduling**: Cron-based sync jobs
- **Advanced Analytics**: Detailed performance metrics
- **Bulk Operations**: Mass enable/disable leagues
- **API Rate Limiting**: Intelligent request throttling
- **Webhook Integration**: Real-time sync notifications

### Integration Opportunities
- **Monitoring Systems**: Prometheus/Grafana integration
- **Alert Systems**: Slack/Email notifications
- **Backup Systems**: Automated data backups
- **Analytics Platforms**: Enhanced reporting

---

## Support

For questions or issues with the League Management System:

1. Check the troubleshooting section above
2. Review API documentation
3. Check server logs for detailed error messages
4. Contact the development team

**Last Updated**: December 2024
**Version**: 1.0.0 