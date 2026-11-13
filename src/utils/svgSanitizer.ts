const BLOCKED_TAGS_RE =
  /<\s*(script|foreignObject|iframe|object|embed|applet|meta|link|base|form|input|textarea|button)\b[^>]*>[\s\S]*?<\/\s*\1\s*>|<\s*(script|foreignObject|iframe|object|embed|applet|meta|link|base|form|input|textarea|button)\b[^>]*\/?>/gi;

const EVENT_HANDLER_ATTR_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const UNSAFE_URL_ATTR_RE =
  /\s+(?:xlink:)?(?:href|src|action|formaction)\s*=\s*(?:"\s*(?:javascript:|data:text\/html|vbscript:|https?:|\/\/)[^"]*"|'\s*(?:javascript:|data:text\/html|vbscript:|https?:|\/\/)[^']*')/gi;
const CSS_EXPRESSION_RE = /(?:javascript:|expression\s*\(|@import|url\s*\(\s*["']?\s*(?:javascript:|https?:|\/\/))/gi;

export function escapeXmlText(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeHexOrCssColor(raw: string, fallback = '#2563EB'): string {
  const trimmed = String(raw || '').trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^[a-zA-Z]{3,20}$/.test(trimmed)) return trimmed;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

/**
 * Strips executable scripts, event handlers, foreignObject/HTML injection vectors,
 * and external network references from SVG markup before dangerouslySetInnerHTML or download.
 */
export function sanitizeSvgMarkup(rawSvg: string): string {
  if (!rawSvg || typeof rawSvg !== 'string') return '';

  let cleaned = rawSvg
    .replace(/^\uFEFF/, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '');

  // Extract first <svg ...>...</svg> block if wrapped in prose or markdown fences
  const svgMatch = cleaned.match(/<svg[\s\S]*?<\/svg>/i);
  if (!svgMatch) {
    return '';
  }
  cleaned = svgMatch[0];

  // Remove blocked tags iteratively to prevent nested tag bypass
  let previous = '';
  while (cleaned !== previous) {
    previous = cleaned;
    cleaned = cleaned.replace(BLOCKED_TAGS_RE, '');
  }

  // Strip inline event handlers & dangerous protocols/external refs
  cleaned = cleaned
    .replace(EVENT_HANDLER_ATTR_RE, '')
    .replace(UNSAFE_URL_ATTR_RE, '')
    .replace(/<use\b[^>]*>/gi, (tag) => {
      // Only allow local fragment references like href="#arrow"
      if (/\b(?:xlink:)?href\s*=\s*["']#[a-zA-Z0-9_-]+["']/i.test(tag)) {
        return tag;
      }
      return '';
    })
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_m, cssBody) => {
      const safeCss = String(cssBody || '').replace(CSS_EXPRESSION_RE, 'none');
      return `<style>${safeCss}</style>`;
    })
    .replace(/style\s*=\s*"([^"]*)"/gi, (_m, styleBody) => {
      const safeStyle = String(styleBody || '').replace(CSS_EXPRESSION_RE, 'none');
      return `style="${safeStyle}"`;
    })
    .replace(/style\s*=\s*'([^']*)'/gi, (_m, styleBody) => {
      const safeStyle = String(styleBody || '').replace(CSS_EXPRESSION_RE, 'none');
      return `style='${safeStyle}'`;
    });

  return cleaned.trim();
}
