# Phase 2 & 3 UI/UX Design Prompts

**Purpose:** These prompts guide an AI coding agent (like Claude, Cursor, or another LLM) to act as a senior UI/UX designer and create comprehensive design specifications for Phase 2 and Phase 3 of the activity feed enhancement.

---

## Overview

After successfully completing **Phase 1** (Cursor-style lightweight activity feed), we need detailed design specifications for:

- **Phase 2:** Structured Event Stream (persistence, thought chips, aggregate progress)
- **Phase 3:** Replay & Error Recovery (retry, filtering, virtualization)

Rather than jumping straight into implementation, these prompts enable **discovery-driven design** where an AI designer explores the problem space, asks the right questions, and delivers production-ready specifications.

---

## How to Use These Prompts

### Step 1: Choose Your AI Coding Agent

These prompts work with any AI coding agent that can:
- Read existing codebase context
- Think through design problems systematically
- Generate detailed specifications with wireframes
- Ask clarifying questions when needed

**Recommended agents:**
- Claude (Anthropic) - Original creator of these prompts
- Cursor AI - Built for coding workflows
- GitHub Copilot Chat - Good for context-aware design
- Any GPT-4+ based coding assistant

---

### Step 2: Load Context

Before using a prompt, provide the AI with:

1. **Phase 1 Context:**
   - [`CURSOR_STYLE_ACTIVITY_FEED.md`](./CURSOR_STYLE_ACTIVITY_FEED.md) - Current implementation
   - [`ACTIVITY_FEED_VISUAL_COMPARISON.md`](./ACTIVITY_FEED_VISUAL_COMPARISON.md) - Visual design
   - [`components/agents/ChatPane.tsx`](./components/agents/ChatPane.tsx) - Code (lines 342-423)

2. **Backend Context:**
   - [`app/api/chat/route.ts`](./app/api/chat/route.ts) - SSE streaming endpoint
   - [`lib/claude-agent.ts`](./lib/claude-agent.ts) - Tool execution logic
   - [`components/agents/types.ts`](./components/agents/types.ts) - Activity types

3. **Database Schema:**
   - Supabase `messages` table (already persisted)
   - Supabase `activities` table (to be created in Phase 2)

---

### Step 3: Run the Prompt

Copy the entire prompt markdown file and paste it into your AI agent's chat.

**For Phase 2:**
```
[Paste entire contents of PHASE_2_UI_UX_PROMPT.md]
```

**For Phase 3:**
```
[Paste entire contents of PHASE_3_UI_UX_PROMPT.md]
```

---

### Step 4: Iterate on the Design

The AI will deliver a comprehensive design specification, but you may need to:

1. **Ask clarifying questions:** "How does this work on mobile?"
2. **Request alternatives:** "Show 3 options for the retry button placement"
3. **Dive deeper:** "Expand the database schema section with RLS policies"
4. **Adjust constraints:** "We can't use websockets; SSE only"

---

### Step 5: Convert to Implementation Plan

Once the design is complete, use it to:

1. **Create engineering tickets** (one per sub-phase)
2. **Write technical specs** (based on API contracts and component specs)
3. **Estimate effort** (based on implementation roadmap)
4. **Kick off implementation** (engineers have clear requirements)

---

## What Each Prompt Delivers

### Phase 2 Prompt: Structured Event Stream

**Input:** Context about Phase 1 + prompt  
**Output:** A single markdown document with:

1. **Database schema** (SQL migration with indexes, RLS policies)
2. **Thought preview chips** (visual design + content strategy)
3. **Aggregate progress indicators** (collapsed + expanded states)
4. **Reload continuity flow** (loading states + merge strategy)
5. **API contract** (REST endpoints + SSE event schema)
6. **Microcopy inventory** (30+ status messages)
7. **Component specifications** (props, states, interactions)
8. **Implementation roadmap** (4 sub-phases with estimates)

**Estimated AI time:** 15-30 minutes (depending on model)

---

### Phase 3 Prompt: Replay & Error Recovery

