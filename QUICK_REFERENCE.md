# Quick Reference: Context Tracking & Unlimited Iterations

## TL;DR

✅ **Removed** 10-iteration limit  
✅ **Added** real-time token tracking  
✅ **Display** context usage % in UI  
✅ **Smart stop** based on Claude's signals + 95% threshold  

## What You'll See

### In the UI (Chat Header)
```
During streaming: 🧠 23.5% (47.0K/200K)
                   ↑    ↑     ↑      ↑
                Color  %   Current  Max
```

**Colors:**
- 🟢 Green: 0-69% (safe)
- 🟡 Yellow: 70-89% (getting close)
- 🔴 Red: 90-100% (approaching limit)

### In Console Logs
```
📊 Initial tokens: 1801 (0.9% of 200000)
🔄 Starting continuation iteration 1...
📊 Cumulative tokens: 5380 (2.7% of 200000)
✓ Natural completion (end_turn), stopping
```

## When Does It Stop?

1. **Natural:** Claude signals `end_turn` (task complete)
2. **Max tokens:** Claude hits response token limit
3. **Context limit:** Reaches 190K tokens (95% of 200K)
4. **No work:** No more tools to execute

## Modified Files

1. `lib/claude-agent.ts` - Core logic + token tracking
2. `components/agents/types.ts` - Type definitions
3. `components/agents/ChatPane.tsx` - UI badge
4. `app/api/chat/route.ts` - Event forwarding

## Key Constants

```typescript
CONTEXT_LIMIT = 200000      // Claude Haiku 4.5 context window
CONTEXT_THRESHOLD = 0.95    // Stop at 95%
MAX_TOKENS = 190000         // 95% of 200K
```

## New Event Type

```typescript
{
  type: 'context_usage',
  inputTokens: 3579,
  outputTokens: 1801,
  totalTokens: 5380,
  contextPercentage: 2.7,
  iteration: 1,
  content: "Context: 2.7% (5,380/200,000 tokens)"
}
```

## Testing Command

```bash
npm run dev
# Open http://localhost:3000/agent
# Send: "Find me 5 jobs you think I'd like"
# Watch the green badge appear in header!
```

## Rollback (if needed)

To revert changes:
```bash
git diff lib/claude-agent.ts components/agents/types.ts components/agents/ChatPane.tsx
# Review changes
git checkout HEAD -- lib/claude-agent.ts components/agents/types.ts components/agents/ChatPane.tsx
```

## Support Docs

- `CONTEXT_TRACKING_IMPLEMENTATION.md` - Full technical details
- `CONTEXT_TRACKING_VISUAL_GUIDE.md` - UI mockups + examples
- `IMPLEMENTATION_COMPLETE.md` - Complete summary

## Status: ✅ READY FOR PRODUCTION
