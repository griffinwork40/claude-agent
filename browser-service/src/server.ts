// browser-service/src/server.ts
// Express API server for LLM-controlled browser automation
import express, { Request, Response, NextFunction } from 'express';
import { getBrowserJobService } from './browser-tools';
import { getBrowserController } from './browser-controller';
import { getBrowserSessionManager } from './browser-session';
import { getSerpClient } from './serp-client';
import { getWebSocketManager } from './websocket-server';
import { getVNCServer } from './vnc-server';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
app.use(express.json({ limit: '50mb' })); // Increase limit for screenshots

// Initialize WebSocket and VNC servers
const wsManager = getWebSocketManager();
const vncServer = getVNCServer();

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

// Create a new browser session with optional VNC access
app.post('/api/browser/session/create', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, userId, headful = false } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId is required' });
    }
    
    console.log(`🆕 Creating browser session [${sessionId}] (headful: ${headful})`);
    const browserController = getBrowserController();
    const sessionManager = getBrowserSessionManager();
    
    // Create session (this will also create VNC if headful)
    const { session } = await sessionManager.getOrCreateSession(sessionId, userId, headful);
    
    const result = {
      sessionId,
      userId,
      isHeadful: session.isHeadful,
      vncUrl: session.vncUrl,
      vncPort: session.vncPort,
      websocketUrl: `ws://localhost:${process.env.WEBSOCKET_PORT || 8080}`
    };
    
    console.log(`✓ Session created: ${sessionId}`);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ Create session error:', error);
    res.status(500).json({ success: false, error: error.message || 'Create session failed' });
  }
});

// Get session info
app.get('/api/browser/session/:sessionId', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const sessionManager = getBrowserSessionManager();
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    res.json({ 
      success: true, 
      data: {
        sessionId: session.sessionId,
        userId: session.userId,
        isHeadful: session.isHeadful,
        vncUrl: session.vncUrl,
        vncPort: session.vncPort,
        controlOwner: session.controlOwner,
        isRecording: session.isRecording,
        lastActivity: session.lastActivity
      }
    });
  } catch (error: any) {
    console.error('❌ Get session error:', error);
    res.status(500).json({ success: false, error: error.message || 'Get session failed' });
  }
});

// Navigate to a URL
app.post('/api/browser/navigate', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, url, headful = false, userId } = req.body;
    if (!sessionId || !url) {
      return res.status(400).json({ success: false, error: 'sessionId and url are required' });
    }
    
    console.log(`🌐 Navigate [${sessionId}]: ${url}`);
    const browserController = getBrowserController();
    const result = await browserController.navigate(sessionId, url, headful, userId);
    
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

// Take control of a session
app.post('/api/browser/session/take-control', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, clientId } = req.body;
    if (!sessionId || !clientId) {
      return res.status(400).json({ success: false, error: 'sessionId and clientId are required' });
    }
    
    console.log(`🎮 Taking control of session [${sessionId}] by client [${clientId}]`);
    const sessionManager = getBrowserSessionManager();
    sessionManager.setControlOwner(sessionId, clientId);
    
    // Notify WebSocket clients
    wsManager.emitBrowserEvent({
      type: 'user_takeover',
      sessionId,
      data: { clientId },
      timestamp: Date.now()
    });
    
    res.json({ success: true, data: { message: 'Control taken' } });
  } catch (error: any) {
    console.error('❌ Take control error:', error);
    res.status(500).json({ success: false, error: error.message || 'Take control failed' });
  }
});

// Release control of a session
app.post('/api/browser/session/release-control', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, clientId } = req.body;
    if (!sessionId || !clientId) {
      return res.status(400).json({ success: false, error: 'sessionId and clientId are required' });
    }
    
    console.log(`🤖 Releasing control of session [${sessionId}] by client [${clientId}]`);
    const sessionManager = getBrowserSessionManager();
    sessionManager.releaseControl(sessionId);
    
    // Notify WebSocket clients
    wsManager.emitBrowserEvent({
      type: 'user_release',
      sessionId,
      data: { clientId },
      timestamp: Date.now()
    });
    
    res.json({ success: true, data: { message: 'Control released' } });
  } catch (error: any) {
    console.error('❌ Release control error:', error);
    res.status(500).json({ success: false, error: error.message || 'Release control failed' });
  }
});

// Get WebSocket connection info
app.get('/api/websocket/info', authenticate, (req: Request, res: Response) => {
  try {
    const wsPort = process.env.WEBSOCKET_PORT || 8080;
    res.json({
      success: true,
      data: {
        websocketUrl: `ws://localhost:${wsPort}`,
        activeClients: wsManager.getClientCount(),
        activeSessions: wsManager.getActiveSessions()
      }
    });
  } catch (error: any) {
    console.error('❌ WebSocket info error:', error);
    res.status(500).json({ success: false, error: error.message || 'WebSocket info failed' });
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

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log('🚀 LLM-controlled browser service running on http://localhost:' + PORT);
  console.log('📝 API Key:', process.env.API_KEY ? 'Set' : 'Not set (warning!)');
  console.log('🔧 Environment:', process.env.NODE_ENV || 'development');
  console.log('🌐 Browser endpoints:');
  console.log('   POST /api/browser/session/create     - Create new session with VNC');
  console.log('   GET  /api/browser/session/:id        - Get session info');
  console.log('   POST /api/browser/session/take-control - Take control of session');
  console.log('   POST /api/browser/session/release-control - Release control');
  console.log('   POST /api/browser/navigate           - Navigate to URL');
  console.log('   POST /api/browser/snapshot           - Get page accessibility tree');
  console.log('   POST /api/browser/screenshot         - Take screenshot');
  console.log('   POST /api/browser/click              - Click element');
  console.log('   POST /api/browser/type               - Type into element');
  console.log('   POST /api/browser/select             - Select dropdown option');
  console.log('   POST /api/browser/wait               - Wait for element/load');
  console.log('   POST /api/browser/evaluate           - Execute JavaScript');
  console.log('   POST /api/browser/content            - Get page HTML/text');
  console.log('   POST /api/browser/close              - Close session');
  console.log('🌐 WebSocket endpoints:');
  console.log('   GET  /api/websocket/info             - WebSocket connection info');
  console.log('🔌 WebSocket server running on port:', process.env.WEBSOCKET_PORT || 8080);
  console.log('🖥️  VNC server ready for headful sessions');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, closing services...');
  const sessionManager = getBrowserSessionManager();
  await sessionManager.closeAll();
  await vncServer.destroyAllSessions();
  await wsManager.close();
  server.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, closing services...');
  const sessionManager = getBrowserSessionManager();
  await sessionManager.closeAll();
  await vncServer.destroyAllSessions();
  await wsManager.close();
  server.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

