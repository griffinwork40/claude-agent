// browser-service/src/server.ts
// Express API server for LLM-controlled browser automation
import express, { Request, Response, NextFunction } from 'express';
import { getBrowserJobService } from './browser-tools';
import { getBrowserController } from './browser-controller';
import { getBrowserSessionManager } from './browser-session';
import { getSerpClient } from './serp-client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
app.use(express.json({ limit: '50mb' })); // Increase limit for screenshots

// Prefer the shared browser service API key env var, but support legacy API_KEY for backwards compatibility.
const expectedApiKey =
  process.env.BROWSER_SERVICE_API_KEY || process.env.API_KEY || 'test-key-12345';

// Simple API key authentication middleware
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  if (apiKey !== expectedApiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Health check endpoint (no auth required)
app.get('/health', (req: Request, res: Response) => {
  const sessionManager = getBrowserSessionManager();
  res.json({ 
    status: 'ok', 
    service: 'llm-browser-automation',
    activeSessions: sessionManager.getActiveSessions().length,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// LLM-Controlled Browser Endpoints (Playwright MCP Style)
// ============================================================================

// Navigate to a URL
app.post('/api/browser/navigate', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, url } = req.body;
    if (!sessionId || !url) {
      return res.status(400).json({ success: false, error: 'sessionId and url are required' });
    }
    
    console.log(`🌐 Navigate [${sessionId}]: ${url}`);
    const browserController = getBrowserController();
    const result = await browserController.navigate(sessionId, url);
    
    console.log(`✓ Navigated to ${result.url}`);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ Navigate error:', error);
    res.status(500).json({ success: false, error: error.message || 'Navigate failed' });
  }
});

// Get page snapshot (accessibility tree)
app.post('/api/browser/snapshot', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId is required' });
    }
    
    console.log(`📸 Snapshot [${sessionId}]`);
    const browserController = getBrowserController();
    const result = await browserController.snapshot(sessionId);
    
    console.log(`✓ Snapshot captured (${result.snapshot.length} chars)`);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ Snapshot error:', error);
    res.status(500).json({ success: false, error: error.message || 'Snapshot failed' });
  }
});

// Take screenshot
app.post('/api/browser/screenshot', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, fullPage = false } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId is required' });
    }
    
    console.log(`📷 Screenshot [${sessionId}] (fullPage: ${fullPage})`);
    const browserController = getBrowserController();
    const result = await browserController.screenshot(sessionId, fullPage);
    
    console.log(`✓ Screenshot captured (${result.screenshot.length} chars base64)`);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ Screenshot error:', error);
    res.status(500).json({ success: false, error: error.message || 'Screenshot failed' });
  }
});

// Click element
app.post('/api/browser/click', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, selector } = req.body;
    if (!sessionId || !selector) {
      return res.status(400).json({ success: false, error: 'sessionId and selector are required' });
    }
    
    console.log(`👆 Click [${sessionId}]: ${selector}`);
    const browserController = getBrowserController();
    const result = await browserController.click(sessionId, selector);
    
    console.log(`✓ ${result.message}`);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ Click error:', error);
    res.status(500).json({ success: false, error: error.message || 'Click failed' });
  }
});

// Type into element
app.post('/api/browser/type', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, selector, text, submit = false } = req.body;
    if (!sessionId || !selector || text === undefined) {
      return res.status(400).json({ success: false, error: 'sessionId, selector, and text are required' });
    }
    
    console.log(`⌨️  Type [${sessionId}]: "${text}" into ${selector}`);
    const browserController = getBrowserController();
    const result = await browserController.type(sessionId, selector, text, submit);
    
    console.log(`✓ ${result.message}`);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ Type error:', error);
    res.status(500).json({ success: false, error: error.message || 'Type failed' });
  }
});

