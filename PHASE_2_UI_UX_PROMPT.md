# Phase 2 UI/UX Design Prompt — Structured Event Stream

**Role:** You are a senior UI/UX designer embedded with an agentic-coding team. Think product-first: flows, states, and clarity. No coding yet—just discovery, framing, and design specification.

---

## Context

We've successfully completed Phase 1: a Cursor-style lightweight activity feed that makes tool execution visible inline with messages. Activities now blend seamlessly with the conversation, but we have critical gaps:

1. **Dead air on send** - Users wait 3-5 seconds before seeing any feedback
2. **Activities disappear on reload** - Everything lives in component state, not database
3. **No "what's next" preview** - Users don't know what the agent plans to do before it executes
4. **Multi-tool batches are unclear** - When executing 3+ tools, no aggregate progress indicator

**Current State:**
- Activities stream via SSE from `/api/chat` endpoint
- Events: `tool_start`, `tool_params`, `tool_executing`, `tool_result`, `thinking`, `status`
- Activities stored in component state only (lost on page refresh)
- Timeline merges messages + activities chronologically
- Phase 1 visual design is solid (Cursor-style, lightweight, muted colors)

**Phase 2 Goal:** Add persistence, thought chips, and structured progress indicators to make the experience continuous and predictable.

---

## Mission

Design the interaction model, data architecture, and UI specifications for Phase 2: Structured Event Stream. Your deliverables should enable engineers to implement activity persistence, thought preview chips, and aggregate progress indicators with minimal ambiguity.

---

## Constraints & Principles

- **Preserve Phase 1 aesthetic** - Keep the lightweight, Cursor-style design
- **Database as source of truth** - Activities must persist across reloads
- **Progressive enhancement** - Features should degrade gracefully if backend fails
- **Performance-conscious** - Don't bog down the DB with excessive writes
- **Privacy-first** - Redact sensitive data before persisting (see Phase 1 redaction rules)
- **Minimal diff** - Reuse existing components where possible

---

## What to Design (Deliverables)

### 1. Database Schema Design

**Supabase Table: `activities`**

Design the schema for persisting activity events. Consider:
- What columns are required? (user_id, session_id, agent_id, type, tool, params, result, etc.)
- How to handle JSONB fields for params/result?
- What indexes are needed for performant queries? (user_id + created_at? session_id?)
- Should we partition by user or time?
- How to handle data retention? (delete activities older than 30 days?)
- What about RLS (Row Level Security) policies?

**SQL Migration Draft:**
```sql
CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  agent_id text NOT NULL,
  type text NOT NULL CHECK (type IN ('tool_start', 'tool_params', ...)),
  tool text,
  params jsonb,
  result jsonb,
  success boolean,
  message text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes?
-- RLS policies?
-- Partitioning?
```

**Questions to answer:**
- Should `params` and `result` be redacted before insert, or on read?
- Do we need a separate `activity_details` table for large payloads (>10KB)?
- Should we track activity duration (started_at vs completed_at)?
- How to handle partial failures (tool started but never completed)?

---

### 2. Thought Preview Chips

**Concept:** Before executing a tool, the agent emits a "thinking preview" event showing what it plans to do next.

**Example:**
```
[User] Find me 5 jobs in Seattle

🧠 Planning search → Running GoogleJobs(page 1)…  [2:53:01 PM]

🔧 Starting search jobs google                     [2:53:02 PM]
⚡ Executing search jobs google                    [2:53:03 PM]
✓ Found 3 jobs on Google Jobs                      [2:54:12 PM]
```

**Design Questions:**

1. **Visual Treatment:**
   - Should thought chips use the Brain icon (🧠) or be text-only?
   - Font size: Same as `thinking` type (11px) or slightly larger?
   - Color: Gray (`text-gray-400`) or muted blue?
   - Animation: Fade-in? Pulse? Typing indicator (…)?
   - Duration: How long should they display? Fade out after tool starts?

2. **Content Strategy:**
   - What information is safe to show? (tool name + safe params only)
   - Format: "Planning X → Running Y(params)…" or simpler?
   - How to redact sensitive params in preview? (e.g., "Running search(location: Seattle)")
   - What if multiple tools planned? Show all, or just "Planning 3 tools…"?

3. **State Management:**
   - Should thought chips be persisted to DB, or ephemeral only?
   - If persisted, should they be collapsed/hidden after tool completes?
   - Do thought chips need timestamps?

