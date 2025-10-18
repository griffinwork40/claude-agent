# Context Tracking Visual Guide

## UI Changes

### Before
```
┌─────────────────────────────────────────┐
│  Chat — Job Search Assistant            │
├─────────────────────────────────────────┤
│                                         │
│  (messages)                             │
│                                         │
└─────────────────────────────────────────┘
```

### After (during streaming)
```
┌─────────────────────────────────────────────────────────┐
│  Chat — Job Search Assistant  🧠 23.5% (47.0K/200K)    │ <- Green badge
├─────────────────────────────────────────────────────────┤
│                                                         │
│  (messages with real-time context tracking)            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Badge Colors

### Green (< 70%)
```
┌──────────────────────────────┐
│ 🧠 23.5% (47.0K/200K)       │  Light green background
└──────────────────────────────┘  Green text, green border
```

### Yellow (70-90%)
```
┌──────────────────────────────┐
│ 🧠 78.2% (156.4K/200K)      │  Light yellow background
└──────────────────────────────┘  Yellow text, yellow border
```

### Red (> 90%)
```
┌──────────────────────────────┐
│ 🧠 92.1% (184.2K/200K)      │  Light red background
└──────────────────────────────┘  Red text, red border
```

## Console Output Examples

### Initial Stream
```
📊 Initial usage: input_tokens=1234
📊 Initial usage: output_tokens=567
📊 Initial tokens: 1801 (0.9% of 200000)
✓ Context usage event sent
```

### Tool Execution Loop
```
🔄 Starting continuation iteration 1...
📊 Usage: input_tokens=2345
📊 Usage: output_tokens=1234
📊 Cumulative tokens: 5380 (2.7% of 200000)
   Input: 3579, Output: 1801
✓ Context usage event sent

🔄 Starting continuation iteration 2...
...
```

### Context Limit Warning
```
📊 Cumulative tokens: 185423 (92.7% of 200000)
   Input: 123456, Output: 61967
⚠️ Context limit reached (185423/190000), stopping
🧠 Thinking: Reached context limit (93% used). Completing response...
```

### Natural Completion
```
📊 Cumulative tokens: 45678 (22.8% of 200000)
   Input: 30456, Output: 15222
📊 Stop reason: end_turn
✓ Natural completion (end_turn), stopping
```

## Flow Diagram

```
User sends message
       ↓
Initial API call → [Capture tokens] → Send context_usage event
       ↓
Tools requested?
       ↓ Yes
Execute tools
       ↓
Continuation call → [Capture tokens] → Accumulate totals
       ↓
Send context_usage event → Update UI badge
       ↓
Check conditions:
  • Total tokens >= 190K? → STOP (context limit)
  • stop_reason = end_turn? → STOP (natural completion)
  • stop_reason = max_tokens? → STOP (max tokens)
  • More tools requested? → Loop back to "Execute tools"
  • No more tools? → STOP (task complete)
       ↓
Complete stream → Clear UI badge
```

## Event Sequence Example

```javascript
// SSE events received by client:

data: {"type":"status","content":"starting"}

data: {"type":"chunk","content":"I'll help you find jobs..."}

data: {"type":"context_usage","content":"Context: 0.9% (1.8K/200K)","inputTokens":1234,"outputTokens":567,"totalTokens":1801,"contextPercentage":0.9,"iteration":0}

data: {"type":"tool_start","tool":"search_jobs_linkedin","toolId":"toolu_abc123"}

data: {"type":"tool_result","tool":"search_jobs_linkedin","success":true,...}

data: {"type":"context_usage","content":"Context: 2.7% (5.4K/200K)","inputTokens":3579,"outputTokens":1801,"totalTokens":5380,"contextPercentage":2.7,"iteration":1}

data: {"type":"chunk","content":"I found 15 relevant positions..."}

data: {"type":"complete","sessionId":"session_123"}
```

## Code Locations

### Token Capture (claude-agent.ts)
```typescript
// Lines ~387-394: Initial stream token tracking
let initialInputTokens = 0;
let initialOutputTokens = 0;

// Lines ~488-500: Capture from message_start and message_delta events
if (chunk.type === 'message_start') {
  initialInputTokens = chunk.message?.usage?.input_tokens || 0;
}
if (chunk.type === 'message_delta') {
  initialOutputTokens = chunk.usage?.output_tokens || 0;
}
```

### Context Usage Event (claude-agent.ts)
```typescript
// Lines ~506-517: Send context usage as SSE
sendActivity('context_usage', {
  content: `Context: ${contextPercentage.toFixed(1)}% (${totalTokens.toLocaleString()}/${CONTEXT_LIMIT.toLocaleString()} tokens)`,
  inputTokens: cumulativeInputTokens,
  outputTokens: cumulativeOutputTokens,
  totalTokens: totalTokens,
  contextPercentage: contextPercentage,
  iteration: 0
});
```

### UI Badge (ChatPane.tsx)
```typescript
// Lines ~955-973: Context usage badge in header
{isStreaming && contextUsage && (
  <div 
    className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${
      contextUsage.percentage < 70 ? 'bg-green-...' : 
      contextUsage.percentage < 90 ? 'bg-yellow-...' : 
      'bg-red-...'
    }`}
  >
    <Brain className="w-3.5 h-3.5" />
    <span>
      {contextUsage.percentage.toFixed(1)}% ({(contextUsage.totalTokens / 1000).toFixed(1)}K/200K)
    </span>
  </div>
)}
```
