/**
 * File: components/agents/chat/thinking-detection.ts
 * Purpose: Pattern detection for thinking steps in agent responses
 */

/**
 * Thinking step patterns to detect in agent text
 */
const thinkingPatterns = [
  { pattern: /^(Analyzing|Examining|Looking at|Reviewing)/i, icon: '🧠' },
  { pattern: /^(Found|Discovered)\s+\d+/i, icon: '💡' },
  { pattern: /^(Filtering|Narrowing|Sorting)/i, icon: '🎯' },
  { pattern: /^(Ranking|Scoring|Evaluating)/i, icon: '⭐' },
  { pattern: /^(Starting|Beginning|Initiating)/i, icon: '🔍' },
  { pattern: /^(Processing|Computing|Calculating)/i, icon: '⚙️' },
  { pattern: /^(Comparing|Matching|Aligning)/i, icon: '🔗' },
  { pattern: /^(Summarizing|Consolidating|Organizing)/i, icon: '📋' },
];

export interface ThinkingStep {
  isThinking: boolean;
  icon?: string;
  text: string;
}

/**
 * Detect if a line of text represents a thinking step
 */
export function detectThinkingStep(text: string): ThinkingStep {
  const trimmedText = text.trim();
  
  for (const { pattern, icon } of thinkingPatterns) {
    if (pattern.test(trimmedText)) {
      return { isThinking: true, icon, text: trimmedText };
    }
  }
  
  return { isThinking: false, text: trimmedText };
}

/**
 * Process a block of text and extract thinking steps
 */
export function extractThinkingSteps(text: string): Array<{ isThinking: boolean; icon?: string; text: string; lineIndex: number }> {
  const lines = text.split('\n');
  
  return lines.map((line, index) => {
    const thinking = detectThinkingStep(line);
    return {
      ...thinking,
      lineIndex: index
    };
  });
}
