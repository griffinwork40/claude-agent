# Cloud Browser Automation - Implementation Checklist

## Requirement Definition
- Deliver headful Playwright sessions accessible through a noVNC web socket gateway so users can watch and optionally take control.
- Maintain persistent browser sessions with explicit AI/user ownership hand-offs and lifecycle APIs exposed to Next.js.
- Stream real-time automation events over WebSockets while keeping REST endpoints available for Claude tool compatibility.
- Integrate Anthropic vision-enabled orchestration directly inside the browser service for higher-level automation and troubleshooting.
- Provide deployment and local testing ergonomics (Dockerfile, docker-compose, Railway config, env vars) that accommodate the new visualization stack.

## Affected Areas
- `browser-service/` (session management, server bootstrap, Dockerfile, dependencies, new automation helpers)
- `app/` Next.js API (`app/api/browser-session/route.ts`) and agent UI (`components/agents/BrowserPreview.tsx`, `app/agent/page.tsx`)
- Shared client utilities (`lib/browser-tools.ts`)
- Project configuration (`.env.example`, `docker-compose.yml`, `.claude/agents/browser-automation-agent.md`, progress tracking)

## Approach Overview
1. Bootstrap the visualization layer by spawning Xvfb + x11vnc + websockify through a reusable `VncServer` helper and switching Playwright into headful mode when preview is enabled.
2. Expand session orchestration into a dedicated `SessionManager` that records metadata (headful/headless, control owner, preview URLs, recording paths) and persists storage state for reuse.
3. Layer a `WebSocketServer` facade around `ws` to broadcast structured automation events and receive user control commands that proxy back into Playwright.
4. Surface a persistent session API route in Next.js returning preview credentials, and build a React `BrowserPreview` component that embeds the noVNC client with takeover buttons and activity feed bindings.
5. Wire new high-level automation helpers (`intelligent-automation.ts`, Anthropic SDK integration) plus tool hooks (`request_user_help`, `wait_for_user_action`, `get_session_preview`) to coordinate AI/user interactions.
6. Update deployment assets (Dockerfile, Railway manifest, docker-compose) and sample environment variables to support the visualization stack securely.

## Edge Cases & Risks
- Ensure VNC password is never logged and resides in a generated auth file with correct permissions.
- Guard against missing Redis/Anthropic credentials; the service must degrade gracefully without optional infrastructure.
- Handle WebSocket disconnects by releasing control locks and notifying the automation agent to resume.
- Prevent stale preview URLs by invalidating session tokens when sessions close.
- Avoid resource starvation by capping simultaneous headful sessions and cleaning up background processes on shutdown.

## Testing Strategy
- `docker-compose up` locally to verify API, VNC (http://localhost:6080), and WebSocket control commands.
- Manual end-to-end run: trigger automation from Claude, observe progress feed, perform user takeover/release.
- Unit smoke checks: curl health endpoint, ensure `/api/browser-session` returns preview metadata, and verify WebSocket handshake using `wscat`.

## Assumptions
- Railway deployment tier provides sufficient CPU/RAM and allows exposing the additional 6080 port.
- Anthropic API key grants access to vision models required for screenshot analysis.
- Redis is optional; if unavailable we rely on in-memory session state with periodic serialization to disk.

## Subtasks
1. Implement VNC server helper and session metadata management.
2. Extend REST/WebSocket servers for automation events and user control.
3. Add intelligent automation module with Anthropic integration hooks.
4. Build Next.js session API + BrowserPreview UI component.
5. Update tooling, environment samples, docker-compose, and progress tracking.

