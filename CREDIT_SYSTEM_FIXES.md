# Credit System Fixes - December 2024

## Issues Identified

### Issue 1: Direct Credits vs Current Credits Mismatch
- **Problem**: When purchasing a tip, the system was deducting from `directCredits` (User.predictionCredits) instead of the unified `currentCredits` system
- **Impact**: Users saw their directCredits decrease but currentCredits remained unchanged, causing confusion

### Issue 2: Notifications Using Direct Credits
- **Problem**: Notifications were referencing `directCredits` instead of the unified `currentCredits` system
- **Impact**: Inconsistent credit display between notifications and dashboard

## Fixes Implemented

### 1. Updated Claim-Tip API (`/api/credits/claim-tip`)

**Before**: Deducted directly from `User.predictionCredits`
```typescript
const updatedUser = await tx.user.update({
  where: { id: userId },
  data: {
    predictionCredits: {
      decrement: 1
    }
  }
});
```

**After**: Uses unified credit system with priority order
```typescript
// Priority 1: Package Credits
if (packageCreditsCount > 0) {
  await tx.userPackage.update({
    where: { id: packageToUse.id },
    data: {
      tipsRemaining: { decrement: 1 }
    }
  });
  creditDeductionSource = 'package';
}
// Priority 2: Quiz Credits  
else if (quizCreditsCount > 0 && userPoints) {
  await tx.userPoints.update({
    where: { userId },
    data: {
      points: { decrement: 50 } // 50 points = 1 credit
    }
  });
  creditDeductionSource = 'quiz';
}
// Priority 3: Direct Credits (fallback)
else {
  await tx.user.update({
    where: { id: userId },
    data: {
      predictionCredits: { decrement: 1 }
    }
  });
  creditDeductionSource = 'direct';
}
```

### 2. Enhanced Response Data

**New Response Fields**:
- `creditDeductionSource`: Indicates which credit source was used ('package', 'quiz', or 'direct')
- `creditBreakdown`: Detailed breakdown of remaining credits by type
- `remainingCredits`: Accurate count based on deduction source

**Example Response**:
```json
{
  "success": true,
  "data": {
    "creditsSpent": 1,
    "remainingCredits": 7,
    "creditDeductionSource": "package",
    "creditBreakdown": {
      "packageCredits": 6,
      "quizCredits": 1,
      "totalCredits": 7,
      "hasUnlimited": false
    }
  }
}
```

### 3. Updated Notification System

**Before**: Used static credit calculation
**After**: Calculates remaining credits based on actual deduction source

```typescript
// Recalculates credits after deduction based on source
if (result.creditDeductionSource === 'package') {
  // Recalculate package credits after deduction
  const updatedUserPackages = await prisma.userPackage.findMany({...});
  // Calculate remaining credits...
} else if (result.creditDeductionSource === 'quiz') {
  // Recalculate quiz credits after deduction
  const updatedUserPoints = await prisma.userPoints.findUnique({...});
  // Calculate remaining credits...
} else {
  // Direct credits were used
  remainingCredits = result.user?.predictionCredits || 0;
}
```

### 4. Transaction Safety

**Database Transaction**: All credit deductions are wrapped in a database transaction to ensure data consistency across multiple credit sources.

## Credit Priority System

1. **Package Credits** (Highest Priority)
   - Source: `UserPackage.tipsRemaining`
   - Used first when available
   - Deducts from packages with earliest expiration

2. **Quiz Credits** (Medium Priority)
   - Source: `UserPoints.points / 50`
   - Used when no package credits available
   - Deducts 50 points per credit

3. **Direct Credits** (Fallback)
   - Source: `User.predictionCredits`
   - Used only when no unified credits available
   - Legacy system for backward compatibility

## Testing Recommendations

1. **Test Credit Priority**: Verify that package credits are used before quiz credits
2. **Test Fallback**: Ensure direct credits are used when no unified credits available
3. **Test Notifications**: Verify notification shows correct remaining credits
4. **Test Dashboard**: Confirm dashboard displays accurate credit counts
5. **Test Edge Cases**: Test with unlimited packages, zero credits, etc.

## Files Modified

- `app/api/credits/claim-tip/route.ts` - Main credit deduction logic
- `docs/CREDIT_SYSTEM.md` - Updated documentation
- `CREDIT_SYSTEM_FIXES.md` - This summary document

## Impact

- ✅ **Fixed**: Credit deduction now uses unified system
- ✅ **Fixed**: Notifications show accurate remaining credits
- ✅ **Improved**: Better user experience with consistent credit display
- ✅ **Enhanced**: Transaction safety for multi-source credit deductions
- ✅ **Documented**: Clear priority system and fallback behavior 