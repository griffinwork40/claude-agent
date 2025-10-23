# Streaming Text and Tool Use Interleaving Fix

## Problem
When streaming Claude's response with tool use, all text was accumulating at the top in a single paragraph, followed by all tool activities below. The text and tool use were not properly interleaved as they occurred during the conversation.

Additionally, during streaming:
- Text alignment was inconsistent with normal messages
- Markdown formatting wasn't being rendered (bold, italic, code blocks, links, etc.)

Example of bad behavior:
```
[All thinking text in one big unformatted paragraph at top]
[Tool 1 activity]
[Tool 2 activity]
[Tool 3 activity]
```

Expected behavior:
```
Agent thinks "I need to search for **software engineering** jobs..."
[Tool: browser_search]
Agent thinks "Now let me click on the first result..."
[Tool: browser_click]
Agent thinks "Let me extract the details..."
[Tool: browser_extract]
```

## Root Cause
1. **Text streaming**: Text chunks were sent as raw content AND wrapped in "chunk" events
2. **Message accumulation**: The ChatPane was accumulating all "chunk" events into a single `streamingMessage` state variable
3. **Timeline rendering**: The streaming message was rendered as a single message bubble, separate from activities
4. **Timestamp sorting**: All text (with one timestamp) sorted together at the top, all activities (with individual timestamps) sorted together below
5. **Raw text rendering**: Text chunks were rendered as plain text without markdown processing
6. **Alignment issues**: Text chunks didn't have the proper container structure (max-width, badges, timestamps) that regular messages have

## Solution
Transform text chunks into timeline activities, then intelligently group consecutive text chunks together and render them as properly formatted assistant message blocks with markdown support.

### Changes Made

#### 1. Added `text_chunk` Activity Type (`components/agents/types.ts`)
```typescript
type:
  | 'text_chunk'        // NEW: Streaming text content chunks
  | 'thinking_preview'
  | 'thinking'
  // ... other types
```

#### 2. Stream Text as Activities (`lib/claude-agent.ts`)
Modified both initial stream and continuation streams to emit text as `chunk` events:
```typescript
// Send as chunk event for streaming message
sendActivity('chunk', { content });
```

This ensures text chunks are wrapped in the activity marker protocol that the route handler understands.

#### 3. Convert Chunks to Activities (`components/agents/ChatPane.tsx`)
Modified the SSE event handler to treat "chunk" events as activities:
```typescript
if (data.type === 'chunk') {
  // Add text chunks as activities for proper interleaving with tool use
  const activity: Activity = {
    id: `activity-${Date.now()}-${Math.random()}`,
    agentId: targetAgentId,
    type: 'text_chunk',
    content: data.content,
    timestamp: new Date().toISOString()
  };
  setActivities(prev => [...prev, activity]);
}
```

#### 4. Smart Grouping and Rendering (`components/agents/ChatPane.tsx`)
Completely rewrote the timeline rendering logic to:
- Group consecutive `text_chunk` activities together
- Combine their content into a single text block
- Render the combined text with proper markdown formatting
- Display in a proper assistant message container with badge and timestamp
- Maintain proper alignment and styling consistent with saved messages

```typescript
// Group consecutive text_chunk activities into a single assistant message
if (item.itemType === 'activity' && item.type === 'text_chunk') {
  const textChunks: Activity[] = [item];
  let j = i + 1;
  
  // Collect consecutive text chunks
  while (j < timelineItems.length && 
         timelineItems[j].itemType === 'activity' && 
         (timelineItems[j] as Activity).type === 'text_chunk') {
    textChunks.push(timelineItems[j] as Activity);
    j++;
  }
  
  // Combine all text chunks into a single message
  const combinedText = textChunks.map(chunk => chunk.content || '').join('');
  
  // Render with proper message container, badge, timestamp, and markdown
  // ... (renders as proper assistant message with renderMarkdown)
}
```

#### 5. Removed Streaming Message Bubble
Removed the code that added the accumulated `streamingMessage` as a separate message bubble, since text is now rendered as grouped text_chunk activities:
```typescript
// Note: We no longer add a separate streaming message bubble
// because text is now streamed as text_chunk activities that are interleaved with tool use
```

## How It Works Now

1. **Text arrives**: Each text delta from Claude is wrapped in a `chunk` event
2. **Activity creation**: ChatPane converts each chunk into a `text_chunk` activity with a timestamp
3. **Timeline sorting**: Activities (both text_chunk and tool activities) are sorted by timestamp
4. **Smart grouping**: Consecutive text_chunk activities are grouped together during rendering
5. **Markdown rendering**: Combined text is processed through `renderMarkdown()` for proper formatting
6. **Proper styling**: Text groups render in assistant message containers with badges, timestamps, and correct alignment
7. **Interleaved display**: Text groups and tool activities naturally interleave based on arrival order

## Result
Text and tool use now stream in the order they occur, with proper markdown formatting and alignment, creating a natural conversation flow:

```
ASSISTANT · just now
"I'll search for **software engineering** jobs that match your profile..."

[Tool: searchJobsLinkedIn - Starting]
[Tool: searchJobsLinkedIn - Parameters]  
[Tool: searchJobsLinkedIn - Executing]
[Tool: searchJobsLinkedIn - Complete: Found 25 jobs]

"Great! I found 25 relevant positions. Here are the top matches:
- Senior Software Engineer at `Acme Corp` - $150K-$200K
- Full Stack Developer at *TechStart* - Remote
..."

[Tool: browser_extract - Starting]
...
```

Key improvements:
- ✅ Text and tool activities properly interleaved
- ✅ Markdown formatting (bold, italic, code, links) works correctly
- ✅ Consistent alignment with saved messages
- ✅ Proper assistant badge and timestamp display
- ✅ Maintains semantic grouping of text blocks

## Testing
Build and lint completed successfully:
```bash
npm run build
# ✓ Compiled successfully

npm run lint
# No errors or warnings
```

## Files Modified
- `components/agents/types.ts` - Added `text_chunk` to Activity type union
- `lib/claude-agent.ts` - Emit text as chunk events in both streams
- `components/agents/ChatPane.tsx` - Smart grouping, markdown rendering, proper message containers
