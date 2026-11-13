import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import {
  CBT_MOCK_QUESTIONS,
  JEE_ADVANCED_PAPER_QUESTIONS,
  NEET_UG_PAPER_QUESTIONS,
  BITSAT_PAPER_QUESTIONS,
} from '../../data/jeeInitialContent';
import { EXPANDED_NTA_58_CHAPTERS } from '../../data/expandedNta58Chapters';
import { gradeCbtAttemptOnServer } from '../coreStudyEngine';
import { AuthenticatedRequest, requireAuthenticatedStudent } from '../middleware/authAndSecurity';
import { createRouteRateLimiter } from '../middleware/rateLimiterAndQuotas';
import { OFFICIAL_EXAM_SPECS } from '../../config/examSpecs';
import {
  AUTHORITATIVE_KEY_VERSION,
  resolveServerAnswerKey,
  stripQuestionAnswerKeys,
} from '../data/authoritativeAnswerKeys';
import { adminListCollection, adminSetDoc } from '../persistence/firestoreAdminStore';

export const pyqAndCbtRouter = Router();

export interface QuestionIssueReportRecord {
  reportId: string;
  uid: string;
  questionId: string;
  issueType:
    | 'wrong_answer_key'
    | 'typo_or_latex'
    | 'missing_diagram'
    | 'provenance_mismatch'
    | 'other';
  details: string;
  status: 'open';
  createdAtIso: string;
}

const reportRateLimit = createRouteRateLimiter({
  maxPerMinute: 10,
  keyPrefix: 'pyq_report',
  errorCode: 'ISSUE_REPORT_RATE_LIMIT',
});

const ALL_SERVER_PYQS = [
  ...CBT_MOCK_QUESTIONS,
  ...JEE_ADVANCED_PAPER_QUESTIONS,
  ...NEET_UG_PAPER_QUESTIONS,
  ...BITSAT_PAPER_QUESTIONS,
];

// Official versioned exam blueprint specs (/api/cbt/exam-specs)
pyqAndCbtRouter.get('/cbt/exam-specs', (_req: Request, res: Response) => {
  res.json({
    defaultVersion: 'jee-main-2027-paper1',
    specs: OFFICIAL_EXAM_SPECS,
  });
});

// 1. Paginated PYQ & 58-Chapter Filter Endpoint (/api/pyq/questions) — STRIPS ANSWER KEYS
pyqAndCbtRouter.get('/pyq/questions', (req: Request, res: Response) => {
  const subject = String(req.query.subject || 'All');
  const chapter = String(req.query.chapter || 'All');
  const provenance = String(req.query.provenance || 'All');
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 25)));

  const filtered = ALL_SERVER_PYQS.filter((q) => {
    const subjMatch = subject === 'All' || q.subject === subject;
    const chapMatch =
      chapter === 'All' || q.chapter.toLowerCase().includes(chapter.toLowerCase());
    const provMatch =
      provenance === 'All' || (q.provenanceType || 'LEARNMATE_ORIGINAL') === provenance;
    return subjMatch && chapMatch && provMatch;
  });

  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit).map(stripQuestionAnswerKeys);

  res.json({
    page,
    limit,
    totalCount: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    chaptersCount: EXPANDED_NTA_58_CHAPTERS.length,
    isPartialArchive: true,
    answerKeysStripped: true,
    keyVersion: AUTHORITATIVE_KEY_VERSION,
    items,
  });
});

