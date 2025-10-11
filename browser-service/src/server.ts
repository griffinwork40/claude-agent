// browser-service/src/server.ts
// Express API server for browser automation - separates Playwright from serverless Next.js
import express, { Request, Response, NextFunction } from 'express';
import { getBrowserJobService } from './browser-tools';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
app.use(express.json());

// Simple API key authentication middleware
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Health check endpoint (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    service: 'browser-automation',
    timestamp: new Date().toISOString()
  });
});

// Search jobs on Indeed
app.post('/api/search-indeed', authenticate, async (req: Request, res: Response) => {
  try {
    const { keywords, location, experience_level, remote } = req.body;
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
      error: error.message || 'Unknown error occurred'
    });
  }
});

// Search jobs on LinkedIn
app.post('/api/search-linkedin', authenticate, async (req: Request, res: Response) => {
  try {
    const { keywords, location, experience_level, remote, userId } = req.body;
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
      error: error.message || 'Unknown error occurred'
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
app.listen(PORT, () => {
  console.log('🚀 Browser service running on http://localhost:' + PORT);
  console.log('📝 API Key:', process.env.API_KEY ? 'Set' : 'Not set (warning!)');
  console.log('🔧 Environment:', process.env.NODE_ENV || 'development');
});

