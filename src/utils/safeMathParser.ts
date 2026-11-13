export type AngleMode = 'rad' | 'deg';

export interface MathEvaluationResult {
  value: number | null;
  error?: string;
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; name: string }
  | { type: 'op'; op: '+' | '-' | '*' | '/' | '^' | '%' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' };

export type AstNode =
  | { kind: 'number'; value: number }
  | { kind: 'var'; name: string }
  | { kind: 'unary'; op: '+' | '-'; arg: AstNode }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^' | '%'; left: AstNode; right: AstNode }
  | { kind: 'call'; name: string; args: AstNode[] };

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
};

const ALLOWED_FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'csc',
  'sec',
  'cot',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'sqrt',
  'cbrt',
  'abs',
  'ln',
  'log',
  'log10',
  'log2',
  'exp',
  'floor',
  'ceil',
  'round',
  'sign',
  'min',
  'max',
  'pow',
]);

const FORBIDDEN_IDENTIFIERS = new Set([
  'window',
  'global',
  'globalthis',
  'process',
  'require',
  'module',
  'exports',
  'function',
  'constructor',
  '__proto__',
  'prototype',
  'eval',
  'import',
  'document',
  'fetch',
  'alert',
]);

const PARAMETER_NAMES = new Set(['x', 'a', 'b', 'c', 'm', 'k', 't', 'n']);

function normalizeRawExpression(raw: string): string {
  let cleaned = (raw || '')
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .trim();

  // Strip optional y = or f(x) = assignment prefix
  cleaned = cleaned.replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '').trim();
  return cleaned;
}

export function tokenizeMathExpression(raw: string): { tokens: Token[]; error?: string } {
  const expr = normalizeRawExpression(raw);
  if (!expr) {
    return { tokens: [], error: 'Expression is empty.' };
  }
  if (expr.length > 512) {
    return { tokens: [], error: 'Expression exceeds maximum length (512 characters).' };
  }

  const rawTokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let start = i;
      let dotCount = 0;
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        if (expr[i] === '.') dotCount += 1;
        i += 1;
      }
      // Scientific notation like 1e-3 or 2.5e4
      if (i < expr.length && (expr[i] === 'e' || expr[i] === 'E')) {
        const next = expr[i + 1];
        if (next && (/[0-9]/.test(next) || ((next === '+' || next === '-') && /[0-9]/.test(expr[i + 2] || '')))) {
          i += 1;
          if (expr[i] === '+' || expr[i] === '-') i += 1;
          while (i < expr.length && /[0-9]/.test(expr[i])) i += 1;
        }
      }
      const numStr = expr.slice(start, i);
      const val = Number(numStr);
      if (dotCount > 1 || !Number.isFinite(val)) {
        return { tokens: [], error: `Invalid numeric literal "${numStr}".` };
      }
      rawTokens.push({ type: 'number', value: val });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        i += 1;
      }
      const rawName = expr.slice(start, i).toLowerCase();
      if (FORBIDDEN_IDENTIFIERS.has(rawName)) {
        return { tokens: [], error: `Disallowed identifier "${rawName}".` };
      }

      // Split implicit compact monomials like "ax", "2ax" (already tokenized 2 then ax), "ab" if not a function or constant
      if (
        !ALLOWED_FUNCTIONS.has(rawName) &&
        !(rawName in CONSTANTS) &&
        !PARAMETER_NAMES.has(rawName)
      ) {
        // Check if every char is a known single-letter variable/constant (e.g. "ax", "kx", "mx")
        const chars = rawName.split('');
        if (chars.length > 1 && chars.every((c) => PARAMETER_NAMES.has(c) || c === 'e')) {
          for (const c of chars) {
            rawTokens.push({ type: 'ident', name: c });
          }
          continue;
        }
        return { tokens: [], error: `Unknown symbol or function "${rawName}".` };
      }

      rawTokens.push({ type: 'ident', name: rawName });
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^' || ch === '%') {
      if (ch === '*' && expr[i + 1] === '*') {
        rawTokens.push({ type: 'op', op: '^' });
        i += 2;
      } else {
        rawTokens.push({ type: 'op', op: ch });
        i += 1;
      }
      continue;
    }

    if (ch === '(') {
      rawTokens.push({ type: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      rawTokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }
    if (ch === ',') {
      rawTokens.push({ type: 'comma' });
      i += 1;
      continue;
    }

    return { tokens: [], error: `Unexpected character "${ch}".` };
  }

  // Insert implicit multiplication tokens where mathematically standard:
  // e.g., 2x -> 2*x, 2(x+1) -> 2*(x+1), (x+1)(x-1) -> (x+1)*(x-1), a(x) -> a*(x), x sin(x) -> x*sin(x)
  const tokens: Token[] = [];
  for (let idx = 0; idx < rawTokens.length; idx += 1) {
    const prev = tokens[tokens.length - 1];
    const curr = rawTokens[idx];
    if (prev) {
      const prevIsValue =
        prev.type === 'number' ||
        prev.type === 'rparen' ||
        (prev.type === 'ident' && !ALLOWED_FUNCTIONS.has(prev.name));
      const currStartsValue =
        curr.type === 'number' || curr.type === 'lparen' || curr.type === 'ident';
      if (prevIsValue && currStartsValue) {
        tokens.push({ type: 'op', op: '*' });
      }
    }
    tokens.push(curr);
  }

  return { tokens };
}

