export type QuestionStatus =
  | 'not_visited'
  | 'not_answered'
  | 'answered'
  | 'marked'
  | 'answered_marked';

export type AdvancedQuestionFormat = 'single' | 'multiple' | 'numerical' | 'matrix';

export interface CBTQuestion {
  id: string;
  number: number;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  section: 'Section A' | 'Section B';
  chapter: string;
  stem: string;
  stemHindi?: string;
  options: string[];
  optionsHindi?: string[];
  correctIndex: number;
  correctIndices?: number[]; // For JEE Advanced multi-choice
  numericalAnswer?: number;
  explanation: string;
  difficultyBucket?: 'Beginner' | 'Must-Do' | 'Advanced Climb';
  examType?: 'JEE Main' | 'JEE Advanced';
  advancedFormat?: AdvancedQuestionFormat;
  pyqTag?: string;
}

export interface QuestionResponseState {
  status: QuestionStatus;
  selectedOption: number | null;
  selectedOptions?: number[]; // For JEE Advanced multi-choice
  numericalValue?: string;
  timeSpentSec: number;
}

export interface QuestionAttemptDetail {
  questionId: string;
  number: number;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  section: 'Section A' | 'Section B';
  isAttempted: boolean;
  isCorrect: boolean;
  marksAwarded: number;
  maxMarks: number;
  timeSpentSec: number;
  userAnswerLabel: string;
  correctAnswerLabel: string;
}

export interface CBTSummaryMetrics {
  score: number;
  maxMarks: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  accuracy: number;
  questionDetails: QuestionAttemptDetail[];
  chapterBreakdown: {
    chapter: string;
    subject: 'Physics' | 'Chemistry' | 'Mathematics';
    marks: number;
    maxMarks: number;
    timeMinutes: number;
    accuracy: number;
  }[];
}

/**
 * Evaluates a single question under either:
 * - Official 2025/2026 NTA JEE Main rules:
 *   Section A (MCQ): +4 correct, -1 wrong, 0 unattempted
 *   Section B (Compulsory Numerical Value): +4 correct, 0 wrong (NO negative marking), 0 unattempted
 * - JEE Advanced Paper 1 & 2 rules:
 *   Single Choice: +3 correct, -1 wrong
 *   Multiple Choice (One or More than One Correct): +4 all correct, -2 any wrong chosen, +1 per correct option if no wrong chosen
 *   Numerical: +4 correct, 0 wrong
 *   Matrix Match: +3 correct, -1 wrong
 */
export function evaluateSingleQuestionMarks(
  q: CBTQuestion,
  r?: QuestionResponseState
): {
  isAttempted: boolean;
  isCorrect: boolean;
  marksAwarded: number;
  maxMarks: number;
  userAnswerLabel: string;
  correctAnswerLabel: string;
} {
  const isAdvanced = q.examType === 'JEE Advanced';
  const format: AdvancedQuestionFormat =
    q.advancedFormat || (q.section === 'Section B' ? 'numerical' : 'single');
  const maxMarks = isAdvanced && (format === 'single' || format === 'matrix') ? 3 : 4;

  const isStatusEvaluated =
    r && (r.status === 'answered' || r.status === 'answered_marked');

  // Numerical Question Evaluation
  if (q.section === 'Section B' || format === 'numerical') {
    const rawVal = r?.numericalValue?.trim() ?? '';
    const hasNum = isStatusEvaluated && rawVal !== '' && Number.isFinite(Number(rawVal));
    const hasOptFallback =
      isStatusEvaluated && !hasNum && r?.selectedOption !== null && r?.selectedOption !== undefined;

    if (!hasNum && !hasOptFallback) {
      return {
        isAttempted: false,
        isCorrect: false,
        marksAwarded: 0,
        maxMarks: 4,
        userAnswerLabel: 'Skipped',
        correctAnswerLabel: String(q.numericalAnswer ?? q.options[q.correctIndex] ?? ''),
      };
    }

    let isCorrect = false;
    let userLabel = rawVal;
    if (hasNum && q.numericalAnswer !== undefined) {
      isCorrect = Math.abs(Number(rawVal) - q.numericalAnswer) <= 0.05;
    } else if (hasOptFallback) {
      isCorrect = r!.selectedOption === q.correctIndex;
      userLabel = q.options[r!.selectedOption!] || `Option ${r!.selectedOption! + 1}`;
    }

    // Per 2025/2026 NTA JEE Main & JEE Advanced numerical rules: +4 for correct, 0 for incorrect (no negative marking)
    return {
      isAttempted: true,
      isCorrect,
      marksAwarded: isCorrect ? 4 : 0,
      maxMarks: 4,
      userAnswerLabel: userLabel,
      correctAnswerLabel: String(q.numericalAnswer ?? q.options[q.correctIndex] ?? ''),
    };
  }

  // JEE Advanced Multi-Choice Partial Marking (+4 / -2 / +1 per correct option)
  if (isAdvanced && format === 'multiple' && q.correctIndices && q.correctIndices.length > 0) {
    const chosen =
      r?.selectedOptions && r.selectedOptions.length > 0
        ? r.selectedOptions
        : r?.selectedOption !== null && r?.selectedOption !== undefined
        ? [r.selectedOption]
        : [];

    if (!isStatusEvaluated || chosen.length === 0) {
      return {
        isAttempted: false,
        isCorrect: false,
        marksAwarded: 0,
        maxMarks: 4,
        userAnswerLabel: 'Skipped',
        correctAnswerLabel: q.correctIndices.map((i) => String.fromCharCode(65 + i)).join(', '),
      };
    }

    const correctSet = new Set(q.correctIndices);
    const hasWrong = chosen.some((idx) => !correctSet.has(idx));
    if (hasWrong) {
      return {
        isAttempted: true,
        isCorrect: false,
        marksAwarded: -2,
        maxMarks: 4,
        userAnswerLabel: chosen.map((i) => String.fromCharCode(65 + i)).join(', '),
        correctAnswerLabel: q.correctIndices.map((i) => String.fromCharCode(65 + i)).join(', '),
      };
    }

    const uniqueCorrectChosen = new Set(chosen.filter((idx) => correctSet.has(idx))).size;
    const allChosen = uniqueCorrectChosen === correctSet.size;
    return {
      isAttempted: true,
      isCorrect: allChosen,
      marksAwarded: allChosen ? 4 : uniqueCorrectChosen, // +1 partial mark per correct option
      maxMarks: 4,
      userAnswerLabel: chosen.map((i) => String.fromCharCode(65 + i)).join(', '),
      correctAnswerLabel: q.correctIndices.map((i) => String.fromCharCode(65 + i)).join(', '),
    };
  }

  // Standard Single-Choice MCQ (JEE Main Section A: +4/-1; JEE Advanced Single/Matrix: +3/-1)
  if (!isStatusEvaluated || r?.selectedOption === null || r?.selectedOption === undefined) {
    return {
      isAttempted: false,
      isCorrect: false,
      marksAwarded: 0,
      maxMarks,
      userAnswerLabel: 'Skipped',
      correctAnswerLabel: `${String.fromCharCode(65 + q.correctIndex)}: ${q.options[q.correctIndex] || ''}`,
    };
  }

  const isCorrect = r.selectedOption === q.correctIndex;
  const posMarks = maxMarks;
  const negMarks = -1;

  return {
    isAttempted: true,
    isCorrect,
    marksAwarded: isCorrect ? posMarks : negMarks,
    maxMarks,
    userAnswerLabel: `${String.fromCharCode(65 + r.selectedOption)}: ${q.options[r.selectedOption] || ''}`,
    correctAnswerLabel: `${String.fromCharCode(65 + q.correctIndex)}: ${q.options[q.correctIndex] || ''}`,
  };
}

