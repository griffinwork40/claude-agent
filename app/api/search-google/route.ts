// app/api/search-google/route.ts
// Google Jobs search endpoint with serverless-compatible scraping
import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { JobOpportunity } from '@/types';

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
    
    // Use fetch with realistic headers to avoid detection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log('❌ Google Jobs request failed:', response.status);
      return NextResponse.json({
        success: true,
        data: [{
          title: "Request Failed",
          company: "Google Jobs",
          location: location,
          salary: "N/A",
          description: `HTTP ${response.status}: ${response.statusText}`,
          url: searchUrl,
          status: "error",
          error: `HTTP ${response.status}`
        }],
        message: "Google Jobs request failed"
      });
    }
    
    const html = await response.text();
    
    // Check if we're blocked or redirected
    if (html.includes('sorry') || html.includes('blocked') || html.includes('captcha') || html.includes('robot')) {
      console.log('❌ Google Jobs blocked access - anti-bot protection detected');
      
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
    
    // Parse HTML with cheerio
    const $ = cheerio.load(html);
    
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
      const elements = $(selector);
      
      if (elements.length > 0) {
        console.log(`✓ Found ${elements.length} jobs with selector: ${selector}`);
        
        elements.each((index, element) => {
          try {
            const $el = $(element);
            
            // Extract job data with multiple fallback methods
            const title = $el.find('h3, .job-title, [data-testid="job-title"], .title').first().text().trim() || `Job ${index + 1}`;
            const company = $el.find('.company, .company-name, [data-testid="company-name"], .employer').first().text().trim() || 'Unknown Company';
            const location = $el.find('.location, .job-location, [data-testid="job-location"]').first().text().trim() || 'Location not specified';
            const salary = $el.find('.salary, .job-salary, [data-testid="salary"]').first().text().trim() || 'Salary not specified';
            const url = $el.find('a[href]').first().attr('href') || '#';
            
            // Extract description from various possible elements
            const description = $el.find('.description, .job-description, .summary, p').first().text().trim() || 'No description available';
            
            if (title && title !== 'Job') {
              jobs.push({
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
        
        if (jobs.length > 0) {
          foundJobs = true;
          break;
        }
      }
    }
    
    // If no jobs found with selectors, try a more generic approach
    if (!foundJobs) {
      console.log('🔍 No jobs found with specific selectors, trying generic approach...');
      
      // Look for any text that might be job-related
      const pageText = $('body').text();
      const hasJobKeywords = /job|position|career|hiring|engineer|developer|software/i.test(pageText);
      
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