export function parseMathAst(raw: string): { ast?: AstNode; error?: string } {
  const { tokens, error } = tokenizeMathExpression(raw);
  if (error) return { error };

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => {
    const tok = tokens[pos];
    pos += 1;
    return tok;
  };

  function parseExpression(): AstNode {
    return parseAddSub();
  }

  function parseAddSub(): AstNode {
    let left = parseMulDiv();
    while (true) {
      const tok = peek();
      if (tok && tok.type === 'op' && (tok.op === '+' || tok.op === '-')) {
        consume();
        const right = parseMulDiv();
        left = { kind: 'binary', op: tok.op, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  function parseMulDiv(): AstNode {
    let left = parseUnary();
    while (true) {
      const tok = peek();
      if (tok && tok.type === 'op' && (tok.op === '*' || tok.op === '/' || tok.op === '%')) {
        consume();
        const right = parseUnary();
        left = { kind: 'binary', op: tok.op, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  function parseUnary(): AstNode {
    const tok = peek();
    if (tok && tok.type === 'op' && (tok.op === '+' || tok.op === '-')) {
      consume();
      return { kind: 'unary', op: tok.op, arg: parseUnary() };
    }
    return parsePower();
  }

  function parsePower(): AstNode {
    const base = parsePrimary();
    const tok = peek();
    if (tok && tok.type === 'op' && tok.op === '^') {
      consume();
      // Right-associative: x^2^3 = x^(2^3), -x^2 handled by unary wrapping power
      const exponent = parseUnary();
      return { kind: 'binary', op: '^', left: base, right: exponent };
    }
    return base;
  }

  function parsePrimary(): AstNode {
    const tok = peek();
    if (!tok) {
      throw new Error('Unexpected end of expression.');
    }

    if (tok.type === 'number') {
      consume();
      return { kind: 'number', value: tok.value };
    }

    if (tok.type === 'lparen') {
      consume();
      const inner = parseExpression();
      const closing = peek();
      if (!closing || closing.type !== 'rparen') {
        throw new Error('Missing closing parenthesis ")".');
      }
      consume();
      return inner;
    }

    if (tok.type === 'ident') {
      consume();
      const next = peek();
      if (ALLOWED_FUNCTIONS.has(tok.name)) {
        if (!next || next.type !== 'lparen') {
          throw new Error(`Function "${tok.name}" requires parentheses, e.g. ${tok.name}(x).`);
        }
        consume(); // '('
        const args: AstNode[] = [];
        const maybeClose = peek();
        if (maybeClose && maybeClose.type !== 'rparen') {
          args.push(parseExpression());
          while (peek()?.type === 'comma') {
            consume();
            args.push(parseExpression());
          }
        }
        const closing = peek();
        if (!closing || closing.type !== 'rparen') {
          throw new Error(`Missing ")" after ${tok.name}(...).`);
        }
        consume();
        return { kind: 'call', name: tok.name, args };
      }

      if (tok.name in CONSTANTS) {
        return { kind: 'number', value: CONSTANTS[tok.name] };
      }

      return { kind: 'var', name: tok.name };
    }

    throw new Error('Invalid syntax near operator or punctuation.');
  }

  try {
    const ast = parseExpression();
    if (pos < tokens.length) {
      return { error: 'Unexpected trailing tokens in expression.' };
    }
    return { ast };
  } catch (err: any) {
    return { error: err?.message || 'Syntax error in expression.' };
  }
}

const astCache = new Map<string, { ast?: AstNode; error?: string }>();

function getCachedAst(raw: string): { ast?: AstNode; error?: string } {
  const key = raw.trim();
  const hit = astCache.get(key);
  if (hit) return hit;
  const parsed = parseMathAst(key);
  if (astCache.size >= 400) {
    const firstKey = astCache.keys().next().value;
    if (firstKey !== undefined) astCache.delete(firstKey);
  }
  astCache.set(key, parsed);
  return parsed;
}

function evalAstNode(
  node: AstNode,
  vars: Record<string, number>,
  angleMode: AngleMode
): number {
  switch (node.kind) {
    case 'number':
      return node.value;
    case 'var': {
      const val = vars[node.name];
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        throw new Error(`Variable "${node.name}" is undefined.`);
      }
      return val;
    }
    case 'unary': {
      const v = evalAstNode(node.arg, vars, angleMode);
      return node.op === '-' ? -v : v;
    }
    case 'binary': {
      const l = evalAstNode(node.left, vars, angleMode);
      const r = evalAstNode(node.right, vars, angleMode);
      switch (node.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          if (Math.abs(r) < 1e-12) return NaN;
          return l / r;
        case '%':
          if (Math.abs(r) < 1e-12) return NaN;
          return l % r;
        case '^': {
          // Guard fractional powers of negative numbers while permitting exact odd integer roots
          if (l < 0 && !Number.isInteger(r)) {
            return NaN;
          }
          return Math.pow(l, r);
        }
      }
    }
    case 'call': {
      const evaluatedArgs = node.args.map((arg) => evalAstNode(arg, vars, angleMode));
      const arg0 = evaluatedArgs[0];
      const toRad = (v: number) => (angleMode === 'deg' ? (v * Math.PI) / 180 : v);
      const fromRad = (v: number) => (angleMode === 'deg' ? (v * 180) / Math.PI : v);

      if (evaluatedArgs.length === 0) {
        throw new Error(`Function "${node.name}" requires at least 1 argument.`);
      }

      switch (node.name) {
        case 'sin':
          return Math.sin(toRad(arg0));
        case 'cos':
          return Math.cos(toRad(arg0));
        case 'tan': {
          const rad = toRad(arg0);
          const cosVal = Math.cos(rad);
          if (Math.abs(cosVal) < 1e-10) return NaN;
          return Math.sin(rad) / cosVal;
        }
        case 'csc': {
          const s = Math.sin(toRad(arg0));
          return Math.abs(s) < 1e-10 ? NaN : 1 / s;
        }
        case 'sec': {
          const c = Math.cos(toRad(arg0));
          return Math.abs(c) < 1e-10 ? NaN : 1 / c;
        }
        case 'cot': {
          const s = Math.sin(toRad(arg0));
          return Math.abs(s) < 1e-10 ? NaN : Math.cos(toRad(arg0)) / s;
        }
        case 'asin':
          return arg0 < -1 || arg0 > 1 ? NaN : fromRad(Math.asin(arg0));
        case 'acos':
          return arg0 < -1 || arg0 > 1 ? NaN : fromRad(Math.acos(arg0));
        case 'atan':
          return fromRad(Math.atan(arg0));
        case 'sinh':
          return Math.sinh(arg0);
        case 'cosh':
          return Math.cosh(arg0);
        case 'tanh':
          return Math.tanh(arg0);
        case 'sqrt':
          return arg0 < 0 ? NaN : Math.sqrt(arg0);
        case 'cbrt':
          return Math.cbrt(arg0);
        case 'abs':
          return Math.abs(arg0);
        case 'ln':
          return arg0 <= 0 ? NaN : Math.log(arg0);
        case 'log':
        case 'log10':
          return arg0 <= 0 ? NaN : Math.log10(arg0);
        case 'log2':
          return arg0 <= 0 ? NaN : Math.log2(arg0);
        case 'exp':
          return Math.exp(arg0);
        case 'floor':
          return Math.floor(arg0);
        case 'ceil':
          return Math.ceil(arg0);
        case 'round':
          return Math.round(arg0);
        case 'sign':
          return Math.sign(arg0);
        case 'min':
          return Math.min(...evaluatedArgs);
        case 'max':
          return Math.max(...evaluatedArgs);
        case 'pow':
          return evaluatedArgs.length >= 2 ? Math.pow(arg0, evaluatedArgs[1]) : NaN;
        default:
          throw new Error(`Unsupported function "${node.name}".`);
      }
    }
  }
}

export function validateMathSyntax(expr: string): { valid: boolean; error?: string } {
  const parsed = getCachedAst(expr);
  if (parsed.error || !parsed.ast) {
    return { valid: false, error: parsed.error || 'Invalid expression.' };
  }
  return { valid: true };
}

export function evaluateMathDetailed(
  expr: string,
  xVal: number,
  params: Record<string, number> = {},
  angleMode: AngleMode = 'rad'
): MathEvaluationResult {
  const parsed = getCachedAst(expr);
  if (parsed.error || !parsed.ast) {
    return { value: null, error: parsed.error || 'Syntax error.' };
  }

  const vars: Record<string, number> = {
    a: 1,
    b: 1,
    c: 0,
    m: 1,
    k: 1,
    n: 1,
    t: xVal,
    ...params,
    x: xVal,
  };

  try {
    const result = evalAstNode(parsed.ast, vars, angleMode);
    if (typeof result !== 'number' || !Number.isFinite(result) || Math.abs(result) > 1e12) {
      return { value: null };
    }
    return { value: result };
  } catch (err: any) {
    return { value: null, error: err?.message || 'Evaluation error.' };
  }
}

export function safeEvaluateMathExpression(
  expr: string,
  xVal: number,
  params: Record<string, number> = {},
  angleMode: AngleMode = 'rad'
): number | null {
  return evaluateMathDetailed(expr, xVal, params, angleMode).value;
}
