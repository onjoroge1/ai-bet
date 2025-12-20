# Parlays Legs Database Fix

## 🐛 **CRITICAL BUG FIXED**

### **Problem:**
Legs were NOT being saved to the database because we were using the wrong ID reference.

### **Root Cause:**
- `ParlayLeg.parlayId` field references `ParlayConsensus.id` (internal Prisma ID)
- We were incorrectly using `parlay.parlay_id` (backend UUID) when creating legs
- This caused foreign key constraint failures (silently caught)

### **Solution:**
1. **Get Internal Prisma ID**: After upserting `ParlayConsensus`, capture the returned `id` field
2. **Use Internal ID for Legs**: Use `parlayConsensus.id` (not `parlay.parlay_id`) when creating `ParlayLeg` records

### **Files Fixed:**
1. ✅ `app/api/parlays/route.ts` - Main sync endpoint
2. ✅ `app/api/admin/parlays/sync-scheduled/route.ts` - Scheduled sync endpoint

### **Changes Made:**

**Before (WRONG):**
```typescript
await prisma.parlayConsensus.upsert({...})
await prisma.parlayLeg.create({
  data: {
    parlayId: parlay.parlay_id, // ❌ WRONG - This is backend UUID
    ...
  }
})
```

**After (CORRECT):**
```typescript
const parlayConsensus = await prisma.parlayConsensus.upsert({...})
const parlayConsensusId = parlayConsensus.id // ✅ Get internal Prisma ID

await prisma.parlayLeg.create({
  data: {
    parlayId: parlayConsensusId, // ✅ CORRECT - This is internal Prisma ID
    ...
  }
})
```

### **Database Schema Reference:**
```prisma
model ParlayConsensus {
  id        String   @id @default(cuid())  // ← Internal Prisma ID
  parlayId  String   @unique              // ← Backend UUID
  legs      ParlayLeg[]
}

model ParlayLeg {
  parlayId  String  // ← References ParlayConsensus.id (NOT parlayId!)
  parlay    ParlayConsensus @relation(fields: [parlayId], references: [id])
}
```

### **Verification:**
After syncing, legs should now be properly saved and retrievable:
- ✅ Legs are saved with correct foreign key reference
- ✅ Legs are retrieved when querying parlays
- ✅ No mock/hardcoded data - all from API

---

**Status**: ✅ **FIXED**  
**Date**: December 12, 2025  
**Priority**: CRITICAL - Legs are the most important part of parlays!