// Select option
app.post('/api/browser/select', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, selector, value } = req.body;
    if (!sessionId || !selector || !value) {
      return res.status(400).json({ success: false, error: 'sessionId, selector, and value are required' });
    }
    
    console.log(`📋 Select [${sessionId}]: ${value} in ${selector}`);
    const browserController = getBrowserController();
    const result = await browserController.select(sessionId, selector, value);
    
    console.log(`✓ ${result.message}`);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ Select error:', error);
    res.status(500).json({ success: false, error: error.message || 'Select failed' });
  }
});

// Wait for element or page load
app.post('/api/browser/wait', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, selector, timeout = 10000 } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId is required' });
    }
    
    console.log(`⏳ Wait [${sessionId}]: ${selector || 'page load'}`);
    const browserController = getBrowserController();
    const result = await browserController.waitFor(sessionId, selector, timeout);
    
    console.log(`✓ ${result.message}`);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ Wait error:', error);
    res.status(500).json({ success: false, error: error.message || 'Wait failed' });
  }
});

// Evaluate JavaScript
app.post('/api/browser/evaluate', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, script } = req.body;
    if (!sessionId || !script) {
      return res.status(400).json({ success: false, error: 'sessionId and script are required' });
    }
    
    console.log(`🔧 Evaluate [${sessionId}]: ${script.slice(0, 100)}...`);
    const browserController = getBrowserController();
    const result = await browserController.evaluate(sessionId, script);
    
    console.log(`✓ Evaluation complete`);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ Evaluate error:', error);
    res.status(500).json({ success: false, error: error.message || 'Evaluation failed' });
  }
});

// Get page content
app.post('/api/browser/content', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId is required' });
    }
    
    console.log(`📄 Get content [${sessionId}]`);
    const browserController = getBrowserController();
    const result = await browserController.getPageContent(sessionId);
    
    console.log(`✓ Content retrieved (${result.text.length} chars)`);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ Get content error:', error);
    res.status(500).json({ success: false, error: error.message || 'Get content failed' });
  }
});

// Close browser session
app.post('/api/browser/close', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId is required' });
    }
    
    console.log(`🚪 Close session [${sessionId}]`);
    const browserController = getBrowserController();
    const result = await browserController.closeSession(sessionId);
    
    console.log(`✓ ${result.message}`);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ Close session error:', error);
    res.status(500).json({ success: false, error: error.message || 'Close session failed' });
  }
});

// ============================================================================
// Legacy Job Scraping Endpoints (deprecated, kept for backwards compatibility)
// ============================================================================