export function calculateCBTSummary(
  questions: CBTQuestion[],
  responses: Record<string, QuestionResponseState>
): CBTSummaryMetrics {
  let score = 0;
  let maxMarksTotal = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;
  const questionDetails: QuestionAttemptDetail[] = [];

  const chapterMap = new Map<
    string,
    {
      chapter: string;
      subject: 'Physics' | 'Chemistry' | 'Mathematics';
      marks: number;
      maxMarks: number;
      timeSec: number;
      correct: number;
      attempted: number;
    }
  >();

  for (const q of questions) {
    const r = responses[q.id];
    const evalRes = evaluateSingleQuestionMarks(q, r);
    maxMarksTotal += evalRes.maxMarks;

    const entry = chapterMap.get(q.chapter) || {
      chapter: q.chapter,
      subject: q.subject,
      marks: 0,
      maxMarks: 0,
      timeSec: 0,
      correct: 0,
      attempted: 0,
    };
    entry.maxMarks += evalRes.maxMarks;
    const tSec = r?.timeSpentSec ?? 45;
    entry.timeSec += tSec;

    if (!evalRes.isAttempted) {
      skippedCount += 1;
    } else {
      entry.attempted += 1;
      score += evalRes.marksAwarded;
      entry.marks += evalRes.marksAwarded;
      if (evalRes.isCorrect) {
        correctCount += 1;
        entry.correct += 1;
      } else {
        incorrectCount += 1;
      }
    }

    questionDetails.push({
      questionId: q.id,
      number: q.number,
      subject: q.subject,
      chapter: q.chapter,
      section: q.section,
      isAttempted: evalRes.isAttempted,
      isCorrect: evalRes.isCorrect,
      marksAwarded: evalRes.marksAwarded,
      maxMarks: evalRes.maxMarks,
      timeSpentSec: tSec,
      userAnswerLabel: evalRes.userAnswerLabel,
      correctAnswerLabel: evalRes.correctAnswerLabel,
    });

    chapterMap.set(q.chapter, entry);
  }

  const totalAttempted = correctCount + incorrectCount;
  const accuracy =
    totalAttempted > 0 ? Number(((correctCount / totalAttempted) * 100).toFixed(1)) : 0;

  const chapterBreakdown = Array.from(chapterMap.values()).map((c) => ({
    chapter: c.chapter,
    subject: c.subject,
    marks: Math.max(0, c.marks),
    maxMarks: c.maxMarks,
    timeMinutes: Math.max(1, Math.round(c.timeSec / 60)),
    accuracy:
      c.attempted > 0 ? Number(((c.correct / c.attempted) * 100).toFixed(1)) : 0,
  }));

  return {
    score,
    maxMarks: maxMarksTotal,
    correctCount,
    incorrectCount,
    skippedCount,
    accuracy,
    questionDetails,
    chapterBreakdown,
  };
}

