# Task: Implement Perfectly Interleaved LLM Text and Tool Activities in Chat

## Problem Statement

The chat UI currently shows tool activities but does NOT properly interleave the LLM's thinking text between tool uses. 

**Current Behavior:**
- Backend streams `chunk` events containing LLM text (reasoning, explanations, responses)
- Frontend accumulates these in `streamingMessage` state
- A single streaming message bubble shows ALL accumulated text
- Tool activities appear separately
- Result: Text appears as one big block, not interleaved with tool execution

**Desired Behavior:**
- LLM text should appear inline between tool activities in chronological order
- When LLM says "I'll search for jobs..." then uses a tool, that text should appear BEFORE the tool activity
- After tool execution, the LLM's analysis of results should appear AFTER the tool activity
- Perfect chronological interleaving of text chunks and tool activities

## Key Files to Analyze

### Backend (Streaming Logic)
- `lib/claude-agent.ts` - Lines 300-750
  - Line 398: Sends `chunk` events for initial stream text
  - Line 575: Sends `chunk` events for continuation stream text  
  - Sends various tool events: `tool_start`, `tool_params`, `tool_executing`, `tool_result`
  - All events include timestamps

### Frontend (Chat UI)
- `components/agents/ChatPane.tsx`
  - Lines 495-497: Filters OUT `text_chunk` activities from rendering
  - Lines 715-757: `timelineItems` useMemo - builds timeline from messages + activities
  - Lines 850-900: SSE event handler - receives `chunk` events, accumulates to `streamingMessage`
  - Lines 1137-1186: Special rendering logic for `text_chunk` activities (currently unused)
  - Lines 1189-1260: Rendering logic for regular activities and messages

### Type Definitions
- `components/agents/types.ts` - Activity and Message types
- `types/index.ts` - ToolUse, ToolResult types

## Current Event Flow

1. Backend streams events via SSE:
   - `chunk` - Text content from LLM
   - `tool_start` - Tool execution begins
   - `tool_params` - Tool parameters
   - `tool_result` - Tool execution complete
   - `thinking` - Status messages
   - `complete` - Stream finished

2. Frontend receives events:
   - `chunk` events → accumulate in `streamingMessage` state (not added to timeline individually)
   - Other events → create `Activity` objects → added to `activitiesMap`

3. Timeline rendering:
   - Shows messages (user + assistant)
   - Shows activities (tools, status)
   - Shows single streaming message (all accumulated text)
   - **NOT properly interleaved**

## Implementation Requirements

### Option A: Convert Chunks to Activities
1. Change event handler to create `text_chunk` activities for each `chunk` event
2. Add timestamp to each activity to preserve order
3. Remove filter that excludes `text_chunk` from activities array (line 495-497)
4. Ensure timeline sorts by timestamp correctly
5. The existing rendering logic for `text_chunk` activities (lines 1137-1186) should then work

### Option B: Track Chunk Timestamps
1. Instead of accumulating all chunks in one string, maintain array of chunks with timestamps
2. Create proper Activity objects for each chunk when received
3. Add to activitiesMap like other activities
4. Let timeline sorting handle interleaving

## Success Criteria

- [ ] LLM text appears inline with tool activities in chronological order
- [ ] Text before tool use appears above the tool activity
- [ ] Text after tool use appears below the tool activity  
- [ ] No duplicate text (streaming vs DB-persisted)
- [ ] Smooth real-time updates as chunks arrive
- [ ] Clean up ephemeral activities when stream completes
- [ ] Works across tool continuation loops (multiple tool uses)

## Testing

After implementation, test with:
```
"Find me 5 jobs you think I'd like"
```

Expected interleaved output:
```
Assistant: I'll search for jobs that match your profile...
[Tool Activity: search_jobs_linkedin]
Assistant: I found 5 relevant positions. Let me get details...
[Tool Activity: get_job_details]
Assistant: Here are the jobs I recommend:
1. Senior Engineer at...
2. Tech Lead at...
...
```

## Notes

- The code at lines 1137-1186 suggests this was previously implemented with `text_chunk` activities
- Line 730 comment says "We no longer add a separate streaming message bubble"
- This indicates the architecture was designed for interleaving but is currently broken
- The backend is already sending chronological events - frontend just needs to handle them correctly

## Additional Context

- Streaming uses SSE (Server-Sent Events) format
- Activities are stored in a Map for deduplication
- Timeline items are sorted by timestamp before rendering
- When stream completes, ephemeral activities are cleared and DB messages loaded
