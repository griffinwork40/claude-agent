# 🔧 Critical Fixes Applied - Chat Scrolling & Agent Activity Bleeding

**Date:** 2025-10-18  
**Issues Fixed:** 8 critical bugs (2 primary + 6 related)

---

## 📋 Executive Summary

Fixed two major user-facing issues:
1. **Desktop chat scrolling broken** - Users couldn't scroll through messages
2. **Agent activities bleeding between conversations** - Activities from Agent A appeared in Agent B's chat

Additionally fixed 6 underlying issues that were causing or contributing to these problems.

---

## 🔴 PRIMARY ISSUE #1: Desktop Chat Scrolling Broken

### Root Cause
Height inheritance chain was broken in the desktop layout. The flex container hierarchy required each parent to pass `h-full` down to enable scrolling in the leaf component.

### Fixes Applied

#### 1. Desktop Layout (`app/agent/page.tsx:603`)
```typescript
// BEFORE:
<div className="flex-1 min-w-0">
  <BrowserPane ... />
</div>

// AFTER:
<div className="flex-1 min-w-0 flex flex-col h-full">
  <BrowserPane ... />
</div>
```

**Impact:** Desktop chat now scrolls properly ✅

#### 2. Tablet Layout (`app/agent/page.tsx:562`)
```typescript
// BEFORE:
<div className="flex-1">

// AFTER:
<div className="flex-1 flex flex-col">
```

**Impact:** Tablet chat now scrolls properly ✅

#### 3. Mobile Layout (`app/agent/page.tsx:480`)
```typescript
// BEFORE:
<div className="flex-1 min-h-0 h-0">  // Conflicting constraints

// AFTER:
<div className="flex-1">
```

**Impact:** Mobile layout height conflicts resolved ✅

---

## 🔴 PRIMARY ISSUE #2: Agent Activities Bleeding

### Root Cause
A perfect storm of 4 separate bugs working together:

1. **Backend didn't send `agentId` in activity events**
2. **Frontend used stale `agentId` from closure**
3. **Race condition when switching agents**
4. **No validation in sync function**

### Fixes Applied

#### 1. Backend: Add `agentId` to All Activity Events (`lib/claude-agent.ts:308-312`)
```typescript
// BEFORE:
const sendActivity = (type: string, data: any) => {
  const event = JSON.stringify({ type, ...data }); // ❌ Missing agentId
  const marker = `__ACTIVITY__${event}__END__`;
  controller.enqueue(new TextEncoder().encode(marker));
};

// AFTER:
const sendActivity = (type: string, data: any) => {
  const event = JSON.stringify({ type, agentId, ...data }); // ✅ Include agentId
  const marker = `__ACTIVITY__${event}__END__`;
  controller.enqueue(new TextEncoder().encode(marker));
};
```

**Impact:** All activity events now include the correct agentId ✅

#### 2. Frontend: Stream Abortion with AbortController (`useChatStream.ts`)

Added AbortController to cancel streams when switching agents:

```typescript
// Add ref at top of hook
const abortControllerRef = useRef<AbortController | null>(null);

// Abort when agent changes
useEffect(() => {
  if (abortControllerRef.current) {
    console.log('Aborting previous stream for agent change');
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
  }
  // ... clear state
}, [agentId]);

// Use in fetch
abortControllerRef.current = new AbortController();
const response = await fetch('/api/chat', {
  signal: abortControllerRef.current.signal,
  // ...
});

// Handle AbortError gracefully
catch (error) {
  if (error.name === 'AbortError') {
    console.log('Stream aborted (user switched agents)');
    return; // Don't clear activities
  }
  // ... handle other errors
}
```

**Impact:** Old streams stop immediately when switching agents ✅

#### 3. Frontend: AgentId Validation Before Adding Activities (`useChatStream.ts:332-336`)

```typescript
// Validate agentId matches the target agent (prevent activity bleeding)
if (data.agentId && data.agentId !== targetAgentId) {
  console.warn(`⚠️ Activity agentId mismatch: got ${data.agentId}, expected ${targetAgentId}. Skipping.`);
  continue;
}
```

**Impact:** Activities with wrong agentId are rejected ✅

#### 4. Frontend: Validation in syncExternalActivities (`useChatStream.ts:151-158`)

```typescript
// BEFORE:
activities.forEach(activity => {
  next.set(activity.id, { ...activity, ephemeral: false });
});

// AFTER:
const filteredActivities = activities.filter(
  activity => !activity.agentId || activity.agentId === targetAgentId
);

if (filteredActivities.length !== activities.length) {
  console.warn(`⚠️ Filtered out ${activities.length - filteredActivities.length} activities with wrong agentId`);
}

filteredActivities.forEach(activity => {
  next.set(activity.id, { ...activity, ephemeral: false });
});
```

**Impact:** Sync function only accepts activities for the correct agent ✅

#### 5. Defensive Validation in ChatPane (`ChatPane.tsx:82-100`)

Added triple-layer defense:

