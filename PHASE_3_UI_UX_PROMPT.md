# Phase 3 UI/UX Design Prompt — Replay & Error Recovery

**Role:** You are a senior UI/UX designer embedded with an agentic-coding team. Think product-first: flows, states, and clarity. No coding yet—just discovery, framing, and design specification.

---

## Context

We've successfully completed:
- **Phase 1:** Cursor-style lightweight activity feed (borderless, muted, inline)
- **Phase 2:** Structured event stream (persisted activities, thought chips, aggregate progress)

**Current State:**
- Activities persist to Supabase and survive page reloads ✅
- Thought preview chips show "what's next" before tool execution ✅
- Aggregate progress indicators for multi-tool batches ✅
- Timeline merges messages + activities chronologically ✅
- Visual design is clean and professional ✅

**Remaining Gaps:**
1. **No error recovery** - When a tool fails, users are stuck (can't retry)
2. **No replay mechanism** - Users can't re-run tools with different params
3. **No activity filtering** - Timeline gets noisy with 100+ activities
4. **Large results freeze UI** - Some tool results are 50KB+ of JSON
5. **No auto-retry** - Rate limits and transient errors require manual intervention

**Phase 3 Goal:** Add replay, error recovery, filtering, and virtualized viewing to make the experience resilient and debuggable.

---

## Mission

Design the interaction model, UI flows, and component specifications for Phase 3: Replay & Error Recovery. Your deliverables should enable engineers to implement retry buttons, activity filtering, virtualized log viewers, and smart error categorization with minimal ambiguity.

---

## Constraints & Principles

- **Preserve Phase 1 & 2 design** - Keep lightweight aesthetic, don't add clutter
- **User safety** - Replaying a tool might trigger expensive operations (confirm first)
- **Error clarity** - Categorize errors so users know what action to take
- **Performance-conscious** - Large logs should virtualize, not block the UI
- **Progressive enhancement** - Features should degrade gracefully
- **Minimal diff** - Reuse existing components where possible

---

## What to Design (Deliverables)

### 1. Replay Mechanism

**Concept:** Users can re-run a tool with the same or modified parameters.

**Example:**
```
✗ Failed: Rate limited                        2:54 PM
   ▶ Show details
   🔄 Retry
   
   (click Retry)
   
🔄 Retrying search jobs google (attempt 2)    2:55 PM
⚡ Executing search jobs google               2:55 PM
✓ Found 5 jobs on Google Jobs                 2:56 PM
```

**Design Questions:**

1. **Trigger Location:**
   - Where should "Retry" button appear? (inline, in chevron details, both?)
   - Should it show on all failed activities, or only certain error types?
   - Should it show on successful activities? (e.g., "Run again with different params")
   - Icon: 🔄 or custom retry icon?

2. **Confirmation Flow:**
   - Should retry require confirmation? ("This will execute search_jobs_google again. Continue?")
   - What if retry is expensive? (e.g., applying to a job, sending an email)
   - Should we show a preview of params before retrying?

3. **Parameter Editing:**
   - Can users edit params before retrying? (e.g., change location from "Seattle" to "Portland")
   - If yes, show inline form or modal?
   - How to validate edited params? (JSON schema validation?)

4. **Retry Tracking:**
   - Should we show retry count? ("Attempt 2/3")
   - Should we limit retries? (max 3 attempts per tool?)
   - Should retry activities be grouped? (show as sub-items under original?)

5. **Result Handling:**
   - If retry succeeds, should original failure be collapsed/hidden?
   - If retry fails again, show both errors or replace?
   - Should retry success show "Fixed!" badge?

6. **Edge Cases:**
   - What if original activity is >1 hour old? (params might be stale)
   - What if user has insufficient permissions? (can't retry)
   - What if backend doesn't support replay? (hide button)

**Wireframe Request:**
Draw/describe 5 states:
1. Failed activity with "Retry" button
2. Retry confirmation modal (if needed)
3. Retry in progress (attempt 2 indicator)
4. Retry success (original failure + new success)
5. Retry fails again (show both errors? aggregate?)

---

### 2. Error Categorization & Recovery Guidance

**Concept:** Categorize errors so users know what action to take (retry, fix permissions, wait, etc.)

**Error Categories:**

| Category | Example | Recovery Action | Auto-Retry? |
|----------|---------|-----------------|-------------|
| **rate_limit** | HTTP 429 | Wait 60s, then retry | Yes (after delay) |
| **auth_failed** | Invalid API key | Update credentials | No (requires user) |
| **network** | Connection timeout | Retry immediately | Yes (3 attempts) |
| **parse_error** | Invalid JSON | Check tool params | No (bad input) |
| **not_found** | Job listing removed | Skip/ignore | No (expected) |
| **permission** | Insufficient access | Grant permissions | No (requires user) |
| **server_error** | HTTP 500 | Retry after 10s | Yes (3 attempts) |
| **validation** | Invalid location | Fix input | No (bad input) |

**Design Questions:**

1. **Visual Treatment:**
   - Should each category have a distinct color? (rate_limit = orange, auth_failed = red, etc.)
   - Should each category have a distinct icon? (⏱️ for rate limit, 🔑 for auth, etc.)
   - How to communicate category without adding visual clutter?

2. **Microcopy Strategy:**
   - Inline error: Short (≤10 words) with actionable next step
   - Expanded error: Full details + recovery guidance (≤50 words)
   - Examples:
     ```
     ✗ Rate limited                          2:54 PM
        ▶ Show details
        
        (expanded)
        The job board is limiting requests.
        I'll retry automatically in 60 seconds.
        
        Error: HTTP 429 Too Many Requests
        Retry-After: 60s
     ```

3. **Auto-Retry Logic:**
   - Which categories should auto-retry? (rate_limit, network, server_error)
   - How to show auto-retry countdown? ("Retrying in 53s…")
   - Should user be able to cancel auto-retry? (Stop button?)
   - Should user be able to force immediate retry? (Skip countdown?)

4. **Recovery Actions:**
   - For `auth_failed`: Show "Update API Key" button → settings page?
   - For `permission`: Show "Grant Permissions" button → oauth flow?
   - For `rate_limit`: Show countdown timer + "Skip" button?
   - For `validation`: Show "Edit Params" inline form?

5. **Error Aggregation:**
   - If 3 tools fail with same error category, aggregate? ("3 searches failed due to rate limiting")
   - Show aggregate recovery action? (one "Wait & Retry All" button)

6. **Edge Cases:**
   - What if error doesn't fit any category? (show as "unknown")
   - What if error message contains sensitive data? (redact before showing)
   - What if retry-after header missing? (default to 60s?)

**Wireframe Request:**
Draw/describe 3 scenarios:
1. Rate limit error with auto-retry countdown
2. Auth error with "Update API Key" recovery action
3. Validation error with inline param editor

---

### 3. Activity Filtering

**Concept:** Let users filter timeline to show only relevant activities (all, tools only, errors only, etc.)

**Example:**
```
┌────────────────────────────────────────────┐
│ [All ▼] [Tools Only] [Errors Only] [Clear]│
└────────────────────────────────────────────┘

🔧 Starting search jobs google      2:53 PM
✓ Found 3 jobs on Google Jobs       2:54 PM
✗ Failed: Rate limited              2:54 PM  ← ERROR
✓ Found 0 jobs on Indeed            2:55 PM
```

**Design Questions:**

1. **Filter Toolbar Location:**
   - Above timeline (like email clients)?
   - Below chat header?
   - Floating button that opens filter panel?
   - Accessible via keyboard shortcut? (Cmd+F?)

2. **Filter Options:**
   - **All** - Show everything (default)
   - **Tools only** - Hide thinking/status/thought chips
   - **Errors only** - Show only failed activities
   - **Success only** - Show only successful activities
   - **By tool type** - Filter by tool name (e.g., only search_jobs_google)
   - **By date** - Last hour, today, this week
   - **Custom** - Advanced filter builder?

3. **Visual Treatment:**
   - Pills/buttons or dropdown menu?
   - Show active filter count? ("Filters (2)")
   - Show filtered-out count? ("Hiding 47 activities")
   - Highlight filter badge when active? (blue background)

4. **Interaction:**
   - Single-select or multi-select? (can combine "Tools only" + "Errors only"?)
   - Persist filter preference? (localStorage? database?)
   - Show "Clear filters" button when active?
   - Animate fade-out of filtered activities?

5. **Empty State:**
   - What if filter returns 0 results?
   - Microcopy: "No errors found. All tools executed successfully." ✅
   - Show "Clear filters" CTA?

6. **Performance:**
   - Filter client-side (fast but limited) or server-side (slow but powerful)?
   - If filtering 10,000+ activities, virtualize filtered list?

7. **Edge Cases:**
   - What if user filters while SSE is streaming new activities? (append to filtered list?)
   - What if filter hides currently expanded activity? (collapse first?)

**Wireframe Request:**
Draw/describe 4 states:
1. Filter toolbar (collapsed/default)
2. Filter dropdown open (showing all options)
3. Active filter (e.g., "Errors only" pill with count badge)
4. Empty state after filtering (no matches)

---

### 4. Virtualized Log Viewer

**Concept:** For activities with large result payloads (>10KB), use virtualized rendering so UI doesn't freeze.

**Example:**
```
✓ Found 500 jobs on Google Jobs               2:54 PM
   ▶ Show details
   
   (expanded)
   Result: 52.3 KB
   ┌────────────────────────────────────────┐
   │ [  1-50  ] ← showing 50 of 5,000 lines │
   │ {                                      │
   │   "jobs": [                            │
   │     { "title": "Software Engineer",    │
   │       "company": "Acme Inc",           │
   │       ... (scrollable, virtualized)    │
   │                                        │
   │                                        │
   │ [Load more] ↓                          │
   └────────────────────────────────────────┘
```

**Design Questions:**

1. **Threshold:**
   - At what size do we virtualize? (>10KB? >1000 lines?)
   - Show file size badge? ("52.3 KB")
   - Warn before expanding? ("Large result. This may take a moment to load.")

2. **Virtual Scrolling:**
   - Use `react-window` or `react-virtualized`?
   - How many lines to render at once? (50? 100?)
   - Show scroll position indicator? ("Lines 101-150 of 5,000")
   - Smooth scroll or jump to top?

3. **Syntax Highlighting:**
   - Should we syntax-highlight large JSON?
   - If yes, use `prism-react-renderer` or `highlight.js`?
   - Should highlighting be optional? (toggle for performance)

4. **Search Within Log:**
   - Add inline search? (Cmd+F within expanded details)
   - Highlight matches?
   - Jump to next/previous match?

5. **Copy/Download:**
   - Add "Copy all" button?
   - Add "Download as JSON" button?
   - Should copy preserve formatting?

6. **Collapse Strategy:**
   - Show summary when collapsed? ("Found 500 jobs: 450 Software Engineer, 30 Product Manager, ...")
   - Truncate preview? (first 5 items only)

7. **Edge Cases:**
   - What if result is deeply nested JSON? (expand/collapse nodes?)
   - What if result is binary data? (show hex dump? hide entirely?)
   - What if result contains ANSI color codes? (strip or render?)

**Wireframe Request:**
Draw/describe 3 states:
1. Large result collapsed (show size badge)
2. Large result expanded (virtualized list, scroll indicator)
3. Search within log (highlight matches)

---

### 5. Batch Retry & Cancel

**Concept:** Let users retry or cancel entire batches (not just individual tools).

**Example:**
```
Executing 3 tools…                             2:53 PM
├─ ✓ search jobs google (done)
├─ ✗ search jobs indeed (failed: rate limited)
└─ ⏱️ search jobs linkedin (pending)

[Cancel remaining] [Retry failed]

(user clicks "Retry failed")

Retrying 1 failed tool…                        2:55 PM
└─ ⚡ search jobs indeed (attempt 2)
```

**Design Questions:**

1. **Batch Controls:**
   - Where to show batch-level buttons? (in aggregate progress card)
   - Show "Cancel" button while batch is running?
   - Show "Retry failed" button after batch completes?
   - Show "Retry all" button? (re-run entire batch, including successful ones)

2. **Cancel Behavior:**
   - What happens to in-progress tools? (abort immediately? let finish?)
   - What happens to pending tools? (skip them)
   - Should we ask for confirmation? ("Cancel 2 remaining tools?")

3. **Retry Batch Logic:**
   - "Retry failed" = only retry tools that failed
   - "Retry all" = re-run all tools (even successful ones)
   - Should we offer both options? (two separate buttons)

4. **Visual Feedback:**
   - How to show canceled tools? (gray strikethrough? ⊘ icon?)
   - How to show retrying batch? (show attempt count per tool?)
   - Should retry batch create new aggregate card or reuse existing?

5. **Edge Cases:**
   - What if user cancels, then retries? (only retry canceled tools, or all?)
   - What if one tool takes 60s to abort? (show "Aborting…" spinner)
   - What if backend doesn't support cancellation? (hide button)

**Wireframe Request:**
Draw/describe 3 states:
1. Batch in progress with "Cancel" button
2. Batch partially failed with "Retry failed" button
3. Retrying failed tools (show attempt count)

---

### 6. Activity History & Search

**Concept:** Let users search past activities and jump to specific tool executions.

**Example:**
```
┌────────────────────────────────────────────┐
│ 🔍 Search activities...                    │
└────────────────────────────────────────────┘

Results for "search jobs google":
  Oct 11, 2:54 PM - ✓ Found 3 jobs
  Oct 10, 3:12 PM - ✗ Failed: Rate limited
  Oct 10, 2:45 PM - ✓ Found 5 jobs
```

**Design Questions:**

1. **Search Input Location:**
   - Above timeline (integrated with filter toolbar)?
   - Separate "Search" button that opens modal?
   - Keyboard shortcut? (Cmd+K for command palette?)

2. **Search Scope:**
   - Search activity messages only? (e.g., "Found 3 jobs")
   - Search tool names? (e.g., "search_jobs_google")
   - Search params? (e.g., "Seattle")
   - Search results? (e.g., job titles within results)
   - Search errors? (e.g., "rate limited")

3. **Search Results:**
   - Show as separate list (modal) or highlight in timeline?
   - Group by date? (Today, Yesterday, Last Week)
   - Show match preview? ("…Found 3 jobs in **Seattle**…")
   - Jump to activity? (scroll timeline to match)

4. **Search Performance:**
   - Client-side search (fast but limited to loaded activities)?
   - Server-side search (slow but comprehensive)?
   - Hybrid? (search loaded first, then query backend if needed)

5. **Advanced Search:**
   - Filter by date range? (e.g., "last 7 days")
   - Filter by status? (e.g., only errors)
   - Filter by tool? (e.g., only search_jobs_google)
   - Save searches? (quick filters like "All errors last week")

6. **Edge Cases:**
   - What if search returns 1,000 results? (paginate)
   - What if search query is too broad? ("Show fewer results. Try a more specific query.")
   - What if no matches? ("No activities found for 'Seattle'")

**Wireframe Request:**
Draw/describe 4 states:
1. Search input (collapsed/placeholder)
2. Search results (list with previews)
3. Jump to activity (scroll timeline + highlight)
4. No results (empty state)

---

### 7. Auto-Retry with Exponential Backoff

**Concept:** Automatically retry failed tools with increasing delays (1s, 2s, 4s, 8s, …).

**Example:**
```
✗ Failed: Connection timeout                  2:54 PM
   Retrying in 2s… [Cancel]

(2 seconds later)

🔄 Retrying search jobs google (attempt 2)    2:54 PM
⚡ Executing search jobs google               2:54 PM
✗ Failed: Connection timeout                  2:54 PM
   Retrying in 4s… [Cancel]

(4 seconds later)

🔄 Retrying search jobs google (attempt 3)    2:55 PM
⚡ Executing search jobs google               2:55 PM
✓ Found 5 jobs on Google Jobs                 2:56 PM
```

**Design Questions:**

1. **Retry Policy:**
   - Which errors should auto-retry? (network, server_error, rate_limit)
   - How many attempts? (3? 5? configurable?)
   - Backoff schedule: (1s, 2s, 4s, 8s, 16s, …) or (1s, 5s, 30s, 60s)?
   - Should max backoff cap at 60s?

2. **Visual Feedback:**
   - Show countdown timer? ("Retrying in 7s…")
   - Show progress bar? (circular countdown indicator)
   - Show attempt count? ("Attempt 2/5")
   - Animate countdown? (number counts down 10, 9, 8, …)

3. **User Control:**
   - Show "Cancel" button during countdown?
   - Show "Retry now" button? (skip countdown)
   - Should canceling auto-retry allow manual retry later?

4. **Batch Auto-Retry:**
   - If batch has 3 failed tools, retry all with same backoff?
   - Or independent backoff per tool? (might complete at different times)

5. **Success After Retry:**
   - Should we collapse previous failures? (show only final success)
   - Or keep all attempts visible? (show journey: fail, fail, success)
   - Show "Fixed after 3 attempts" badge?

6. **Edge Cases:**
   - What if page closes during countdown? (resume on reload?)
   - What if error changes on retry? (rate_limit → auth_failed)
   - What if user manually retries during countdown? (cancel auto-retry)

**Wireframe Request:**
Draw/describe 4 states:
1. Failed activity with countdown ("Retrying in 4s…")
2. Auto-retry in progress (attempt 2 indicator)
3. Auto-retry succeeds (show journey: 2 fails + 1 success)
4. Auto-retry exhausted (show "Max retries reached" + manual retry button)

---

### 8. Activity Context Menu

**Concept:** Right-click (or long-press on mobile) on activity to show context menu with actions.

**Example:**
```
✓ Found 5 jobs on Google Jobs                 2:54 PM
   (right-click)
   
   ┌─────────────────────┐
   │ 🔄 Retry             │
   │ 📋 Copy result       │
   │ 💾 Download JSON     │
   │ 🗑️ Delete activity   │
   └─────────────────────┘
```

**Design Questions:**

1. **Menu Trigger:**
   - Right-click (desktop) + long-press (mobile)?
   - Or show "⋮" icon on hover (like YouTube comments)?
   - Or both?

2. **Menu Actions:**
   - **Retry** - Re-run the tool
   - **Copy result** - Copy result JSON to clipboard
   - **Download JSON** - Save result as .json file
   - **Delete activity** - Remove from timeline (and DB?)
   - **Share** - Copy shareable link (if public workspace)
   - **Report error** - Send error details to support

3. **Conditional Actions:**
   - Only show "Retry" if activity failed or is retryable
   - Only show "Copy result" if result exists
   - Only show "Delete" if user has permission

4. **Delete Confirmation:**
   - Should deleting activity require confirmation? ("Delete this activity? This cannot be undone.")
   - Should delete be permanent (DB) or just hide (flag as deleted)?

5. **Mobile UX:**
   - Long-press to open menu (with haptic feedback)
   - Show backdrop to close menu on tap-outside
   - Large touch targets (44px min)

6. **Edge Cases:**
   - What if context menu opens near edge of screen? (flip direction)
   - What if user opens multiple context menus? (close previous)

**Wireframe Request:**
Draw/describe 2 scenarios:
1. Desktop context menu (right-click)
2. Mobile context menu (long-press + backdrop)

---

## Constraints & Edge Cases to Consider

### User Safety
- Replaying expensive operations (e.g., applying to job, sending email) should require confirmation
- Deleting activities should be reversible (soft delete) or require confirmation
- Auto-retry should respect rate limits (don't make problem worse)

### Performance
- Virtualizing large logs should not block UI thread
- Filtering 10,000+ activities should be instant (<100ms)
- Auto-retry with exponential backoff should not spam backend

### Privacy
- Replayed activities should redact sensitive params
- Downloaded JSON should redact credentials
- Shared activities should require explicit opt-in

### Accessibility
- Retry buttons should have clear ARIA labels ("Retry search jobs google")
- Auto-retry countdown should announce to screen readers ("Retrying in 5 seconds")
- Context menus should be keyboard-navigable (arrow keys + Enter)

---

## Research Questions

Before designing, consider:

1. **How do other tools handle replay/retry?**
   - GitHub Actions: "Re-run failed jobs" button
   - Postman: "Retry request" with editable params
   - Kubernetes: Auto-restart pods with exponential backoff

2. **What are common error recovery patterns?**
   - Gmail: "Undo send" (immediate recovery)
   - Stripe: "Retry webhook" (manual recovery)
   - AWS: Auto-retry with jitter (automatic recovery)

3. **How to balance automation vs control?**
   - Auto-retry is convenient but can feel "out of control"
   - Manual retry is explicit but requires user attention
   - Hybrid: Auto-retry with cancel option?

---

## Deliverables (Output Package)

Your Phase 3 design should include:

### 1. Replay Mechanism Specification
- Visual design (retry button, confirmation modal, attempt tracking)
- Parameter editing flow (inline vs modal)
- Retry tracking strategy (attempts, grouping)

### 2. Error Categorization System
- Error taxonomy (8 categories with icons, colors, recovery actions)
- Microcopy inventory (inline + expanded messages)
- Auto-retry decision tree (which errors, how many attempts)

### 3. Activity Filtering Specification
- Filter toolbar design (location, options, interaction)
- Filter persistence strategy (localStorage? DB?)
- Empty state design

### 4. Virtualized Log Viewer Specification
- Threshold and virtualization strategy
- Syntax highlighting approach
- Search/copy/download features

### 5. Batch Retry & Cancel Specification
- Batch-level controls (cancel, retry failed, retry all)
- Visual feedback for canceled tools
- Edge case handling

### 6. Activity History & Search Specification
- Search input design and location
- Search scope and results format
- Advanced search options

### 7. Auto-Retry Specification
- Retry policy (errors, attempts, backoff schedule)
- Visual countdown design
- User control (cancel, skip)

### 8. Context Menu Specification
- Trigger method (right-click, long-press)
- Menu actions (conditional based on activity state)
- Mobile-specific considerations

### 9. Microcopy Inventory
- All error messages (8 categories × 3 states = 24+ strings)
- All button labels (Retry, Cancel, Copy, Delete, etc.)
- All empty states
- All confirmations

### 10. Component Specifications
- RetryButton (props, states, interactions)
- ErrorCategoryBadge (visual treatment per category)
- ActivityFilter (toolbar component)
- VirtualizedLogViewer (virtualization strategy)
- BatchControls (cancel + retry buttons)
- ActivityContextMenu (actions, positioning)
- AutoRetryCountdown (timer component)

### 11. Implementation Phases
Break Phase 3 into 4-5 sub-phases:
- Sub-phase A: Replay mechanism (retry button, tracking)
- Sub-phase B: Error categorization & auto-retry
- Sub-phase C: Activity filtering & search
- Sub-phase D: Virtualized log viewer
- Sub-phase E: Polish (context menu, batch controls)

Each sub-phase should be deployable independently.

---

## Success Criteria

Phase 3 is successful if:

✅ Users can retry failed tools (100% of retryable errors)  
✅ Auto-retry reduces manual intervention by 80% (rate_limit, network)  
✅ Activity filtering reduces noise (hide 70% of non-essential events)  
✅ Large logs (50KB+) render without freezing UI (<500ms)  
✅ Context menu provides quick access to common actions  
✅ Error messages are actionable (100% have recovery guidance)  
✅ Phase 1 & 2 design preserved (no visual regressions)  

---

## References

**Read First:**
- [`CURSOR_STYLE_ACTIVITY_FEED.md`](./CURSOR_STYLE_ACTIVITY_FEED.md) - Phase 1 implementation
- [`PHASE_2_DESIGN.md`](./PHASE_2_DESIGN.md) - Phase 2 implementation (once complete)
- [`ACTIVITY_FEED_VISUAL_COMPARISON.md`](./ACTIVITY_FEED_VISUAL_COMPARISON.md) - Current visual design

**Existing Code to Review:**
- `components/agents/ChatPane.tsx` - ActivityCard component (Phase 1 & 2)
- `lib/claude-agent.ts` - Tool execution + error handling
- `app/api/chat/route.ts` - SSE streaming + error events

**Similar Patterns:**
- GitHub Actions: Retry failed jobs
- Postman: Retry requests with editable params
- AWS Console: Auto-retry with exponential backoff

---

## Output Format

Deliver your Phase 3 design as a single markdown document with:

1. **Executive Summary** (1 page)
2. **Replay Mechanism** (wireframes + specs)
3. **Error Categorization** (taxonomy + microcopy)
4. **Activity Filtering** (UI design + interaction)
5. **Virtualized Log Viewer** (technical approach)
6. **Batch Controls** (retry + cancel flows)
7. **Activity Search** (search UI + results)
8. **Auto-Retry** (policy + countdown design)
9. **Context Menu** (actions + positioning)
10. **Component Specifications** (all new components)
11. **Microcopy Inventory** (all strings)
12. **Implementation Roadmap** (sub-phases with estimates)
13. **Success Metrics** (measurable targets)

Include ASCII wireframes where helpful (like Phase 1 & 2).

---

**Now, design Phase 3: Replay & Error Recovery. Make it resilient, debuggable, and forgiving.**

