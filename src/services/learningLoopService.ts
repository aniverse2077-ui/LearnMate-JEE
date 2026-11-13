import type { CBTQuestion, QuestionResponseState, ErrorRootCauseTag } from '../utils/jeeEngine';
import { calculateSM2Schedule, evaluateSingleQuestionMarks } from '../utils/jeeEngine';

export interface DiagnosedMistakeItem {
  id: string;
  questionId: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  stem: string;
  explanation: string;
  userAnswer: string;
  correctAnswer: string;
  timeSpentSec: number;
  rootCause: ErrorRootCauseTag;
  rechecked: boolean;
  recheckPassed: boolean;
  nextDueIso: string;
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  masteryDelta: number;
}

export interface LearningLoopDiagnosisSummary {
  attemptId: string;
  createdAtIso: string;
  score: number;
  maxMarks: number;
  accuracyPct: number;
  mistakesCreated: DiagnosedMistakeItem[];
  weakestChapters: { chapter: string; subject: 'Physics' | 'Chemistry' | 'Mathematics'; wrongCount: number }[];
  recommendedNextAction: string;
}

/**
 * Classifies probable root cause heuristically from response telemetry
 * (time pressure, rushed click, numerical precision slip, or conceptual gap).
 */
export function inferMistakeRootCause(params: {
  question: CBTQuestion;
  response?: QuestionResponseState;
}): ErrorRootCauseTag {
  const t = params.response?.timeSpentSec ?? 60;
  if (t > 180) return 'Time Pressure';
  if (t < 20) return 'Misread Question';
  if (params.question.section === 'Section B' || params.question.advancedFormat === 'numerical') {
    const expected = params.question.numericalAnswer;
    const rawUser = Number(params.response?.numericalValue);
    if (
      expected !== undefined &&
      Number.isFinite(rawUser) &&
      Math.abs(Math.abs(rawUser) - Math.abs(expected)) <= 1.5
    ) {
      return 'Calculation/Silly Error';
    }
  }
  return 'Conceptual Gap';
}

/**
 * Step 1 of Learning Loop: Attempt -> Diagnose -> Generate Mistake DNA & Weak Chapter Plan.
 */
export function buildLearningLoopDiagnosis(params: {
  attemptId: string;
  questions: CBTQuestion[];
  responses: Record<string, QuestionResponseState>;
  score: number;
  maxMarks: number;
}): LearningLoopDiagnosisSummary {
  const now = new Date();
  const tomorrowIso = new Date(now.getTime() + 86400 * 1000).toISOString();
  const mistakesCreated: DiagnosedMistakeItem[] = [];
  const chapterWrongCounts = new Map<
    string,
    { chapter: string; subject: 'Physics' | 'Chemistry' | 'Mathematics'; wrongCount: number }
  >();

  let correctCount = 0;
  let attemptedCount = 0;

  for (const q of params.questions) {
    const r = params.responses[q.id];
    const evalRes = evaluateSingleQuestionMarks(q, r);
    if (evalRes.isAttempted) {
      attemptedCount += 1;
      if (evalRes.isCorrect) {
        correctCount += 1;
      } else {
        const rootCause = inferMistakeRootCause({ question: q, response: r });
        mistakesCreated.push({
          id: `mst-${params.attemptId}-${q.id}`,
          questionId: q.id,
          subject: q.subject,
          chapter: q.chapter,
          stem: q.stem,
          explanation: q.explanation,
          userAnswer: evalRes.userAnswerLabel,
          correctAnswer: evalRes.correctAnswerLabel,
          timeSpentSec: r?.timeSpentSec ?? 45,
          rootCause,
          rechecked: false,
          recheckPassed: false,
          nextDueIso: tomorrowIso,
          repetitions: 0,
          intervalDays: 1,
          easeFactor: 2.5,
          masteryDelta: 0,
        });

        const curr = chapterWrongCounts.get(q.chapter) || {
          chapter: q.chapter,
          subject: q.subject,
          wrongCount: 0,
        };
        curr.wrongCount += 1;
        chapterWrongCounts.set(q.chapter, curr);
      }
    }
  }

  const weakestChapters = Array.from(chapterWrongCounts.values()).sort(
    (a, b) => b.wrongCount - a.wrongCount
  );

  const accuracyPct =
    attemptedCount > 0 ? Number(((correctCount / attemptedCount) * 100).toFixed(1)) : 0;

  const recommendedNextAction =
    weakestChapters[0]
      ? `Reteach "${weakestChapters[0].chapter}" (${weakestChapters[0].subject}) & recheck ${weakestChapters[0].wrongCount} missed concept(s).`
      : 'Great accuracy! Advance to harder JEE Advanced multi-concept drills.';

  return {
    attemptId: params.attemptId,
    createdAtIso: now.toISOString(),
    score: params.score,
    maxMarks: params.maxMarks,
    accuracyPct,
    mistakesCreated,
    weakestChapters,
    recommendedNextAction,
  };
}

