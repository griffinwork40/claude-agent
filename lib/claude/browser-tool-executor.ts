/**
 * Browser Tool Executor Module
 * 
 * Handles browser tool execution for the Claude agent.
 * Extracted from claude-agent.ts for better modularity and maintainability.
 */

import { getBrowserService } from '../browser-tools';
import { ToolUse, BrowserToolResult } from '@/types';

/**
 * Execute a browser tool based on the tool use request
 */
export async function executeBrowserTool(toolUse: ToolUse, userId: string): Promise<BrowserToolResult> {
  const browserService = getBrowserService();
  const input = toolUse.input as Record<string, any>;
  
  switch (toolUse.name) {
    case 'browser_navigate':
      const navResult = await browserService.navigate(input.sessionId, input.url);
      return {
        success: true,
        data: navResult,
        message: `Navigated to ${navResult.url}`
      };
      
    case 'browser_snapshot':
      const snapshotResult = await browserService.snapshot(input.sessionId);
      return {
        success: true,
        data: snapshotResult,
        message: 'Page snapshot captured'
      };
      
    case 'browser_screenshot':
      const screenshotResult = await browserService.screenshot(input.sessionId, input.fullPage);
      return {
        success: true,
        data: { screenshot: screenshotResult.screenshot.slice(0, 100) + '... (truncated)' },
        message: 'Screenshot captured'
      };
      
    case 'browser_click':
      const clickResult = await browserService.click(input.sessionId, input.selector);
      return {
        success: true,
        data: clickResult,
        message: clickResult.message
      };
      
    case 'browser_type':
      const typeResult = await browserService.type(input.sessionId, input.selector, input.text, input.submit);
      return {
        success: true,
        data: typeResult,
        message: typeResult.message
      };
      
    case 'browser_select':
      const selectResult = await browserService.select(input.sessionId, input.selector, input.value);
      return {
        success: true,
        data: selectResult,
        message: selectResult.message
      };
      
    case 'browser_wait':
      const waitResult = await browserService.waitFor(input.sessionId, input.selector, input.timeout);
      return {
        success: true,
        data: waitResult,
        message: waitResult.message
      };
      
    case 'browser_evaluate':
      const evalResult = await browserService.evaluate(input.sessionId, input.script);
      return {
        success: true,
        data: evalResult,
        message: 'JavaScript executed successfully'
      };
      
    case 'browser_get_content':
      const contentResult = await browserService.getContent(input.sessionId);
      return {
        success: true,
        data: {
          url: contentResult.url,
          textLength: contentResult.text.length,
          htmlLength: contentResult.html.length,
          textPreview: contentResult.text.slice(0, 500)
        },
        message: 'Page content retrieved'
      };
      
    case 'browser_close_session':
      const closeResult = await browserService.closeSession(input.sessionId);
      return {
        success: true,
        data: closeResult,
        message: closeResult.message
      };
      
    case 'search_jobs_indeed':
      console.log('🔍 Executing search_jobs_indeed:', input);
      try {
        const indeedJobsResult = await browserService.searchJobsIndeed({
          keywords: input.keywords,
          location: input.location,
          experience_level: input.experience_level,
          remote: input.remote
        });
        console.log(`✓ Indeed search completed: ${indeedJobsResult.length} jobs found`);
        return {
          success: true,
          data: indeedJobsResult,
          message: `Found ${indeedJobsResult.length} jobs on Indeed`
        };
      } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Indeed search tool failed:', errMessage);
        return {
          success: false,
          error: `Indeed search failed: ${errMessage}`,
          message: `Failed to search Indeed: ${errMessage}`
        };
      }
      
    case 'search_jobs_google':
      console.log('🔍 Executing search_jobs_google:', input);
      try {
        const googleJobsResult = await browserService.searchJobsGoogle({
          keywords: input.keywords,
          location: input.location,
          experience_level: input.experience_level,
          remote: input.remote
        });
        console.log(`✓ Google Jobs search completed: ${googleJobsResult.length} jobs found`);
        return {
          success: true,
          data: googleJobsResult,
          message: `Found ${googleJobsResult.length} jobs on Google Jobs`
        };
      } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Google Jobs search tool failed:', errMessage);
        return {
          success: false,
          error: `Google Jobs search failed: ${errMessage}`,
          message: `Failed to search Google Jobs: ${errMessage}`
        };
      }
      
    case 'search_jobs_linkedin':
      console.log('🔍 Executing search_jobs_linkedin:', input);
      try {
        const linkedinJobsResult = await browserService.searchJobsLinkedIn({
          keywords: input.keywords,
          location: input.location,
          experience_level: input.experience_level,
          remote: input.remote,
          userId: input.userId || userId
        });
        console.log(`✓ LinkedIn search completed: ${linkedinJobsResult.length} jobs found`);
        return {
          success: true,
          data: linkedinJobsResult,
          message: `Found ${linkedinJobsResult.length} jobs on LinkedIn`
        };
      } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ LinkedIn search tool failed:', errMessage);
        return {
          success: false,
          error: `LinkedIn search failed: ${errMessage}`,
          message: `Failed to search LinkedIn: ${errMessage}`
        };
      }

    case 'find_company_careers_page':
      console.log('🔍 Finding company careers page:', input);
      try {
        const careersResult = await browserService.findCompanyCareersPage({
          companyName: input.companyName,
          jobTitle: input.jobTitle
        });
        return {
          success: true,
          data: careersResult,
          message: `Found careers page: ${careersResult.careersUrl}`
        };
      } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errMessage,
          message: `Failed to find careers page: ${errMessage}`
        };
      }

    case 'extract_company_application_url':
      console.log('🔍 Extracting company application URL:', input);
      try {
        const extractResult = await browserService.extractCompanyApplicationUrl({
          jobBoardUrl: input.jobBoardUrl
        });
        
        if (extractResult.companyApplicationUrl) {
          return {
            success: true,
            data: extractResult,
            message: `Found company application URL: ${extractResult.companyApplicationUrl}`
          };
        } else {
          return {
            success: false,
            data: extractResult,
            message: `This job requires applying through the job board (no direct company application available)`
          };
        }
      } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errMessage,
          message: `Failed to extract company URL: ${errMessage}`
        };
      }
      
    default:
      throw new Error(`Unknown browser tool: ${toolUse.name}`);
  }
}