export function transitionQuestionStatus(
  currentOption: number | null,
  action: 'visit' | 'save_next' | 'mark_review' | 'clear',
  hasNumerical?: boolean
): QuestionStatus {
  const hasAnswer = currentOption !== null || Boolean(hasNumerical);
  switch (action) {
    case 'clear':
      return 'not_answered';
    case 'save_next':
      return hasAnswer ? 'answered' : 'not_answered';
    case 'mark_review':
      return hasAnswer ? 'answered_marked' : 'marked';
    case 'visit':
    default:
      return hasAnswer ? 'answered' : 'not_answered';
  }
}

/**
 * Detects unbound parameter slider variables (a, b, c, m, k) in a mathematical expression.
 */
export function detectEquationParameters(expr: string): string[] {
  const cleaned = expr
    .toLowerCase()
    .replace(/\b(sin|cos|tan|asin|acos|atan|sqrt|abs|log|ln|exp|pi)\b/g, ' ');
  const candidates = ['a', 'b', 'c', 'm', 'k'];
  const found: string[] = [];
  for (const param of candidates) {
    const regex = new RegExp(`\\b${param}\\b|(\\d)${param}|${param}(x|\\()`, 'i');
    if (regex.test(cleaned)) {
      found.push(param);
    }
  }
  return found;
}

/**
 * Evaluates a mathematical expression y = f(x) safely for the Desmos Graphing & Scientific Calculator.
 * Supports parameters (a, b, c, m, k), x^2, sin, cos, tan, asin, acos, atan, ln, log, exp, sqrt, abs, pi, e.
 */