4. **Edge Cases:**
   - What if thinking takes >10 seconds? Show elapsed time?
   - What if agent changes its mind? (planned tool X, executed tool Y instead)
   - What if error occurs during planning? Show error in chip?

**Wireframe Request:**
Draw/describe 3 states:
1. Thought chip appears (before tool execution)
2. Tool execution begins (thought chip + activity card)
3. Tool completes (thought chip fades/collapses, result shown)

---

### 3. Aggregate Progress Indicators

**Concept:** When executing multiple tools in a batch (e.g., search Google + Indeed + LinkedIn), show a single progress indicator instead of 3 separate activity cards.

**Example:**
```
[User] Find me jobs on Google, Indeed, and LinkedIn

🧠 Planning searches…                              [2:53:01 PM]

Executing 3 tools…                                 [2:53:02 PM]
├─ ✓ search jobs google (done)
├─ ⏳ search jobs indeed (running)
└─ ⏱️ search jobs linkedin (pending)

✓ Found 8 total jobs across 3 platforms            [2:54:30 PM]
   ▶ Show details
```

**Design Questions:**

1. **Visual Treatment:**
   - Collapsed state: "Executing 3 tools…" with spinner?
   - Expanded state: Tree view with checkmarks/spinners per tool?
   - Expandable by default, or collapsed until hover/click?
   - Icon: Use Zap (⚡) or custom "batch" icon?

2. **Progress Tracking:**
   - Show count: "2/3 complete" or just visual indicators?
   - Show elapsed time: "Executing for 12s…"?
   - Animate checkmarks as each tool completes?
   - What if one tool fails? Show red X inline?

3. **Result Aggregation:**
   - Final summary: "Found 8 jobs across 3 platforms" or list individual results?
   - Should each tool result be expandable separately?
   - What if results are mixed (2 success, 1 failure)?

4. **Interaction:**
   - Can users cancel a batch mid-execution?
   - Can users expand to see individual tool progress?
   - Should failed tools be retryable from the aggregate view?

5. **Edge Cases:**
   - What if tools execute sequentially (not parallel)? Still show aggregate?
   - What if batch takes >60 seconds? Show "still running…" indicator?
   - What if backend doesn't support batch tracking? Fallback to individual cards?

**Wireframe Request:**
Draw/describe 4 states:
1. Batch starts (collapsed, spinner)
2. Batch in progress (expanded tree view, 2/3 done)
3. Batch completes successfully (summary with all results)
4. Batch completes with failures (summary showing 2 success, 1 error)

---

### 4. Reload Continuity UX

**Concept:** When user refreshes the page, activities should reload from the database and display seamlessly alongside messages.

**Design Questions:**

1. **Loading State:**
   - Show skeleton loaders for activities while fetching?
   - Show spinner in timeline?
   - Optimistic rendering (show cached state, then hydrate)?

2. **Merge Strategy:**
   - How to merge persisted activities with live SSE stream?
   - What if SSE emits duplicate events? (same tool_use_id)
   - Should we show "Replay" label on loaded activities?

3. **Incomplete Activities:**
   - What if activity started but never completed? (tool_start but no tool_result)
   - Show "Timed out" or "Incomplete" status?
   - Allow users to retry incomplete activities?

4. **Timeline Integrity:**
   - Messages are already persisted; how to ensure activities interleave correctly?
   - Sort by timestamp (activity.created_at vs message.created_at)?
   - What if timestamps are slightly off due to clock skew?

5. **Performance:**
   - Paginate activities? (load last 50, "Load more" button?)
   - Lazy load activity details (params/result)?
   - Cache activities in localStorage for instant render?

**Wireframe Request:**
Draw/describe 3 states:
1. Page loads (skeleton loaders for activities)
2. Activities hydrated from DB (seamlessly merged with messages)
3. New SSE activity arrives (appends to timeline without flicker)

---

### 5. Persistence Boundaries

**Strategy Question:** What to persist vs what to keep ephemeral?

**Always Persist:**
- Tool start/execution/result events
- Final success/failure messages
- Errors (for debugging)

**Consider Persisting:**
- Tool parameters (redacted)
- Tool results (truncated if >10KB?)
- Thinking/status events (or only cache locally?)

**Never Persist:**
- Sensitive credentials (API keys, tokens, session IDs)
- Full browser screenshots (too large)
- PII unless explicitly allowed

**Design Decisions Needed:**
1. Should we persist `tool_params` events separately, or merge into `tool_start`?
2. Should we persist ephemeral events like `thinking`? (useful for replay, but noisy)
3. Should we truncate large results before persisting? (e.g., first 5KB + "… see more")
4. Should we batch inserts (performance) or insert immediately (reliability)?

