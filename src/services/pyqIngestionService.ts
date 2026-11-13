import { CBTQuestion, QuestionProvenanceType } from '../utils/jeeEngine';

export interface PYQShiftQuestionPackItem {
  id: string;
  year: number;
  shift: string;
  examType: 'JEE Main' | 'JEE Advanced';
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapterId: string;
  chapterName: string;
  difficulty: 'Easy' | 'Moderate' | 'Tough';
  questionType: 'MCQ' | 'Numerical' | 'Multi-Correct' | 'Matrix-Match' | 'Paragraph';
  stemLatex: string;
  optionsLatex?: string[];
  correctIndex?: number;
  correctIndices?: number[];
  numericalAnswer?: number;
  numericalTolerance?: number;
  solutionLatex: string;
  conceptTags: string[];
  provenanceType?: QuestionProvenanceType;
  sourceUrl?: string;
  answerKeyVersion?: string;
  verificationStatus?: 'verified' | 'reconstructed' | 'unverified';
}

export interface PYQPackValidationResult {
  valid: boolean;
  questions: CBTQuestion[];
  errors: string[];
  provenanceSummary: Record<QuestionProvenanceType, number>;
}

/**
 * Validates and ingests shift-tagged JSON question packs (`year`, `shift`, `examType`,
 * `chapterId`, `difficulty`, `questionType`, `solutionLatex`, `conceptTags`) into CBTQuestion[]
 * with explicit provenance & verification tracking.
 */
export function validateAndIngestPYQPack(rawPack: unknown): PYQPackValidationResult {
  const errors: string[] = [];
  const questions: CBTQuestion[] = [];
  const provenanceSummary: Record<QuestionProvenanceType, number> = {
    VERIFIED_OFFICIAL_PYQ: 0,
    RECONSTRUCTED_WITH_SOURCE: 0,
    LEARNMATE_ORIGINAL: 0,
    AI_GENERATED: 0,
    UNVERIFIED_OR_REVIEW_PENDING: 0,
  };

  if (!Array.isArray(rawPack)) {
    return {
      valid: false,
      questions: [],
      errors: ['PYQ Question Pack must be a JSON array of question objects.'],
      provenanceSummary,
    };
  }

  rawPack.forEach((item: any, idx) => {
    const label = `Item #${idx + 1}`;
    const itemErrors: string[] = [];
    if (!item || typeof item !== 'object') {
      errors.push(`${label}: Must be an object.`);
      return;
    }
    if (!item.year || typeof item.year !== 'number') {
      itemErrors.push(`${label}: Missing numeric 'year'.`);
    }
    if (!item.shift || typeof item.shift !== 'string') {
      itemErrors.push(`${label}: Missing 'shift' string.`);
    }
    if (item.examType !== 'JEE Main' && item.examType !== 'JEE Advanced') {
      itemErrors.push(`${label}: 'examType' must be 'JEE Main' or 'JEE Advanced'.`);
    }
    if (
      item.subject !== 'Physics' &&
      item.subject !== 'Chemistry' &&
      item.subject !== 'Mathematics'
    ) {
      itemErrors.push(`${label}: 'subject' must be Physics, Chemistry, or Mathematics.`);
    }
    if (!item.chapterId || typeof item.chapterId !== 'string') {
      itemErrors.push(`${label}: Missing 'chapterId'.`);
    }
    if (!item.stemLatex || typeof item.stemLatex !== 'string') {
      itemErrors.push(`${label}: Missing 'stemLatex'.`);
    }
    if (!item.solutionLatex || typeof item.solutionLatex !== 'string') {
      itemErrors.push(`${label}: Missing 'solutionLatex'.`);
    }
    if (!Array.isArray(item.conceptTags)) {
      itemErrors.push(`${label}: 'conceptTags' must be an array of strings.`);
    }

    if (itemErrors.length > 0) {
      errors.push(...itemErrors);
      return;
    }

    const qType: PYQShiftQuestionPackItem['questionType'] = item.questionType || 'MCQ';
    const isSectionB = qType === 'Numerical';
    const difficultyBucket =
      item.difficulty === 'Easy'
        ? 'Beginner'
        : item.difficulty === 'Tough'
        ? 'Advanced Climb'
        : 'Must-Do';

    const advancedFormat =
      qType === 'Multi-Correct'
        ? 'multiple'
        : qType === 'Numerical'
        ? 'numerical'
        : qType === 'Matrix-Match'
        ? 'matrix'
        : qType === 'Paragraph'
        ? 'paragraph'
        : 'single';

    // Strict provenance rule: never claim VERIFIED_OFFICIAL_PYQ without both sourceUrl and answerKeyVersion
    let provenanceType: QuestionProvenanceType =
      item.provenanceType ||
      (item.sourceUrl && item.answerKeyVersion
        ? 'VERIFIED_OFFICIAL_PYQ'
        : 'RECONSTRUCTED_WITH_SOURCE');
    if (
      provenanceType === 'VERIFIED_OFFICIAL_PYQ' &&
      (!item.sourceUrl || !item.answerKeyVersion)
    ) {
      provenanceType = 'RECONSTRUCTED_WITH_SOURCE';
    }

    provenanceSummary[provenanceType] += 1;

    questions.push({
      id: item.id || `pyq-${item.year}-${idx + 1}`,
      number: idx + 1,
      subject: item.subject,
      section: isSectionB ? 'Section B' : 'Section A',
      chapter: item.chapterName || item.chapterId,
      stem: item.stemLatex,
      options:
        Array.isArray(item.optionsLatex) && item.optionsLatex.length > 0
          ? item.optionsLatex
          : ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: typeof item.correctIndex === 'number' ? item.correctIndex : 0,
      correctIndices: Array.isArray(item.correctIndices) ? item.correctIndices : undefined,
      numericalAnswer:
        typeof item.numericalAnswer === 'number' ? item.numericalAnswer : undefined,
      numericalTolerance:
        typeof item.numericalTolerance === 'number' ? item.numericalTolerance : undefined,
      explanation: item.solutionLatex,
      difficultyBucket,
      examType: item.examType,
      advancedFormat,
      pyqTag: `${item.examType} ${item.year} • ${item.shift}`,
      year: item.year,
      shift: item.shift,
      provenanceType,
      sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl : undefined,
      answerKeyVersion:
        typeof item.answerKeyVersion === 'string' ? item.answerKeyVersion : undefined,
      verificationStatus:
        provenanceType === 'VERIFIED_OFFICIAL_PYQ'
          ? 'verified'
          : provenanceType === 'RECONSTRUCTED_WITH_SOURCE'
          ? 'reconstructed'
          : 'unverified',
      conceptTags: item.conceptTags,
    });
  });

  return {
    valid: errors.length === 0,
    questions,
    errors,
    provenanceSummary,
  };
}
