/**
 * Tool Executor Module
 * 
 * Orchestrates tool execution for the Claude agent.
 * Extracted from claude-agent.ts for better modularity and maintainability.
 */

import { ToolUse, ToolResult } from '@/types';
import { executeGmailTool } from './gmail-tools';
import { executeBrowserTool } from './browser-tool-executor';

/**
 * Execute tools based on tool use requests
 */
export async function executeTools(
  toolUses: ToolUse[],
  userId: string,
  sendActivity?: (type: string, data: any) => void
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  // Generate batch ID for multiple tools
  const batchId = toolUses.length > 1 ? `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}` : undefined;

  // Send batch start event if multiple tools
  if (batchId && sendActivity) {
    sendActivity('batch_start', {
      batchId,
      batchTotal: toolUses.length,
      tools: toolUses.map(t => t.name),
      content: `Starting batch execution of ${toolUses.length} tools...`
    });
  }

  let completedCount = 0;

  const buildBatchContext = (completed: number) => (
    batchId ? {
      batchId,
      batchTotal: toolUses.length,
      batchCompleted: completed
    } : {}
  );

  for (const toolUse of toolUses) {
    // Add batch context to tool activities
    const executingBatchContext = buildBatchContext(completedCount);

    console.log(`🔧 Executing tool: ${toolUse.name}`, toolUse.input);

    // Send activity event for tool execution start
    if (sendActivity) {
      sendActivity('tool_executing', {
        tool: toolUse.name,
        toolId: toolUse.id,
        params: toolUse.input,
        ...executingBatchContext
      });
    }

    completedCount++;
    const resultBatchContext = buildBatchContext(completedCount);

    try {
      let result: any;
      
      // Determine tool type and execute accordingly
      if (toolUse.name.startsWith('gmail_')) {
        result = await executeGmailTool(toolUse, userId);
      } else {
        result = await executeBrowserTool(toolUse, userId);
      }
      
      results.push({
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
        is_error: !result.success
      });
      
      console.log(`✓ Tool ${toolUse.name} executed:`, result.success ? 'SUCCESS' : 'FAILED');
      
      // Send activity event for tool execution complete with batch context
      if (sendActivity) {
        sendActivity('tool_result', {
          tool: toolUse.name,
          toolId: toolUse.id,
          success: result.success,
          result: result,
          message: result.message,
          ...resultBatchContext
        });
        if (batchId) {
          sendActivity('batch_progress', {
            ...resultBatchContext,
            content: `Completed ${completedCount} of ${toolUses.length} tools`
          });
        }
      }
      
    } catch (error: unknown) {
      console.error(`❌ Error executing tool ${toolUse.name}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      const errorResult = {
        success: false,
        error: `Tool execution failed: ${errorMessage}`,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      };
      
      results.push({
        tool_use_id: toolUse.id,
        content: JSON.stringify(errorResult),
        is_error: true
      });
      
      // Send activity event for tool error with batch context
      if (sendActivity) {
        sendActivity('tool_result', {
          tool: toolUse.name,
          toolId: toolUse.id,
          success: false,
          error: errorMessage,
          message: `Failed: ${errorMessage}`,
          ...resultBatchContext
        });
        if (batchId) {
          sendActivity('batch_progress', {
            ...resultBatchContext,
            content: `Completed ${completedCount} of ${toolUses.length} tools (latest failed)`
          });
        }
      }
    }
  }

  // Send batch completion event if this was a batch execution
  if (batchId && sendActivity) {
    const successCount = results.filter(r => !r.is_error).length;
    const failureCount = results.length - successCount;

    sendActivity('batch_complete', {
      batchId,
      batchTotal: toolUses.length,
      batchCompleted: completedCount,
      success: failureCount === 0,
      content: failureCount === 0
        ? `Completed ${toolUses.length} tools successfully`
        : `Completed ${toolUses.length} tools with ${failureCount} error${failureCount > 1 ? 's' : ''}`
    });
  }

  return results;
}