---

### 6. Activity Event Schema Evolution

**Current Events (Phase 1):**
```typescript
type Activity = {
  id: string;
  type: 'tool_start' | 'tool_params' | 'tool_executing' | 'tool_result' | 'thinking' | 'status';
  tool?: string;
  toolId?: string;
  params?: any;
  result?: any;
  success?: boolean;
  message?: string;
  content?: string;
  error?: string;
  timestamp: string;
};
```

**Proposed New Events (Phase 2):**
```typescript
type Activity = {
  // ... existing fields ...
  
  // NEW: Thought preview
  type: '... | thinking_preview | batch_start | batch_progress | batch_complete';
  
  // NEW: Batch tracking
  batchId?: string;          // Group related tools
  batchTotal?: number;       // Total tools in batch
  batchCompleted?: number;   // Completed so far
  
  // NEW: Timing
  startedAt?: string;        // When tool execution began
  completedAt?: string;      // When tool execution ended
  duration?: number;         // Milliseconds (computed)
  
  // NEW: Redaction flag
  isRedacted?: boolean;      // Indicates params/result were sanitized
};
```

**Design Questions:**
1. Should we version the activity schema? (v1, v2, etc.)
2. How to handle backward compatibility? (old activities without new fields)
3. Should `batchId` be auto-generated or passed from backend?
4. Should duration be computed on frontend or backend?

---

### 7. Microcopy & Empty States

**Microcopy Needed:**

1. **Loading activities:** "Loading activity history…"
2. **No activities yet:** "No tools executed yet. Send a message to get started."
3. **Batch in progress:** "Executing 3 tools…" vs "Running 3 searches…"
4. **Batch complete:** "Found 8 jobs across 3 platforms" vs "All searches complete"
5. **Incomplete activity:** "Activity timed out" vs "Never completed"
6. **Thought preview:** "Planning search…" vs "Thinking about next steps…"

**Tone & Voice:**
- Concise (≤10 words per status message)
- Action-oriented ("Executing" not "Currently executing")
- User-centric ("Found 8 jobs" not "System retrieved 8 records")
- Calm during errors ("Search timed out. Retrying…" not "ERROR: TIMEOUT")

**Empty State Design:**
- What icon? (empty box? sparkle? lightbulb?)
- Microcopy: Short and encouraging
- CTA: "Send a message to start" button?

---

### 8. API Contract Design

**New Endpoints Needed:**

```typescript
// GET /api/activities?agentId=xxx&limit=50&offset=0
// Returns: { activities: Activity[], hasMore: boolean }

// POST /api/activities (internal, called by chat API route)
// Body: Activity object (redacted)
// Returns: { id: string, created_at: string }

// DELETE /api/activities/:id (for cleanup/privacy)
// Returns: { success: boolean }
```

**SSE Event Updates:**

```typescript
// NEW: Thought preview event
data: {
  type: 'thinking_preview',
  content: 'Planning search → Running GoogleJobs(page 1)…',
  timestamp: '2025-10-11T14:53:01Z'
}

// NEW: Batch start event
data: {
  type: 'batch_start',
  batchId: 'batch_123',
  batchTotal: 3,
  tools: ['search_jobs_google', 'search_jobs_indeed', 'search_jobs_linkedin'],
  timestamp: '2025-10-11T14:53:02Z'
}

// UPDATED: Tool result includes batch context
data: {
  type: 'tool_result',
  tool: 'search_jobs_google',
  batchId: 'batch_123',
  batchCompleted: 1,
  batchTotal: 3,
  success: true,
  message: 'Found 3 jobs on Google Jobs',
  timestamp: '2025-10-11T14:54:12Z'
}
```

**Design Questions:**
1. Should activities API be REST or GraphQL?
2. Should we support filtering by type? (e.g., only show errors)
3. Should we support date range queries? (activities from last 7 days)
4. Rate limiting strategy? (max 100 queries per minute?)

---

## Constraints & Edge Cases to Consider

### Performance
- What if a user has 10,000+ activities? (pagination required)
- What if activity results are huge? (truncate, lazy load details)
- What if DB write fails? (cache locally, retry with exponential backoff)

### Privacy
- What if params contain PII? (redact before persisting)
- What if user deletes account? (cascade delete activities)
- What if GDPR export requested? (include activities in data dump)

