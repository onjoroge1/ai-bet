# 🔍 Parlays Sync Debugging - Leg Creation Failures

**Issue**: Legs are failing to be created during parlay sync. Error shows "Failed to create any legs" but individual leg errors are not visible in the terminal output.

**Error Location**: `app/api/parlays/route.ts` line 378

**Current Error Handling**:
- Individual leg errors are caught and logged (line 354-369)
- Final error logged when no legs created (line 378-381)
- But error details are not included in the final error message

**Next Steps**:
1. Check terminal logs for individual leg error messages (should appear before line 755)
2. Verify backend API response structure matches expected interface
3. Check for type mismatches (Decimal vs Number)
4. Add more detailed error logging to final error message

**Potential Issues**:
- Missing or null values in backend API response
- Type conversion issues (e.g., Decimal fields expecting strings)
- Foreign key constraint violations (unlikely - we're using internal ID correctly)
- Database schema mismatch