// 2. Lazy-Loaded PYQ JSON Pack Endpoint (/api/pyq/packs/:packId) — STRIPS ANSWER KEYS
pyqAndCbtRouter.get('/pyq/packs/:packId', (req: Request, res: Response) => {
  const rawPackId = String(req.params.packId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const publicPacksDir = path.resolve(process.cwd(), 'public', 'pyq-packs');
  const filePath = path.join(publicPacksDir, `${rawPackId}.json`);

  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const strippedQuestions = Array.isArray(parsed?.questions)
        ? parsed.questions.map(stripQuestionAnswerKeys)
        : [];
      res.json({
        ...parsed,
        answerKeysStripped: true,
        keyVersion: AUTHORITATIVE_KEY_VERSION,
        questions: strippedQuestions,
      });
      return;
    } catch {
      // fall through
    }
  }

  if (rawPackId === 'jee-advanced-papers') {
    res.json({
      packId: 'jee-advanced-papers',
      title: 'JEE Advanced Multi-Format Sample Pack (Curated Sample)',
      isPartialArchive: true,
      answerKeysStripped: true,
      keyVersion: AUTHORITATIVE_KEY_VERSION,
      archiveNote:
        'Curated multi-format sample bank showcasing JEE Advanced partial marking, matrix-match, and integer patterns.',
      questionCount: JEE_ADVANCED_PAPER_QUESTIONS.length,
      questions: JEE_ADVANCED_PAPER_QUESTIONS.map(stripQuestionAnswerKeys),
    });
    return;
  }

  res.json({
    packId: rawPackId || 'jee-main-shifts',
    title: 'JEE Main 2027 Blueprint 75-Q Practice Simulator Pack',
    isPartialArchive: true,
    answerKeysStripped: true,
    keyVersion: AUTHORITATIVE_KEY_VERSION,
    archiveNote:
      '75-question blueprint drill generator combining curated reference problems and LearnMate Original practice variants.',
    questionCount: CBT_MOCK_QUESTIONS.length,
    questions: CBT_MOCK_QUESTIONS.map(stripQuestionAnswerKeys),
  });
});

// 2b. Server-side Single Question Answer Verification for Practice Cards & Explorer
pyqAndCbtRouter.post('/pyq/verify-answer', (req: Request, res: Response) => {
  const { questionId, selectedOption, selectedOptions, numericalValue } = req.body || {};
  const id = String(questionId || '').trim();
  const keyEntry = resolveServerAnswerKey(id);
  if (!keyEntry) {
    res.status(404).json({
      errorCode: 'QUESTION_KEY_NOT_FOUND',
      message: 'Authoritative server answer key not found for this question ID.',
    });
    return;
  }

  let isCorrect = false;
  if (
    typeof keyEntry.numericalAnswer === 'number' &&
    numericalValue !== undefined &&
    numericalValue !== ''
  ) {
    const tol = keyEntry.numericalTolerance ?? 0.01;
    const numVal = Number(numericalValue);
    isCorrect = Number.isFinite(numVal) && Math.abs(numVal - keyEntry.numericalAnswer) <= tol;
  } else if (
    keyEntry.advancedFormat === 'multiple' &&
    Array.isArray(keyEntry.correctIndices) &&
    Array.isArray(selectedOptions)
  ) {
    const a = [...keyEntry.correctIndices].sort();
    const b = [...selectedOptions].map(Number).sort();
    isCorrect = a.length === b.length && a.every((v, idx) => v === b[idx]);
  } else if (typeof selectedOption === 'number') {
    isCorrect = selectedOption === keyEntry.correctIndex;
  }

  res.json({
    questionId: id,
    isCorrect,
    correctIndex: keyEntry.correctIndex,
    correctIndices: keyEntry.correctIndices,
    numericalAnswer: keyEntry.numericalAnswer,
    explanation: keyEntry.explanation,
    keyVersion: AUTHORITATIVE_KEY_VERSION,
  });
});

