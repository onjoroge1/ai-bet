# Empty Table Fix - Homepage Upcoming Matches

**Date**: January 3, 2026  
**Status**: ✅ **FIXED**

---

## 🐛 **Issue**

When a day (e.g., "Tomorrow") has no matches in the upcoming matches table, the entire table would break/crash instead of showing an empty state.

---

## ✅ **Fix Applied**

### **Changes Made**:

1. **Always Show Sections**: Removed conditional rendering for individual day sections (Today, Tomorrow, Other Upcoming)
   - **Before**: Sections only showed if they had matches
   - **After**: Sections always show, even if empty

2. **Empty State in Table**: Added empty state handling in `MatchTable` component
   - **Before**: Table would break if `matches` array was empty
   - **After**: Shows "No matches scheduled" message in table when empty

3. **Always Show Card**: Removed condition that hid entire "Upcoming Matches" card
   - **Before**: Card only showed if at least one section had matches
   - **After**: Card always shows (consistent UI)

---

## 📋 **Code Changes**

### **1. Removed Conditional Rendering for Sections**

**Before**:
```typescript
{upcomingGrouped.today.length > 0 && (
  <div className="mb-8">
    <h3>Today</h3>
    <MatchTable matches={upcomingGrouped.today} isLive={false} />
  </div>
)}
```

**After**:
```typescript
<div className="mb-8">
  <h3>Today</h3>
  <MatchTable matches={upcomingGrouped.today} isLive={false} />
</div>
```

---

### **2. Added Empty State in MatchTable**

**Before**:
```typescript
<tbody>
  {matches.map((match) => (
    <tr>...</tr>
  ))}
</tbody>
```

**After**:
```typescript
<tbody>
  {matches.length === 0 ? (
    <tr>
      <td colSpan={5} className="py-8 px-4 text-center text-slate-400">
        No matches scheduled
      </td>
    </tr>
  ) : (
    matches.map((match) => (
      <tr>...</tr>
    ))
  )}
</tbody>
```

---

### **3. Always Show Upcoming Matches Card**

**Before**:
```typescript
{(upcomingGrouped.today.length > 0 ||
  upcomingGrouped.tomorrow.length > 0 ||
  upcomingGrouped.upcoming.length > 0) && (
  <Card>...</Card>
)}
```

**After**:
```typescript
<Card>
  {/* Always show, even if all sections are empty */}
</Card>
```

---

## ✅ **Result**

### **Before Fix**:
- ❌ Table breaks when a day has no matches
- ❌ Entire section disappears
- ❌ Poor user experience

### **After Fix**:
- ✅ Table always shows with headers
- ✅ Empty state message: "No matches scheduled"
- ✅ Consistent UI structure
- ✅ No crashes or errors

---

## 🎯 **Behavior**

### **Scenario 1: All Days Have Matches**
- ✅ Shows all sections with matches
- ✅ Normal table display

### **Scenario 2: Tomorrow Has No Matches**
- ✅ Shows "Today" section with matches
- ✅ Shows "Tomorrow" section with empty state
- ✅ Shows "Other Upcoming" section with matches
- ✅ No crashes

### **Scenario 3: All Days Are Empty**
- ✅ Shows all sections with empty states
- ✅ Card still displays
- ✅ Consistent structure

---

## 📝 **User Experience**

**Empty State Display**:
- Table headers always visible
- "No matches scheduled" message in table body
- Consistent spacing and styling
- No broken UI or errors

---

**Status**: ✅ **FIXED**  
**Impact**: Better UX, no crashes when days have no matches

