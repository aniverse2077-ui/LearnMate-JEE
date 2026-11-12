import { CBTQuestion } from '../utils/jeeEngine';

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
  solutionLatex: string;
  conceptTags: string[];
}

export interface PYQPackValidationResult {
  valid: boolean;
  questions: CBTQuestion[];
  errors: string[];
}

/**
 * Validates and ingests shift-tagged JSON question packs (`year`, `shift`, `examType`,
 * `chapterId`, `difficulty`, `questionType`, `solutionLatex`, `conceptTags`) into CBTQuestion[].
 */
export function validateAndIngestPYQPack(rawPack: unknown): PYQPackValidationResult {
  const errors: string[] = [];
  const questions: CBTQuestion[] = [];

  if (!Array.isArray(rawPack)) {
    return {
      valid: false,
      questions: [],
      errors: ['PYQ Question Pack must be a JSON array of question objects.'],
    };
  }

  rawPack.forEach((item: any, idx) => {
    const label = `Item #${idx + 1}`;
    if (!item || typeof item !== 'object') {
      errors.push(`${label}: Must be an object.`);
      return;
    }
    if (!item.year || typeof item.year !== 'number') {
      errors.push(`${label}: Missing numeric 'year'.`);
    }
    if (!item.shift || typeof item.shift !== 'string') {
      errors.push(`${label}: Missing 'shift' string.`);
    }
    if (item.examType !== 'JEE Main' && item.examType !== 'JEE Advanced') {
      errors.push(`${label}: 'examType' must be 'JEE Main' or 'JEE Advanced'.`);
    }
    if (
      item.subject !== 'Physics' &&
      item.subject !== 'Chemistry' &&
      item.subject !== 'Mathematics'
    ) {
      errors.push(`${label}: 'subject' must be Physics, Chemistry, or Mathematics.`);
    }
    if (!item.chapterId || typeof item.chapterId !== 'string') {
      errors.push(`${label}: Missing 'chapterId'.`);
    }
    if (!item.stemLatex || typeof item.stemLatex !== 'string') {
      errors.push(`${label}: Missing 'stemLatex'.`);
    }
    if (!item.solutionLatex || typeof item.solutionLatex !== 'string') {
      errors.push(`${label}: Missing 'solutionLatex'.`);
    }
    if (!Array.isArray(item.conceptTags)) {
      errors.push(`${label}: 'conceptTags' must be an array of strings.`);
    }

    if (errors.length > 0) return;

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

    questions.push({
      id: item.id || `pyq-${item.year}-${idx + 1}`,
      number: idx + 1,
      subject: item.subject,
      section: isSectionB ? 'Section B' : 'Section A',
      chapter: item.chapterName || item.chapterId,
      stem: item.stemLatex,
      options: Array.isArray(item.optionsLatex) && item.optionsLatex.length > 0
        ? item.optionsLatex
        : ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: typeof item.correctIndex === 'number' ? item.correctIndex : 0,
      correctIndices: Array.isArray(item.correctIndices) ? item.correctIndices : undefined,
      numericalAnswer: typeof item.numericalAnswer === 'number' ? item.numericalAnswer : undefined,
      explanation: item.solutionLatex,
      difficultyBucket,
      examType: item.examType,
      advancedFormat,
      pyqTag: `${item.examType} ${item.year} • ${item.shift}`,
      conceptTags: item.conceptTags,
    });
  });

  return {
    valid: errors.length === 0,
    questions,
    errors,
  };
}
