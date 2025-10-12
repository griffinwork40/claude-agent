<!-- README.md Purpose: Provide a high-level overview of the Enlist job search agent project. -->

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

### Extending automation runtimes

See [`docs/extending-automation-runtimes.md`](docs/extending-automation-runtimes.md) for guidance on adding new containerized services (e.g., Appium, Python workers, ATS API clients) that complement the existing Playwright-based browser service.

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

## Troubleshooting

- If applications are failing, check that your resume and cover letter are accessible
- If searches are returning no results, verify your location and job preferences
- For CAPTCHA issues, the system will notify you to manually complete the challenge