export function evaluateMathFunction(
  expr: string,
  xVal: number,
  params: Record<string, number> = {}
): number | null {
  try {
    let cleaned = expr.trim().toLowerCase();
    if (cleaned.startsWith('y=')) cleaned = cleaned.slice(2).trim();
    if (cleaned.startsWith('y =')) cleaned = cleaned.slice(3).trim();
    if (cleaned.startsWith('f(x)=')) cleaned = cleaned.slice(5).trim();
    if (cleaned.startsWith('f(x) =')) cleaned = cleaned.slice(6).trim();

    cleaned = cleaned.replace(/−/g, '-');

    // Substitute parameter slider variables (a, b, c, m, k) first
    const paramDefaults: Record<string, number> = {
      a: 1,
      b: 1,
      c: 0,
      m: 1,
      k: 1,
      ...params,
    };

    // Handle implicit multiplication with parameters e.g. ax -> a*x, 2a -> 2*a
    cleaned = cleaned.replace(/([abcmk])(x)/g, '$1*$2');
    cleaned = cleaned.replace(/(\d)([abcmk])\b/g, '$1*$2');
    cleaned = cleaned.replace(/([abcmk])(\()/g, '$1*$2');

    for (const [k, val] of Object.entries(paramDefaults)) {
      const reg = new RegExp(`\\b${k}\\b`, 'g');
      cleaned = cleaned.replace(reg, `(${val})`);
    }

    // Implicit multiplication like 2x -> 2*x, 4(x) -> 4*(x), )x -> )*x
    cleaned = cleaned.replace(/(\d)(x)/g, '$1*$2');
    cleaned = cleaned.replace(/(\d)(\()/g, '$1*$2');
    cleaned = cleaned.replace(/(\))(x|\d|\()/g, '$1*$2');

    // Replace functions and constants
    cleaned = cleaned
      .replace(/\basin\b/g, 'Math.asin')
      .replace(/\bacos\b/g, 'Math.acos')
      .replace(/\batan\b/g, 'Math.atan')
      .replace(/\bsin\b/g, 'Math.sin')
      .replace(/\bcos\b/g, 'Math.cos')
      .replace(/\btan\b/g, 'Math.tan')
      .replace(/\bsqrt\b/g, 'Math.sqrt')
      .replace(/\babs\b/g, 'Math.abs')
      .replace(/\bln\b/g, 'Math.log')
      .replace(/\blog10\b/g, 'Math.log10')
      .replace(/\blog\b/g, 'Math.log10')
      .replace(/\bexp\b/g, 'Math.exp')
      .replace(/\bpi\b/g, 'Math.PI')
      .replace(/\be\b/g, 'Math.E')
      .replace(/\^/g, '**');

    cleaned = cleaned.replace(/\bx\b/g, `(${xVal})`);

    if (
      /[a-zA-Z_$]/.test(
        cleaned.replace(
          /Math\.(asin|acos|atan|sin|cos|tan|sqrt|abs|log10|log|exp|PI|E)/g,
          ''
        )
      )
    ) {
      return null;
    }

    const fn = new Function(`return (${cleaned});`);
    const result = fn();
    if (typeof result === 'number' && Number.isFinite(result)) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

export function evaluateDerivative(
  expr: string,
  xVal: number,
  params: Record<string, number> = {}
): number | null {
  const h = 1e-4;
  const fPlus = evaluateMathFunction(expr, xVal + h, params);
  const fMinus = evaluateMathFunction(expr, xVal - h, params);
  if (fPlus === null || fMinus === null) return null;
  const deriv = (fPlus - fMinus) / (2 * h);
  return Number.isFinite(deriv) ? deriv : null;
}

export interface GraphKeyPoint {
  x: number;
  y: number;
  type: 'root' | 'max' | 'min' | 'intersection' | 'y-intercept';
  label: string;
}

/**
 * Automatically detects Roots (f(x)=0), Y-Intercept (x=0), and Local Extrema (f'(x)=0)
 * across [xMin, xMax] for Desmos-style interactive point inspection.
 */
export function findRootsAndExtrema(
  expr: string,
  xMin: number,
  xMax: number,
  params: Record<string, number> = {}
): GraphKeyPoint[] {
  const points: GraphKeyPoint[] = [];
  const steps = 240;
  const dx = (xMax - xMin) / steps;

  // Y-intercept if 0 is in range
  if (xMin <= 0 && xMax >= 0) {
    const y0 = evaluateMathFunction(expr, 0, params);
    if (y0 !== null) {
      points.push({
        x: 0,
        y: Number(y0.toFixed(3)),
        type: 'y-intercept',
        label: `y-int (0, ${Number(y0.toFixed(2))})`,
      });
    }
  }

  for (let i = 0; i < steps; i++) {
    const x1 = xMin + i * dx;
    const x2 = x1 + dx;
    const y1 = evaluateMathFunction(expr, x1, params);
    const y2 = evaluateMathFunction(expr, x2, params);

    if (y1 !== null && y2 !== null) {
      // Check root sign change
      if (Math.abs(y1) < 1e-6) {
        const rx = Number(x1.toFixed(3));
        if (!points.some((p) => p.type === 'root' && Math.abs(p.x - rx) < dx * 1.5)) {
          points.push({ x: rx, y: 0, type: 'root', label: `Root (${rx}, 0)` });
        }
      } else if (y1 * y2 < 0 && Math.abs(y1 - y2) < 25) {
        // Linear interpolation refinement
        const rootX = x1 - (y1 * (x2 - x1)) / (y2 - y1);
        const rx = Number(rootX.toFixed(3));
        if (!points.some((p) => p.type === 'root' && Math.abs(p.x - rx) < dx * 1.5)) {
          points.push({ x: rx, y: 0, type: 'root', label: `Root (${rx}, 0)` });
        }
      }
    }

    // Check local extrema via derivative sign change
    const d1 = evaluateDerivative(expr, x1, params);
    const d2 = evaluateDerivative(expr, x2, params);
    if (d1 !== null && d2 !== null && d1 * d2 <= 0 && Math.abs(d1 - d2) > 1e-4 && Math.abs(d1 - d2) < 50) {
      const extX = x1 - (d1 * (x2 - x1)) / (d2 - d1);
      const extY = evaluateMathFunction(expr, extX, params);
      if (extY !== null) {
        const ex = Number(extX.toFixed(3));
        const ey = Number(extY.toFixed(3));
        const kind = d1 > 0 && d2 <= 0 ? 'max' : 'min';
        if (!points.some((p) => (p.type === 'max' || p.type === 'min') && Math.abs(p.x - ex) < dx * 1.8)) {
          points.push({
            x: ex,
            y: ey,
            type: kind,
            label: `${kind === 'max' ? 'Local Max' : 'Local Min'} (${ex}, ${ey})`,
          });
        }
      }
    }
  }

  return points.slice(0, 14);
}

/**
 * Finds intersection points between two curves f1(x) and f2(x).
 */
export function findCurveIntersections(
  expr1: string,
  expr2: string,
  xMin: number,
  xMax: number,
  params: Record<string, number> = {}
): GraphKeyPoint[] {
  const pts: GraphKeyPoint[] = [];
  const steps = 240;
  const dx = (xMax - xMin) / steps;

  for (let i = 0; i < steps; i++) {
    const x1 = xMin + i * dx;
    const x2 = x1 + dx;
    const a1 = evaluateMathFunction(expr1, x1, params);
    const b1 = evaluateMathFunction(expr2, x1, params);
    const a2 = evaluateMathFunction(expr1, x2, params);
    const b2 = evaluateMathFunction(expr2, x2, params);

    if (a1 !== null && b1 !== null && a2 !== null && b2 !== null) {
      const diff1 = a1 - b1;
      const diff2 = a2 - b2;
      if (Math.abs(diff1) < 1e-5 || (diff1 * diff2 < 0 && Math.abs(diff1 - diff2) < 25)) {
        const ix =
          Math.abs(diff1 - diff2) < 1e-9 ? x1 : x1 - (diff1 * (x2 - x1)) / (diff2 - diff1);
        const iy = evaluateMathFunction(expr1, ix, params);
        if (iy !== null) {
          const rx = Number(ix.toFixed(3));
          const ry = Number(iy.toFixed(3));
          if (!pts.some((p) => Math.abs(p.x - rx) < dx * 1.6)) {
            pts.push({
              x: rx,
              y: ry,
              type: 'intersection',
              label: `Intersection (${rx}, ${ry})`,
            });
          }
        }
      }
    }
  }
  return pts.slice(0, 10);
}

export function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n === 0 || n === 1) return 1;
  let res = 1;
  for (let i = 2; i <= Math.min(n, 170); i++) res *= i;
  return res;
}

export function computeCombination(n: number, r: number): number {
  if (r < 0 || n < 0 || r > n) return 0;
  return Math.round(factorial(n) / (factorial(r) * factorial(n - r)));
}

export function computePermutation(n: number, r: number): number {
  if (r < 0 || n < 0 || r > n) return 0;
  return Math.round(factorial(n) / factorial(n - r));
}

export function computeDeterminant3x3(m: number[][]): number {
  if (m.length !== 3 || m[0].length !== 3) return 0;
  const [a, b, c] = m[0];
  const [d, e, f] = m[1];
  const [g, h, i] = m[2];
  return Number((a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)).toFixed(4));
}

export function computeVectorOps(
  a: [number, number, number],
  b: [number, number, number]
): {
  dot: number;
  cross: [number, number, number];
  magA: number;
  magB: number;
  angleDeg: number;
} {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross: [number, number, number] = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const magA = Math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2);
  const magB = Math.sqrt(b[0] ** 2 + b[1] ** 2 + b[2] ** 2);
  const cosTheta = magA > 0 && magB > 0 ? Math.max(-1, Math.min(1, dot / (magA * magB))) : 1;
  const angleDeg = Number(((Math.acos(cosTheta) * 180) / Math.PI).toFixed(2));
  return {
    dot: Number(dot.toFixed(4)),
    cross: [
      Number(cross[0].toFixed(4)),
      Number(cross[1].toFixed(4)),
      Number(cross[2].toFixed(4)),
    ],
    magA: Number(magA.toFixed(4)),
    magB: Number(magB.toFixed(4)),
    angleDeg,
  };
}

