# Cloud Browser Automation with Hybrid Control

## Goal
Replicate your successful local Claude Code CLI + Playwright MCP setup in the cloud, where:
- AI fully automates job applications in a persistent browser session
- User can monitor progress in real-time
- User can optionally take over the browser session when desired
- System defaults to full automation unless user intervenes

## Architecture Overview

### Current State
- Next.js app (Vercel) → Browser Service (Docker on Railway) → Playwright automation
- Browser sessions are headless and not accessible to users
- Claude AI calls browser tools via HTTP API
- No real-time visualization or intervention capability

### Target State
- Next.js app → Enhanced Browser Service with:
  - **noVNC/Browser Preview Server** for real-time viewing
  - **WebSocket connection** for live updates and control handoff
  - **Persistent browser sessions** that survive across requests
  - **Recording capability** to replay automation sessions
  - AI-first automation with optional user takeover

## Implementation Strategy

### Phase 1: Add Browser Visualization Layer

**File: `browser-service/src/vnc-server.ts`** (NEW)
- Set up noVNC server using `x11vnc` and virtual display (Xvfb)
- Expose WebSocket endpoint for browser streaming
- Enable headful Chromium in virtual display
- Handle authentication for VNC access

**File: `browser-service/Dockerfile`**
- Add X11, Xvfb, x11vnc, noVNC dependencies
- Configure virtual display environment
- Expose VNC WebSocket port (6080)

**File: `browser-service/src/browser-session.ts`**
- Modify to support both headless and headful modes
- Add session persistence beyond single requests
- Track session ownership (AI vs user control)
- Implement control handoff mechanism

### Phase 2: Real-time Communication Layer

**File: `browser-service/src/websocket-server.ts`** (NEW)
- WebSocket server for bidirectional communication
- Events: `automation_start`, `automation_progress`, `user_takeover`, `user_release`
- Stream browser actions in real-time to UI
- Accept user control commands (click, type, etc.)

**File: `app/api/browser-session/route.ts`** (NEW)
- Next.js API route to create persistent browser sessions
- Return VNC WebSocket URL and session credentials
- Manage session lifecycle (create, pause, resume, terminate)

**File: `components/agents/BrowserPreview.tsx`** (NEW)
- React component with noVNC viewer
- "Take Control" / "Release Control" buttons
- Real-time activity feed showing AI actions
- Recording playback interface

### Phase 3: Enhanced Automation Intelligence

**File: `browser-service/src/intelligent-automation.ts`** (NEW)
- Integrate Claude AI directly into browser service
- Use vision API to understand page layouts
- Implement smart form filling with context awareness
- Add retry logic with AI-driven troubleshooting

**File: `.claude/agents/browser-automation-agent.md`** (NEW)
- System prompt for browser automation agent
- Instructions for form filling, CAPTCHA handling, error recovery
- Guidelines for when to request user intervention

**File: `lib/browser-tools.ts`**
- Add new tools: `request_user_help`, `get_session_preview`, `wait_for_user_action`
- Update existing tools to support session recording
- Add tool for AI to narrate what it's doing

### Phase 4: Cloud Deployment Configuration

**File: `browser-service/railway.json`**
- Configure Railway for persistent volumes (session recordings)
- Set up VNC port exposure
- Configure resource limits for Xvfb + Chromium

**File: `.env.example`**
- Add `ENABLE_BROWSER_PREVIEW=true`
- Add `VNC_PASSWORD` for secure access
- Add `ANTHROPIC_API_KEY` for browser service AI

**File: `docker-compose.yml`** (NEW, for local testing)
- Local development setup with VNC access
- Port mappings: 3001 (API), 6080 (VNC)
- Volume mounts for recordings

## Key Technical Decisions

### 1. Browser Visualization: noVNC + Xvfb
**Why:** Industry standard for remote browser access, works in Docker, accessible via web browser
**Alternative considered:** Browser DevTools Protocol (CDP) - more complex, less visual

### 2. Session Persistence: Redis + File System
**Why:** Fast session state lookup, recordings stored as files for replay
**Alternative considered:** Pure in-memory - doesn't survive restarts

### 3. AI Integration: Direct Anthropic SDK in browser-service
**Why:** Lower latency, can use vision API for screenshots, independent of Next.js
**Alternative considered:** Proxy through Next.js - adds latency, complicates architecture

### 4. Control Handoff: WebSocket with lock mechanism
**Why:** Real-time bidirectional communication, explicit ownership of browser control
**Alternative considered:** Polling - too slow for interactive control

## Migration Path

### Minimal Viable Product (Week 1)
1. Add Xvfb + noVNC to Dockerfile
2. Create basic VNC endpoint
3. Add "View Browser" button in UI
4. Deploy to Railway with port exposure

### Enhanced Automation (Week 2)
1. Integrate Anthropic SDK into browser-service
2. Implement intelligent form filling
3. Add real-time activity streaming via WebSocket
4. Create browser preview component in UI

### Full Control System (Week 3)
1. Implement control handoff mechanism
2. Add user takeover interface
3. Enable session recording and playback
4. Add AI request for user help

## Files to Create/Modify

### New Files
- `browser-service/src/vnc-server.ts` - VNC server setup
- `browser-service/src/websocket-server.ts` - Real-time communication
- `browser-service/src/intelligent-automation.ts` - AI-driven automation
- `browser-service/src/session-manager.ts` - Enhanced session tracking
- `app/api/browser-session/route.ts` - Session management API
- `components/agents/BrowserPreview.tsx` - noVNC viewer component
- `.claude/agents/browser-automation-agent.md` - Browser AI instructions
- `docker-compose.yml` - Local development setup

### Modified Files
- `browser-service/Dockerfile` - Add X11/VNC dependencies
- `browser-service/src/server.ts` - Integrate WebSocket server
- `browser-service/src/browser-session.ts` - Persistent sessions
- `browser-service/package.json` - Add dependencies (ws, x11, redis)
- `lib/browser-tools.ts` - Add user intervention tools
- `app/agent/page.tsx` - Add browser preview pane
- `browser-service/railway.json` - Configure Railway deployment

## Testing Strategy

### Local Testing
```bash
# Start with docker-compose
docker-compose up

# Access VNC at http://localhost:6080
# Test AI automation + manual takeover
```

### Cloud Testing
1. Deploy to Railway staging environment
2. Verify VNC WebSocket connection through