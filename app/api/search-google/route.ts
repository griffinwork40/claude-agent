// app/api/search-google/route.ts
// Google Jobs search endpoint with anti-bot evasion
import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { JobOpportunity } from '@/types';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

export async function POST(request: NextRequest) {
  try {
    const { keywords, location, experience_level, remote } = await request.json();
    
    console.log('🔍 Google Jobs search request:', { keywords, location, experience_level, remote });
    
    // Build Google Jobs search URL
    const searchParams = new URLSearchParams({
      q: keywords,
      l: location,
      ...(remote && { jt: 'remote' }),
      ...(experience_level && { exp: experience_level })
    });
    
    const searchUrl = `https://www.google.com/search?${searchParams.toString()}&ibp=htl;jobs`;
    
    console.log('🌐 Searching Google Jobs:', searchUrl);
    
    // Launch browser with stealth mode
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Add random delays to mimic human behavior
    const randomDelay = () => Math.random() * 2000 + 1000;
    
    try {
      // Navigate to Google Jobs
      await page.goto(searchUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Wait for page to load
      await page.waitForTimeout(randomDelay());
      
      // Check if we're blocked or redirected
      const currentUrl = page.url();
      if (currentUrl.includes('sorry') || currentUrl.includes('blocked') || currentUrl.includes('captcha')) {
        console.log('❌ Google Jobs blocked access - anti-bot protection detected');
        await browser.close();
        
        return NextResponse.json({
          success: true,
          data: [{
            title: "Manual Search Required",
            company: "Google Jobs",
            location: location,
            salary: "N/A",
            description: "Automated search failed: anti-bot protection detected. Please use the manual search link below.",
            url: searchUrl,
            status: "fallback",
            fallback_url: searchUrl,
            error: "anti-bot protection detected"
          }],
          message: "Found 1 jobs on Google Jobs (fallback due to anti-bot protection)"
        });
      }
      
      // Try multiple selectors for job listings
      const jobSelectors = [
        '[data-ved] .g', // Google's job cards
        '.g .job-card', // Alternative job card selector
        '[data-ved] .job-card-container', // Another variant
        '.g[data-ved]', // Generic Google result
        '.jobsearch-ResultsList > li', // Indeed-style results
        '.job-card-container', // Generic job card
        '[data-testid="job-card"]' // Test ID based
      ];
      
      let jobs: JobOpportunity[] = [];
      let foundJobs = false;
      
      for (const selector of jobSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          const jobElements = await page.$$(selector);
          
          if (jobElements.length > 0) {
            console.log(`✓ Found ${jobElements.length} jobs with selector: ${selector}`);
            
            jobs = await page.evaluate((sel) => {
              const elements = document.querySelectorAll(sel);
              const jobList: JobOpportunity[] = [];
              
              elements.forEach((element, index) => {
                try {
                  // Extract job data with multiple fallback methods
                  const titleElement = element.querySelector('h3, .job-title, [data-testid="job-title"], .title') as HTMLElement;
                  const companyElement = element.querySelector('.company, .company-name, [data-testid="company-name"], .employer') as HTMLElement;
                  const locationElement = element.querySelector('.location, .job-location, [data-testid="job-location"]') as HTMLElement;
                  const salaryElement = element.querySelector('.salary, .job-salary, [data-testid="salary"]') as HTMLElement;
                  const linkElement = element.querySelector('a[href]') as HTMLAnchorElement;
                  
                  const title = titleElement?.textContent?.trim() || `Job ${index + 1}`;
                  const company = companyElement?.textContent?.trim() || 'Unknown Company';
                  const location = locationElement?.textContent?.trim() || 'Location not specified';
                  const salary = salaryElement?.textContent?.trim() || 'Salary not specified';
                  const url = linkElement?.href || '#';
                  
                  // Extract description from various possible elements
                  const descElement = element.querySelector('.description, .job-description, .summary, p') as HTMLElement;
                  const description = descElement?.textContent?.trim() || 'No description available';
                  
                  if (title && title !== 'Job') {
                    jobList.push({
                      title,
                      company,
                      location,
                      salary,
                      description: description.substring(0, 500), // Limit description length
                      url,
                      status: 'success'
                    });
                  }
                } catch (error) {
                  console.log('Error parsing job element:', error);
                }
              });
              
              return jobList;
            }, selector);
            
            foundJobs = true;
            break;
          }
        } catch (error) {
          console.log(`Selector ${selector} failed:`, error);
          continue;
        }
      }
      
      // If no jobs found with selectors, try a more generic approach
      if (!foundJobs) {
        console.log('🔍 No jobs found with specific selectors, trying generic approach...');
        
        // Look for any text that might be job-related
        const pageText = await page.evaluate(() => document.body.textContent);
        const hasJobKeywords = /job|position|career|hiring|engineer|developer|software/i.test(pageText || '');
        
        if (hasJobKeywords) {
          // Return a fallback response with manual search link
          jobs = [{
            title: "Jobs Found - Manual Review Required",
            company: "Google Jobs",
            location: location,
            salary: "See individual listings",
            description: "Jobs were found but couldn't be automatically parsed. Please visit the search URL to view results manually.",
            url: searchUrl,
            status: "fallback",
            fallback_url: searchUrl
          }];
        }
      }
      
      await browser.close();
      
      if (jobs.length === 0) {
        console.log('❌ No jobs found on Google Jobs');
        return NextResponse.json({
          success: true,
          data: [{
            title: "No Jobs Found",
            company: "Google Jobs",
            location: location,
            salary: "N/A",
            description: "No job listings found for the specified criteria. Try adjusting your search terms.",
            url: searchUrl,
            status: "error",
            error: "No jobs found"
          }],
          message: "Found 0 jobs on Google Jobs"
        });
      }
      
      console.log(`✓ Google Jobs search completed: ${jobs.length} jobs found`);
      return NextResponse.json({
        success: true,
        data: jobs,
        message: `Found ${jobs.length} jobs on Google Jobs`
      });
      
    } catch (error) {
      await browser.close();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Google Jobs search error:', error);
    
    return NextResponse.json({
      success: true,
      data: [{
        title: "Search Error",
        company: "Google Jobs",
        location: "Unknown",
        salary: "N/A",
        description: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        url: "#",
        status: "error",
        error: error instanceof Error ? error.message : 'Unknown error'
      }],
      message: "Google Jobs search failed"
    });
  }
}