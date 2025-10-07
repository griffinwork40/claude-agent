# Job Application Bot Documentation

## Overview

The Job Application Bot is an AI-powered system built using the Claude Agent SDK that automates the job search and application process. The bot uses multiple specialized subagents to find, curate, and apply for jobs based on user preferences, while maintaining a human-in-the-loop approval process.

## Architecture

The system consists of four main subagents:

1. **Job Search Agent**: Finds job opportunities across multiple platforms
2. **Job Curation Agent**: Filters and ranks jobs based on user preferences
3. **User Interaction Agent**: Presents jobs and obtains approval for applications
4. **Application Agent**: Automates the application submission process

## Setup and Configuration

### Prerequisites

- Claude Agent SDK
- Playwright for browser automation
- Node.js (for TypeScript SDK) or Python environment
- Valid Claude API key

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
npm install playwright
```

Or for Python:

```bash
pip install claude-agent-sdk
pip install playwright
```

### Configuration

The system uses the existing `griffin.json` file from your resume project as the primary data source. This structured JSON file contains comprehensive personal, professional, and application-related information.

The system reads from the existing resume project structure:
- `griffin.json` - Contains structured profile with personal info, skills, experience
- Resume PDF file (path specified in griffin.json)
- Current `CLAUDE.md` file contains application strategies and job categories

### Job Category Prioritization

Based on your original implementation, the system uses these job category priorities:

#### 🔥 HIGH PRIORITY (Strong Match)
- **AI/ML Specialist** - Prompt engineering, AI tool implementation
- **Marketing Technology Specialist** - AI-powered marketing tools
- **Product Manager** - SaaS products, AI tools, startup experience  
- **Technical Consultant** - AI enablement, workflow automation
- **Content Creator/Manager** - AI-powered content strategy
- **Business Development** - Tech startups, AI solutions
- **Customer Success Manager** - SaaS/tech products
- **Marketing Coordinator** - Digital marketing, automation
- **Technical Writer** - Documentation, AI tools, software
- **Freelance/Contract Roles** - AI consulting, marketing automation

#### 🟡 MEDIUM PRIORITY (Good Match)  
- **Junior Developer** - Focus on AI/automation tools, less traditional coding
- **UI/UX Designer** - Web design background
- **Operations Specialist** - Workflow automation, process improvement
- **Sales Representative** - Tech products, AI solutions
- **Project Coordinator** - Tech projects, startup environment
- **Social Media Manager** - Content creation, automation tools

#### 🔴 AVOID (Poor Match)
- Senior/Lead Developer positions requiring deep coding expertise
- Traditional software engineering roles
- Data Science requiring advanced math/statistics
- DevOps/Infrastructure roles
- Embedded systems or hardware development

### Application Strategy

The system emphasizes these key areas when applying:
- Proven experience building AI-powered SaaS products
- Client-facing experience and communication skills
- Entrepreneurial background and startup experience
- Ability to bridge technical and business requirements
- Track record of delivering real business value with AI tools
- Experience with modern web technologies and APIs
- Strong content creation and marketing skills

### Keyword Matching

The system focuses on these primary skills to highlight:
- AI Tools (ChatGPT, Claude, DALL-E, Gemini)
- Prompt Engineering
- Marketing Automation  
- Content Creation & Strategy
- SaaS/Product Development
- Client Management
- Workflow Automation
- No-Code Solutions
- Technical Consulting
- Entrepreneurship
```

## Subagent Specifications

### 1. Job Search Agent

**File**: `./.claude/agents/job-search-agent.md`

**Purpose**: Search job boards (LinkedIn, Indeed, Glassdoor, etc.) based on user criteria and extract relevant job listings.

**Capabilities**:
- Use Playwright for browser automation
- Navigate to job platforms
- Input search criteria
- Scrape job listings
- Extract job details (title, company, location, description, application link)
- Apply basic filtering

**Tools**:
- Playwright browser automation
- Web search tools
- File system access for saving results

### 2. Job Curation Agent

**File**: `./.claude/agents/job-curation-agent.md`

**Purpose**: Filter and rank job listings based on user preferences and qualifications to create a curated list of opportunities.

**Capabilities**:
- Compare job descriptions with user's skills and experience
- Rank jobs by relevance
- Apply advanced filtering based on user criteria
- Create job summaries for user review

**Tools**:
- Text analysis tools
- File system access for reading user profile
- Matching algorithms

### 3. User Interaction Agent