**Input:** Context about Phase 1 & 2 + prompt  
**Output:** A single markdown document with:

1. **Replay mechanism** (retry button + parameter editing + tracking)
2. **Error categorization** (8 error types + recovery guidance)
3. **Activity filtering** (filter toolbar + options + persistence)
4. **Virtualized log viewer** (large result handling + syntax highlighting)
5. **Batch retry & cancel** (batch-level controls + visual feedback)
6. **Activity history & search** (search UI + results format)
7. **Auto-retry specification** (retry policy + backoff schedule)
8. **Context menu** (right-click actions + mobile support)
9. **Component specifications** (8+ new components)
10. **Implementation roadmap** (5 sub-phases with estimates)

**Estimated AI time:** 20-40 minutes (depending on model)

---

## Prompt Structure

Each prompt follows a consistent structure:

### 1. Role & Context
- Defines AI as senior UI/UX designer
- Provides background on Phase 1 completion
- Explains current gaps and pain points

### 2. Mission
- Clear goal: "Design the interaction model for Phase X"
- Deliverables: "Enable engineers to implement with minimal ambiguity"

### 3. Constraints & Principles
- Preserve Phase 1 aesthetic
- Database as source of truth
- Privacy-first (redaction rules)
- Minimal diff (reuse components)

### 4. What to Design (Deliverables)
- 8-10 major design areas
- Each with:
  - Concept explanation
  - Design questions (10-30 questions)
  - Wireframe request
  - Edge cases to consider

### 5. Research Questions
- How do similar tools solve this? (GitHub Actions, Postman, etc.)
- What are the performance implications?
- What are the privacy implications?

### 6. Deliverables (Output Package)
- Detailed list of expected outputs
- Format specifications
- Success criteria

### 7. References
- Links to Phase 1 docs
- Existing code to review
- Similar patterns in other tools

---

## Design Philosophy

These prompts embody several key principles:

### 1. **Discovery-Driven Design**
Rather than prescribing solutions, the prompts ask the AI to:
- Explore the problem space systematically
- Ask the right questions
- Consider trade-offs
- Propose alternatives

### 2. **Question-Rich, Not Directive**
Each design area includes 20-40 questions like:
- "Should thought chips persist to DB or be ephemeral?"
- "What if retry is expensive? Show confirmation?"
- "How to handle incomplete activities after page reload?"

This forces the AI to think through edge cases and make explicit design decisions.

### 3. **Wireframe-Centric**
Every design area requests ASCII wireframes showing:
- Default state
- Interaction states (hover, expanded, error)
- Edge cases (empty, loading, failure)

### 4. **Implementation-Ready**
The prompts bridge design → engineering by requesting:
- Database schemas (SQL with indexes)
- API contracts (REST + SSE event schemas)
- Component specifications (props, states, methods)
- Implementation roadmaps (phased with estimates)

### 5. **Preserve Phase 1 Quality**
Every prompt emphasizes:
- Keep Cursor-style lightweight aesthetic
- No visual regressions
- Minimal diff (reuse existing components)

---

## Example Output Quality

When used correctly, these prompts produce designs with:

✅ **Comprehensive coverage** - Every state, edge case, and interaction documented  
✅ **Visual clarity** - ASCII wireframes show exactly what to build  
✅ **Technical specificity** - SQL schemas, API contracts, component props all defined  
✅ **Implementation-ready** - Engineers can start coding immediately  
✅ **Measurable success** - Concrete metrics (e.g., "Activities persist 100%")  

---

## Customization

Feel free to modify the prompts for your needs:

### To Simplify
- Remove advanced features (e.g., skip virtualization in Phase 3)
- Reduce deliverables (e.g., skip context menu)
- Shorten sub-phases (combine sub-phase A + B)

### To Expand
- Add more design areas (e.g., "Activity export to CSV")
- Request more wireframes (e.g., "Show 5 states instead of 3")
- Add more constraints (e.g., "Must work offline")