// 3. Server-Verified CBT Grading & Shift Percentile Calculation (/api/cbt/grade)
pyqAndCbtRouter.post('/cbt/grade', (req: Request, res: Response) => {
  const {
    questions,
    questionIds,
    attemptType = 'official_mock',
    responses = {},
    examMode = 'JEE Main',
    shiftDifficulty = 'Moderate',
  } = req.body || {};

  const hasQuestions = Array.isArray(questions) && questions.length > 0;
  const hasIds = Array.isArray(questionIds) && questionIds.length > 0;
  if (!hasQuestions && !hasIds) {
    res.status(400).json({
      errorCode: 'EMPTY_CBT_QUESTIONS',
      message: 'A non-empty questions or questionIds array is required for server CBT grading.',
    });
    return;
  }

  if (typeof responses !== 'object' || responses === null || Array.isArray(responses)) {
    res.status(400).json({
      errorCode: 'INVALID_RESPONSES_FORMAT',
      message: 'responses must be a map keyed by questionId.',
    });
    return;
  }

  try {
    const graded = gradeCbtAttemptOnServer({
      questions: hasQuestions ? questions : undefined,
      questionIds: hasIds ? questionIds : undefined,
      attemptType: attemptType === 'custom_drill' ? 'custom_drill' : 'official_mock',
      responses,
      examMode,
      shiftDifficulty,
    });

    res.json(graded);
  } catch (err: any) {
    res.status(err?.statusCode || 400).json({
      errorCode: err?.errorCode || 'CBT_GRADING_FAILED',
      message: err?.message || 'Unable to grade CBT attempt against server keys.',
    });
  }
});

// 4. Question / PYQ Issue Reporting Workflow (/api/pyq/report-issue) — Persisted via firestoreAdminStore
pyqAndCbtRouter.post(
  '/pyq/report-issue',
  requireAuthenticatedStudent,
  reportRateLimit,
  async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.userUid!;
    const { questionId, issueType = 'other', details = '' } = req.body || {};

    if (!questionId || typeof questionId !== 'string' || questionId.trim().length > 128) {
      res.status(400).json({
        errorCode: 'INVALID_QUESTION_ID',
        message: 'A valid questionId is required.',
        requestId: req.requestId,
      });
      return;
    }

    const cleanDetails = String(details || '').trim();
    if (cleanDetails.length < 5 || cleanDetails.length > 2000) {
      res.status(400).json({
        errorCode: 'INVALID_ISSUE_DETAILS',
        message: 'Issue details must be between 5 and 2000 characters.',
        requestId: req.requestId,
      });
      return;
    }

    const allowedIssueTypes = new Set([
      'wrong_answer_key',
      'typo_or_latex',
      'missing_diagram',
      'provenance_mismatch',
      'other',
    ]);
    const safeType = allowedIssueTypes.has(String(issueType))
      ? (String(issueType) as QuestionIssueReportRecord['issueType'])
      : 'other';

    const report: QuestionIssueReportRecord = {
      reportId: `rep-${crypto.randomUUID().slice(0, 12)}`,
      uid,
      questionId: questionId.trim(),
      issueType: safeType,
      details: cleanDetails,
      status: 'open',
      createdAtIso: new Date().toISOString(),
    };

    try {
      await adminSetDoc(`issue_reports/${uid}/items`, report.reportId, report, true);
      res.status(201).json({
        status: 'REPORT_LOGGED',
        report,
      });
    } catch (err: any) {
      res.status(err?.statusCode || 503).json({
        errorCode: err?.errorCode || 'PERSISTENCE_UNAVAILABLE',
        message: err?.message || 'Unable to persist issue report.',
        requestId: req.requestId,
      });
    }
  }
);

pyqAndCbtRouter.get(
  '/pyq/report-issue',
  requireAuthenticatedStudent,
  async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.userUid!;
    try {
      const reports = await adminListCollection<QuestionIssueReportRecord>(
        `issue_reports/${uid}/items`,
        100
      );
      res.json({
        reports: reports.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso)),
      });
    } catch (err: any) {
      res.status(err?.statusCode || 503).json({
        errorCode: err?.errorCode || 'PERSISTENCE_UNAVAILABLE',
        message: err?.message || 'Unable to load issue reports.',
        requestId: req.requestId,
      });
    }
  }
);
