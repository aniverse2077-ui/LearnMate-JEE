export type ExamVersionId =
  | 'jee-main-2027-paper1'
  | 'jee-main-2024-historical'
  | 'jee-advanced-2024-paper1'
  | 'jee-advanced-2024-paper2'
  | 'neet-ug-2026'
  | 'bitsat-2026';

export interface ExamSectionSpec {
  id: 'Section A' | 'Section B';
  label: string;
  questionCountPerSubject: number;
  compulsoryAttemptCount: number;
  correctMarks: number;
  wrongMarks: number;
  unattemptedMarks: number;
  questionType: 'single_mcq' | 'numerical' | 'multi_mcq' | 'matrix' | 'paragraph';
  numericalRoundingRule?: 'nearest_integer' | 'two_decimal_places' | 'exact_with_tolerance';
}

export interface OfficialExamBlueprintSpec {
  versionId: ExamVersionId;
  examTrack: 'JEE Main' | 'JEE Advanced' | 'NEET UG' | 'BITSAT';
  displayName: string;
  effectiveYear: number;
  durationMinutes: number;
  totalQuestions: number;
  maxMarks: number;
  subjects: string[];
  sections: ExamSectionSpec[];
  sourceNote: string;
}

export const OFFICIAL_EXAM_SPECS: Record<ExamVersionId, OfficialExamBlueprintSpec> = {
  'jee-main-2027-paper1': {
    versionId: 'jee-main-2027-paper1',
    examTrack: 'JEE Main',
    displayName: 'NTA JEE Main 2026/2027 Paper 1 (B.E./B.Tech)',
    effectiveYear: 2027,
    durationMinutes: 180,
    totalQuestions: 75,
    maxMarks: 300,
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    sections: [
      {
        id: 'Section A',
        label: '20 Compulsory Single-Choice MCQs per Subject',
        questionCountPerSubject: 20,
        compulsoryAttemptCount: 20,
        correctMarks: 4,
        wrongMarks: -1,
        unattemptedMarks: 0,
        questionType: 'single_mcq',
      },
      {
        id: 'Section B',
        label: '5 Compulsory Numerical Value Questions per Subject (+4 / -1)',
        questionCountPerSubject: 5,
        compulsoryAttemptCount: 5,
        correctMarks: 4,
        wrongMarks: -1,
        unattemptedMarks: 0,
        questionType: 'numerical',
        numericalRoundingRule: 'nearest_integer',
      },
    ],
    sourceNote:
      'NTA Information Bulletin (effective Jan 2025 onward, carried into 2026/2027): 75 compulsory questions (20 MCQ + 5 Numerical per subject), +4/-1 negative marking in both Section A and Section B.',
  },
  'jee-main-2024-historical': {
    versionId: 'jee-main-2024-historical',
    examTrack: 'JEE Main',
    displayName: 'NTA JEE Main 2024 Historical Pattern (90 Questions, 5 of 10 Optional in Sec B)',
    effectiveYear: 2024,
    durationMinutes: 180,
    totalQuestions: 90,
    maxMarks: 300,
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    sections: [
      {
        id: 'Section A',
        label: '20 Compulsory Single-Choice MCQs per Subject',
        questionCountPerSubject: 20,
        compulsoryAttemptCount: 20,
        correctMarks: 4,
        wrongMarks: -1,
        unattemptedMarks: 0,
        questionType: 'single_mcq',
      },
      {
        id: 'Section B',
        label: '10 Numerical Questions (Attempt Any 5) per Subject (+4 / -1)',
        questionCountPerSubject: 10,
        compulsoryAttemptCount: 5,
        correctMarks: 4,
        wrongMarks: -1,
        unattemptedMarks: 0,
        questionType: 'numerical',
        numericalRoundingRule: 'nearest_integer',
      },
    ],
    sourceNote:
      'Historical 2022–2024 NTA pattern preserved accurately for past-year shift archives.',
  },
  'jee-advanced-2024-paper1': {
    versionId: 'jee-advanced-2024-paper1',
    examTrack: 'JEE Advanced',
    displayName: 'JEE Advanced Paper 1 Pattern (Multi-Choice Partial, Numerical, Single/Matrix)',
    effectiveYear: 2024,
    durationMinutes: 180,
    totalQuestions: 51,
    maxMarks: 180,
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    sections: [
      {
        id: 'Section A',
        label: 'Single Choice (+3/-1) & Multi-Correct Partial (+4/-2; +3/+2/+1)',
        questionCountPerSubject: 11,
        compulsoryAttemptCount: 11,
        correctMarks: 4,
        wrongMarks: -2,
        unattemptedMarks: 0,
        questionType: 'multi_mcq',
      },
      {
        id: 'Section B',
        label: 'Non-Negative Integer / Numerical (+4 / 0)',
        questionCountPerSubject: 6,
        compulsoryAttemptCount: 6,
        correctMarks: 4,
        wrongMarks: 0,
        unattemptedMarks: 0,
        questionType: 'numerical',
        numericalRoundingRule: 'exact_with_tolerance',
      },
    ],
    sourceNote:
      'IIT JEE Advanced Paper 1 partial marking (+4 all, +3/+2/+1 subset without wrong, -2 wrong) and 0 negative marking on non-negative integer numericals.',
  },
  'jee-advanced-2024-paper2': {
    versionId: 'jee-advanced-2024-paper2',
    examTrack: 'JEE Advanced',
    displayName: 'JEE Advanced Paper 2 Pattern (Multi-Correct, Paragraph & Matrix-Match)',
    effectiveYear: 2024,
    durationMinutes: 180,
    totalQuestions: 51,
    maxMarks: 180,
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    sections: [
      {
        id: 'Section A',
        label: 'Multi-Correct (+4/-2) & Paragraph / Matrix-Match (+3/-1)',
        questionCountPerSubject: 11,
        compulsoryAttemptCount: 11,
        correctMarks: 4,
        wrongMarks: -2,
        unattemptedMarks: 0,
        questionType: 'paragraph',
      },
      {
        id: 'Section B',
        label: 'Numerical Value (+4 / 0)',
        questionCountPerSubject: 6,
        compulsoryAttemptCount: 6,
        correctMarks: 4,
        wrongMarks: 0,
        unattemptedMarks: 0,
        questionType: 'numerical',
        numericalRoundingRule: 'exact_with_tolerance',
      },
    ],
    sourceNote: 'IIT JEE Advanced Paper 2 variable-pattern specification.',
  },
  'neet-ug-2026': {
    versionId: 'neet-ug-2026',
    examTrack: 'NEET UG',
    displayName: 'NTA NEET (UG) 2025/2026 Pattern (180 Compulsory MCQs, 720 Marks)',
    effectiveYear: 2026,
    durationMinutes: 180,
    totalQuestions: 180,
    maxMarks: 720,
    subjects: ['Physics', 'Chemistry', 'Biology'],
    sections: [
      {
        id: 'Section A',
        label: '180 Compulsory Single-Choice MCQs (+4 / -1)',
        questionCountPerSubject: 45,
        compulsoryAttemptCount: 45,
        correctMarks: 4,
        wrongMarks: -1,
        unattemptedMarks: 0,
        questionType: 'single_mcq',
      },
    ],
    sourceNote: 'NTA NEET UG reverted to 180 compulsory MCQs in 180 minutes (+4/-1).',
  },
  'bitsat-2026': {
    versionId: 'bitsat-2026',
    examTrack: 'BITSAT',
    displayName: 'BITSAT 2026 Computer-Based Speed Test (130 Qs, +3 / -1)',
    effectiveYear: 2026,
    durationMinutes: 180,
    totalQuestions: 130,
    maxMarks: 390,
    subjects: ['Physics', 'Chemistry', 'Mathematics', 'English & Logical Reasoning'],
    sections: [
      {
        id: 'Section A',
        label: '130 Single-Choice Speed MCQs (+3 / -1)',
        questionCountPerSubject: 30,
        compulsoryAttemptCount: 30,
        correctMarks: 3,
        wrongMarks: -1,
        unattemptedMarks: 0,
        questionType: 'single_mcq',
      },
    ],
    sourceNote: 'BITS Pilani BITSAT CBT marking: +3 correct, -1 wrong, 0 unattempted.',
  },
};

