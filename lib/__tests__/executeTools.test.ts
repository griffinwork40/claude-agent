import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ToolUse } from '@/types';

const navigateMock = vi.fn(async () => ({ url: 'https://example.com' }));
const clickMock = vi.fn(async () => ({ message: 'Clicked element' }));
const getBrowserServiceMock = vi.fn(() => ({
  navigate: navigateMock,
  click: clickMock,
  snapshot: vi.fn(),
  screenshot: vi.fn(async () => ({ screenshot: 'base64' })),
  type: vi.fn(async () => ({ message: 'Typed value' })),
  select: vi.fn(async () => ({ message: 'Selected value' })),
  waitForSelector: vi.fn(async () => ({ success: true })),
  evaluate: vi.fn(async () => ({ result: 'ok' })),
  scroll: vi.fn(async () => ({ message: 'Scrolled' })),
  extractText: vi.fn(async () => ({ text: 'sample' })),
  getCurrentUrl: vi.fn(async () => ({ url: 'https://example.com' })),
  searchJobsGoogle: vi.fn(async () => ([])),
  searchJobsIndeed: vi.fn(async () => ([])),
  searchJobsLinkedIn: vi.fn(async () => ([])),
  searchJobsMonster: vi.fn(async () => ([])),
  findCompanyCareerPage: vi.fn(async () => ({ url: 'https://company.com/careers' })),
  extractCompanyApplicationUrl: vi.fn(async () => ({ companyApplicationUrl: 'https://apply.example.com' })),
  startSession: vi.fn(async () => ({ sessionId: 'session' })),
  endSession: vi.fn(async () => ({ success: true })),
}));

vi.mock('../browser-tools', () => ({
  getBrowserService: getBrowserServiceMock,
  browserTools: [],
}));

// Import after mocks so the module picks up the mocked browser service
import { executeTools } from '../claude-agent';

describe('executeTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBrowserServiceMock.mockReturnValue({
      navigate: navigateMock,
      click: clickMock,
    } as any);
    navigateMock.mockResolvedValue({ url: 'https://example.com' });
    clickMock.mockResolvedValue({ message: 'Clicked element' });
  });

  it('emits thinking activity metadata between tools', async () => {
    const toolUses: ToolUse[] = [
      { id: 'tool-1', name: 'browser_navigate', input: { sessionId: 'session', url: 'https://example.com' } },
      { id: 'tool-2', name: 'browser_click', input: { sessionId: 'session', selector: '#apply' } },
    ];

    const sendActivity = vi.fn();

    await executeTools(toolUses, 'user-1', sendActivity);

    const thinkingEvent = sendActivity.mock.calls.find(call => call[0] === 'thinking');
    expect(thinkingEvent).toBeTruthy();
    const [, payload] = thinkingEvent!;

    expect(payload).toMatchObject({
      content: 'Thinking about using browser click next...',
      previousTool: 'browser_navigate',
      previousToolId: 'tool-1',
      previousToolLabel: 'browser navigate',
      nextTool: 'browser_click',
      nextToolId: 'tool-2',
      nextToolLabel: 'browser click',
    });
  });

  it('uses fallback messaging when the next tool name is unavailable', async () => {
    const toolUses: ToolUse[] = [
      { id: 'tool-1', name: 'browser_navigate', input: { sessionId: 'session', url: 'https://example.com' } },
      // Simulate malformed next tool without a name
      { id: 'tool-2', name: '' as unknown as string, input: {} },
    ];

    const sendActivity = vi.fn();

    await executeTools(toolUses, 'user-2', sendActivity);

    const thinkingEvent = sendActivity.mock.calls.find(call => call[0] === 'thinking');
    expect(thinkingEvent).toBeTruthy();
    const [, payload] = thinkingEvent!;

    expect(payload.content).toBe('Thinking about the next step...');
    expect(payload.nextToolLabel).toBeUndefined();
  });
});