// SERP API job search endpoint
app.post('/api/search-serp', authenticate, async (req: Request, res: Response) => {
  try {
    const { keywords, location, experience_level, remote } = req.body;

    if (!keywords || !location) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: keywords and location are required',
        details: { keywords: !!keywords, location: !!location }
      });
    }

    console.log('🔍 SERP API search request:', { keywords, location, experience_level, remote });

    const serpClient = getSerpClient();
    const results = await serpClient.searchJobs({
      keywords,
      location,
      experience_level,
      remote
    });

    console.log(`✓ SERP API returned ${results.length} opportunities`);
    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error('❌ Error searching via SERP API:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Search jobs on Indeed
app.post('/api/search-indeed', authenticate, async (req: Request, res: Response) => {
  try {
    const { keywords, location, experience_level, remote } = req.body;
    
    // Validate required parameters
    if (!keywords || !location) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: keywords and location are required',
        details: { keywords: !!keywords, location: !!location }
      });
    }
    
    console.log('🔍 Indeed search request:', { keywords, location, experience_level, remote });
    
    const browserService = getBrowserJobService();
    const results = await browserService.searchJobsIndeed({
      keywords, 
      location, 
      experience_level, 
      remote
    });
    
    console.log(`✓ Found ${results.length} jobs on Indeed`);
    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error('❌ Error searching Indeed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Unknown error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Search jobs on Google Jobs
app.post('/api/search-google', authenticate, async (req: Request, res: Response) => {
  try {
    const { keywords, location, experience_level, remote } = req.body;
    
    // Validate required parameters
    if (!keywords || !location) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: keywords and location are required',
        details: { keywords: !!keywords, location: !!location }
      });
    }
    
    console.log('🔍 Google Jobs search request:', { keywords, location, experience_level, remote });
    
    const browserService = getBrowserJobService();
    const results = await browserService.searchJobsGoogle({
      keywords, 
      location, 
      experience_level, 
      remote
    });
    
    console.log(`✓ Found ${results.length} jobs on Google Jobs`);
    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error('❌ Error searching Google Jobs:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Unknown error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Search jobs on LinkedIn
app.post('/api/search-linkedin', authenticate, async (req: Request, res: Response) => {
  try {
    const { keywords, location, experience_level, remote, userId } = req.body;
    
    // Validate required parameters
    if (!keywords || !location || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: keywords, location, and userId are required',
        details: { keywords: !!keywords, location: !!location, userId: !!userId }
      });
    }
    
    console.log('🔍 LinkedIn search request:', { keywords, location, experience_level, remote, userId });
    
    const browserService = getBrowserJobService();
    const results = await browserService.searchJobsLinkedIn({
      keywords, 
      location, 
      experience_level, 
      remote, 
      userId
    });
    
    console.log(`✓ Found ${results.length} jobs on LinkedIn`);
    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error('❌ Error searching LinkedIn:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Unknown error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get detailed job information
app.post('/api/job-details', authenticate, async (req: Request, res: Response) => {
  try {
    const { job_url } = req.body;
    console.log('📄 Job details request:', { job_url });
    
    if (!job_url) {
      return res.status(400).json({ 
        success: false, 
        error: 'job_url is required' 
      });
    }
    
    const browserService = getBrowserJobService();
    const details = await browserService.getJobDetails(job_url);
    
    console.log('✓ Job details retrieved');
    res.json({ success: true, data: details });
  } catch (error: any) {
    console.error('❌ Error getting job details:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Unknown error occurred'
    });
  }
});

// Apply to a job
app.post('/api/apply-to-job', authenticate, async (req: Request, res: Response) => {
  try {
    const { job_url, user_profile } = req.body;
    console.log('📝 Apply to job request:', { job_url });
    
    if (!job_url || !user_profile) {
      return res.status(400).json({ 
        success: false, 
        error: 'job_url and user_profile are required' 
      });
    }
    
    const browserService = getBrowserJobService();
    const result = await browserService.applyToJob(job_url, user_profile);
    
    console.log(`${result.success ? '✓' : '❌'} Application result:`, result.message);
    res.json({ success: result.success, data: result });
  } catch (error: any) {
    console.error('❌ Error applying to job:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Unknown error occurred'
    });
  }
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log('🚀 LLM-controlled browser service running on http://localhost:' + PORT);
  console.log('📝 API Key:', process.env.API_KEY ? 'Set' : 'Not set (warning!)');
  console.log('🔧 Environment:', process.env.NODE_ENV || 'development');
  console.log('🌐 New endpoints:');
  console.log('   POST /api/browser/navigate    - Navigate to URL');
  console.log('   POST /api/browser/snapshot    - Get page accessibility tree');
  console.log('   POST /api/browser/screenshot  - Take screenshot');
  console.log('   POST /api/browser/click       - Click element');
  console.log('   POST /api/browser/type        - Type into element');
  console.log('   POST /api/browser/select      - Select dropdown option');
  console.log('   POST /api/browser/wait        - Wait for element/load');
  console.log('   POST /api/browser/evaluate    - Execute JavaScript');
  console.log('   POST /api/browser/content     - Get page HTML/text');
  console.log('   POST /api/browser/close       - Close session');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, closing browser sessions...');
  const sessionManager = getBrowserSessionManager();
  await sessionManager.closeAll();
  server.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, closing browser sessions...');
  const sessionManager = getBrowserSessionManager();
  await sessionManager.closeAll();
  server.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

