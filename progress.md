<!-- progress.md Purpose: Track major project milestones and completion percentage. -->

# Progress

- 2025-10-07: Fixed React key warnings on landing; implemented asChild in Button; updated web manifest to use existing SVG icon. Overall completion: 31%.
- 2025-10-07: Refactored /agent page for full mobile responsiveness with bottom sheet UI pattern, tablet 2-pane layout with collapsible sidebar, and improved desktop 3-pane layout. Added smooth animations and touch-friendly interactions. Overall completion: 22%.
- 2025-10-07: Updated landing copy to highlight resume building/tailoring. Overall completion: 17%.
- 2025-10-07: Initiated Supabase auth integration (helpers dep added). Overall completion: 15%.

- 2025-10-07: Added .env.example and documented how to point to an existing Supabase project. Overall completion: 24%.

- 2025-10-07: Wired to multi-agent-reviews Supabase via env; created tables (messages, jobs, applications). Overall completion: 28%.


- 2025-10-08: Fixed Supabase helpers usage: switched to createClientComponentClient and createServerComponentClient to resolve runtime error when logging out. Overall completion: 34%.


- 2025-10-08: Replaced deprecated updateSession with createMiddlewareClient in `middleware.ts` to fix signup/login redirects and cookie sync. Overall completion: 36%.

 - 2025-10-08: Disabled broken OpenDyslexic @font-face (bad .woff2 files). Will re-enable with valid binaries. Overall completion: 37%.

- 2025-10-08: Fixed desktop layout for /agent page - replaced rigid CSS grid with flexible flexbox layout, removed extra padding/gaps that caused overflow, and ensured proper border styling for seamless three-pane experience. Overall completion: 39%.

- 2025-10-08: Fixed root layout constraint issue - created LayoutWrapper component to conditionally apply max-width container only on non-agent pages, allowing /agent to use full viewport width. Standardized header height to 4rem (h-16) across all breakpoints. Overall completion: 42%.

- 2025-10-08: Added resizable panes to /agent desktop layout - created ResizablePane component with drag handles allowing users to adjust the width of left sidebar (200-500px) and right chat pane (300-600px). Includes hover/active visual feedback and smooth dragging UX. Overall completion: 45%.

- 2025-10-08: Refactored agent UI from code-focused PR interface to flexible job search assistant. Removed hardcoded mock agents, updated types to remove coding-specific fields (repo, branch, diffStats), simplified Agent interface to conversation-based model. Implemented "New agent" button that creates blank conversations with auto-naming from first message. Added comprehensive empty state with helpful messaging. Updated AgentList, BrowserPane, and main agent page to reflect new conversation-based paradigm. Overall completion: 52%.

- 2025-10-09: Repositioned auth experience copy to highlight the AI job apply agent value props and aligned AuthForm messaging. Overall completion: 55%.
- 2025-10-09: Optimized mobile auth layout so login and signup cards render first, reducing scroll friction for new and returning users. Overall completion: 56%.
- 2025-10-09: Implemented responsive header navigation with hamburger trigger, focus-trapped mobile menu, route-aware highlighting, and unit tests covering mobile/desktop breakpoints. Overall completion: 55%.

- 2025-10-11: **MAJOR: Playwright Production Migration** - Solved Vercel serverless incompatibility by separating browser automation into dedicated HTTP service. Created browser-service/ with Express API for Playwright execution, updated lib/browser-tools.ts to HTTP client, added Dockerfile + Railway config for deployment. Includes comprehensive testing guide and deployment docs. Ready for Railway deployment. Overall completion: 85% (implementation complete, testing/deployment pending).

- 2025-10-11: **CRITICAL FIX: Conversation Memory Bug** - Fixed agent not remembering chat history. Root cause: `runClaudeAgentStream()` was only sending the latest user message to Claude API instead of full conversation history from the session. Now properly uses `session.messages` array to build complete message history, and saves assistant responses back to session after streaming completes. This enables true multi-turn conversations where context is preserved. Overall completion: 87%.

- 2025-10-11: **CRITICAL FIX: Conversation Separation Bug** - Fixed messages bleeding across conversations. When creating a new conversation or switching agents, old messages would appear after the LLM response. Root causes: (1) Database messages lacked session_id/agent_id linkage, (2) `refreshMessages()` assigned ALL user messages to current agent, (3) Messages not cleared on agent change. Solution: Clear messages on agent create/switch, track messages in local state with proper agentId, reset session state when agent changes, and add messages directly to state instead of fetching from unfiltered database. Each conversation now properly maintains its own isolated message history. Overall completion: 89%.

- 2025-10-11: **CRITICAL FIX: Conversation Persistence Bug** - Fixed conversations disappearing on page refresh. Root cause: Messages were stored in database but frontend only used local state with no loading mechanism. Solution: (1) Created `lib/message-utils.ts` with database-to-frontend conversion functions, (2) Added GET `/api/chat` endpoint with user authentication to load messages, (3) Updated agent page to load messages on mount and create default agent for existing conversations, (4) Added loading state while fetching messages, (5) Ensured proper agentId tracking in chat API. Conversations now persist across page refreshes and browser sessions. Overall completion: 92%.

