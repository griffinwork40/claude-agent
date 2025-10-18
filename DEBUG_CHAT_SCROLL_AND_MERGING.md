# Debug Chat Scroll and Agent Merging Issues

## Current Status
- **Chat scrolling still broken on desktop** despite removing `overflow-hidden` from multiple containers
- **Agent activities still merging/bleeding** between different agents despite adding agent ID filtering

## Previous Attempts Made

### Scrolling Fixes Applied:
1. ✅ `BottomSheet.tsx:187` - Removed `overflow-hidden` from mobile content wrapper
2. ✅ `agent/page.tsx:562` - Removed `overflow-hidden` from tablet tab content  
3. ✅ `agent/page.tsx:583` - Removed `overflow-hidden` from desktop layout container
4. ✅ `ResizablePane.tsx:121` - Added `h-full` to ensure proper height inheritance

### Agent Merging Fixes Applied:
1. ✅ `ChatPane.tsx:83-87` - Added agent ID filtering when adding activities to timeline:
```typescript
chatStream.activities
  .filter((activity) => activity.agentId === agent.id)
  .forEach((activity) => {
    items.push({ ...activity, itemType: 'activity' as const });
  });
```

## Issues Still Present

### 1. Desktop Scrolling Still Broken
**Symptoms:** Cannot scroll in chat pane on desktop layout
**Possible Root Causes:**
- ChatPane's internal flex layout may be constraining height
- The `flex-1 overflow-y-auto` div in ChatPane may not be getting proper height
- ResizablePane may need additional height constraints
- ChatTimeline component may have height issues

### 2. Agent Activities Still Merging
**Symptoms:** Activities from Agent A appear in Agent B's chat
**Possible Root Causes:**
- The `useChatStream` hook's `activitiesMap` may not be properly isolated per agent
- `syncExternalActivities` may be preserving activities from wrong agents
- The filtering in ChatPane may not be working due to timing issues
- Activities may be getting added to the wrong agent's context

## Debugging Tasks for Next Session

### 1. Investigate ChatPane Height Chain
- Check if ChatPane's `section` element has proper height
- Verify the `flex-1 overflow-y-auto` div gets proper height from parent
- Test if ChatTimeline component has any height constraints
- Check if ResizablePane is properly passing height to children

### 2. Debug Agent Activity Isolation
- Add console.log statements to track which activities belong to which agent
- Check if `useChatStream` hook is properly resetting when agent changes
- Verify `syncExternalActivities` is only preserving correct agent's activities
- Test if the filtering in ChatPane is actually being applied

### 3. Test Specific Scenarios
- Create two agents and send messages to both
- Switch between agents while one is streaming
- Check browser dev tools for CSS height/overflow issues
- Verify scroll events are being captured

## Files to Investigate
- `components/agents/chat/ChatPane.tsx` - Main chat component
- `components/agents/chat/useChatStream.ts` - Activity management hook
- `components/agents/chat/ChatTimeline.tsx` - Timeline rendering
- `components/ResizablePane.tsx` - Desktop layout container
- `app/agent/page.tsx` - Layout containers

## Key Questions to Answer
1. Is the ChatPane getting proper height from its parent containers?
2. Are activities being properly isolated by agent ID in the useChatStream hook?
3. Is the filtering in ChatPane actually working at runtime?
4. Are there any CSS conflicts preventing scroll from working?

## Next Steps
1. Add debugging console.logs to track activity flow
2. Inspect DOM elements for height/overflow issues
3. Test with minimal reproduction cases
4. Consider if the issue is in the activity management vs. the UI rendering
