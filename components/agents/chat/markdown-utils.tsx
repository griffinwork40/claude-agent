/**
 * File: components/agents/chat/markdown-utils.tsx
 * Purpose: Pure markdown rendering utilities extracted from ChatPane.tsx
 */
import { ReactNode } from 'react';

/**
 * Render inline text segments with basic formatting (bold, italic, code)
 */
export function renderInlineSegment(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /(\*\*|__|\*|`)(.+?)\1/g;
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    const marker = match[1];
    const content = match[2];
    const key = `${keyPrefix}-inline-${index}`;

    if (marker === '`') {
      result.push(
        <code
          key={key}
          className="rounded bg-black/20 px-1 py-0.5 font-mono text-xs text-white/90"
        >
          {content}
        </code>
      );
    } else if (marker === '**' || marker === '__') {
      result.push(
        <strong key={key}>
          {renderInlineSegment(content, `${key}-strong`)}
        </strong>
      );
    } else {
      result.push(
        <em key={key}>
          {renderInlineSegment(content, `${key}-em`)}
        </em>
      );
    }

    lastIndex = pattern.lastIndex;
    index += 1;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

/**
 * Render inline markdown with link support
 */
export function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(...renderInlineSegment(text.slice(lastIndex, match.index), `${keyPrefix}-segment-${index}`));
    }

    const label = renderInlineSegment(match[1], `${keyPrefix}-link-${index}-label`);
    const href = match[2];

    result.push(
      <a
        key={`${keyPrefix}-link-${index}`}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-inherit underline decoration-brand-300 decoration-2 hover:decoration-brand-500"
      >
        {label}
      </a>
    );

    lastIndex = linkPattern.lastIndex;
    index += 1;
  }

  if (lastIndex < text.length) {
    result.push(...renderInlineSegment(text.slice(lastIndex), `${keyPrefix}-segment-${index}`));
  }

  return result;
}

/**
 * Render full markdown content with block-level elements
 */
export function renderMarkdown(content: string, keyPrefix: string): ReactNode {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  const pushParagraph = (paragraphLines: string[]) => {
    const paragraphText = paragraphLines.join(' ').trim();
    if (!paragraphText) return;
    blocks.push(
      <p key={`${keyPrefix}-p-${index}`} className="m-0">
        {renderInlineMarkdown(paragraphText, `${keyPrefix}-p-${index}`)}
      </p>
    );
    index += 1;
  };

  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Check for headers (# ## ### #### ##### ######)
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const HeaderTag = `h${level}` as keyof JSX.IntrinsicElements;
      const sizeClasses = {
        1: 'text-2xl font-bold',
        2: 'text-xl font-bold', 
        3: 'text-lg font-semibold',
        4: 'text-base font-semibold',
        5: 'text-sm font-semibold',
        6: 'text-xs font-semibold'
      };
      
      blocks.push(
        <HeaderTag 
          key={`${keyPrefix}-h${level}-${index}`} 
          className={`${sizeClasses[level as keyof typeof sizeClasses]} mt-4 mb-2 first:mt-0`}
        >
          {renderInlineMarkdown(text, `${keyPrefix}-h${level}-${index}`)}
        </HeaderTag>
      );
      index += 1;
      i += 1;
      continue;
    }

    // Check for horizontal rules (---, ***, ___)
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push(
        <hr key={`${keyPrefix}-hr-${index}`} className="my-4 border-t border-[var(--border)]" />
      );
      index += 1;
      i += 1;
      continue;
    }

    if (/^(\*|-|\+)\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^(\*|-|\+)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^(\*|-|\+)\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`${keyPrefix}-ul-${index}`} className="ml-5 list-disc space-y-1">
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ul-${index}-item-${itemIndex}`}>
              {renderInlineMarkdown(item, `${keyPrefix}-ul-${index}-item-${itemIndex}`)}
            </li>
          ))}
        </ul>
      );
      index += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`${keyPrefix}-ol-${index}`} className="ml-5 list-decimal space-y-1">
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ol-${index}-item-${itemIndex}`}>
              {renderInlineMarkdown(item, `${keyPrefix}-ol-${index}-item-${itemIndex}`)}
            </li>
          ))}
        </ol>
      );
      index += 1;
      continue;
    }

    const paragraphLines = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i]) &&
      !/^(\*|-|\+)\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i += 1;
    }
    pushParagraph(paragraphLines);
  }

  return (
    <div className="space-y-2 text-sm leading-relaxed [&_a]:underline [&_a]:decoration-brand-500 [&_a]:decoration-2">
      {blocks}
    </div>
  );
}
