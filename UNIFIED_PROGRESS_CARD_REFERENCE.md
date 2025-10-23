# UnifiedProgressCard - Quick Reference

## 📖 Overview

The `UnifiedProgressCard` component consolidates multiple tool executions into a single, delightful progress interface. It automatically groups batch activities and displays them with real-time progress tracking, smooth animations, and intelligent auto-expand behavior.

---

## 🚀 Quick Start

### Basic Usage

```tsx
import { UnifiedProgressCard } from '@/components/agents/chat/UnifiedProgressCard';

// In your component
<UnifiedProgressCard
  activities={batchActivities}
  batchId="unique-batch-id"
/>
```

### With All Features

```tsx
<UnifiedProgressCard
  activities={batchActivities}
  batchId="batch-123"
  autoExpand={false}
  onRetry={(toolName) => retryTool(toolName)}
  className="my-custom-class"
/>
```

---

## 📋 Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `activities` | `Activity[]` | ✅ Yes | - | Array of activities belonging to this batch |
| `batchId` | `string` | ✅ Yes | - | Unique identifier for the batch |
| `autoExpand` | `boolean` | ❌ No | `false` | Override auto-expand logic |
| `onRetry` | `(toolName: string) => void` | ❌ No | - | Callback when retry button clicked |
| `className` | `string` | ❌ No | `''` | Additional CSS classes |

---

## 🎨 Visual States

### Idle
```
┌─────────────────────────────────┐
│ ▶ 🧠 Preparing...               │
│ ░░░░░░░░░░░░░░░░░░░░  0%       │
└─────────────────────────────────┘
```

### Planning
```
┌─────────────────────────────────┐
│ ▶ 🧠 Planning strategy...       │
│ ━━░░░░░░░░░░░░░░░░░░  10%      │
└─────────────────────────────────┘
```

### Executing (Collapsed)
```
┌─────────────────────────────────┐
│ ▶ 🔍 Searching job boards [2/3] │
│ ━━━━━━━━━━━━━━━░░░░  66%       │
└─────────────────────────────────┘
```

### Executing (Expanded)
```
┌─────────────────────────────────┐
│ ▼ 🔍 Searching job boards [2/3] │
│ ━━━━━━━━━━━━━━━░░░░  66%       │
│                                 │
│   ✓ Google Jobs (0.8s)         │
│   ✓ Indeed (1.2s)              │
│   ⏳ LinkedIn (searching...)    │
└─────────────────────────────────┘
```

### Complete (Success)
```
┌─────────────────────────────────┐
│ ▼ ✨ Complete                   │
│ ━━━━━━━━━━━━━━━━━━━━  100%    │
│                                 │
│   ✓ Google Jobs (0.8s)         │
│   ✓ Indeed (1.2s)              │
│   ✓ LinkedIn (1.5s)            │
└─────────────────────────────────┘

✓ Completed successfully • 3 tools
```

### Complete (Partial Failure)
```
┌─────────────────────────────────┐
│ ▼ ⚠️ Completed with errors      │
│ ━━━━━━━━━━━━━━░░░░░  66%       │
│                                 │
│   ✓ Google Jobs (0.8s)         │
│   ✗ Indeed (rate limited) [Retry]│
│   ✓ LinkedIn (1.5s)            │
│                                 │
│   ⚠️ 1 of 3 tools failed.      │
│      Continuing with available  │
│      results...                 │
└─────────────────────────────────┘
```

---

## 🎯 Auto-Expand Behavior

The card automatically expands when:
- ✅ First tool in batch starts executing
- ✅ Batch has 2 or more tools
- ✅ User hasn't manually collapsed it before (checked via localStorage)

The card stays collapsed when:
- ❌ User manually collapsed it (preference saved)
- ❌ Batch only has 1 tool
- ❌ Batch is already complete

---

## 🎨 Customization

### Custom Styling

```tsx
<UnifiedProgressCard
  activities={activities}
  batchId={batchId}
  className="shadow-lg border-2 border-blue-500"
/>
```

### Disable Auto-Expand

```tsx
<UnifiedProgressCard
  activities={activities}
  batchId={batchId}
  autoExpand={false}
/>
```

### Add Retry Handler

```tsx
const handleRetry = (toolName: string) => {
  console.log(`Retrying ${toolName}`);
  // Your retry logic here
  executeTool(toolName, batchId);
};

<UnifiedProgressCard
  activities={activities}
  batchId={batchId}
  onRetry={handleRetry}
/>
```

---

## 🔍 Activity Types

### Supported Activity Types

The component processes these activity types:

| Type | Purpose | Icon | Color |
|------|---------|------|-------|
| `thinking_preview` | Tool is being planned | 🧠 Spinner | gray-400/70 |
| `tool_start` | Tool execution begins | ⏳ Spinner | blue-400/70 |
| `tool_executing` | Tool is running | ⏳ Spinner | blue-400/70 |
| `tool_result` (success) | Tool completed successfully | ✓ CheckCircle | green-500/70 |
| `tool_result` (failed) | Tool failed | ✗ XCircle | red-400/70 |

### Ignored Activity Types

These are automatically filtered out:
- `tool_params` - Too technical for end users
- Internal status updates without user-facing value

---

## 📊 Progress Calculation

Progress is calculated as:
```typescript
const progressPercentage = 
  ((completed + failed) / total) * 100;
```

This means:
- **Completed tools** count toward progress
- **Failed tools** also count (batch still advancing)
- **Running tools** don't count until finished

---

## 🎬 Animations

### Entry Animation
```css
/* Component fades in and scales up */
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
```

