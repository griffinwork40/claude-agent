// browser-service/src/intelligent-automation.ts
// High-level automation orchestrator powered by Anthropic SDK and real-time events
import { Anthropic } from '@anthropic-ai/sdk';
import { getBrowserSessionManager } from './browser-session';
import { getAutomationWebSocketServer, AutomationEvent } from './websocket-server';

interface AutomationGoal {
  sessionId: string;
  objective: string;
}

interface AutomationStepResult {
  success: boolean;
  message: string;
  retry?: boolean;
}

/**
 * Wraps Anthropic calls and Playwright helpers to provide resilient automation flows.
 */
class IntelligentAutomationService {
  private readonly anthropic: Anthropic | null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.anthropic = apiKey ? new Anthropic({ apiKey }) : null;
  }

  /**
   * Execute a narrated automation routine and stream updates over WebSocket.
   */
  async execute(goal: AutomationGoal): Promise<void> {
    const { sessionId, objective } = goal;
    const sessionManager = getBrowserSessionManager();
    const websocket = getAutomationWebSocketServer();

    const startEvent: AutomationEvent = {
      sessionId,
      type: 'automation_start',
      payload: { objective },
      timestamp: new Date().toISOString(),
    };
    websocket.broadcast(startEvent);

    if (!this.anthropic) {
      websocket.broadcast({
        sessionId,
        type: 'automation_error',
        payload: { message: 'Anthropic API key missing; falling back to scripted automation.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await this.narrate(sessionId, `Starting automation: ${objective}`);

    try {
      const preview = sessionManager.getPreview(sessionId);
      const contextInfo = preview ? 'Preview available' : 'Headless session';

      const prompt = `You are orchestrating a job application assistant. Objective: ${objective}. ${contextInfo}. Provide a step-by-step plan.`;
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 512,
        temperature: 0.4,
        system: 'You analyze browser state and provide actionable plans for automation.',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
      });

      const plan = response.content[0]?.type === 'text' ? response.content[0].text : 'Proceed with default automation flow.';
      websocket.broadcast({
        sessionId,
        type: 'automation_progress',
        payload: { plan },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      websocket.broadcast({
        sessionId,
        type: 'automation_error',
        payload: { message: error instanceof Error ? error.message : String(error) },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Emit a narration event for transparency.
   */
  async narrate(sessionId: string, message: string): Promise<void> {
    const websocket = getAutomationWebSocketServer();
    websocket.broadcast({
      sessionId,
      type: 'automation_progress',
      payload: { message },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Ask the user for help via automation feed.
   */
  async requestUserHelp(sessionId: string, reason: string): Promise<void> {
    const websocket = getAutomationWebSocketServer();
    websocket.broadcast({
      sessionId,
      type: 'user_takeover',
      payload: { reason },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Report automation outcome.
   */
  async reportResult(sessionId: string, result: AutomationStepResult): Promise<void> {
    const websocket = getAutomationWebSocketServer();
    websocket.broadcast({
      sessionId,
      type: result.success ? 'automation_complete' : 'automation_error',
      payload: result,
      timestamp: new Date().toISOString(),
    });
  }
}

let automationService: IntelligentAutomationService | null = null;

/**
 * Singleton accessor for the intelligent automation service.
 */
export const getIntelligentAutomationService = (): IntelligentAutomationService => {
  if (!automationService) {
    automationService = new IntelligentAutomationService();
  }
  return automationService;
};

