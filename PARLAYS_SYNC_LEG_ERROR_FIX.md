# 🔧 Parlays Sync Leg Creation Error Fix

**Issue**: Legs are failing to be created during parlay sync from backend APIs.

**Error**: "Failed to create any legs for parlay {parlay_id}"

**Root Cause Investigation**:
1. ✅ Added detailed error logging to capture individual leg creation errors
2. ✅ Added type information to debug type conversion issues
3. ✅ Ensured Decimal fields are properly converted (Prisma Decimal accepts numbers/strings)

**Changes Made**:
1. **Enhanced Error Logging** (line 377-404):
   - Added detailed sample leg data to error logs
   - Includes type information for all fields
   - Shows all leg data to help identify missing/invalid values

2. **Decimal Field Conversion** (line 333-335):
   - Explicitly convert to Number() for Decimal fields
   - Prisma Decimal fields accept numbers or strings
   - Ensures proper type handling

**Next Steps for Debugging**:
1. Run sync again and check logs for individual leg error messages (should appear before final error)
2. Look for error messages starting with "❌ Error creating leg"
3. Check the `legData` and `error` fields in those logs to identify the specific issue
4. Common issues to check:
   - Missing or null values in backend API response
   - Type mismatches
   - Foreign key constraint violations
   - Database connection issues

**Files Modified**:
- `app/api/parlays/route.ts` - Enhanced error logging and Decimal conversion

**Status**: ⏳ **Awaiting test results to identify specific error**