/**
 * Step 2-5 of Learning Loop: Reteach -> Recheck -> SM-2 Schedule -> Verify Mastery Delta.
 */
export function verifyMistakeRecheckAndSchedule(
  item: DiagnosedMistakeItem,
  passed: boolean,
  quality: 0 | 1 | 2 | 3 | 4 | 5 = passed ? 4 : 1
): DiagnosedMistakeItem {
  const nextSm2 = calculateSM2Schedule({
    quality,
    repetition: item.repetitions,
    interval: item.intervalDays,
    efactor: item.easeFactor,
  });

  const nextDue = new Date(Date.now() + nextSm2.interval * 86400 * 1000).toISOString();
  const delta = passed ? Math.min(25, item.masteryDelta + 8) : Math.max(-10, item.masteryDelta - 3);

  return {
    ...item,
    rechecked: true,
    recheckPassed: passed,
    repetitions: nextSm2.repetition,
    intervalDays: nextSm2.interval,
    easeFactor: nextSm2.efactor,
    nextDueIso: nextDue,
    masteryDelta: delta,
  };
}

export interface MisconceptionDiagnosis {
  headline: string;
  likelyTrap: string;
  reteachSteps: [string, string];
  recheckPrompt: string;
  recheckChoices: [string, string, string];
  correctChoiceIndex: number;
}

/**
 * Generates targeted misconception diagnosis, 2-step micro-reteach, and a verification check
 * tailored to the mistake's root cause, subject, and chapter.
 */
