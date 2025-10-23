# Streaming Chat Duplicate Activities Fix & Production Readiness Plan

## Problem Analysis

### Root Causes Identified

1. **Duplicate Activities from Multiple Sources**
   - Activities are created locally in ChatPane.tsx (lines 844-851)
   - Same activities are persisted via /api/activities endpoint (route.ts lines 126-173)
   - Activities sent twice: once as SSE events, once as DB records
   - No deduplication logic between local state and persisted activities

2. **Text Chunks Saved Multiple Times**
   - claude-agent.ts saves text chunks to DB at three points:
     - Pre-tool execution (line 403-410)
     - During continuation (line 593-600)
     - Final chunk (line 777-784)
   - ChatPane also creates text_chunk activities (line 842)
   - Result: Same text appears as both messages AND activities

3. **Message Reload Race Condition**
   - Stream completes and dispatches 'reload-messages' event (line 866)
   - Activities still being persisted asynchronously (lines 195-198)
   - New messages loaded before activities finish saving
   - Activities then appear duplicate to already-rendered messages

4. **Activity State Management Issues**
   - Activities persist in local state after stream completion
   - No cleanup when switching agents
   - `externalActivities` filter logic (ChatPane line 677) doesn't prevent dupes
   - Timeline merging (lines 696-727) creates visual duplicates

5. **SSE Event Processing**
   - Buffer parsing creates activity markers AND raw chunks (route.ts lines 217-287)
   - Same content flows through multiple event types (chunk, text_chunk, activity)
   - No correlation IDs to track which events are already processed

## Production-Ready Streaming Architecture

### Phase 1: Deduplication & State Management (Priority: Critical)

#### 1.1 Single Source of Truth
**File: `lib/claude-agent.ts`**
- Remove incremental text chunk saves (lines 403-410, 593-600, 777-784)
- Save complete assistant message only once at stream completion
- Add message correlation ID to track chunks belonging to same response
- Activities should NOT duplicate message content

**Changes:**
```typescript
// Add at top of file
interface StreamingContext {
  messageId: string;  // Correlate all chunks to final message
  textBuffer: string; // Accumulate text
  activities: Activity[]; // Track tool activities only
}

// In runClaudeAgentStream, replace incremental saves with:
const streamContext: StreamingContext = {
  messageId: `msg-${Date.now()}-${userId}`,
  textBuffer: '',
  activities: []
};

// Remove saveAssistantTextChunk calls
// Only save final complete message at end
```