- 2025-10-11: **CRITICAL FIX: Duplicate Messages Bug** - Fixed LLM responses appearing twice in the UI. Root cause: Messages were being added to state twice - once via `onSend()` during streaming and again when loading from database. Solution: Changed architecture to use database as single source of truth. User messages are added immediately for instant feedback, but assistant messages are only loaded from database after streaming completes. ChatPane now dispatches a `reload-messages` event after stream completion, and the parent component reloads all messages from the database. This eliminates duplicates while maintaining smooth UX. Overall completion: 94%.

- 2025-10-11: **CRITICAL FIX: Tool Execution Hanging Bug** - Fixed conversation freezing after tool execution by replacing recursive continuation approach with iterative loop. Root cause: Original recursive handler stopped after 2-3 levels, preventing Claude from chaining tools like navigate → wait → snapshot → analyze. Solution: Implemented clean iterative loop (MAX_TOOL_ITERATIONS=5) that allows Claude to chain unlimited tool sequences until it naturally produces a text response. Each iteration executes tools, updates conversation history, and continues streaming. Added comprehensive logging at each iteration to track text vs tool outputs. This enables complete workflows like job search (navigate → wait → snapshot → extract → analyze → respond). Overall completion: 96%.

- 2025-10-11: **CRITICAL FIX: Missing Job Search Tools** - Fixed Google Jobs and Indeed not working as high-level tools. Root cause: Only `search_jobs_google` tool was defined in browserTools array, while `search_jobs_indeed` and `search_jobs_linkedin` were completely missing, even though backend endpoints existed. Agent was forced to use low-level browser automation (`browser_navigate`, `browser_evaluate`) to manually scrape Indeed instead of using dedicated job search tools. Solution: (1) Added missing tool definitions for Indeed and LinkedIn in `lib/browser-tools.ts`, (2) Added BrowserService methods for `searchJobsIndeed()` and `searchJobsLinkedIn()`, (3) Added tool handlers in `lib/claude-agent.ts` for both tools, (4) Updated agent instructions to prefer high-level tools and use Google as default. All three job search tools now work as intended, with proper separation from low-level browser primitives. Overall completion: 97%.

- 2025-10-11: Fixed bottom sheet closing on scroll. Root cause: swipe-to-close initiated anywhere inside sheet, conflicting with chat scroll. Solution: restrict drag-to-close to the handle area only and ignore touch moves from content. Lint and build clean. Overall completion: 98%.

- 2025-10-12: Ensured chat composer respects iOS Safari safe-area inset so input and send button are fully visible above the home indicator. Overall completion: 99%.
- 2025-10-12: Tuned iOS Safari safe-area offset to halve the additional padding, keeping controls visible without excessive footer height. Overall completion: 99%.
- 2025-10-12: Slimmed iOS Safari composer controls by reducing mobile rows/padding while keeping safe-area protection, bringing the footer to a more compact height. Overall completion: 99%.
- 2025-10-12: Documented strategies for extending automation beyond Playwright, including new service containers, runtime options, and deployment considerations. Overall completion: 99%.

- 2025-10-11: **UI/UX ENHANCEMENT: Activity Feed Integration into Chat** - Moved activity feed from center BrowserPane into ChatPane as inline, collapsible activity cards inspired by Cursor IDE. Activities now appear chronologically interleaved with messages, showing tool executions in real-time context. Replaced emoji icons with lucide-react icons (Wrench, FileText, Zap, CheckCircle, XCircle, Brain, Info). Added ActivityCard component with expandable details for params/results. Simplified BrowserPane to placeholder for future workspace features (job listings, application tracking). This provides better temporal context, cleaner UI, and frees up center pane real estate. Overall completion: 98%.

- 2025-10-11: **UI/UX REFINEMENT: Cursor-Style Activity Feed** - Completed Phase 1 visual refinement to match Cursor IDE's lightweight aesthetic. Stripped all card styling (borders, backgrounds, heavy padding) from ActivityCard, reduced visual weight with smaller fonts (text-xs → text-[11px] for subtle types), muted icon colors with opacity (text-blue-400/60, text-green-500/60, text-red-400/70), flattened layout to single-line focus (icon + text + timestamp), simplified expandable mechanism (text link instead of rotating chevron), added progressive disclosure (details only show on hover/expand), implemented ARIA attributes for accessibility. Activities now blend seamlessly with messages, appearing as lightweight inline events rather than standalone boxes. Minimal spacing (my-1 py-0.5), 14px icons with 1.5px stroke weight, and completely transparent backgrounds create the borderless, flat design that doesn't compete with message content. Overall completion: 98.5%.
