# Enlist — Job Search Agent

Enlist is your job search agent—scouting roles, tailoring materials, and applying automatically. Visit `https://jobenlist.com`.

## Features

- Multi-platform job search (LinkedIn, Indeed, Glassdoor, etc.)
- Smart job curation based on your profile and preferences
- Human-in-the-loop approval before applying
- Automated application submission
- Application tracking and reporting

## Architecture

The system uses four specialized subagents:

1. **Job Search Agent**: Finds job opportunities across multiple platforms
2. **Job Curation Agent**: Filters and ranks jobs based on your preferences
3. **User Interaction Agent**: Presents jobs and gets your approval
4. **Application Agent**: Automates the application process for approved jobs

## Prerequisites

- Node.js (for TypeScript SDK) or Python environment
- Claude API key
- Playwright for browser automation

## Installation

1. Install the Claude Agent SDK:
   ```bash
   npm install @anthropic-ai/claude-agent-sdk
   npm install playwright
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

3. Set up your Claude API key:
   ```bash
   export ANTHROPIC_API_KEY="your-api-key-here"
   ```

## Configuration

The system uses the existing `griffin.json` file from your resume project as the primary data source. This structured JSON file contains comprehensive personal, professional, and application-related information.

1. Ensure your resume project is accessible at `/Users/griffinlong/Projects/personal_projects/resume/`
2. Verify that `griffin.json` contains your updated information
3. Confirm your resume PDF is accessible at the path specified in `griffin.json`
4. Review the job categories and application strategy in `sample_config.json` for reference

## Usage

1. Run the main agent system:
   ```bash
   # Using the Claude Agent SDK CLI
   claude-agent run --config config.json
   ```

2. The system will:
   - Search for jobs based on your criteria
   - Curate and rank the best opportunities
   - Present them to you one by one
   - Apply to jobs you approve of

## How It Works

1. **Job Search**: The Job Search Agent browses job platforms and finds opportunities matching your criteria
2. **Curation**: The Job Curation Agent ranks opportunities based on your profile and preferences
3. **Approval**: The User Interaction Agent presents jobs to you one by one for approval
4. **Application**: The Application Agent submits applications for jobs you approve

## Safety and Ethics

- All applications require your explicit approval before submission
- The system respects job board terms of service
- Applications are spaced appropriately to avoid being flagged as spam
- Your personal information is kept secure

## Customization

- Modify the agent prompt files in `./.claude/agents/` to change agent behavior
- Adjust your preferences in `config.json`
- Add more job platforms by extending the Job Search Agent

## Gmail Integration Setup

The dashboard now supports connecting a Gmail account so the Claude agent can list recent threads, send follow-up emails, and update conversation state. To enable the integration:

1. **Create a Google Cloud OAuth Client**
   - Visit the [Google Cloud Console](https://console.cloud.google.com/) and create a project (or reuse an existing one).
   - Enable the Gmail API under **APIs & Services → Library**.
   - Configure an OAuth consent screen, add the `https://mail.google.com/` scope to the publishing configuration, and publish the app (or keep it in testing for limited users).
   - Create **OAuth 2.0 Client Credentials** with type **Web Application**. Add the authorized redirect URI pointing to your deployment, e.g. `https://your-domain.com/api/integrations/gmail/callback`.

2. **Populate Environment Variables**
   Copy `.env.example` to `.env.local` and fill in:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI` – must match the URI registered in Google Cloud.
   - `GOOGLE_OAUTH_SUCCESS_REDIRECT` – path or absolute URL where users should land after linking Gmail (defaults to `/dashboard`).

3. **Provision Supabase Storage**
   Run the SQL in `supabase/migrations/20250212_add_gmail_credentials.sql` against your Supabase project to create the `gmail_credentials` table. Ensure the table has Row Level Security policies that allow the application to read/write rows for the authenticated user (or rely on the service role client).

4. **Install Dependencies**
   Install the Gmail client dependencies and update the lockfile:

   ```bash
   npm install
   ```

5. **Deploy**
   Redeploy the app with the updated environment variables. Users can connect or disconnect Gmail from the dashboard, and the new Claude tools `gmail_list_threads`, `gmail_send_email`, and `gmail_mark_thread_read` allow the agent to automate inbox workflows.

## Troubleshooting

- If applications are failing, check that your resume and cover letter are accessible
- If searches are returning no results, verify your location and job preferences
- For CAPTCHA issues, the system will notify you to manually complete the challenge