/**
 * Computes statistical metrics + linear regression y = mx + b for Study Tools -> Statistics.
 */
export function calculateStatistics(values: number[]): {
  count: number;
  mean: number;
  median: number;
  variance: number;
  stdDev: number;
} {
  if (!values.length) {
    return { count: 0, mean: 0, median: 0, variance: 0, stdDev: 0 };
  }
  const count = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / count;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(count / 2);
  const median = count % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / count;
  const stdDev = Math.sqrt(variance);

  return {
    count,
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(4)),
    variance: Number(variance.toFixed(4)),
    stdDev: Number(stdDev.toFixed(4)),
  };
}

export function validateIdFormat(id: string): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= 128 &&
    /^[a-zA-Z0-9_\-]+$/.test(id)
  );
}

export interface CBTMockSummary {
  totalScore: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  accuracyPct: number;
  paletteCounts: Record<QuestionStatus, number>;
  questionDetails: QuestionAttemptDetail[];
  chapterBreakdown: CBTSummaryMetrics['chapterBreakdown'];
}

export function calculateCBTMockScore(
  questions: CBTQuestion[],
  responses: Record<string, QuestionResponseState>
): CBTMockSummary {
  const base = calculateCBTSummary(questions, responses);
  const paletteCounts: Record<QuestionStatus, number> = {
    not_visited: 0,
    not_answered: 0,
    answered: 0,
    marked: 0,
    answered_marked: 0,
  };
  for (const q of questions) {
    const st = responses[q.id]?.status || 'not_visited';
    paletteCounts[st] = (paletteCounts[st] || 0) + 1;
  }
  return {
    totalScore: base.score,
    maxScore: base.maxMarks,
    correctCount: base.correctCount,
    incorrectCount: base.incorrectCount,
    unansweredCount: base.skippedCount,
    accuracyPct: base.accuracy,
    paletteCounts,
    questionDetails: base.questionDetails,
    chapterBreakdown: base.chapterBreakdown,
  };
}

export function applyQuestionAction(
  current: QuestionResponseState,
  action: 'visit' | 'save_and_next' | 'mark_for_review_and_next' | 'clear_response',
  draftOption?: number | null
): QuestionResponseState {
  const hasNum = Boolean(current.numericalValue && current.numericalValue.trim() !== '');
  const hasMulti = Boolean(current.selectedOptions && current.selectedOptions.length > 0);
  if (action === 'clear_response') {
    return {
      ...current,
      status: transitionQuestionStatus(null, 'clear', false),
      selectedOption: null,
      selectedOptions: [],
      numericalValue: '',
    };
  }
  if (action === 'save_and_next') {
    const opt = draftOption !== undefined ? draftOption : current.selectedOption;
    return {
      ...current,
      status: transitionQuestionStatus(opt, 'save_next', hasNum || hasMulti),
      selectedOption: opt,
    };
  }
  if (action === 'mark_for_review_and_next') {
    const opt = draftOption !== undefined ? draftOption : current.selectedOption;
    return {
      ...current,
      status: transitionQuestionStatus(opt, 'mark_review', hasNum || hasMulti),
      selectedOption: opt,
    };
  }
  if (current.status === 'not_visited') {
    return {
      ...current,
      status: 'not_answered',
    };
  }
  return current;
}

export const computeFactorial = factorial;
export type GraphSpecialPoint = GraphKeyPoint;
export type CBTQuestionResponse = QuestionResponseState;
export const calculateCBTMockSummary = calculateCBTMockScore;

