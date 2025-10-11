# Conversation Archiving Feature

## Overview

This document describes the conversation archiving feature that allows users to archive and unarchive conversations in the agent dashboard.

## Implementation

### Database Schema

A new `sessions` table was created to track conversation metadata:

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  description TEXT,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

The table includes:
- Row Level Security (RLS) policies to ensure users can only access their own sessions
- Indexes on `user_id` and `archived` for query performance
- Foreign key constraint to ensure data integrity

### API Routes

#### GET /api/sessions
Fetches all sessions for the authenticated user.

**Query Parameters:**
- `includeArchived` (boolean): Include archived sessions in the response (default: false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "session-id",
      "user_id": "user-id",
      "name": "Conversation name",
      "description": "Description",
      "archived": false,
      "created_at": "2025-10-11T00:00:00Z",
      "updated_at": "2025-10-11T00:00:00Z"
    }
  ]
}
```

#### POST /api/sessions
Creates or updates a session.

**Request Body:**
```json
{
  "id": "session-id",
  "name": "Conversation name",
  "description": "Description"
}
```

#### PATCH /api/sessions
Updates the archived status of a session.

**Request Body:**
```json
{
  "id": "session-id",
  "archived": true
}
```

**Note:** If the session doesn't exist, it will be created automatically.

### Frontend Changes

#### Type Updates (`components/agents/types.ts`)
- Added `archived?: boolean` field to `Agent` interface
- Added new props to `AgentListProps`:
  - `onArchive?: (agentId: string) => void`
  - `onUnarchive?: (agentId: string) => void`
  - `showArchived?: boolean`
  - `onToggleShowArchived?: () => void`

#### AgentList Component (`components/agents/AgentList.tsx`)
- Added toggle button to switch between active and archived conversations
- Added archive/unarchive buttons that appear on hover for each conversation
- Visual indicator "(archived)" for archived conversations
- Archive icon: box with down arrow
- Unarchive icon: inbox/restore icon

#### Agent Page (`app/agent/page.tsx`)
- Loads session data from `/api/sessions` on mount
- Filters conversations based on archived status
- Implements `handleArchive` and `handleUnarchive` functions
- Implements `handleToggleShowArchived` to switch views
- Default behavior: shows only active (non-archived) conversations
- Automatically selects the most recent non-archived conversation on load

## User Experience

### Archiving a Conversation
1. Hover over a conversation in the list
2. Click the archive icon (box with down arrow)
3. The conversation is immediately archived and removed from the active list
4. The archived status is persisted to the database

### Viewing Archived Conversations
1. Click the "→ Show archived" button at the top of the conversation list
2. The view switches to show only archived conversations
3. The button text changes to "← Hide archived"

### Unarchiving a Conversation
1. Switch to the archived view
2. Hover over an archived conversation
3. Click the unarchive icon (inbox/restore)
4. The conversation is immediately unarchived and moved back to active conversations
5. Switch back to the active view to see the restored conversation

## Technical Details

### State Management
- `showArchived` state determines which conversations to display
- `displayedAgents` computed value filters agents based on archived status
- Archive/unarchive operations update local state immediately for responsive UI
- Database updates happen asynchronously in the background

### Error Handling
- API errors are logged to the console
- Failed archive/unarchive operations don't crash the UI
- Session creation is automatic if archiving a conversation without a session record

### Performance Considerations
- Sessions are loaded once on page mount
- Archive/unarchive operations are optimistic (UI updates immediately)
- Indexes on the `sessions` table ensure fast queries
- RLS policies are efficient and secure

## Future Enhancements

Possible improvements for future iterations:
1. Bulk archive/unarchive operations
2. Auto-archive conversations after X days of inactivity
3. Archive confirmation dialog (optional)
4. Search within archived conversations
5. Archive statistics (number of archived conversations)
6. Keyboard shortcuts for archiving (e.g., Cmd+Backspace)
7. Undo/redo for archive operations
8. Export archived conversations

## Migration

To apply the database schema changes, run the migration:

```sql
-- Execute the migration file
\i supabase/migrations/20251011_add_sessions_table.sql
```

Or if using Supabase CLI:
```bash
supabase migration up
```

## Testing

### Manual Testing
1. Create multiple conversations
2. Archive a conversation and verify it disappears from the active list
3. Toggle to archived view and verify the conversation appears
4. Unarchive the conversation and verify it returns to active list
5. Verify archived status persists across page refreshes
6. Test with different screen sizes (mobile, tablet, desktop)

### Automated Testing
Test file location: `app/api/sessions/route.test.ts`

Run tests:
```bash
npm run test -- app/api/sessions
```

## Security

- All session operations require authentication
- RLS policies ensure users can only access their own sessions
- Archive status changes are validated on the server
- User ID is derived from the authenticated session, not client input