**File**: `./.claude/agents/user-interaction-agent.md`

**Purpose**: Present curated jobs to the user and obtain approval before proceeding with applications.

**Capabilities**:
- Format job listings in a user-friendly manner
- Present pros/cons of each opportunity
- Process user responses (yes/no)
- Maintain application state

**Tools**:
- Natural language processing
- File system access for maintaining state

### 4. Application Agent

**File**: `./.claude/agents/application-agent.md`

**Purpose**: Automate the application process for jobs that the user has approved.

**Capabilities**:
- Fill out application forms using Playwright
- Upload resume and cover letter
- Handle multi-step application processes
- Track and log application status

**Tools**:
- Playwright browser automation
- Document generation tools
- File system access for tracking applications

## User Interaction Flow

1. User provides job preferences and personal information
2. Job Search Agent runs search based on criteria
3. Job Curation Agent processes results and creates curated list
4. User Interaction Agent presents opportunities one by one
5. User approves or rejects each opportunity
6. Application Agent processes approved applications
7. System tracks and reports application status

### Detailed Interaction Steps

The user interaction follows this detailed sequence:

**Step 1: Job Presentation**
- User Interaction Agent presents a curated job opportunity
- Shows job title, company, location, and key details
- Highlights why it's a good match for the user
- Mentions any potential concerns

**Step 2: User Response**
- User responds with "yes" to apply or "no" to skip
- User can ask for more details about the position
- User can request to see the next opportunity
- User can stop the process at any time

**Step 3: Action Based on Response**
- If "yes": Application Agent proceeds with the application
- If "no": System moves to the next curated opportunity
- If user wants more details: Additional information is provided

**Step 4: Application Process**
- Application Agent fills out forms automatically
- Uploads resume and generates custom cover letter
- Submits the application
- Logs the application in the tracking system

**Step 5: Confirmation and Progress**
- User receives confirmation of successful application
- System updates application tracker
- Continues to next opportunity or completes session

## Implementation Details

### Authentication

The bot supports standard Claude API authentication via environment variables:

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

### MCP Integration

For advanced features, you can extend the system with Model Context Protocol (MCP) servers to integrate with additional services like databases, CRM systems, or custom APIs.

### Error Handling

The system includes comprehensive error handling for:
- Network issues during job searches
- CAPTCHA challenges
- Application site failures
- Invalid user data

## Best Practices

- Maintain human oversight for all applications
- Respect job board rate limits
- Ensure application materials are personalized
- Monitor application success rates
- Regularly update resume and cover letter templates
- Keep personal information secure

## Ethical Considerations

- All applications require explicit user approval before submission
- The system should not spam job boards with applications
- Applications should represent genuine interest in the position
- User data must be protected and not shared without consent
- The system should comply with the terms of service of all job platforms
- Avoid applying to positions for which the user is clearly unqualified

## Legal Compliance

- Ensure compliance with local employment laws
- Respect data privacy regulations (GDPR, CCPA, etc.)
- Maintain records as required by law
- Be transparent about the use of automation in job applications
- Consider disclosure requirements for automated applications

## Tech Stack: Next.js, Supabase, Vercel

### Frontend
- **Framework**: Next.js 14+ with TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui or Radix UI
- **State Management**: Zustand or React Query
- **Real-time**: Supabase Realtime for chat updates
- **Deployment**: Vercel

### Backend & Database
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **API**: Next.js API routes or Server Actions
- **Real-time**: Supabase Realtime
- **File Storage**: Supabase Storage for resume/CV files

### Claude Agent Integration
- **Claude Agent SDK**: Running in Next.js API routes
- **Subagents**: Implemented as separate modules
- **MCP Integration**: Playwright running in Vercel functions
- **Environment**: Set Claude API key in Vercel environment variables

### Playwright Automation
- **Browser Automation**: Playwright running in Vercel serverless functions
- **Isolation**: Each application runs in separate browser context
- **File Access**: Direct access to Supabase Storage for resume/CV
- **Rate Limiting**: Built-in Vercel function limitations help prevent rate limits

### Data Flow with Next.js/Supabase
1. User interacts through Next.js chat interface
2. Messages stored in Supabase database
3. Claude Agent processes input via Next.js API routes
4. Job opportunities saved to Supabase
5. User approval/rejection tracked in Supabase
6. Playwright automation triggered via serverless function
7. Application results stored back to Supabase
8. Supabase Realtime updates chat interface