export function formatCountdownTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
    secs
  ).padStart(2, '0')}`;
}

export function calculateNextSRSReview(
  rating: 'Again' | 'Hard' | 'Good' | 'Easy',
  intervalDays: number,
  easeFactor: number
): { nextIntervalDays: number; nextEaseFactor: number; label: string } {
  if (rating === 'Again') {
    return {
      nextIntervalDays: 1,
      nextEaseFactor: Math.max(1.3, easeFactor - 0.2),
      label: '< 10 mins (Reset to 1d)',
    };
  }
  if (rating === 'Hard') {
    const nextInt = Math.max(1, Math.round(intervalDays * 1.2));
    return {
      nextIntervalDays: nextInt,
      nextEaseFactor: Math.max(1.3, easeFactor - 0.15),
      label: `${nextInt} day(s)`,
    };
  }
  if (rating === 'Good') {
    const nextInt = Math.max(2, Math.round(intervalDays * easeFactor));
    return {
      nextIntervalDays: nextInt,
      nextEaseFactor: easeFactor,
      label: `${nextInt} days`,
    };
  }
  const nextInt = Math.max(4, Math.round(intervalDays * easeFactor * 1.3));
  return {
    nextIntervalDays: nextInt,
    nextEaseFactor: Math.min(3.0, easeFactor + 0.15),
    label: `${nextInt} days`,
  };
}

export interface AutoDetectedMaterialClassification {
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  confidenceLabel: string;
}

const JEE_CHAPTER_CATALOG: {
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  keywords: string[];
}[] = [
  // Physics Chapters
  {
    subject: 'Physics',
    chapter: 'Rotational Motion',
    keywords: [
      'rotational',
      'moment of inertia',
      'torque',
      'angular momentum',
      'rolling',
      'parallel axis',
      'perpendicular axis',
      'radius of gyration',
      'rigid body',
      'i_cm',
      'omega',
      'alpha',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Electrostatics',
    keywords: [
      'electrostatics',
      'coulomb',
      'gauss law',
      'electric field',
      'electric potential',
      'dipole',
      'capacitor',
      'capacitance',
      'dielectric',
      'epsilon',
      'flux',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Current Electricity',
    keywords: [
      'current electricity',
      'kirchhoff',
      'wheatstone',
      'potentiometer',
      'meter bridge',
      'ohm',
      'drift velocity',
      'resistivity',
      'galvanometer',
      'ammeter',
      'voltmeter',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Moving Charges and Magnetism',
    keywords: [
      'biot-savart',
      'biot savart',
      'ampere',
      'lorentz force',
      'cyclotron',
      'solenoid',
      'toroid',
      'magnetic field',
      'magnetic moment',
      'magnetism',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Electromagnetic Induction & AC',
    keywords: [
      'faraday',
      'lenz law',
      'inductance',
      'mutual induction',
      'self induction',
      'eddy current',
      'alternating current',
      'lcr circuit',
      'phasor',
      'resonance',
      'transformer',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Ray and Wave Optics',
    keywords: [
      'optics',
      'snell',
      'total internal reflection',
      'prism',
      'lens maker',
      'mirror formula',
      'ydse',
      'young double slit',
      'diffraction',
      'polarization',
      'interference',
      'huygens',
      'refractive index',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Modern Physics',
    keywords: [
      'photoelectric',
      'de broglie',
      'bohr model',
      'hydrogen spectrum',
      'rydberg',
      'nuclear',
      'binding energy',
      'radioactivity',
      'half life',
      'semiconductor',
      'zener diode',
      'logic gates',
      'planck',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Thermodynamics & KTG',
    keywords: [
      'carnot',
      'isothermal',
      'adiabatic',
      'isobaric',
      'isochoric',
      'kinetic theory of gases',
      'rms speed',
      'mean free path',
      'equipartition',
      'stefan',
      'wien',
      'calorimetry',
      'heat engine',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Kinematics & Laws of Motion',
    keywords: [
      'kinematics',
      'projectile',
      'relative velocity',
      'newton',
      'friction',
      'pulley',
      'wedge',
      'pseudo force',
      'centripetal',
      'banking of roads',
      'free body diagram',
      'trajectory',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Work, Power, Energy & Centre of Mass',
    keywords: [
      'work energy theorem',
      'conservative force',
      'potential energy',
      'vertical circle',
      'centre of mass',
      'center of mass',
      'collision',
      'coefficient of restitution',
      'impulse',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Gravitation, SHM & Waves',
    keywords: [
      'gravitation',
      'kepler',
      'escape velocity',
      'orbital velocity',
      'satellite',
      'simple harmonic motion',
      'shm',
      'pendulum',
      'spring block',
      'doppler',
      'standing wave',
      'organ pipe',
      'beats',
      'surface tension',
      'bernoulli',
      'viscosity',
      'poiseuille',
      'young modulus',
    ],
  },

  // Chemistry Chapters
  {
    subject: 'Chemistry',
    chapter: 'Electrochemistry',
    keywords: [
      'electrochemistry',
      'nernst',
      'faraday law of electrolysis',
      'kohlrausch',
      'molar conductivity',
      'galvanic cell',
      'electrode potential',
      'cell emf',
      'salt bridge',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Chemical Kinetics',
    keywords: [
      'chemical kinetics',
      'rate law',
      'order of reaction',
      'molecularity',
      'arrhenius',
      'activation energy',
      'first order',
      'zero order',
      'half-life',
      'rate constant',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Chemical & Ionic Equilibrium',
    keywords: [
      'le chatelier',
      'equilibrium constant',
      'kp and kc',
      'ionic equilibrium',
      'solubility product',
      'ksp',
      'buffer solution',
      'henderson',
      'salt hydrolysis',
      'ph scale',
      'bronsted',
      'lewis acid',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Coordination Compounds',
    keywords: [
      'coordination compound',
      'crystal field theory',
      'cft',
      'werner',
      'ligand',
      'chelate',
      'spectrochemical',
      'isomerism in coordination',
      'ean rule',
      'synergic bonding',
      'octahedral splitting',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'd & f Block Elements',
    keywords: [
      'd and f block',
      'd & f block',
      'transition elements',
      'lanthanoid',
      'actinoid',
      'kmno4',
      'k2cr2o7',
      'permanganate',
      'dichromate',
      'spin-only',
      'interstitial compounds',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'p-Block & Inorganic Chemistry',
    keywords: [
      'p-block',
      'p block',
      'boron family',
      'carbon family',
      'pnictogen',
      'chalcogen',
      'halogen',
      'noble gas',
      'interhalogen',
      'oxoacid',
      'diborane',
      'silicate',
      'metallurgy',
      'qualitative analysis',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Chemical Bonding & Atomic Structure',
    keywords: [
      'chemical bonding',
      'vsepr',
      'hybridization',
      'molecular orbital theory',
      'mot',
      'bond order',
      'fajan',
      'dipole moment',
      'hydrogen bonding',
      'quantum numbers',
      'aufbau',
      'hund',
      'pauli',
      'schrodinger',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'General Organic Chemistry & Hydrocarbons',
    keywords: [
      'general organic chemistry',
      'goc',
      'inductive effect',
      'hyperconjugation',
      'resonance',
      'mesomeric',
      'aromaticity',
      'huckel',
      'carbocation',
      'carbanion',
      'free radical',
      'stereoisomerism',
      'enantiomer',
      'diastereomer',
      'chirality',
      'r/s configuration',
      'markovnikov',
      'ozonolysis',
      'alkene',
      'alkyne',
      'benzene',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Organic Reaction Mechanisms (Haloalkanes, Alcohols, Carbonyls & Amines)',
    keywords: [
      'sn1',
      'sn2',
      'e1',
      'e2',
      'nucleophilic',
      'electrophilic',
      'aldol',
      'cannizzaro',
      'grignard',
      'reimer-tiemann',
      'kolbe',
      'williamson',
      'hoffmann bromamide',
      'gabriel phthalimide',
      'diazonium',
      'sandmeyer',
      'wittig',
      'perkin',
      'haloalkane',
      'aldehyde',
      'ketone',
      'carboxylic acid',
      'amine',
      'biomolecule',
      'amino acid',
      'carbohydrate',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Solutions, Mole Concept & Chemical Thermodynamics',
    keywords: [
      'raoult',
      'colligative',
      'van’t hoff',
      'vant hoff',
      'osmotic pressure',
      'elevation in boiling',
      'depression in freezing',
      'mole concept',
      'stoichiometry',
      'limiting reagent',
      'molarity',
      'molality',
      'gibbs free energy',
      'enthalpy',
      'entropy',
      'hess law',
      'born-haber',
    ],
  },

  // Mathematics Chapters
  {
    subject: 'Mathematics',
    chapter: 'Definite & Indefinite Integration',
    keywords: [
      'integration',
      'integral',
      'king property',
      'leibniz',
      'by parts',
      'partial fraction',
      'wallis',
      'area under curve',
      'antiderivative',
      '\\int',
      'dx',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Limits, Continuity & Differentiability',
    keywords: [
      'limits',
      'continuity',
      'differentiability',
      'l hospital',
      'l’hospital',
      'rolle',
      'lagrange mean value',
      'chain rule',
      'implicit differentiation',
      'maxima and minima',
      'monotonicity',
      'tangent and normal',
      '\\lim',
      'dy/dx',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Differential Equations',
    keywords: [
      'differential equation',
      'integrating factor',
      'linear differential',
      'homogeneous differential',
      'variable separable',
      'orthogonal trajectory',
      'order and degree',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Matrices and Determinants',
    keywords: [
      'matrices',
      'matrix',
      'determinant',
      'cayley-hamilton',
      'cayley hamilton',
      'adjoint',
      'inverse of matrix',
      'cramer',
      'system of linear equations',
      'eigenvalue',
      'orthogonal matrix',
      'symmetric matrix',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Vector Algebra & 3D Geometry',
    keywords: [
      'vector algebra',
      '3d geometry',
      'scalar triple product',
      'vector triple product',
      'box product',
      'skew lines',
      'shortest distance',
      'direction cosines',
      'direction ratios',
      'plane equation',
      'dot product',
      'cross product',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Conic Sections & Coordinate Geometry',
    keywords: [
      'conic section',
      'parabola',
      'ellipse',
      'hyperbola',
      'eccentricity',
      'latus rectum',
      'directrix',
      'focus',
      'chord of contact',
      'radical axis',
      'straight line',
      'circle equation',
      'orthocentre',
      'circumcentre',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Complex Numbers & Quadratic Equations',
    keywords: [
      'complex number',
      'de moivre',
      'argand',
      'nth roots of unity',
      'cube root of unity',
      'modulus and argument',
      'euler form',
      'quadratic equation',
      'nature of roots',
      'vieta',
      'location of roots',
      'discriminant',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Permutations, Combinations & Probability',
    keywords: [
      'permutation',
      'combination',
      'combinatorics',
      'derangement',
      'pigeonhole',
      'multinomial',
      'binomial theorem',
      'general term',
      'probability',
      'bayes theorem',
      'conditional probability',
      'random variable',
      'bernoulli trials',
      'ncr',
      'npr',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Sequences, Series, Sets & Trigonometry',
    keywords: [
      'arithmetic progression',
      'geometric progression',
      'harmonic progression',
      'am-gm',
      'telescoping series',
      'sigma notation',
      'trigonometry',
      'inverse trigonometric',
      'arcsin',
      'arccos',
      'arctan',
      'equivalence relation',
      'bijective',
      'one-one onto',
    ],
  },
];

/**
 * Automatically identifies the JEE Subject ('Physics' | 'Chemistry' | 'Mathematics')
 * and specific JEE Chapter from any uploaded filename, optional title, YouTube lecture
 * URL/outline, handwritten OCR text, or pasted study notes.
 */
export function detectJeeSubjectAndChapter(
  rawInput: string,
  optionalTitle = ''
): AutoDetectedMaterialClassification {
  const combined = `${optionalTitle} ${rawInput}`.toLowerCase();

  let bestCatalogMatch: {
    subject: 'Physics' | 'Chemistry' | 'Mathematics';
    chapter: string;
    score: number;
  } | null = null;

  const subjectScores: Record<'Physics' | 'Chemistry' | 'Mathematics', number> = {
    Physics: 0,
    Chemistry: 0,
    Mathematics: 0,
  };

  // Explicit subject name mentions get a gentle weight
  if (/\b(physics|mechanics|electrodynamics|optics|shm|kinematics)\b/i.test(combined)) {
    subjectScores.Physics += 3;
  }
  if (
    /\b(chemistry|organic|inorganic|electrochemistry|molarity|ligand|orbital|alkene|benzene)\b/i.test(
      combined
    )
  ) {
    subjectScores.Chemistry += 3;
  }
  if (
    /\b(mathematics|maths|math|calculus|algebra|trigonometry|integral|matrix|matrices|conic)\b/i.test(
      combined
    )
  ) {
    subjectScores.Mathematics += 3;
  }

  for (const item of JEE_CHAPTER_CATALOG) {
    let chapterScore = 0;
    if (combined.includes(item.chapter.toLowerCase())) {
      chapterScore += 8;
    }
    for (const kw of item.keywords) {
      if (combined.includes(kw.toLowerCase())) {
        chapterScore += 3;
      }
    }
    if (chapterScore > 0) {
      subjectScores[item.subject] += chapterScore;
      if (!bestCatalogMatch || chapterScore > bestCatalogMatch.score) {
        bestCatalogMatch = {
          subject: item.subject,
          chapter: item.chapter,
          score: chapterScore,
        };
      }
    }
  }

  // Determine winning subject
  let winningSubject: 'Physics' | 'Chemistry' | 'Mathematics' = 'Physics';
  if (
    subjectScores.Chemistry > subjectScores.Physics &&
    subjectScores.Chemistry >= subjectScores.Mathematics
  ) {
    winningSubject = 'Chemistry';
  } else if (
    subjectScores.Mathematics > subjectScores.Physics &&
    subjectScores.Mathematics > subjectScores.Chemistry
  ) {
    winningSubject = 'Mathematics';
  } else if (bestCatalogMatch) {
    winningSubject = bestCatalogMatch.subject;
  }

  // Clean optional title or infer chapter from catalog match or first meaningful line
  const cleanedOptionalTitle = optionalTitle
    .trim()
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  let detectedChapter = '';
  if (bestCatalogMatch && bestCatalogMatch.score >= 3) {
    detectedChapter = cleanedOptionalTitle || bestCatalogMatch.chapter;
  } else if (cleanedOptionalTitle) {
    detectedChapter = cleanedOptionalTitle;
  } else {
    const firstLine = rawInput
      .split('\n')
      .map((l) => l.replace(/^[#*-\s]+/, '').trim())
      .find((l) => l.length > 3 && !l.startsWith('http'));
    detectedChapter = firstLine ? firstLine.slice(0, 60) : `${winningSubject} Chapter Notes`;
  }

  return {
    subject: winningSubject,
    chapter: detectedChapter,
    confidenceLabel:
      bestCatalogMatch && bestCatalogMatch.score >= 3
        ? `Auto-Detected: ${winningSubject} • ${bestCatalogMatch.chapter}`
        : `Auto-Detected: ${winningSubject} • ${detectedChapter}`,
  };
}


