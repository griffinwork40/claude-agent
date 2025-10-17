# Interleaved Chat Fix V2 - Accumulated Text Approach

## Problem Identified

The initial implementation (V1) created a separate `text_chunk` activity for each streaming chunk event. This caused:
- Word-by-word splitting where each tiny chunk became its own activity
- Duplicate text rendering due to many small activities not being properly grouped
- "Crazy" text display as reported by user

## Root Cause

SSE streams send very small chunks (sometimes single words or punctuation). Creating individual activities for each chunk resulted in:
1. Hundreds of tiny activities with microsecond timestamp differences
2. Timeline sorting couldn't properly group them as "consecutive"
3. Rendering logic tried to group them but timing issues caused duplicates

## Solution: Accumulated Text with Flush on Tool Events

Instead of creating a new activity for each chunk, we:
1. **Accumulate** all text chunks into a single buffer
2. **Update** a single `text_chunk` activity with the accumulated text
3. **Flush** and start a new text segment when a tool event occurs

This provides proper interleaving (text → tool → text) without word splitting.

## Implementation Changes

### 1. Added Accumulation State (Lines 480-483)

```typescript
// Track accumulated text chunks for proper interleaving
const accumulatedTextRef = useRef<string>('');
const lastTextChunkIdRef = useRef<string | null>(null);
```

**Why refs?** 
- Updates don't trigger re-renders
- Values persist across event handler calls
- Fast updates during streaming

### 2. Updated Chunk Handler (Lines 865-895)

**Before (V1):**
```typescript
// Created a NEW activity for EVERY chunk
const chunkActivity: Activity = {
  id: `chunk-${Date.now()}-${Math.random()}`, // New ID each time
  content: data.content, // Single chunk only
  // ...
};
```

**After (V2):**
```typescript
// Accumulate text content
accumulatedTextRef.current += data.content;

// Create or UPDATE a single text_chunk activity
const chunkId = lastTextChunkIdRef.current || `chunk-${Date.now()}-${Math.random()}`;
if (!lastTextChunkIdRef.current) {
  lastTextChunkIdRef.current = chunkId;
}

const chunkActivity: Activity = {
  id: chunkId, // SAME ID - updates existing activity
  content: accumulatedTextRef.current, // ALL accumulated text
  // ...
};

// Update replaces previous version in Map
setActivitiesMap(prev => {
  const next = new Map(prev);
  next.set(chunkId, chunkActivity); // Overwrites with accumulated version
  return next;
});
```

**Result:** Only ONE text_chunk activity exists at a time, containing all accumulated text.

### 3. Flush on Tool Events (Lines 943-948)

```typescript
} else if (
  data.type === 'tool_start' || 
  data.type === 'tool_params' || 
  // ... other tool/status events
) {
  // When a tool event occurs, flush the accumulated text
  // This creates proper interleaving: text -> tool -> text
  if (accumulatedTextRef.current && lastTextChunkIdRef.current) {
    // Text is already in activities map, just reset for next segment
    accumulatedTextRef.current = '';
    lastTextChunkIdRef.current = null;
  }
  
  // Then add the tool activity...
}
```

**How it works:**
1. LLM streams text → accumulates in single activity
2. Tool event arrives → flush (reset refs), add tool activity
3. LLM streams more text → new accumulated activity starts
4. Timeline shows: [text_chunk] → [tool] → [text_chunk]

### 4. Reset on Stream Complete/Error (Lines 903, 919, 932)

```typescript
// Reset accumulated text refs
accumulatedTextRef.current = '';
lastTextChunkIdRef.current = null;
```

Ensures clean state for next conversation turn.

## How It Works Now

### Event Sequence Example

```
1. chunk: "I'll search"
   → accumulatedTextRef = "I'll search"
   → activity-123: {content: "I'll search"}

2. chunk: " for jobs"
   → accumulatedTextRef = "I'll search for jobs"
   → activity-123: {content: "I'll search for jobs"} // UPDATES same activity

3. chunk: "..."
   → accumulatedTextRef = "I'll search for jobs..."
   → activity-123: {content: "I'll search for jobs..."} // UPDATES again

4. tool_start: search_jobs_linkedin
   → FLUSH: accumulatedTextRef = '', lastTextChunkId = null
   → activity-456: {type: 'tool_start', tool: 'search_jobs_linkedin'}

5. chunk: "I found 5 positions"
   → accumulatedTextRef = "I found 5 positions"
   → activity-789: {content: "I found 5 positions"} // NEW chunk for post-tool text
```

### Timeline Rendering

```
Timeline: [activity-123, activity-456, activity-789]
         ↓
Rendered: 
  "I'll search for jobs..."
  [Tool: search_jobs_linkedin]
  "I found 5 positions"
```

## Key Benefits

✅ **No word splitting** - Text accumulates naturally
✅ **No duplicates** - Single activity updated in place
✅ **Perfect interleaving** - Flush on tool events creates boundaries
✅ **Efficient** - Map deduplication handles updates automatically
✅ **Clean display** - Existing rendering logic groups consecutive chunks

## Comparison: V1 vs V2

| Aspect | V1 (Broken) | V2 (Fixed) |
|--------|-------------|------------|
| Activities per word | 1 activity | Part of 1 accumulated activity |
| Total activities for "I'll search for jobs" | 4-5 activities | 1 activity |
| Text display | Word by word, duplicated | Smooth, accumulated |
| Interleaving | Broken by too many chunks | Clean segments |
| Performance | Map thrashing | Efficient updates |

## Testing

Test with: **"Find me 5 jobs you think I'd like"**

Expected output:
```
Assistant: I'd be happy to help you find jobs! Let me search...
[Tool Activity: search_jobs_linkedin]
Assistant: I found 5 great positions. Here they are:
1. Senior Engineer at...
2. Tech Lead at...
```

Should NOT see:
- ❌ Word-by-word text appearing
- ❌ Duplicate phrases
- ❌ "I'd beI'd be happy to help happy to help"
- ❌ Text appearing multiple times

## Architecture Notes

- **Activity Map** provides automatic deduplication by ID
- **Refs** prevent unnecessary re-renders during accumulation
- **Flush on tool events** is the key to proper interleaving
- **Existing rendering logic** (lines 1147-1196) still groups consecutive text_chunks
- **Backward compatible** - still accumulates `streamingMessage` as fallback

## Files Changed

- `components/agents/ChatPane.tsx`: All changes in this file
  - Lines 480-483: Added accumulation refs
  - Lines 865-895: Updated chunk handler
  - Lines 943-948: Flush on tool events
  - Lines 903, 919, 932: Reset refs on complete/error

## Success Criteria

✅ Text accumulates smoothly without splitting
✅ Tool activities appear at proper boundaries
✅ Text → Tool → Text interleaving is chronological
✅ No duplicate text
✅ Clean, readable conversation flow