export function getExamSpecByVersion(versionId?: string): OfficialExamBlueprintSpec {
  if (versionId && versionId in OFFICIAL_EXAM_SPECS) {
    return OFFICIAL_EXAM_SPECS[versionId as ExamVersionId];
  }
  return OFFICIAL_EXAM_SPECS['jee-main-2027-paper1'];
}

export type SupportedCurrency = 'INR' | 'USD' | 'GBP' | 'EUR' | 'AED';

export interface GlobalCurrencyPricing {
  currency: SupportedCurrency;
  symbol: string;
  proMonthly: number;
  proAnnual: number;
  instituteMonthly: number;
  label: string;
}

export const GLOBAL_PPP_PRICING: Record<SupportedCurrency, GlobalCurrencyPricing> = {
  INR: {
    currency: 'INR',
    symbol: '₹',
    proMonthly: 299,
    proAnnual: 2499,
    instituteMonthly: 1499,
    label: 'India (INR)',
  },
  USD: {
    currency: 'USD',
    symbol: '$',
    proMonthly: 9,
    proAnnual: 79,
    instituteMonthly: 39,
    label: 'Global / US (USD)',
  },
  GBP: {
    currency: 'GBP',
    symbol: '£',
    proMonthly: 7,
    proAnnual: 64,
    instituteMonthly: 31,
    label: 'United Kingdom (GBP)',
  },
  EUR: {
    currency: 'EUR',
    symbol: '€',
    proMonthly: 8,
    proAnnual: 72,
    instituteMonthly: 35,
    label: 'Europe (EUR)',
  },
  AED: {
    currency: 'AED',
    symbol: 'AED ',
    proMonthly: 33,
    proAnnual: 290,
    instituteMonthly: 145,
    label: 'UAE / Gulf (AED)',
  },
};

/**
 * Computes days remaining until the official NTA JEE Main 2027 Session 1 target date (2027-01-22),
 * never freezing on a stale hardcoded number like "69 days".
 */
export function getDaysToJeeMain2027Session1(now: Date = new Date()): number {
  const targetMs = Date.UTC(2027, 0, 22, 3, 30, 0); // 2027-01-22 09:00 IST
  const diffDays = Math.ceil((targetMs - now.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
}

