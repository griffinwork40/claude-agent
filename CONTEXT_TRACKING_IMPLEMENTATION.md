# Context Tracking & Unlimited Tool Iterations Implementation

## Summary

Successfully removed the 10-iteration limit and added comprehensive token tracking with UI display for context usage percentage.

## Changes Made

### 1. Backend - Token Tracking (`lib/claude-agent.ts`)

**Removed hard iteration limit:**
- Removed `MAX_TOOL_ITERATIONS = 10` constant
- Loop now continues until natural completion or context limit

**Added token counting:**
- Track `input_tokens` and `output_tokens` from Anthropic's API responses
- Capture usage data from `message_start` (input tokens) and `message_delta` (output tokens) events
- Accumulate tokens across all iterations
- Use Claude Haiku 4.5's 200K context window with 95% threshold (190K tokens)

**New termination conditions:**
1. Natural completion: `stop_reason === 'end_turn'`
2. Max tokens hit: `stop_reason === 'max_tokens'`
3. Context limit reached: cumulative tokens >= 190K (95% of 200K)
4. No more tools requested

**SSE events added:**
- New `context_usage` event type sent after each iteration
- Includes: `inputTokens`, `outputTokens`, `totalTokens`, `contextPercentage`, `iteration`
- Sent after initial stream and each continuation round

### 2. Type Definitions (`components/agents/types.ts`)

**Updated Activity interface:**
```typescript
type: ... | 'context_usage';  // New event type

// New fields:
inputTokens?: number;
outputTokens?: number;
totalTokens?: number;
contextPercentage?: number;
iteration?: number;
```

### 3. UI - Context Usage Display (`components/agents/ChatPane.tsx`)

**Added state tracking:**
```typescript
const [contextUsage, setContextUsage] = useState<{
  percentage: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
} | null>(null);
```

**Visual indicator in header:**
- Compact badge showing context usage percentage
- Color-coded based on usage:
  - Green: < 70% (safe)
  - Yellow: 70-90% (caution)
  - Red: > 90% (approaching limit)
- Format: "45.0% (45.0K/200K)"
- Tooltip shows input/output token breakdown
- Only visible during active streaming
- Clears when stream completes or errors

**Event handling:**
- Captures `context_usage` SSE events
- Updates state in real-time as agent makes progress
- Resets on completion/error

## Technical Details

### Token Tracking Flow

1. **Initial Stream:**
   - Capture `message_start` event → `input_tokens`
   - Capture `message_delta` event → `output_tokens`
   - Send `context_usage` event (iteration 0)

2. **Tool Execution Loop:**
   - Execute tools
   - Continue with new API call
   - Capture usage from each iteration
   - Accumulate: `cumulativeInputTokens`, `cumulativeOutputTokens`
   - Send updated `context_usage` event after each round

3. **Termination Check:**
   - After each iteration, calculate: `totalTokens / 200000 * 100`
   - Stop if >= 95% (190K tokens)
   - Also check `stop_reason` from API
   - Natural completion takes priority

### Context Window Details

- **Model:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **Context window:** 200,000 tokens
- **Safety threshold:** 95% (190,000 tokens)
- **Buffer:** 10,000 tokens reserved to avoid hard cutoff

### Backwards Compatibility

- All new fields are optional
- UI gracefully handles missing `context_usage` events
- Existing functionality unchanged if token data unavailable
- No breaking changes to existing API contracts

## Benefits

1. **No artificial limits** - Agent can continue working until task is done
2. **Transparent resource usage** - Users see exactly how much context is consumed
3. **Proactive warnings** - Visual feedback before hitting limits
4. **Smart termination** - Respects Claude's natural completion signals
5. **Developer visibility** - Detailed logging of token usage per iteration

## Usage in UI

When streaming is active, users will see a small badge in the chat header:

- **Green badge:** "23.5% (47.0K/200K)" - plenty of context left
- **Yellow badge:** "78.2% (156.4K/200K)" - getting close
- **Red badge:** "92.1% (184.2K/200K)" - approaching limit

Hover over the badge to see input/output token breakdown.

## Testing Recommendations

1. **Long conversation test:** Have agent search jobs, apply to multiple positions, send emails - verify context tracking updates
2. **Multi-tool test:** Trigger batch tool execution - confirm tokens accumulate correctly
3. **Limit test:** (Difficult to reach naturally) Verify graceful stop at 95% threshold
4. **Error handling:** Interrupt stream mid-execution - verify state clears properly

## Future Enhancements

Possible additions:
- Persist token usage to database for analytics
- Add context usage graph/chart over time
- Warning notification when approaching 90%
- Estimated tokens remaining for next operation
- Token usage per tool/action breakdown