#### 1.2 Activity Persistence Strategy
**File: `app/api/chat/route.ts`**
- Remove activity persistence from chat route (lines 126-173, 258-261)
- Activities should be streamed to client only
- Let client decide what to persist (or don't persist at all)
- Activities are ephemeral progress indicators, not historical records

**Changes:**
```typescript
// Remove persistActivity function entirely (lines 126-173)
// Remove pendingActivities array and Promise.allSettled waits
// Activities are just SSE events for real-time UX
```

#### 1.3 Client-Side Deduplication
**File: `components/agents/ChatPane.tsx`**
- Use Map with activity IDs to prevent duplicates
- Clear activities when stream completes (after message reload)
- Don't add text_chunk activities - they become messages
- Only show tool activities (not text rendering)

**Changes:**
```typescript
// Replace activities state with:
const [activities, setActivities] = useState<Map<string, Activity>>(new Map());

// In SSE handler, use:
setActivities(prev => {
  const next = new Map(prev);
  next.set(activity.id, activity); // Deduplicates automatically
  return next;
});

// On stream complete, clear activities after reload:
setActivities(new Map()); // Clear after messages-reloaded event
```

### Phase 2: Clean Message/Activity Separation (Priority: High)

#### 2.1 Distinct Data Types
- **Messages**: Persistent conversational content (user input, assistant responses)
- **Activities**: Ephemeral streaming progress (tool calls, thinking, status)
- **Rule**: Activities NEVER duplicate message content

#### 2.2 Text Streaming Strategy
**Current (broken):**
- Text → chunk event → text_chunk activity → message
- Results in 3 representations of same content

**Fixed:**
- Text → chunk event → accumulated in streaming state → single message on complete
- Activities only for non-text actions (tool use, thinking)

**File: `components/agents/ChatPane.tsx`**
```typescript
// Remove text_chunk activity creation (lines 842-851)
// Keep only streamingMessage accumulation (line 853)
// Timeline should show: [messages] + [tool activities] (NOT text activities)
```

#### 2.3 Timeline Rendering
**File: `components/agents/ChatPane.tsx` lines 1102-1237**

**Changes:**
```typescript
// Filter out text_chunk from activities
const toolActivities = activities.filter(a => a.type !== 'text_chunk');

// Render tool activities inline between messages
// Don't group text chunks - they're already in messages
```

### Phase 3: Stream Completion Sequencing (Priority: High)

#### 3.1 Event Ordering
**File: `app/api/chat/route.ts`**
1. Stream text and activities to client
2. Save complete message to DB
3. Send 'complete' SSE event with messageId
4. Client receives complete event
5. Client clears ephemeral activities
6. Client triggers message reload
7. Messages reload with new DB message
8. Render clean state with no duplicates

#### 3.2 Reload Synchronization
**File: `components/agents/ChatPane.tsx`**
```typescript
// Add message ID tracking
const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

// On complete event:
if (data.type === 'complete') {
  setStreamingMessageId(data.messageId);
  setIsStreaming(false);
  
  // Reload messages
  window.dispatchEvent(new CustomEvent('reload-messages'));
}

// On messages-reloaded event:
window.addEventListener('messages-reloaded', () => {
  setStreamingMessage('');
  setActivities(new Map()); // Clear all ephemeral activities
  setStreamingMessageId(null);
});
```

### Phase 4: Production UX Enhancements (Priority: Medium)

#### 4.1 Loading States
- Show skeleton/spinner during message reload
- Indicate when switching between streaming and persisted state
- Progressive disclosure of long tool outputs

#### 4.2 Error Handling
- Graceful degradation if message save fails
- Retry logic for failed activity streams
- Clear error messages to user
- Recovery without page refresh

#### 4.3 Performance Optimization
- Debounce activity updates (currently every chunk)
- Virtual scrolling for long conversations
- Lazy load old messages/activities
- Compress activity payloads

#### 4.4 Accessibility
- Announce streaming status to screen readers
- Keyboard navigation for activities
- Focus management during stream updates
- ARIA live regions for dynamic content

### Phase 5: Testing & Validation (Priority: Critical)

#### 5.1 Unit Tests
```typescript
// Test deduplication logic
describe('Activity deduplication', () => {
  it('should not create duplicate activities with same ID', () => {
    // Test Map-based deduplication
  });
  
  it('should clear activities after stream completion', () => {
    // Test cleanup logic
  });
});

// Test message/activity separation
describe('Message rendering', () => {
  it('should not render text_chunk activities', () => {
    // Test filtering
  });
  
  it('should show tool activities only', () => {
    // Test activity types
  });
});
```

#### 5.2 Integration Tests
```typescript
// Test full stream flow
describe('Chat streaming', () => {
  it('should complete without duplicates', async () => {
    // Mock SSE stream
    // Verify single message, no duplicate activities
  });
  
  it('should handle rapid messages without race conditions', async () => {
    // Send multiple messages quickly
    // Verify state consistency
  });
});
```

#### 5.3 E2E Tests
- User sends message → sees streaming → sees final message (no dupes)
- User switches agents → no stale activities
- Long conversation with tools → timeline renders correctly
- Network interruption → graceful recovery

## Implementation Priority

### Immediate (Next 2 hours)
1. Remove activity persistence from chat route ✅
2. Remove text chunk DB saves from claude-agent ✅
3. Add activity deduplication Map in ChatPane ✅
4. Filter text_chunk from timeline rendering ✅

### Short-term (Next day)
5. Add proper stream completion sequencing ✅
6. Implement activity cleanup on reload ✅
7. Add correlation IDs for messages ✅
8. Basic error handling and loading states ✅

### Medium-term (Next week)
9. Comprehensive test suite
10. Performance optimizations
11. Accessibility improvements
12. Production monitoring/logging

## Success Metrics

- ✅ No duplicate activities in UI
- ✅ No duplicate text content (messages vs activities)
- ✅ Clean state transitions (streaming → complete → reloaded)
- ✅ Stable performance (no memory leaks, laggy scrolling)
- ✅ All E2E tests pass
- ✅ Zero console errors during normal operation

## Rollout Plan

1. **Development**: Implement fixes in feature branch
2. **Testing**: Run full test suite + manual QA
3. **Staging**: Deploy to staging environment
4. **Monitoring**: Watch for errors/performance issues
5. **Production**: Gradual rollout with feature flag
6. **Validation**: Monitor metrics for 48 hours
7. **Cleanup**: Remove old code paths if successful

## Risk Mitigation

- **Database migrations**: Activities table might have orphaned records (cleanup script)
- **Browser compatibility**: Test SSE in Safari, Firefox, Chrome
- **Mobile experience**: Test on real devices (iOS Safari, Chrome Android)
- **Concurrent users**: Load test with multiple simultaneous streams
- **Network issues**: Test on throttled/offline connections

## Code Cleanup Opportunities

After fixes are validated:
- Remove unused activity persistence code
- Remove text_chunk activity type entirely
- Simplify timeline rendering logic
- Consolidate message loading logic
- Remove redundant state variables

## Documentation Updates

- Update WARP.md with new streaming architecture
- Document message/activity separation
- Add streaming troubleshooting guide
- Update component prop interfaces
- Add inline code comments for complex logic

---

## Next Steps

Run this plan by the team, then start with **Immediate** priority items. Each phase builds on the previous, so order matters. Target completion of critical fixes within 24 hours.
