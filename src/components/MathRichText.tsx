import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';

interface MathRichTextProps {
  content: string;
  className?: string;
  blockMath?: boolean;
  inline?: boolean;
}

/**
 * Normalizes LaTeX delimiters:
 * - Converts \[ ... \] into $$ ... $$
 * - Converts \( ... \) into $ ... $
 * - Normalizes plain -> in chemical equations inside math blocks to \rightarrow
 */
export function normalizeLatexDelimiters(input: string): string {
  if (!input) return '';
  return input
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner) => `$$${inner.trim()}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner) => `$${inner.trim()}$`);
}

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
  inline = false,
}) => {
  if (!content) return null;

  const normalized = normalizeLatexDelimiters(content);

  if (blockMath && !normalized.includes('$')) {
    const html = renderLatexSegment(normalized, true);
    return (
      <div
        className={`katex-block-wrapper overflow-x-auto py-1 ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Use react-markdown + remark-math + remark-gfm + rehype-katex for full multi-line markdown/tables/lists/math
  if (!inline && (normalized.includes('\n') || normalized.includes('|') || normalized.includes('###'))) {
    return (
      <div className={`leading-relaxed space-y-1.5 ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false, trust: true }]]}
          components={{
            p: ({ children }) => <p className="leading-relaxed">{children}</p>,
            strong: ({ children }) => (
              <strong className="font-bold text-slate-900 dark:text-white bg-amber-100/70 dark:bg-amber-900/40 px-1 py-0.5 rounded">
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em className="italic font-semibold text-indigo-700 dark:text-indigo-300 underline decoration-indigo-300/70 underline-offset-2">
                {children}
              </em>
            ),
            ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          }}
        >
          {normalized}
        </ReactMarkdown>
      </div>
    );
  }

  // Fast inline / single-line tokenizer with KaTeX rendering for stems, options, flashcards, and formulas
  const tokens = normalized.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);

  const renderMarkdownFormatting = (text: string, keyPrefix: string) => {
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
        if (token.startsWith('$$') && token.endsWith('$$')) {
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
        if (token.startsWith('$') && token.endsWith('$')) {
          const raw = token.slice(1, -1);
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