### Reliability
- What if page closes mid-execution? (activities persist, mark as "incomplete")
- What if SSE connection drops? (poll for new activities on reconnect)
- What if tool hangs forever? (timeout after 60s, mark as "timed out")

### Concurrency
- What if user opens multiple tabs? (use broadcast channel to sync activities)
- What if two tool calls have same tool_use_id? (use id + timestamp for uniqueness)

---

## Research Questions

Before designing, consider:

1. **How do other tools handle activity persistence?**
   - GitHub Actions: Logs persist, can replay
   - Cursor: Recent activity saved locally
   - Linear: Activity feed persists per issue

2. **What are the performance implications?**
   - 100 activities = 100 DB rows = ~10KB
   - 10,000 activities = ~1MB (need pagination)
   - JSONB indexing for fast queries?

3. **What are the privacy implications?**
   - Store params/results encrypted at rest?
   - Auto-redact common PII patterns?
   - Allow users to manually delete activities?

---

## Deliverables (Output Package)

Your Phase 2 design should include:

### 1. Database Schema Specification
- Full SQL migration with indexes, constraints, RLS policies
- Redaction strategy (before insert vs on read)
- Partitioning/retention strategy

### 2. Thought Preview Chip Specification
- Visual design (wireframes + CSS specs)
- Content strategy (what to show, how to redact)
- Interaction model (fade in/out, timing)
- Persistence decision (DB or ephemeral)

### 3. Aggregate Progress Indicator Specification
- Visual design (collapsed + expanded states)
- Progress tracking strategy (count, time, status)
- Result aggregation format
- Error handling (mixed success/failure)

### 4. Reload Continuity Flow
- Loading state design
- Merge strategy (persisted + live SSE)
- Incomplete activity handling
- Performance optimizations

### 5. API Contract
- REST endpoint specifications (GET, POST, DELETE)
- SSE event schema updates (new event types)
- Authentication/authorization strategy
- Rate limiting

### 6. Microcopy Inventory
- All status messages (30+ strings)
- Empty states
- Error messages
- Loading states

### 7. Component Specifications
- ActivityCard updates (new props, new states)
- ThoughtPreviewChip (new component)
- BatchProgressIndicator (new component)
- ActivityTimeline updates (merge logic)

### 8. Implementation Phases
Break Phase 2 into 3-4 sub-phases:
- Sub-phase A: Database schema + persistence layer
- Sub-phase B: Thought preview chips
- Sub-phase C: Aggregate progress indicators
- Sub-phase D: Reload continuity + polish

Each sub-phase should be deployable independently.

---

## Success Criteria

Phase 2 is successful if:

✅ Activities persist across page reloads (100% continuity)  
✅ "Dead air" reduced to <500ms (thought chips show immediately)  
✅ Multi-tool batches show aggregate progress (not 10 separate cards)  
✅ No sensitive data persisted (redaction verified)  
✅ Performance: Fetch 50 activities in <200ms  
✅ No visual regressions from Phase 1 (still Cursor-style lightweight)  

---

## References

**Read First:**
- [`CURSOR_STYLE_ACTIVITY_FEED.md`](./CURSOR_STYLE_ACTIVITY_FEED.md) - Phase 1 implementation
- [`ACTIVITY_FEED_VISUAL_COMPARISON.md`](./ACTIVITY_FEED_VISUAL_COMPARISON.md) - Current visual design
- [`UI_UX_DISCOVERY_SPRINT_SUMMARY.md`](./UI_UX_DISCOVERY_SPRINT_SUMMARY.md) - Original discovery brief

**Existing Code to Review:**
- `components/agents/ChatPane.tsx` (lines 342-423) - ActivityCard component
- `components/agents/types.ts` - Activity type definitions
- `app/api/chat/route.ts` - SSE streaming endpoint
- `lib/claude-agent.ts` - Tool execution + activity emission

**Supabase Schema:**
- `messages` table - Already persisted
- `activities` table - To be created in Phase 2

---

## Output Format

Deliver your Phase 2 design as a single markdown document with:

1. **Executive Summary** (1 page)
2. **Database Schema** (SQL + rationale)
3. **UI Specifications** (wireframes + CSS specs)
4. **API Contract** (endpoints + SSE events)
5. **Component Specifications** (props, states, interactions)
6. **Microcopy Inventory** (all strings)
7. **Implementation Roadmap** (sub-phases with estimates)
8. **Success Metrics** (measurable targets)

Include ASCII wireframes where helpful (like Phase 1 discovery brief).

---

**Now, design Phase 2: Structured Event Stream. Make it persistent, predictive, and performant.**

