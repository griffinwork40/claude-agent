# Activity Feed - Cursor-Style Refactor

**Status:** ✅ IMPLEMENTED (October 11, 2025)  
**See:** `CURSOR_STYLE_ACTIVITY_FEED.md` for full implementation details

## Overview
Refactor activity cards to match Cursor's clean, borderless design. Remove heavy styling (backgrounds, borders, boxes) and create a lightweight inline display that blends seamlessly with messages.

## Current Problems
- Colored backgrounds and borders are too heavy/distracting
- Box-style cards compete with messages for attention
- Activities still showing as empty colored lines
- Overall visual weight is too high

## Cursor's Design Pattern
Looking at the reference screenshot:
- **No borders or backgrounds** - completely transparent/flat
- **Simple inline layout** - icon, text, timestamp on one line
- **Subtle colors** - muted icon colors (not bright)
- **Minimal spacing** - compact vertical spacing
- **Clean expandable** - simple "Show details" text instead of obvious chevron
- **Blends with chat** - doesn't stand out more than messages

## Implementation Plan

### 1. Redesign ActivityCard Component

**File**: `components/agents/ChatPane.tsx`

Remove the card/box styling entirely:
```typescript
// OLD (current):
<div className="my-3 rounded-lg border bg-blue-50 border-blue-200">
  <button className="w-full px-4 py-3">...</button>
</div>

// NEW (Cursor-style):
<div className="my-1.5 py-1">
  <div className="flex items-center gap-2">...</div>
</div>
```

**Changes**:
- Remove: `rounded-lg`, `border`, `bgColor`, `borderColor`
- Remove: button wrapper (use div with optional onClick)
- Remove: padding/spacing (use minimal `py-1`)
- Add: simple flex layout for icon + text + timestamp

### 2. Simplify Color Palette

**File**: `components/agents/ChatPane.tsx` - `getActivityIcon()`

Use more muted, subtle colors:
```typescript
// OLD: Bright colors
text-blue-600, text-green-600, text-red-600

// NEW: Muted colors  
text-blue-400/70, text-green-500/60, text-red-400/70, text-gray-400
```

**Rationale**: Cursor uses very subtle colors that don't compete with message text

### 3. Flatten the Layout

**New structure**:
```
[Icon] Activity Title                                    Timestamp
       ↓ Show details (if expandable)
       [Details content when expanded]
```

**Changes**:
- Single line for collapsed state
- Icon + text inline (no separate containers)
- Timestamp right-aligned
- "Show details" appears below on hover/when expandable
- No button styling, no hover backgrounds

### 4. Update Expandable Behavior

**Changes**:
- Remove ChevronRight rotating icon
- Use simple text: "Show details" / "Hide details"
- Only show on hover or when already expanded
- Details appear with minimal styling (just indented text)
- No background boxes for JSON - just gray monospace text

### 5. Reduce Visual Weight

**Specific changes**:
- Font size: `text-xs` for activity text (smaller than messages)
- Icon size: `14px` (smaller, more subtle)
- Spacing: `my-1.5` instead of `my-3`
- Colors: Use `/70` or `/60` opacity for all colors
- Remove: All hover states, backgrounds, borders

### 6. Handle "thinking" and "status" Types

These are even more subtle in Cursor:
- No icon, just gray text
- Even smaller font (`text-[11px]`)
- Very minimal spacing

### 7. Fix Empty Activity Bug

While refactoring, ensure:
- All activities have proper content
- Validation still skips truly empty activities
- Console logging remains for debugging
- Activities render correctly throughout tool execution

## Files to Modify

1. **`components/agents/ChatPane.tsx`**
   - Redesign `ActivityCard` component
   - Update `getActivityIcon()` color palette
   - Simplify layout and remove all card styling
   - Change expandable mechanism

2. **No other files needed** - this is purely a styling refactor

## Design Specifications

### Collapsed Activity
```
[🔧] Starting search jobs google              2:14 PM
```
- Icon: 14px, muted color with opacity
- Text: text-xs, text-[var(--fg)]/70
- Timestamp: text-xs, text-[var(--fg)]/40, right-aligned
- No background, no border, no hover effect

### Expanded Activity
```
[🔧] Starting search jobs google              2:14 PM
     ▼ Hide details
     { keywords: "line cook", location: "..." }
```
- Details: Indented, text-[11px], font-mono
- Gray text on transparent background
- Simple JSON formatting, no syntax highlighting needed

### Color Palette
- Tool icons: `text-blue-400/60`
- Success: `text-green-500/60`  
- Error: `text-red-400/70`
- Thinking: `text-gray-400`
- Executing: `text-amber-400/60`

## Testing Checklist
- [x] Activities appear inline with messages
- [x] No colored backgrounds or borders
- [x] Icons are subtle and muted
- [x] Text is smaller than message text
- [x] Expandable details work smoothly
- [x] No empty colored lines appear
- [x] Visual weight is minimal
- [x] Looks similar to Cursor's implementation

## Implementation Complete ✅

All visual refinements have been implemented in `components/agents/ChatPane.tsx`:
- Stripped card styling (borders, backgrounds, padding)
- Reduced spacing to `my-1 py-0.5`
- Muted colors with opacity (e.g., `text-blue-400/60`)
- Smaller fonts (`text-xs` → `text-[11px]` for subtle types)
- Icon size 14px with strokeWeight 1.5
- Progressive disclosure ("Show details" on hover)
- ARIA attributes for accessibility
- Fade-in animations for expanded details

See `CURSOR_STYLE_ACTIVITY_FEED.md` for full documentation.

