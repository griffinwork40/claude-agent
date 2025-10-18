// lib/browser-tools.ts
// HTTP client for LLM-controlled browser automation service
import { JobOpportunity } from '@/types';

// LLM-controlled browser automation client
export class BrowserService {
  private serviceUrl = process.env.BROWSER_SERVICE_URL || 'http://localhost:3001';
  private apiKey = process.env.BROWSER_SERVICE_API_KEY || 'test-key-12345';

  private async request(endpoint: string, body: Record<string, unknown>) {
    const url = `${this.serviceUrl}${endpoint}`;
    console.log(`🌐 Browser service request: ${endpoint}`, { params: body });
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000) // 30s timeout
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ 
          error: response.statusText,
          status: response.status 
        }));
        console.error(`❌ Browser service error (${response.status}):`, error);
        throw new Error(`Browser service error (${response.status}): ${error.error || response.statusText}`);
      }
      
      const result = await response.json();
      if (!result.success) {
        console.error('❌ Browser service returned failure:', result);
        throw new Error(result.error || 'Request failed');
      }
      
      console.log(`✓ Browser service response:`, { 
        endpoint, 
        dataLength: Array.isArray(result.data) ? result.data.length : 'N/A' 
      });
      return result.data;
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Browser service request failed: ${endpoint}`, {
        error: errMessage,
        serviceUrl: this.serviceUrl,
        endpoint
      });
      throw error;
    }
  }

  // Navigate to a URL
  async navigate(sessionId: string, url: string): Promise<{ url: string }> {
    return this.request('/api/browser/navigate', { sessionId, url });
  }

  // Get page snapshot (accessibility tree)
  async snapshot(sessionId: string): Promise<{ snapshot: string; url: string }> {
    return this.request('/api/browser/snapshot', { sessionId });
  }

  // Take screenshot
  async screenshot(sessionId: string, fullPage: boolean = false): Promise<{ screenshot: string }> {
    return this.request('/api/browser/screenshot', { sessionId, fullPage });
  }

  // Click element
  async click(sessionId: string, selector: string): Promise<{ message: string }> {
    return this.request('/api/browser/click', { sessionId, selector });
  }

  // Type into element
  async type(sessionId: string, selector: string, text: string, submit: boolean = false): Promise<{ message: string }> {
    return this.request('/api/browser/type', { sessionId, selector, text, submit });
  }

  // Select dropdown option
  async select(sessionId: string, selector: string, value: string): Promise<{ message: string }> {
    return this.request('/api/browser/select', { sessionId, selector, value });
  }

  // Wait for element or page load
  async waitFor(sessionId: string, selector?: string, timeout: number = 10000): Promise<{ message: string }> {
    return this.request('/api/browser/wait', { sessionId, selector, timeout });
  }

  // Evaluate JavaScript
  async evaluate(sessionId: string, script: string): Promise<{ result: unknown }> {
    return this.request('/api/browser/evaluate', { sessionId, script });
  }

  // Get page content
  async getContent(sessionId: string): Promise<{ html: string; text: string; url: string }> {
    return this.request('/api/browser/content', { sessionId });
  }

  // Close browser session
  async closeSession(sessionId: string): Promise<{ message: string }> {
    return this.request('/api/browser/close', { sessionId });
  }

  // Search jobs on Indeed
  async searchJobsIndeed(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): Promise<JobOpportunity[]> {
    return this.request('/api/search-indeed', params);
  }

  // Search jobs on Google Jobs
  async searchJobsGoogle(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): Promise<JobOpportunity[]> {
    return this.request('/api/search-google', params);
  }

  // Search jobs on LinkedIn
  async searchJobsLinkedIn(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
    userId: string;
  }): Promise<JobOpportunity[]> {
    return this.request('/api/search-linkedin', params);
  }

  // Find company careers page
  async findCompanyCareersPage(params: {
    companyName: string;
    jobTitle?: string;
  }): Promise<{ careersUrl: string; companyWebsite: string }> {
    return this.request('/api/find-careers-page', params);
  }

  // Extract company application URL from job board listing
  async extractCompanyApplicationUrl(params: {
    jobBoardUrl: string;
  }): Promise<{ companyApplicationUrl: string | null; requiresJobBoard: boolean }> {
    return this.request('/api/extract-company-url', params);
  }

  // Request user help for complex scenarios
  async requestUserHelp(params: {
    sessionId: string;
    reason: string;
    context?: string;
    suggestedAction?: string;
  }): Promise<{ message: string; helpRequested: boolean }> {
    return this.request('/api/browser/request-help', params);
  }

  // Get session preview URL
  async getSessionPreview(params: {
    sessionId: string;
  }): Promise<{ previewUrl: string; vncUrl?: string }> {
    return this.request('/api/browser/session-preview', params);
  }

  // Wait for user action
  async waitForUserAction(params: {
    sessionId: string;
    message: string;
    timeout?: number;
  }): Promise<{ message: string; userActionTaken: boolean }> {
    return this.request('/api/browser/wait-user-action', params);
  }
}

// Singleton instance
let browserService: BrowserService | null = null;

export const getBrowserService = (): BrowserService => {
  if (!browserService) {
    browserService = new BrowserService();
  }
  return browserService;
};

// Tool definitions for Claude - LLM-controlled browser
export const browserTools = [
  {
    name: 'browser_navigate',
    description: 'Navigate the browser to a specific URL. This starts or continues a browser session.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'Browser session ID (use user ID or generate unique ID per conversation)'
        },
        url: {
          type: 'string',
          description: 'URL to navigate to'
        }
      },
      required: ['sessionId', 'url']
    }
  },
  {
    name: 'browser_snapshot',
    description: 'Get an accessibility tree snapshot of the current page. Shows page structure with interactive elements, useful for understanding what actions are available.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'Browser session ID'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current page. Returns base64-encoded PNG image.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'Browser session ID'
        },
        fullPage: {
          type: 'boolean',
          description: 'Whether to capture full page (true) or just viewport (false)'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'browser_click',
    description: 'Click an element on the page using a CSS selector.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'Browser session ID'
        },
        selector: {
          type: 'string',
          description: 'CSS selector for the element to click (e.g., "button.submit", "#login-btn")'
        }
      },
      required: ['sessionId', 'selector']
    }
  },
  {
    name: 'browser_type',
    description: 'Type text into an input field using a CSS selector.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'Browser session ID'
        },
        selector: {
          type: 'string',
          description: 'CSS selector for the input element (e.g., "input[name=email]", "#search")'
        },
        text: {
          type: 'string',
          description: 'Text to type into the field'
        },
        submit: {
          type: 'boolean',
          description: 'Whether to press Enter after typing (for forms)'
        }
      },
      required: ['sessionId', 'selector', 'text']
    }
  },
  {
    name: 'browser_select',
    description: 'Select an option from a dropdown menu.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'Browser session ID'
        },
        selector: {
          type: 'string',
          description: 'CSS selector for the select element'
        },
        value: {
          type: 'string',
          description: 'Value of the option to select'
        }
      },
      required: ['sessionId', 'selector', 'value']
    }
  },
  {
    name: 'browser_wait',
    description: 'Wait for an element to appear or for page to finish loading.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'Browser session ID'
        },
        selector: {
          type: 'string',
          description: 'CSS selector to wait for (optional, waits for page load if omitted)'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 10000)'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'browser_evaluate',
    description: 'Execute JavaScript code in the browser context. Use for extracting data or performing complex operations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'Browser session ID'
        },
        script: {
          type: 'string',
          description: 'JavaScript code to execute (e.g., "document.title", "Array.from(document.querySelectorAll(\'a\')).map(a => a.href)")'
        }
      },
      required: ['sessionId', 'script']
    }
  },
  {
    name: 'browser_get_content',
    description: 'Get the full HTML and text content of the current page.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'Browser session ID'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'browser_close_session',
    description: 'Close and cleanup a browser session when done.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'Browser session ID to close'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'search_jobs_indeed',
    description: 'Search Indeed for job listings. Returns real job postings from Indeed.com.',
    input_schema: {
      type: 'object' as const,
      properties: {
        keywords: {
          type: 'string',
          description: 'Job search keywords (e.g., "software engineer", "marketing manager")'
        },
        location: {
          type: 'string',
          description: 'Job location (e.g., "San Francisco", "Remote", "New York")'
        },
        experience_level: {
          type: 'string',
          description: 'Experience level (entry, mid, senior, executive)',
          enum: ['entry', 'mid', 'senior', 'executive']
        },
        remote: {
          type: 'boolean',
          description: 'Whether to include remote jobs'
        }
      },
      required: ['keywords', 'location']
    }
  },
  {
    name: 'search_jobs_google',
    description: 'Search Google Jobs for aggregated job listings from multiple sources (Indeed, LinkedIn, company sites, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        keywords: {
          type: 'string',
          description: 'Job search keywords (e.g., "software engineer", "marketing manager")'
        },
        location: {
          type: 'string',
          description: 'Job location (e.g., "San Francisco", "Remote", "New York")'
        },
        experience_level: {
          type: 'string',
          description: 'Experience level (entry, mid, senior, executive)',
          enum: ['entry', 'mid', 'senior', 'executive']
        },
        remote: {
          type: 'boolean',
          description: 'Whether to include remote jobs'
        }
      },
      required: ['keywords', 'location']
    }
  },
  {
    name: 'search_jobs_linkedin',
    description: 'Search LinkedIn for job listings. Requires authenticated LinkedIn session.',
    input_schema: {
      type: 'object' as const,
      properties: {
        keywords: {
          type: 'string',
          description: 'Job search keywords (e.g., "software engineer", "marketing manager")'
        },
        location: {
          type: 'string',
          description: 'Job location (e.g., "San Francisco", "Remote", "New York")'
        },
        experience_level: {
          type: 'string',
          description: 'Experience level (entry, mid, senior, executive)',
          enum: ['entry', 'mid', 'senior', 'executive']
        },
        remote: {
          type: 'boolean',
          description: 'Whether to include remote jobs'
        },
        userId: {
          type: 'string',
          description: 'User ID for session management'
        }
      },
      required: ['keywords', 'location', 'userId']
    }
  },
  {
    name: 'find_company_careers_page',
    description: 'Find the direct company careers/jobs page URL for a given company. Useful for applying directly on company websites instead of job boards.',
    input_schema: {
      type: 'object' as const,
      properties: {
        companyName: {
          type: 'string',
          description: 'Name of the company (e.g., "Acme Corp", "Google", "Local Restaurant Group")'
        },
        jobTitle: {
          type: 'string',
          description: 'Optional: Specific job title to help find the right posting on company site'
        }
      },
      required: ['companyName']
    }
  },
  {
    name: 'extract_company_application_url',
    description: 'Extract the direct company application URL from a job board listing (Indeed, LinkedIn, etc). Many jobs have an "Apply on company website" button - this tool clicks through to get that URL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        jobBoardUrl: {
          type: 'string',
          description: 'URL of the job listing on Indeed, LinkedIn, or other job board'
        }
      },
      required: ['jobBoardUrl']
    }
  },
  {
    name: 'request_user_help',
    description: 'Request human intervention when automation encounters complex scenarios like CAPTCHAs, unexpected errors, or situations requiring human judgment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'Browser session ID'
        },
        reason: {
          type: 'string',
          description: 'Reason for requesting help (e.g., "CAPTCHA detected", "Form validation error", "Unexpected page layout")'
        },
        context: {
          type: 'string',
          description: 'Additional context about the current situation'
        },
        suggestedAction: {
          type: 'string',
          description: 'Suggested action for the user to take'
        }
      },
      required: ['sessionId', 'reason']
    }
  },
  {
    name: 'get_session_preview',
    description: 'Get a preview URL for the current browser session to allow user monitoring and intervention.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'Browser session ID'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'wait_for_user_action',
    description: 'Pause automation and wait for user to take manual action in the browser. Use when user intervention is needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'Browser session ID'
        },
        message: {
          type: 'string',
          description: 'Message to display to user about what action is needed'
        },
        timeout: {
          type: 'number',
          description: 'Maximum time to wait for user action in seconds (default: 300)'
        }
      },
      required: ['sessionId', 'message']
    }
  }
];
