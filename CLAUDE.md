# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

What this file is for
- Fast on-ramp for building, linting, testing, and exercising the core flows
- High-level architecture so you don’t have to spelunk the whole tree
- Only includes codebase-specific details verified from this repo

Common commands
- Dev server
  - npm run dev
  - Default Next.js dev server port: 3000
- Build and start
  - npm run build
  - npm run start
- Lint
  - npm run lint             # ESLint across the project
  - npm run lint:next        # Next.js lint rules
- Tests (Vitest + JSDOM)
  - npm run test             # run all tests
  - npm run test:watch       # watch mode
  - Run a single test file
    - npm run test -- app/api/chat/route.test.ts
  - Run tests matching a name pattern
    - npm run test -- -t "rejects unauthenticated POST"
- One-time setup for browser automation (Playwright)
  - npx playwright install

Environment
- Required (used in code)
  - ANTHROPIC_API_KEY: Anthropic SDK key
  - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anon key for browser/server helpers
  - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (server-side admin ops in API routes)
- Optional branding/site
  - NEXT_PUBLIC_SITE_NAME (default: Job Enlist)
  - NEXT_PUBLIC_SITE_URL (default: http://localhost:3000)
- Test runner loads .env.local if present (see vitest.setup.ts)

Fast endpoints and smoke checks
- Verify Claude SDK initialization
  - curl -sS http://localhost:3000/api/test-claude | jq
- Verify streaming wiring (Server-Sent Events placeholder)
  - curl -sS http://localhost:3000/api/test-stream | jq
- Chat streaming endpoint (requires authenticated session)
  - POST http://localhost:3000/api/chat with JSON {"message":"hi","sessionId":null}
  - Expects SSE stream framing with events of type: status | chunk | complete | error

Architecture overview
- App framework: Next.js 14 App Router (app/)
  - Frontend UI
    - app/page.tsx: Landing page
    - app/agent/page.tsx: Three-pane agent dashboard
      - components/agents/
        - AgentList.tsx: left pane (conversations)
        - BrowserPane.tsx: center workspace (placeholder for job artifacts)
        - ChatPane.tsx: right pane, streams assistant output via SSE from /api/chat
  - Auth & gating (Supabase)
    - middleware.ts: gates /agent and /settings, redirects to /login when unauthenticated
    - app/(auth)/login, app/(auth)/signup: auth forms using @supabase/auth-helpers-nextjs
    - app/auth/callback/route.ts: OAuth callback redirect
    - lib/supabase/server.ts, lib/supabase/client.ts, lib/supabase.tsx: server/client creation helpers
  - API routes (server)
    - app/api/chat/route.ts: primary SSE chat pipeline
      - Auth: requires Supabase session (createRouteHandlerClient)
      - Persists messages (user, then full assistant response) into Supabase tables via admin client
      - Streams assistant tokens as SSE: data: {type: chunk|complete|error, ...}
      - Delegates model interaction to lib/claude-agent.ts
    - app/api/test-claude/route.ts: initializes Claude client (sanity check)
    - app/api/test-stream/route.ts: example call via Claude Agent SDK (sanity check)
    - app/api/apply/route.ts: stub endpoint for triggering application automation and persisting results

- Claude integration (tool-calling + streaming)
  - lib/claude-agent.ts
    - initializeAgent(): builds Anthropic client using ANTHROPIC_API_KEY and loads system instructions from ./.claude/agents/job-assistant-agent.md
    - runClaudeAgentStream(message, userId, sessionId?)
      - Streams Claude text deltas
      - Parses tool_use blocks, collects input JSON, executes tools, then continues the conversation with tool_result messages
    - Tools are defined in lib/browser-tools.ts
  - .claude/agents/*.md: role instructions for subagents (Job Search, Curation, Application, User Interaction)
  - Architecture decision: Uses @anthropic-ai/sdk directly (not Claude Agent SDK) for better control over browser automation and streaming

- Browser automation (Playwright)
  - lib/browser-tools.ts
    - Provides BrowserJobService with searchJobsIndeed, searchJobsLinkedIn, getJobDetails, applyToJob
    - Maintains LinkedIn session state under ./linkedin-sessions/{userId}-linkedin.json
    - Tool schemas exported as browserTools for Claude tool-calling
    - Important: searchJobsLinkedIn requires a logged-in session; code will pause for manual login on first run and then persist storage state

- Data model touchpoints
  - messages (Supabase): chat transcripts persisted by app/api/chat/route.ts
  - jobs / applications (Supabase): referenced by app/api/apply/route.ts as placeholders for application flow

- CI
  - .github/workflows/{build,lint,test}.yml run on Node 20 with npm ci
  - Use npm in this repo (workflows assume npm). If multiple lockfiles exist, prefer package-lock.json

Important notes for WARP
- The chat API requires an authenticated Supabase session; unauthenticated POSTs return 401 (see route.test.ts)
- SSE event protocol is JSON lines with "data: {type, ...}"; ChatPane.tsx handles parsing and assembling full assistant output
- Claude instructions are read from ./.claude/agents/job-assistant-agent.md at runtime; keep changes there if you need to alter system behavior
- Playwright jobs may need manual LinkedIn login on first run to create a session file; after that the session is reused

Suggested improvements to existing WARP.md
- Replace the current WARP.md (which mirrors CLAUDE.md) with this file to:
  - Add concrete dev/test/lint commands
  - Document actual SSE pipeline, tool-calling flow, and Supabase integration
  - Enumerate all env vars used in code (NEXT_PUBLIC_SUPABASE_ANON_KEY was missing)
  - Provide quick smoke commands and clarify npm usage per CI