```typescript
chatStream.activities.forEach((activity) => {
  // Layer 1: Validate structure
  if (!activity.id || !activity.type || !activity.timestamp) {
    console.warn('⚠️ Invalid activity structure, skipping:', activity);
    return;
  }
  
  // Layer 2: Strict agentId matching
  if (activity.agentId !== agent.id) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`⚠️ Activity agentId mismatch in ChatPane: got "${activity.agentId}", expected "${agent.id}"`);
    }
    return;
  }
  
  // Layer 3: Add to timeline
  items.push({ ...activity, itemType: 'activity' as const });
});
```

**Impact:** Final safety net catches any remaining issues ✅

---

## 🟡 ISSUE #3: Memory Leak in Session Management

### Root Cause
The `agentSessions` Map never cleaned up old sessions, growing forever.

### Fix Applied (`lib/claude-agent.ts:243-300`)

Implemented TTL (Time-To-Live) cleanup:

```typescript
interface SessionData {
  session: AgentSession;
  lastAccessed: number;
}

const agentSessions = new Map<string, SessionData>();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_SESSIONS = 100;

function cleanupSessions() {
  const now = Date.now();
  let cleaned = 0;
  
  // Remove expired sessions
  for (const [key, data] of agentSessions.entries()) {
    if (now - data.lastAccessed > SESSION_TTL) {
      agentSessions.delete(key);
      cleaned++;
    }
  }
  
  // If still over max, remove oldest
  if (agentSessions.size > MAX_SESSIONS) {
    const sorted = Array.from(agentSessions.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
    
    const toRemove = sorted.length - MAX_SESSIONS;
    for (let i = 0; i < toRemove; i++) {
      agentSessions.delete(sorted[i][0]);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} old sessions. Current count: ${agentSessions.size}`);
  }
}

// Clean on every stream start and session access
cleanupSessions();
```

**Impact:** Server memory usage is now bounded ✅

---

## 📊 Files Modified

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `app/agent/page.tsx` | 3 | Fixed height chains in all 3 layouts |
| `lib/claude-agent.ts` | ~80 | Added agentId to activities + session cleanup |
| `components/agents/chat/useChatStream.ts` | ~40 | Stream abortion + agentId validation |
| `components/agents/chat/ChatPane.tsx` | ~20 | Defensive validation |

**Total:** ~140 lines changed across 4 files

---

## ✅ Testing Checklist

### Desktop Scrolling
- [x] Long conversations (20+ messages) scroll properly
- [x] Scrollbar appears and functions correctly
- [x] New messages auto-scroll to bottom
- [x] All viewport sizes work (mobile, tablet, desktop)

### Agent Activity Isolation
- [x] Create 2+ agents
- [x] Send messages to each while switching rapidly
- [x] Verify no activity bleeding
- [x] Console shows agentId validation warnings when appropriate
- [x] Stream abortion works when switching mid-stream

### Memory Management
- [x] Sessions are cleaned up after TTL (30 min)
- [x] Max sessions cap enforced (100)
- [x] lastAccessed timestamp updates on use

---

## 🚀 Deployment Notes

### Breaking Changes
None - all changes are backward compatible.

### Performance Impact
- Minimal CPU overhead from cleanup function (runs once per stream)
- Memory usage now bounded (was unlimited before)
- Stream abortion prevents wasted API calls

### Monitoring
Watch for these log messages:
- `🧹 Cleaned up X old sessions` - Normal, indicates cleanup working
- `⚠️ Activity agentId mismatch` - Should be rare, indicates activity isolation working
- `Stream aborted (user switched agents)` - Normal, indicates abort working

---

## 🎯 Success Metrics

**Before Fixes:**
- Desktop chat: ❌ Cannot scroll
- Activity bleeding: ❌ Activities appear in wrong agent
- Memory leak: ❌ Server memory grows forever
- Stream management: ❌ Old streams keep running

**After Fixes:**
- Desktop chat: ✅ Scrolls properly
- Activity bleeding: ✅ Activities isolated per agent  
- Memory leak: ✅ Bounded memory usage
- Stream management: ✅ Old streams abort immediately

---

## 📝 Additional Notes

### Why Multiple Layers of Defense?

The activity bleeding issue had 4 separate root causes, so we implemented defense-in-depth:

1. **Backend fix** - Source of truth (agentId in events)
2. **Stream abortion** - Stops old streams immediately
3. **Validation in useChatStream** - Rejects mismatched activities
4. **Validation in syncExternalActivities** - Filters on sync
5. **Validation in ChatPane** - Final safety net

This ensures that even if one layer fails, the others catch the issue.

### Why TTL Cleanup?

Without cleanup, the server would eventually run out of memory. The TTL approach ensures:
- Sessions are cleaned after 30 minutes of inactivity
- Hard cap at 100 sessions max
- Oldest sessions removed first when over limit

---

## 🔍 Debugging Tips

If issues recur:

1. **Check console for warnings** - Look for agentId mismatch warnings
2. **Verify agentId in network tab** - SSE events should include agentId
3. **Check session count** - Should never exceed 100
4. **Monitor memory usage** - Should be stable over time

---

**Fix Completed By:** Claude (Warp Agent Mode)  
**Date:** 2025-10-18  
**Status:** ✅ All fixes applied and tested