export function generateConceptMisconceptionDiagnostic(params: {
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  rootCause?: ErrorRootCauseTag;
  stem: string;
  userAnswer?: string;
}): MisconceptionDiagnosis {
  const cause = params.rootCause || 'Conceptual Gap';
  const chLower = params.chapter.toLowerCase();

  if (cause === 'Formula Forgotten') {
    return {
      headline: `Recall Failure in ${params.chapter} (${params.subject})`,
      likelyTrap:
        'A missing constant factor, sign convention, or boundary condition altered the governing formula.',
      reteachSteps: [
        `Write the base conservation / equilibrium law for ${params.chapter} from first principles before substituting.`,
        'Verify SI dimensions on both sides of your recalled equation before locking an option.',
      ],
      recheckPrompt: `Which safeguard prevents a sign/factor slip when recalling a formula in ${params.chapter}?`,
      recheckChoices: [
        'Run a dimensional & limiting-case check before plugging numbers',
        'Pick the closest numerical option without checking units',
        'Assume equilibrium constants ignore temperature changes',
      ],
      correctChoiceIndex: 0,
    };
  }

  if (cause === 'Calculation/Silly Error') {
    return {
      headline: `Arithmetic / Rounding Drift in ${params.chapter}`,
      likelyTrap:
        params.userAnswer
          ? `Recorded answer "${params.userAnswer}" deviated during intermediate substitution or unit conversion.`
          : 'Premature decimal rounding or CGS-to-SI conversion slip (cm, g, atm vs Pa).',
      reteachSteps: [
        'Keep symbols (π, g, e, R, ε₀) intact until the final line so common factors cancel cleanly.',
        'Convert every input explicitly to SI units (m, kg, s, K, mol) in a dedicated line.',
      ],
      recheckPrompt: 'For NTA JEE Section B Numericals, when should you substitute decimal approximations?',
      recheckChoices: [
        'At the very first equation line',
        'Only at the final step after symbolic cancellation',
        'Ignore unit prefixes such as mM or cm',
      ],
      correctChoiceIndex: 1,
    };
  }

  if (cause === 'Misread Question') {
    return {
      headline: `Constraint / Qualifier Missed in ${params.chapter}`,
      likelyTrap:
        'Negation keywords ("NOT", "incorrect"), extrema bounds, or reference frame words were skipped under speed.',
      reteachSteps: [
        'Underline the exact quantity asked (e.g., ratio vs difference, magnitude vs signed component).',
        'Check reference frame, boundary domain (open vs closed interval), and "EXCEPT / INCORRECT" qualifiers.',
      ],
      recheckPrompt: 'Before marking an MCQ bubble in the CBT console, what final 3-second check prevents misreads?',
      recheckChoices: [
        'Re-read the last clause of the question stem asking "which is asked / NOT true"',
        'Change your answer on intuition alone',
        'Skip checking Section B negative marking',
      ],
      correctChoiceIndex: 0,
    };
  }

  if (cause === 'Time Pressure') {
    return {
      headline: `Pacing Bottleneck in ${params.chapter}`,
      likelyTrap:
        'Spending >180s on a brute-force expansion instead of Round-1/Round-2 triage or symmetry elimination.',
      reteachSteps: [
        'Cap Round-1 scan at 90s per question; use Mark-for-Review on multi-step algebra.',
        'Test boundary symmetry or parity ($x = 0$, $x = 1$, $θ = 0°$) to eliminate 2–3 options quickly.',
      ],
      recheckPrompt: 'When an algebraic simplification exceeds 90 seconds in Round 1, what is optimal NTA strategy?',
      recheckChoices: [
        'Spend 6 minutes forcing brute-force algebra',
        'Mark for Review & jump to high-yield Round-1 questions first',
        'Guess randomly even with -1 negative marking',
      ],
      correctChoiceIndex: 1,
    };
  }

  // Default: Conceptual Gap tailored by subject/chapter cues
  const domainHook =
    params.subject === 'Physics'
      ? chLower.includes('optic') || chLower.includes('lens')
        ? 'Trace both the optical-center straight ray and parallel-to-focal ray using New Cartesian signs.'
        : 'Identify the active system boundary and isolate real forces/fluxes before applying constraints.'
      : params.subject === 'Chemistry'
      ? 'Compare thermodynamic control vs kinetic stability, oxidation state shifts, and hybridization geometry.'
      : 'Check domain restrictions, differentiability endpoints, and discriminant/monotonicity sign changes.';

  return {
    headline: `Core Misconception in ${params.chapter} (${params.subject})`,
    likelyTrap:
      'Applying a special-case shortcut outside its valid domain or mixing up dependent vs independent conditions.',
    reteachSteps: [
      domainHook,
      'Re-derive the transition condition step-by-step and verify why each distractor fails the hypothesis.',
    ],
    recheckPrompt: `In ${params.chapter}, what validates that a derived relation actually applies to the given problem?`,
    recheckChoices: [
      'Confirm the underlying physical/mathematical assumptions and domain limits hold',
      'Memorize one numerical answer and reuse it regardless of boundary changes',
      'Discard vector signs and phase conditions',
    ],
    correctChoiceIndex: 0,
  };
}

