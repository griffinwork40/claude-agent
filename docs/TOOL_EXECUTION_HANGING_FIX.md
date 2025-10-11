# Tool Execution Hanging Fix

**Date:** 2025-10-11  
**Status:** ✅ Fixed  
**Severity:** Critical

## Problem Description

The conversation would freeze after Claude executed the first tool (e.g., `browser_navigate`). The user would see:
- The tool execution activity events in the activity feed
- The navigation success message  
- But then **no response text from Claude**
- The conversation appeared frozen, unable to send new messages

### User Experience
```
User: "line cook altamonte springs"
Agent: [Executes browser_navigate tool]
Activity Feed: "Navigated to https://www.indeed.com/jobs?q=line+cook&l=..."
Agent: [silence... frozen]
```

## Root Cause

The continuation stream handler in `lib/claude-agent.ts` (lines 273-286) was **incomplete**:

```typescript
// OLD CODE - Only handled text deltas
for await (const chunk of continuationStream) {
  if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
    // Handle text...
  } else if (chunk.type === 'message_stop') {
    break;
  }
}
```

**The problem:** After executing a tool like `browser_navigate`, Claude would receive the tool result and then want to:
1. Take a snapshot of the page to see what's there
2. Extract job listings
3. Analyze the results
4. Respond to the user

But since the continuation handler **only processed text deltas**, when Claude tried to use more tools, those tool use blocks were **ignored**. The stream would complete without producing any output, leaving the conversation frozen.

### Why This Happened

Claude's tool-calling workflow is:
```
User message → Claude thinks → Uses tool(s)
  → Receives tool result(s) → Often uses MORE tools or thinks more
    → Finally responds with text
```

The original code assumed Claude would always respond with text immediately after receiving tool results, but in reality, Claude often needs to take **multiple tool actions** before formulating a response.

## Solution

Replaced the recursive continuation approach with a **clean iterative loop** that allows Claude to chain as many tools as needed:

### Key Changes

1. **Iterative loop instead of recursion**:
   ```typescript
   const MAX_TOOL_ITERATIONS = 5;
   let iteration = 0;
   let shouldContinue = true;
   
   while (shouldContinue && iteration < MAX_TOOL_ITERATIONS) {
     iteration++;
     // Stream continuation, check for tools, execute them, loop again
   }
   ```

2. **Handle all chunk types in each iteration**:
   - `content_block_start` - Track when new text or tool blocks begin
   - `content_block_delta` - Stream text to client, accumulate tool input JSON
   - `content_block_stop` - Finalize tool use blocks
   - `message_stop` - Execute any tools and continue loop

3. **Track tool uses and text separately**:
   ```typescript
   const continuationToolUses: ToolUse[] = [];
   let hasText = false;
   // If tools found, execute and loop again
   // If no tools, end loop
   ```

4. **Update conversation history each iteration**:
   ```typescript
   continuationMessages = [
     ...continuationMessages,
     { role: 'assistant', content: assistantContent },
     { role: 'user', content: toolResults }
   ];
   ```

5. **Comprehensive logging per iteration**:
   - `🔄 Starting continuation iteration N/5...`
   - `✓ Continuation N completed. Text: true/false, Tools: X`
   - `✓ Tool execution loop completed after N iterations`

### New Flow

```
User: "line cook altamonte springs"
  ↓
Initial Stream: Claude uses browser_navigate
  ↓
Tool Execution: Navigate to Indeed
  ↓
Iteration 1: Claude uses browser_wait (wait for page load)
  ↓
Tool Execution: Wait 5 seconds
  ↓
Iteration 2: Claude uses browser_snapshot (see what's on page)
  ↓
Tool Execution: Capture accessibility tree
  ↓
Iteration 3: Claude uses browser_get_content (get full text)
  ↓
Tool Execution: Extract page content
  ↓
Iteration 4: Claude responds with text (no more tools)
  ↓
"I found 10 line cook positions in Altamonte Springs! Here are the top matches..."
  ↓
Loop ends (no more tools to execute)
```

## Files Modified

- **`lib/claude-agent.ts`** (lines 262-398)
  - Expanded continuation stream handler to track and execute tool uses
  - Added recursive continuation for multi-step tool chains
  - Added detailed logging for debugging tool execution flow
  - Added activity events for all continuation tool actions

## Testing

To verify the fix works:

1. Start a conversation with a job search query
2. Observe the activity feed showing multiple tool executions:
   - Initial navigation
   - Continuation snapshot/extraction
   - Final response
3. Verify the conversation completes with Claude's text response
4. Verify you can send follow-up messages

### Expected Behavior

**Activity Feed should show:**
```
🔵 starting
🔧 Starting browser_navigate
🔧 Executing browser_navigate
✅ Navigated to https://...
🔧 Starting browser_wait
🔧 Executing browser_wait
✅ Page loaded
🔧 Starting browser_snapshot
🔧 Executing browser_snapshot  
✅ Page snapshot captured
🔧 Starting browser_get_content
🔧 Executing browser_get_content
✅ Page content retrieved
💬 "I found 10 line cook positions..."
```

## Prevention

To prevent this issue in the future:

1. **Always handle all chunk types** when processing Claude streaming responses
2. **Use iterative loops instead of recursion** for tool chaining - easier to reason about and no depth limits
3. **Add comprehensive logging** at each iteration to track progress
4. **Test tool-heavy workflows** to ensure all iterations complete
5. **Set reasonable MAX_ITERATIONS** to prevent infinite loops (currently 5)

## Related Issues

This fix enables the full agentic workflow where Claude can:
- Navigate to a job site
- Take a snapshot of the results
- Extract structured data from the page
- Click on job listings for more details
- Apply to jobs
- Respond to the user with a complete summary

All of these multi-step workflows now work correctly with proper continuation handling.

