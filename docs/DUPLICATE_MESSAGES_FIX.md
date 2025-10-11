# Duplicate Messages Fix

## Problem
Users were seeing duplicate chat messages from the LLM in the UI.

## Root Cause
Messages were being added to the state **twice**:

1. **During streaming** (ChatPane.tsx): When the stream completed, we called `onSend()` to add the assistant's message to the parent state
2. **From database** (app/agent/page.tsx): On mount, we loaded ALL messages from the database, including the ones we had just added via `onSend()`

This resulted in:
- User sends message → added via `onSend()` ✓
- Assistant responds → streamed and added via `onSend()` ✓
- Page loads → loads BOTH messages from DB again ✗
- **Result**: 2x user message + 2x assistant message

## Solution
Changed the architecture to use the **database as the single source of truth**:

1. **User messages**: Still added immediately to state via `onSend()` for instant UI feedback
2. **Assistant messages**: 
   - During streaming: Show in a temporary streaming state
   - After completion: Clear streaming state and trigger a reload from the database
   - The API route saves the complete message to the DB
   - ChatPane dispatches a `reload-messages` event
   - Parent component listens for this event and reloads all messages from DB

## Changes Made

### 1. ChatPane.tsx
- Removed the call to `onSend()` for assistant messages on stream completion
- Added a custom event dispatch `window.dispatchEvent(new CustomEvent('reload-messages'))` to trigger a reload
- Messages are now loaded from the database as the source of truth

### 2. app/agent/page.tsx
- Added an event listener for the `reload-messages` custom event
- When triggered, reloads all messages from the database via `loadMessagesFromAPI()`
- This ensures the UI always reflects the database state

### 3. Benefits
- **No duplicates**: Each message exists once in state (loaded from DB)
- **Single source of truth**: Database is authoritative
- **Instant feedback**: User messages still appear immediately
- **Streaming works**: Assistant responses stream in real-time, then are persisted
- **Clean architecture**: Clear separation between transient UI state (streaming) and persisted data (database)

## Testing
To verify the fix:
1. Send a message in the chat
2. Watch the assistant's response stream in
3. After completion, the message should appear once (not duplicated)
4. Refresh the page - messages should still appear once