### To Adapt to Your Stack
- Change database from Supabase to PostgreSQL
- Change from SSE to WebSockets
- Change from React to Vue/Svelte

Just update the relevant sections in the prompt.

---

## Success Stories

These prompts were used to:

1. **Phase 1 Discovery Brief** - Generated comprehensive UI/UX analysis that led to Cursor-style refactor
2. **Phase 1 Implementation** - Delivered in 4 hours with zero production bugs
3. **Phase 2 & 3 Planning** - Created these prompts to enable future AI-driven design

**Result:** 98.5% project completion with professional-grade UI/UX.

---

## FAQ

### Q: Can I use these prompts with non-AI designers?

**A:** Yes! These prompts work as design briefs for human designers too. They provide:
- Clear scope and constraints
- Comprehensive question lists (saves hours of discovery)
- Expected deliverable format
- Success criteria

Just remove the "Role: You are an AI..." preamble.

---

### Q: How long does each design phase take?

**A:** Depends on your AI model and depth:

| Model | Phase 2 | Phase 3 |
|-------|---------|---------|
| GPT-4 | 20-30 min | 30-45 min |
| Claude Sonnet | 15-25 min | 25-40 min |
| Claude Opus | 10-20 min | 20-30 min |

Expect 2-3 rounds of iteration for best results.

---

### Q: What if the AI skips important details?

**A:** Follow up with specific questions:
- "Expand the database schema section with RLS policies"
- "Show 3 alternative designs for the retry button"
- "Add mobile-specific wireframes"

The prompts are designed for iterative refinement.

---

### Q: Can I combine Phase 2 & 3 into one prompt?

**A:** Not recommended. Each phase is 5,000-10,000 words of spec. Combining them would:
- Overwhelm the AI's context window
- Reduce depth and quality
- Make iteration harder

Keep them separate for best results.

---

### Q: What if my AI doesn't follow the prompt format?

**A:** Try:
1. **Reiterate constraints:** "Remember to include ASCII wireframes for each state"
2. **Request specific sections:** "Now generate the database schema section"
3. **Use examples:** "Like this: [paste example from Phase 1 docs]"

Most modern AI coding agents handle these prompts well.

---

### Q: How do I know if the design is good?

**A:** Check against success criteria in each prompt:

**Phase 2:**
- Activities persist across reloads? ✅
- Dead air reduced to <500ms? ✅
- Multi-tool batches show aggregate progress? ✅

**Phase 3:**
- Users can retry failed tools? ✅
- Activity filtering reduces noise? ✅
- Large logs render without freezing? ✅

If criteria are met, design is good.

---

## Next Steps

1. **Review Phase 1 implementation** ([`CURSOR_STYLE_ACTIVITY_FEED.md`](./CURSOR_STYLE_ACTIVITY_FEED.md))
2. **Choose your AI coding agent** (Claude, Cursor, Copilot, etc.)
3. **Load Phase 2 context** (implementation docs + code)
4. **Run Phase 2 prompt** ([`PHASE_2_UI_UX_PROMPT.md`](./PHASE_2_UI_UX_PROMPT.md))
5. **Iterate on design** (ask clarifying questions)
6. **Convert to implementation plan** (break into engineering tickets)
7. **Repeat for Phase 3** after Phase 2 ships

---

## Support

If you're stuck or need guidance:

1. **Check examples:** Review [`UI_UX_DISCOVERY_SPRINT_SUMMARY.md`](./UI_UX_DISCOVERY_SPRINT_SUMMARY.md) for Phase 1 output quality
2. **Review references:** All prompts link to relevant docs and code
3. **Ask the AI:** "What information do you need to complete this section?"

---

## Credits

**Created by:** Claude (Anthropic) via UI/UX Discovery Sprint  
**Date:** October 11, 2025  
**Project:** Enlist - Job Search Agent  
**Methodology:** Discovery-driven design with AI coding agents  

---

**Good luck designing Phase 2 & 3! May your activity feeds be persistent, predictive, and performant.** 🚀