### Shimmer Effect
```css
/* Progress bar shimmers while active */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### Success Cascade
```css
/* Checkmarks appear sequentially */
@keyframes cascadeCheck {
  0% { opacity: 0; transform: translateX(-10px); }
  100% { opacity: 1; transform: translateX(0); }
}
```

Stagger delay: `index * 50ms`

---

## 🧩 Integration with ChatTimeline

The `ChatTimeline` component automatically handles batch grouping:

```tsx
// Automatically groups activities by batchId
const batchGroups = useMemo(() => {
  const groups = new Map<string, Activity[]>();
  
  activities.forEach(activity => {
    if (activity.batchId) {
      if (!groups.has(activity.batchId)) {
        groups.set(activity.batchId, []);
      }
      groups.get(activity.batchId)!.push(activity);
    }
  });
  
  return groups;
}, [activities]);

// Renders UnifiedProgressCard for batches
if (item.batchId && batchGroups.has(item.batchId)) {
  if (isFirstInBatch) {
    return (
      <UnifiedProgressCard
        key={`batch-${item.batchId}`}
        activities={batchGroups.get(item.batchId)!}
        batchId={item.batchId}
      />
    );
  }
}
```

---

## 💾 User Preferences

### localStorage Keys

```typescript
// Collapse state is stored per batch
const key = `batch-progress-collapsed-${batchId}`;
localStorage.setItem(key, 'true'); // collapsed
localStorage.setItem(key, 'false'); // expanded
```

### Reading Preference

```typescript
const userPref = localStorage.getItem(
  `batch-progress-collapsed-${batchId}`
);
const shouldCollapse = userPref === 'true';
```

---

## 🔧 Troubleshooting

### Card Not Rendering

**Problem:** Component returns `null`

**Cause:** No tools in batch (`total === 0`)

**Solution:** Ensure activities array contains tool-related activities with the same `batchId`

### Progress Not Updating

**Problem:** Progress bar stuck

**Cause:** Activities not updating or missing `type: 'tool_result'`

**Solution:** Ensure backend sends proper activity updates with correct types

### Auto-Expand Not Working

**Problem:** Card doesn't expand automatically

**Causes:**
1. User previously collapsed it (check localStorage)
2. Only 1 tool in batch
3. Batch already complete

**Solution:**
```tsx
// Force expansion
<UnifiedProgressCard
  activities={activities}
  batchId={batchId}
  autoExpand={true}
/>
```

### Animations Not Smooth

**Problem:** Janky animations

**Cause:** Expensive re-renders during animation

**Solution:** Component uses `useMemo` internally, but ensure parent isn't re-rendering unnecessarily

---

## 🎓 Best Practices

### ✅ Do

- Use unique `batchId` for each batch
- Include all batch activities in the `activities` array
- Let auto-expand work (trust the defaults)
- Provide `onRetry` for better UX

### ❌ Don't

- Mix activities from different batches
- Override `autoExpand` unless necessary
- Add heavy computations in retry callback
- Modify activities array while rendering

---

## 📱 Responsive Design

The component is fully responsive:

```css
/* Mobile (< 640px) */
- Smaller text sizes
- Compact spacing
- Touch-friendly tap targets (min 44px)

/* Tablet (640px - 1024px) */
- Standard sizing
- Balanced spacing

/* Desktop (> 1024px) */
- Full-size text
- Generous spacing
- Hover effects enabled
```

---

## ♿️ Accessibility

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Focus card toggle button |
| `Enter` / `Space` | Toggle expand/collapse |
| `Tab` | Focus retry button (if visible) |
| `Enter` | Execute retry |

### Screen Reader Support

```tsx
// ARIA labels
aria-expanded={isExpanded}
aria-controls={detailsId}
role="img" aria-label={phaseConfig.text}

// Announcements
"Planning strategy"
"Searching 3 job boards, 2 of 3 complete"
"Completed successfully, 3 tools"
```

### Color Contrast

All colors meet WCAG 2.1 AA standards:
- Text on background: > 4.5:1
- Interactive elements: > 3:1

---

## 🧪 Testing

### Unit Tests (Example)

```typescript
import { render, screen } from '@testing-library/react';
import { UnifiedProgressCard } from './UnifiedProgressCard';

test('renders with tools', () => {
  const activities = [
    { 
      id: '1', 
      type: 'tool_start', 
      tool: 'search_jobs',
      batchId: 'batch-1'
    },
  ];
  
  render(
    <UnifiedProgressCard
      activities={activities}
      batchId="batch-1"
    />
  );
  
  expect(screen.getByText(/search jobs/i)).toBeInTheDocument();
});
```

### Integration Tests

```typescript
test('auto-expands on execution', async () => {
  const { rerender } = render(
    <UnifiedProgressCard
      activities={[...planningActivities]}
      batchId="batch-1"
    />
  );
  
  // Add executing activity
  rerender(
    <UnifiedProgressCard
      activities={[...planningActivities, executingActivity]}
      batchId="batch-1"
    />
  );
  
  await waitFor(() => {
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-expanded', 
      'true'
    );
  });
});
```

---

## 📚 Related Components

- `ActivityCard` - Fallback for non-batch activities
- `ChatTimeline` - Parent component that renders UnifiedProgressCard
- `BatchProgressIndicator` - Legacy component (deprecated)

---

## 🔗 Resources

- [Design Plan](./BATCH_PROGRESS_UX_PLAN.md)
- [Implementation Summary](./BATCH_PROGRESS_IMPLEMENTATION_COMPLETE.md)
- [Component Source](./components/agents/chat/UnifiedProgressCard.tsx)
- [ChatTimeline Integration](./components/agents/chat/ChatTimeline.tsx)

---

**Last Updated:** October 18, 2025  
**Component Version:** 1.0.0  
**Status:** Production Ready ✅
