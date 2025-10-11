# Conversation Memory Fix

## Problem
The agent was not remembering previous messages in the conversation. Each user message was treated as a completely new conversation, causing the agent to lose all context from previous exchanges.

## Root Cause
In `lib/claude-agent.ts`, the `runClaudeAgentStream()` function was maintaining a session with message history in memory:

```typescript
// Session was storing messages
session.messages.push({ role: 'user', content: userMessage });
```

**BUT** when calling the Claude API, it was only sending the latest user message:

```typescript
// ❌ WRONG: Only sending current message
const messages = [
  { role: 'user' as const, content: userMessage }
];
```

This meant Claude API never received the conversation history, so every request appeared to be starting a brand new conversation.

## Solution

### 1. Send Full Conversation History to Claude
Changed the messages array to use the complete session history:

```typescript
// ✅ CORRECT: Send full conversation history
const messages = session.messages.map(msg => ({
  role: msg.role as 'user' | 'assistant',
  content: msg.content
}));
```

### 2. Save Assistant Responses to Session
Added tracking of the assistant's complete response (including both initial and tool continuation responses):

```typescript
// Track the complete text response to save to session history
let fullAssistantResponse = '';

// Accumulate during streaming
fullAssistantResponse += content;

// Save to session after streaming completes
if (fullAssistantResponse.trim()) {
  session.messages.push({ 
    role: 'assistant', 
    content: fullAssistantResponse 
  });
}
```

## How It Works Now

### Flow for a Multi-Turn Conversation

**Turn 1:**
- User: "What's the weather like?"
- Session: `[{role: 'user', content: 'What's the weather like?'}]`
- Claude receives: Same as session
- Assistant: "I don't have access to weather data..."
- Session: `[{user}, {assistant: "I don't have access..."}]`

**Turn 2:**
- User: "Okay, can you help me with my resume?"
- Session: `[{user: weather}, {assistant: no access}, {user: resume}]`
- Claude receives: **Full conversation history** (all 3 messages)
- Assistant: "Of course! I remember you asked about weather first. Let me help with your resume..."

## Benefits

1. **True Multi-Turn Conversations**: Agent can reference previous messages
2. **Context Preservation**: No need to repeat information
3. **Better User Experience**: Natural conversation flow
4. **Tool Use Context**: When using browser tools, the full context helps Claude make better decisions

## Testing

To verify the fix works:

1. Start a conversation: "Hello, my name is John"
2. Send a follow-up: "What did I just tell you my name was?"
3. Agent should correctly respond with "John"

Previously, the agent would have no memory of the first message.

## Technical Details

- **Session Storage**: In-memory Map keyed by sessionId
- **Session Lifecycle**: Persists across requests for the same sessionId
- **Message Format**: Simple `{role, content}` structure matching Claude API format
- **Memory Management**: Sessions stored in memory (consider Redis for production scale)

## Files Modified

- `lib/claude-agent.ts`:
  - Line 115-118: Use full session history when calling Claude
  - Line 154: Add `fullAssistantResponse` tracker
  - Line 190: Accumulate text chunks
  - Line 281: Accumulate continuation chunks
  - Line 289-300: Save complete response to session

## Future Improvements

1. **Persistent Storage**: Move sessions to database for multi-server deployments
2. **Context Window Management**: Implement truncation for very long conversations
3. **Token Counting**: Track token usage and warn when approaching limits
4. **Session Cleanup**: Implement TTL to clear inactive sessions
5. **Export/Import**: Allow users to save/restore conversation history

