import React from 'react';
import katex from 'katex';

interface MathRichTextProps {
  content: string;
  className?: string;
  blockMath?: boolean;
  inline?: boolean;
}

/**
 * Normalizes common plain-text math/physics/chemistry expressions into LaTeX if not already wrapped in $...$,
 * and renders inline ($...$) and display ($$...$$) equations with KaTeX while preserving **bold** (key laws)
 * and *italic* (exceptions/traps) formatting.
 */
export function renderLatexSegment(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex.trim(), {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: true,
    });
  } catch {
    return latex;
  }
}

export const MathRichText: React.FC<MathRichTextProps> = ({
  content,
  className = '',
  blockMath = false,
}) => {
  if (!content) return null;

  if (blockMath && !content.includes('$')) {
    const html = renderLatexSegment(content, true);
    return (
      <div
        className={`katex-block-wrapper overflow-x-auto py-1 ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Split by block math $$...$$ or \[...\], then inline math $...$ or \(...\)
  const tokens = content.split(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g);

  const renderMarkdownFormatting = (text: string, keyPrefix: string) => {
    // Parse **bold** and *italic* segments
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        const inner = part.slice(2, -2);
        return (
          <strong
            key={`${keyPrefix}-b-${idx}`}
            className="font-bold text-slate-900 dark:text-white bg-amber-100/70 dark:bg-amber-900/40 px-1 py-0.5 rounded"
          >
            {inner}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        const inner = part.slice(1, -1);
        return (
          <em
            key={`${keyPrefix}-i-${idx}`}
            className="italic font-semibold text-indigo-700 dark:text-indigo-300 underline decoration-indigo-300/70 underline-offset-2"
          >
            {inner}
          </em>
        );
      }
      return <React.Fragment key={`${keyPrefix}-t-${idx}`}>{part}</React.Fragment>;
    });
  };

  return (
    <span className={`leading-relaxed ${className}`}>
      {tokens.map((token, i) => {
        if (!token) return null;
        if (
          (token.startsWith('$$') && token.endsWith('$$')) ||
          (token.startsWith('\\[') && token.endsWith('\\]'))
        ) {
          const raw = token.slice(2, -2);
          const html = renderLatexSegment(raw, true);
          return (
            <span
              key={i}
              className="block my-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        if (
          (token.startsWith('$') && token.endsWith('$')) ||
          (token.startsWith('\\(') && token.endsWith('\\)'))
        ) {
          const raw = token.startsWith('$') ? token.slice(1, -1) : token.slice(2, -2);
          const html = renderLatexSegment(raw, false);
          return (
            <span
              key={i}
              className="inline-block mx-0.5 align-middle"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return <React.Fragment key={i}>{renderMarkdownFormatting(token, `seg-${i}`)}</React.Fragment>;
      })}
    </span>
  );
};
