# Twitter Template Selection & Preview

## How Template Selection Works

### Current Implementation (Random Selection)

**Location**: `lib/social/twitter-generator.ts` (line 122)

The system uses **random selection** to choose templates:

```typescript
// Filter templates based on available data
let availableTemplates = this.matchTemplates.filter(
  t => !t.requiresConfidence || matchData.aiConf !== undefined
)

// Randomly select a template
const template = availableTemplates[Math.floor(Math.random() * availableTemplates.length)]
```

**How it works:**
1. Filters available templates based on data (e.g., if confidence score is needed)
2. Randomly picks one template from the available pool
3. Replaces template variables with actual data
4. Returns the generated post

**Available Templates for Matches:**
- Template 1: AI Confidence Hook (requires confidence score)
- Template 2: Market vs AI Angle
- Template 3: Neutral Preview
- Template 4: Value Framing
- Template 5: Short & Direct
- Template 6: Update Signal
- Template 8: Pattern Teaser
- Template 9: Live AI Signal
- Template 12: Ultra-Minimal

**Template Selection Logic:**
- If match has confidence score → All 9 templates available
- If match has no confidence score → 8 templates available (excludes Template 1)

---

## Preview Feature

### How to Preview Generated Posts

**New Feature**: Preview before scheduling!

1. **Preview Button**: Click "Preview" button next to any match/parlay
2. **Preview Dialog**: See the generated post content, template ID, and character count
3. **Schedule**: Click "Schedule" button to save and schedule the post

### Preview API Endpoint

**Endpoint**: `POST /api/admin/social/twitter/preview`

**Request:**
```json
{
  "action": "generate_match" | "generate_parlay",
  "matchId": "string" (for matches),
  "parlayId": "string" (for parlays)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Preview generated",
  "data": {
    "content": "Generated post text...",
    "url": "https://snapbet.ai/match/...",
    "templateId": "1",
    "postType": "match"
  }
}
```

---

## Viewing Generated Posts

### 1. **Scheduled Posts Tab**

After generating a post, view it in the "Scheduled Posts" tab:
- See post content
- View template ID
- Check status (scheduled, posted, failed)
- See scheduled/posted timestamps
- View URLs

### 2. **Preview Dialog** (Before Scheduling)

When you click "Preview":
- See the exact content that will be posted
- View which template was selected (random)
- Check character count
- Review the URL that will be included
- Option to cancel or close

---

## Template Selection Details

### Match Templates

All templates are stored in `lib/social/twitter-generator.ts`:

```typescript
private static matchTemplates = [
  { id: '1', content: '...', requiresConfidence: true },
  { id: '2', content: '...', requiresConfidence: false },
  // ... etc
]
```

**Selection Process:**
1. Start with all match templates
2. Filter based on available data:
   - If `requiresConfidence: true` → Only include if `matchData.aiConf` exists
   - Otherwise → Always available
3. Random selection from filtered list
4. Replace variables: `{TEAM_A}`, `{TEAM_B}`, `{LEAGUE}`, `{AI_CONF}`, `{MATCH_URL}`

### Parlay Templates

Only 1 template available:
- Template 7: Parlay Teaser

**Selection**: Always uses Template 7 (no random selection needed)

---

## Future Enhancement Options

If you want more control over template selection:

1. **Template Weighting**: Assign weights to templates (some more likely)
2. **Template Rotation**: Cycle through templates instead of random
3. **Template Selection Rules**: 
   - Use Template 1 for high confidence (>70%)
   - Use Template 2 if market odds differ significantly
   - Use Template 6 for updated predictions
   - etc.
4. **Manual Template Selection**: Allow admin to choose specific template

---

## Current Workflow

1. **Admin views matches/parlays** in Social Automation page
2. **Clicks "Preview"** → See generated post with random template
3. **Reviews content** → Check template, character count, URL
4. **Clicks "Schedule"** → Saves post to database (status: scheduled)
5. **Cron job posts** → Posting cron picks up scheduled posts and posts to Twitter
6. **View in "Scheduled Posts" tab** → See all scheduled/posted posts

---

## Character Limit Handling

- **Twitter limit**: 280 characters
- **URLs count as**: ~23 characters (Twitter auto-shortens)
- **System handles**: Automatically truncates if needed, preserves URL

**Example:**
```
Content: 250 chars
URL: 23 chars (counted)
Total: 273 chars ✅ (within limit)

If content > 257 chars → Truncates content, keeps URL
```

