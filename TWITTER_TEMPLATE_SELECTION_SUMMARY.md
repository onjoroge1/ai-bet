# Twitter Template Selection - Implementation Summary

## ✅ Completed

1. **Updated Templates** (`lib/social/twitter-generator.ts`)
   - All 12 templates from your specification are now defined
   - Templates organized by category (Blog Summary, Upcoming Match, Live Analysis, Parlay, Brand)
   - Each template has: id, name, category, content, requirements

2. **Updated Generator Methods**
   - `generateMatchPost()` now accepts optional `templateId` parameter
   - `generateParlayPost()` now accepts optional `templateId` parameter
   - Uses new template structure instead of old arrays

3. **New API Endpoint**
   - `/api/admin/social/twitter/templates` - Returns available templates for a post type

## 🔧 Still Needed

### 1. Fix Broken Code in UI (`app/admin/social-automation/page.tsx`)
The `handleGenerateMatchPost` function has duplicate/broken code that needs to be cleaned up.

### 2. Add Template Selection Dropdown
For each match/parlay, add a dropdown to select which template to use:
- Filter templates based on match data (e.g., confidence score)
- Show template name and category
- Store selected template in state

### 3. Update Preview/Schedule Flow
- Preview button should require template selection
- Preview should use selected template
- Schedule should use selected template from preview

## Template IDs Reference

### Match Templates
- `ai-confidence` - Requires confidence score
- `ai-vs-market`
- `neutral-preview`
- `value-signal`
- `minimal`
- `fixture-alert` - No link
- `league-focus` - No link
- `live-momentum` - Requires live data
- `live-observations` - Requires live data

### Parlay Templates
- `daily-parlay`

### Brand Templates
- `brand-authority` - No link
- `brand-educational` - No link

## Next Steps

1. Clean up broken code in social-automation page
2. Add template dropdown component to UI
3. Wire up template selection to preview/schedule handlers
4. Test the full flow

