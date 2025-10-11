# Conversation Separation Bug Fix

## Problem
When creating a new conversation or switching between conversations, messages from the old conversation would still appear after the LLM responded. The messages were separated at first, but once streaming completed, you could scroll up and see messages from the previous conversation.

## Root Cause

### Issue 1: Messages Not Linked to Conversations
- Messages stored in the database only had `user_id`, `content`, and `sender`
- No `session_id` or `agent_id` field to link messages to specific conversations
- When fetching messages from the API, ALL messages for a user were returned

### Issue 2: Incorrect Message Assignment
In `app/agent/page.tsx`, the `refreshMessages()` function was:
```typescript
// Convert server messages to our Message format
const serverMessages: Message[] = data.data.map((msg: ServerMessage) => ({
  id: msg.id,
  agentId: selectedAgent?.id || 'default',  // ❌ Assigns CURRENT agent to ALL messages
  role: msg.sender === 'user' ? 'user' : 'assistant',
  content: msg.content,
  createdAt: msg.created_at,
}));
setMessages(serverMessages);
```

This meant ALL messages from the database were assigned to whichever agent was currently selected.

### Issue 3: Messages Not Cleared on Agent Switch
When switching agents or creating a new conversation, the message state persisted, so old messages would remain visible.

## Solution

### 1. Clear Messages on Agent Change
Updated `app/agent/page.tsx` to clear messages when creating a new agent or selecting a different agent:

```typescript
function handleCreateAgent() {
  // ...
  // Clear messages for the new conversation
  setMessages([]);
  // ...
}

function handleSelect(agentId: string) {
  // ...
  // Clear messages when switching agents
  setMessages([]);
  // ...
}
```

### 2. Track Messages in Local State
Instead of fetching all messages from the database and incorrectly assigning them to agents, we now:
- Store messages in local component state only
- Add messages immediately when user sends a message
- Add messages when assistant completes streaming

Changes in `components/agents/ChatPane.tsx`:
```typescript
const handleStreamingSend = async (content: string) => {
  // Add user message to local state immediately
  const userMessage: RenderMessage = {
    id: `msg-${Date.now()}-user`,
    agentId: agent.id,
    role: 'user',
    content: content,
    createdAt: new Date().toISOString(),
  };
  onSend(content, agent.id, userMessage);
  
  // ... stream response ...
  
  // When complete, add assistant message
  const assistantMessage: RenderMessage = {
    id: `msg-${Date.now()}-assistant`,
    agentId: agent.id,
    role: 'assistant',
    content: streamingMessage,
    createdAt: new Date().toISOString(),
  };
  onSend(streamingMessage, agent.id, assistantMessage);
}
```

### 3. Reset Session State on Agent Change
Added useEffect in `ChatPane.tsx` to reset session state when switching agents:

```typescript
useEffect(() => {
  if (agent?.id !== currentAgentId) {
    console.log('Agent changed, resetting session');
    setCurrentAgentId(agent?.id ?? null);
    setSessionId(null);
    setIsStreaming(false);
    setStreamingMessage('');
    setStreamingStartedAt(null);
  }
}, [agent?.id, currentAgentId]);
```

### 4. Updated Message Handling Callback
Changed the `onSend` callback signature to accept the full message object:

```typescript
// types.ts
export interface ChatPaneProps {
  // ...
  onSend: (content: string, agentId: string, message: Message) => void;
  // ...
}

// page.tsx
function handleAddMessage(content: string, agentId: string, message: Message) {
  setMessages((prev) => [...prev, message]);
}
```

## Result
Now each conversation maintains its own message history properly:
- Creating a new conversation starts with an empty message list
- Switching between conversations shows only the messages for that specific conversation
- Messages are correctly associated with the agent/conversation they belong to
- No messages bleed across conversations

## Additional Fix: Message Disappearing Bug

After the initial fix, there was a bug where the user's sent message would disappear from the UI immediately after sending.

### Root Cause
In `handleSelect()`, we were clearing ALL messages with `setMessages([])` when switching between agents. This was incorrect because:
1. Messages are already tagged with their `agentId`
2. The `ChatPane` component filters messages by `agentId` using `visibleMessages`
3. Clearing messages on agent selection removed the message that was just added

### Fix
Remove the `setMessages([])` call from `handleSelect()`:
```typescript
function handleSelect(agentId: string) {
  setSelectedAgentId(agentId);
  // Don't clear messages - let ChatPane filter by agentId
  // Each message is tagged with its agentId, so filtering will show only relevant messages
  // ...
}
```

Now messages persist in state and are properly filtered:
- **Creating a new agent**: Messages ARE cleared (correct behavior)
- **Switching between existing agents**: Messages are NOT cleared, just filtered by `agentId`

## Additional Fix: Assistant Message Disappearing

After fixing the user message issue, there was another bug where the assistant's streamed response would disappear after completion.

### Root Cause
In the `complete` event handler, we were reading `streamingMessage` state directly:
```typescript
const assistantMessage: Message = {
  // ...
  content: streamingMessage,  // ❌ Reading stale closure value
};
onSend(streamingMessage, agent.id, assistantMessage);
setStreamingMessage('');  // Then clearing it
```

The problem is that `streamingMessage` was being read from the closure, which could be stale or empty, and then we'd immediately clear it.

### Fix
Use the functional form of `setStreamingMessage` to capture the current value:
```typescript
setStreamingMessage(finalContent => {
  // finalContent is guaranteed to be the current accumulated message
  const assistantMessage: Message = {
    // ...
    content: finalContent,
  };
  onSend(finalContent, agent.id, assistantMessage);
  return '';  // Clear after capturing
});
```

This ensures we capture the complete message content before clearing it, so the message persists in the parent state.

## Future Improvements
For production, consider:
1. Adding a `session_id` column to the database messages table
2. Storing messages with their session ID for persistence across page reloads
3. Fetching messages filtered by session ID from the API
4. Implementing proper conversation persistence in the database

