export type QuestionStatus =
  | 'not_visited'
  | 'not_answered'
  | 'answered'
  | 'marked'
  | 'answered_marked';

export interface CBTQuestion {
  id: string;
  number: number;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  section: 'Section A' | 'Section B';
  chapter: string;
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuestionResponseState {
  status: QuestionStatus;
  selectedOption: number | null;
  timeSpentSec: number;
}

export interface CBTSummaryMetrics {
  score: number;
  maxMarks: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  accuracy: number;
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
 * Pure NTA JEE Main Marking Scheme calculator (+4 for correct, -1 for incorrect, 0 for unattempted).
 * Both "answered" and "answered_marked" are evaluated for marks per official NTA CBT rules.
 */
export function calculateCBTSummary(
  questions: CBTQuestion[],
  responses: Record<string, QuestionResponseState>
): CBTSummaryMetrics {
  let score = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;

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
    const entry = chapterMap.get(q.chapter) || {
      chapter: q.chapter,
      subject: q.subject,
      marks: 0,
      maxMarks: 0,
      timeSec: 0,
      correct: 0,
      attempted: 0,
    };
    entry.maxMarks += 4;
    entry.timeSec += r?.timeSpentSec ?? 60;

    const isEvaluated =
      r &&
      (r.status === 'answered' || r.status === 'answered_marked') &&
      r.selectedOption !== null &&
      r.selectedOption !== undefined;

    if (!isEvaluated) {
      skippedCount += 1;
    } else {
      entry.attempted += 1;
      if (r.selectedOption === q.correctIndex) {
        score += 4;
        correctCount += 1;
        entry.marks += 4;
        entry.correct += 1;
      } else {
        score -= 1;
        incorrectCount += 1;
        entry.marks -= 1;
      }
    }

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
    maxMarks: questions.length * 4,
    correctCount,
    incorrectCount,
    skippedCount,
    accuracy,
    chapterBreakdown,
  };
}

/**
 * Transitions a question's NTA palette status based on user action.
 */
export function transitionQuestionStatus(
  currentOption: number | null,
  action: 'visit' | 'save_next' | 'mark_review' | 'clear'
): QuestionStatus {
  switch (action) {
    case 'clear':
      return 'not_answered';
    case 'save_next':
      return currentOption !== null ? 'answered' : 'not_answered';
    case 'mark_review':
      return currentOption !== null ? 'answered_marked' : 'marked';
    case 'visit':
    default:
      return currentOption !== null ? 'answered' : 'not_answered';
  }
}

/**
 * Evaluates a mathematical expression y = f(x) safely for the Study Tools Graphing Workspace.
 * Supports x^2, sin(x), cos(x), tan(x), exp(x), log(x), sqrt(x), abs(x), pi, e.
 */
export function evaluateMathFunction(expr: string, xVal: number): number | null {
  try {
    let cleaned = expr.trim().toLowerCase();
    if (cleaned.startsWith('y=')) cleaned = cleaned.slice(2).trim();
    if (cleaned.startsWith('y =')) cleaned = cleaned.slice(3).trim();
    if (cleaned.startsWith('f(x)=')) cleaned = cleaned.slice(5).trim();
    if (cleaned.startsWith('f(x) =')) cleaned = cleaned.slice(6).trim();

    // Replace unicode minus '−' with '-'
    cleaned = cleaned.replace(/−/g, '-');

    // Implicit multiplication like 2x -> 2*x, 4(x) -> 4*(x)
    cleaned = cleaned.replace(/(\d)(x)/g, '$1*$2');
    cleaned = cleaned.replace(/(\d)(\()/g, '$1*$2');
    cleaned = cleaned.replace(/(\))(x|\d)/g, '$1*$2');

    // Replacefunctions and constants
    cleaned = cleaned
      .replace(/\bsin\b/g, 'Math.sin')
      .replace(/\bcos\b/g, 'Math.cos')
      .replace(/\btan\b/g, 'Math.tan')
      .replace(/\bsqrt\b/g, 'Math.sqrt')
      .replace(/\babs\b/g, 'Math.abs')
      .replace(/\blog\b/g, 'Math.log')
      .replace(/\bexp\b/g, 'Math.exp')
      .replace(/\bpi\b/g, 'Math.PI')
      .replace(/\^/g, '**');

    // Replace standalone x with (xVal)
    cleaned = cleaned.replace(/\bx\b/g, `(${xVal})`);

    // Guard against arbitrary code
    if (/[a-zA-Z_$]/.test(cleaned.replace(/Math\.(sin|cos|tan|sqrt|abs|log|exp|PI)/g, ''))) {
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

/**
 * Computes statistical metrics for the Study Tools -> Statistics calculator.
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

/**
 * Validates outgoing Firestore payloads against firebase-blueprint.json constraints.
 */
export function validateIdFormat(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
}

export interface CBTMockSummary {
  totalScore: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  accuracyPct: number;
  paletteCounts: Record<QuestionStatus, number>;
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
  };
}

export function applyQuestionAction(
  current: QuestionResponseState,
  action: 'visit' | 'save_and_next' | 'mark_for_review_and_next' | 'clear_response',
  draftOption?: number | null
): QuestionResponseState {
  if (action === 'clear_response') {
    return {
      ...current,
      status: transitionQuestionStatus(null, 'clear'),
      selectedOption: null,
    };
  }
  if (action === 'save_and_next') {
    const opt = draftOption !== undefined ? draftOption : current.selectedOption;
    return {
      ...current,
      status: transitionQuestionStatus(opt, 'save_next'),
      selectedOption: opt,
    };
  }
  if (action === 'mark_for_review_and_next') {
    const opt = draftOption !== undefined ? draftOption : current.selectedOption;
    return {
      ...current,
      status: transitionQuestionStatus(opt, 'mark_review'),
      selectedOption: opt,
    };
  }
  // visit
  if (current.status === 'not_visited') {
    return {
      ...current,
      status: 'not_answered',
    };
  }
  return current;
}

