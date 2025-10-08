# Claude Agent Project Context

This is a job application assistant built with the Claude Agent SDK. The agent helps users find, evaluate, and apply for jobs.

## Project Structure

- **Agent Instructions**: Located in `.claude/agents/job-assistant-agent.md`
- **Settings**: Configured in `.claude/settings.json`
- **Streaming API**: `/api/chat` endpoint supports Server-Sent Events
- **Frontend**: React components with streaming chat interface

## Key Features

1. **Job Search & Discovery**: Find relevant opportunities based on user preferences
2. **Job Curation**: Evaluate job quality and fit
3. **Application Assistance**: Help with resumes, cover letters, and interview prep
4. **Streaming Responses**: Real-time token-by-token response display

## Environment Variables Required

- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude Agent SDK
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

## Usage

The agent maintains conversation context through session management and provides streaming responses for better user experience.
