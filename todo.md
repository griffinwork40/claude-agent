# TODO

- [x] Add @supabase/auth-helpers-nextjs dependency
- [x] Update landing copy to include resume building/tailoring
- [x] Add .env.example and document required Supabase keys
- [ ] Create lib/supabase/client.ts and server.ts
- [x] Add middleware to protect /agent/* and /settings
  - Updated to use `createMiddlewareClient` for session sync
- [x] Create /app/(auth)/login page with email+OAuth
- [x] Create /app/(auth)/signup page with email+OAuth
- [x] Create /app/settings placeholder page
- [ ] Add server-side session checks to protected pages
- [x] Add Logout button in UI shell
- [x] Require session in API routes if sensitive

Fixes (2025-10-11):

- [x] Prevent bottom sheet from closing when scrolling chat (handle-only swipe)

- [x] Create tables in Supabase (messages, jobs, applications)
- [ ] Point env to multi-agent-reviews project and set SUPABASE_SERVICE_ROLE_KEY


Frontend polish and fixes (2025-10-07):

- [x] Support asChild in `components/ui/Button.tsx` and prevent leaking props
- [x] Add missing keys to mapped feature cards in `app/page.tsx`
- [x] Update `public/site.webmanifest` to reference existing `/icon.svg`

Agent UI refactor (2025-10-08):

- [x] Remove hardcoded mock agents and placeholder data
- [x] Update type definitions to support conversation-based agents
- [x] Implement "New agent" button with agent creation flow
- [x] Add empty state UI with helpful messaging
- [x] Auto-name agents from first user message
- [x] Update AgentList component with flat list and search
- [x] Update BrowserPane for job search context
- [x] Remove coding-specific fields (repo, branch, diffStats, status grouping)

Activity Feed Integration (2025-10-11):

- [x] Install lucide-react package for icons
- [x] Create ActivityCard component with collapsible design and icon mapping
- [x] Merge activities with messages in ChatPane timeline
- [x] Simplify BrowserPane to placeholder for future workspace features
- [x] Test expand/collapse functionality and build
- [x] Update progress.md with completion status

Streaming Bug Fix (2025-10-17):

- [x] Fixed text duplication during streaming (changed from functional state update to ref-based approach)
- [ ] Test fix comprehensively with various message types and speeds
- [ ] Remove debug logging before production deploy
- [ ] Add unit test to prevent regression

Future Enhancements:

- [ ] Add activity filtering/search in chat
- [ ] Add copy-to-clipboard for activity details
- [ ] Implement activity grouping for related tool calls
- [ ] Add visual progress indicators for long-running tools
- [ ] Populate BrowserPane with job listings and application tracking
- [ ] Performance optimization for large conversations
- [ ] Add file upload and analysis support
- [ ] Implement context visualization and management

