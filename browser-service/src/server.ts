// browser-service/src/server.ts
// Express + WebSocket API server for LLM-controlled browser automation
import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import crypto from 'crypto';
import { getBrowserJobService } from './browser-tools';
import { getBrowserController } from './browser-controller';
import { getBrowserSessionManager } from './browser-session';
import { getSerpClient } from './serp-client';
import { getAutomationWebSocketServer } from './websocket-server';
import { getIntelligentAutomationService } from './intelligent-automation';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
app.use(express.json({ limit: '50mb' })); // Increase limit for screenshots

const httpServer = createServer(app);
const websocketServer = getAutomationWebSocketServer();
websocketServer.attach(httpServer);

const sharedSessionManager = getBrowserSessionManager();
const automationService = getIntelligentAutomationService();

websocketServer.onUserCommand(async (sessionId, command) => {
  try {
    const action = typeof command.action === 'string' ? command.action : '';
    const browserController = getBrowserController();

    if (action === 'request_control') {
      const granted = sharedSessionManager.requestControl(sessionId, 'user');
      websocketServer.broadcast({
        sessionId,
        type: granted ? 'user_takeover' : 'automation_error',
        payload: granted
          ? { message: 'User control granted' }
          : { message: 'Unable to take control; AI currently owns the session.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (action === 'release_control') {
      sharedSessionManager.releaseControl(sessionId, 'user');
      websocketServer.broadcast({
        sessionId,
        type: 'user_release',
        payload: { message: 'User released control back to AI.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (action === 'navigate' && typeof command.url === 'string') {
      await browserController.navigate(sessionId, command.url);
      websocketServer.broadcast({
        sessionId,
        type: 'automation_progress',
        payload: { message: `User navigated to ${command.url}` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (action === 'click' && typeof command.selector === 'string') {
      await browserController.click(sessionId, command.selector);
      websocketServer.broadcast({
        sessionId,
        type: 'automation_progress',
        payload: { message: `User clicked ${command.selector}` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (action === 'type' && typeof command.selector === 'string' && typeof command.text === 'string') {
      await browserController.type(sessionId, command.selector, command.text, Boolean(command.submit));
      websocketServer.broadcast({
        sessionId,
        type: 'automation_progress',
        payload: { message: `User typed into ${command.selector}` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    websocketServer.broadcast({
      sessionId,
      type: 'automation_error',
      payload: { message: `Unsupported user command: ${action}` },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    websocketServer.broadcast({
      sessionId,
      type: 'automation_error',
      payload: { message: error instanceof Error ? error.message : String(error) },
      timestamp: new Date().toISOString(),
    });
  }
});

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
  res.json({
    status: 'ok',
    service: 'llm-browser-automation',
    activeSessions: sharedSessionManager.getActiveSessions().length,
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
    websocketServer.broadcast({
      sessionId,
      type: 'automation_progress',
      payload: { action: 'navigate', url: result.url },
      timestamp: new Date().toISOString(),
    });
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
    websocketServer.broadcast({
      sessionId,
      type: 'automation_progress',
      payload: { action: 'snapshot' },
      timestamp: new Date().toISOString(),
    });
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
    websocketServer.broadcast({
      sessionId,
      type: 'automation_progress',
      payload: { action: 'screenshot', fullPage },
      timestamp: new Date().toISOString(),
    });
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
    websocketServer.broadcast({
      sessionId,
      type: 'automation_progress',
      payload: { action: 'click', selector },
      timestamp: new Date().toISOString(),
    });
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
    websocketServer.broadcast({
      sessionId,
      type: 'automation_progress',
      payload: { action: 'type', selector, text },
      timestamp: new Date().toISOString(),
    });
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
    websocketServer.broadcast({
      sessionId,
      type: 'automation_progress',
      payload: { action: 'select', selector, value },
      timestamp: new Date().toISOString(),
    });
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
    websocketServer.broadcast({
      sessionId,
      type: 'automation_progress',
      payload: { action: 'wait', selector, timeout },
      timestamp: new Date().toISOString(),
    });
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
    websocketServer.broadcast({
      sessionId,
      type: 'automation_progress',
      payload: { action: 'evaluate' },
      timestamp: new Date().toISOString(),
    });
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
    websocketServer.broadcast({
      sessionId,
      type: 'automation_progress',
      payload: { action: 'content', length: result.text.length },
      timestamp: new Date().toISOString(),
    });
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
    websocketServer.broadcast({
      sessionId,
      type: 'automation_progress',
      payload: { action: 'close' },
      timestamp: new Date().toISOString(),
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ Close session error:', error);
    res.status(500).json({ success: false, error: error.message || 'Close session failed' });
  }
});

// Explicitly create or resume a browser session
app.post('/api/browser/session/create', authenticate, async (req: Request, res: Response) => {
  try {
    let { sessionId, headful = true } = req.body;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    sharedSessionManager.requestControl(sessionId, 'ai');
    await sharedSessionManager.getOrCreateSession(sessionId, { headful });
    const preview = sharedSessionManager.getPreview(sessionId);

    res.json({
      success: true,
      data: {
        sessionId,
        preview,
      },
    });
  } catch (error: any) {
    console.error('❌ Session create error:', error);
    res.status(500).json({ success: false, error: error.message || 'Session creation failed' });
  }
});

// Get preview metadata for a session
app.post('/api/browser/preview', authenticate, async (req: Request, res: Response) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'sessionId is required' });
  }

  const preview = sharedSessionManager.getPreview(sessionId);
  if (!preview) {
    return res.status(404).json({ success: false, error: 'Preview not available for this session' });
  }

  res.json({ success: true, data: preview });
});

// Request control of a session via REST
app.post('/api/browser/control/request', authenticate, async (req: Request, res: Response) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'sessionId is required' });
  }

  const granted = sharedSessionManager.requestControl(sessionId, 'user');
  if (!granted) {
    return res.status(423).json({ success: false, error: 'Control locked by AI' });
  }

  websocketServer.broadcast({
    sessionId,
    type: 'user_takeover',
    payload: { message: 'User requested control via REST API.' },
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, data: { message: 'Control granted' } });
});

// Release control back to AI via REST
app.post('/api/browser/control/release', authenticate, async (req: Request, res: Response) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'sessionId is required' });
  }

  sharedSessionManager.releaseControl(sessionId, 'user');
  websocketServer.broadcast({
    sessionId,
    type: 'user_release',
    payload: { message: 'User released control via REST API.' },
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, data: { message: 'Control released' } });
});

// Retrieve session info snapshot
app.get('/api/browser/session/:sessionId', authenticate, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const info = sharedSessionManager.getSessionInfo(sessionId);
  if (!info) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  res.json({ success: true, data: info });
});

// Trigger intelligent automation workflow
app.post('/api/browser/automation/run', authenticate, async (req: Request, res: Response) => {
  const { sessionId, objective } = req.body;
  if (!sessionId || !objective) {
    return res.status(400).json({ success: false, error: 'sessionId and objective are required' });
  }

  automationService.execute({ sessionId, objective }).catch((error) => {
    console.error('Automation execution failed:', error);
  });

  res.json({ success: true, data: { message: 'Automation started' } });
});

// Narrate an automation step to the user
app.post('/api/browser/automation/narrate', authenticate, async (req: Request, res: Response) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message) {
    return res.status(400).json({ success: false, error: 'sessionId and message are required' });
  }

  await automationService.narrate(sessionId, message);
  res.json({ success: true, data: { message: 'Narration dispatched' } });
});

// Ask the user to assist the automation
app.post('/api/browser/user-help', authenticate, async (req: Request, res: Response) => {
  const { sessionId, reason } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'sessionId is required' });
  }

  await automationService.requestUserHelp(sessionId, reason || 'Assistance requested by automation');
  res.json({ success: true, data: { message: 'User help requested' } });
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

// Extract company application URL from job board listing
app.post('/api/extract-company-url', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobBoardUrl } = req.body;
    
    if (!jobBoardUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'jobBoardUrl is required' 
      });
    }
    
    console.log('🔍 Extract company URL request:', { jobBoardUrl });
    
    const browserService = getBrowserJobService();
    const result = await browserService.extractCompanyApplicationUrl(jobBoardUrl);
    
    if (result.companyApplicationUrl) {
      console.log(`✓ Found company application URL: ${result.companyApplicationUrl}`);
    } else {
      console.log('ℹ️ Job requires application through job board');
    }
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ Error extracting company URL:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Unknown error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Find company careers page
app.post('/api/find-careers-page', authenticate, async (req: Request, res: Response) => {
  try {
    const { companyName, jobTitle } = req.body;
    
    if (!companyName) {
      return res.status(400).json({ 
        success: false, 
        error: 'companyName is required' 
      });
    }
    
    console.log('🔍 Find careers page request:', { companyName, jobTitle });
    
    const browserService = getBrowserJobService();
    const result = await browserService.findCompanyCareersPage(companyName, jobTitle);
    
    console.log(`✓ Found careers page: ${result.careersUrl}`);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ Error finding careers page:', error);
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

const httpServer = createServer(app);
const websocketServer = getAutomationWebSocketServer();
websocketServer.attach(httpServer);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
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
  console.log('   POST /api/browser/session/create - Create or resume session');
  console.log('   POST /api/browser/preview     - Retrieve VNC preview details');
  console.log('   POST /api/browser/control/*   - Manage AI/user control handoff');
  console.log('   POST /api/browser/automation/run - Kick off intelligent automation');
  console.log('   POST /api/browser/automation/narrate - Narrate automation steps');
  console.log('   POST /api/browser/user-help   - Broadcast user help requests');
  console.log('   WS   /ws/automation           - Real-time automation events');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, closing browser sessions...');
  await sharedSessionManager.closeAll();
  httpServer.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, closing browser sessions...');
  await sharedSessionManager.closeAll();
  httpServer.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

