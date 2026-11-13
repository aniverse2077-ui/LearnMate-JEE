import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import {
  CBT_MOCK_QUESTIONS,
  JEE_ADVANCED_PAPER_1_QUESTIONS,
  NEET_UG_PAPER_QUESTIONS,
  BITSAT_PAPER_QUESTIONS,
} from '../../data/jeeInitialContent';
import { EXPANDED_NTA_58_CHAPTERS } from '../../data/expandedNta58Chapters';
import { gradeCbtAttemptOnServer } from '../coreStudyEngine';

export const pyqAndCbtRouter = Router();

const ALL_SERVER_PYQS = [
  ...CBT_MOCK_QUESTIONS,
  ...JEE_ADVANCED_PAPER_1_QUESTIONS,
  ...NEET_UG_PAPER_QUESTIONS,
  ...BITSAT_PAPER_QUESTIONS,
];

// 1. Paginated PYQ & 58-Chapter Filter Endpoint (/api/pyq/questions)
pyqAndCbtRouter.get('/pyq/questions', (req: Request, res: Response) => {
  const subject = String(req.query.subject || 'All');
  const chapter = String(req.query.chapter || 'All');
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 25)));

  const filtered = ALL_SERVER_PYQS.filter((q) => {
    const subjMatch = subject === 'All' || q.subject === subject;
    const chapMatch =
      chapter === 'All' || q.chapter.toLowerCase().includes(chapter.toLowerCase());
    return subjMatch && chapMatch;
  });

  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  res.json({
    page,
    limit,
    totalCount: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    chaptersCount: EXPANDED_NTA_58_CHAPTERS.length,
    items,
  });
});

// 2. Lazy-Loaded PYQ JSON Pack Endpoint (/api/pyq/packs/:packId)
pyqAndCbtRouter.get('/pyq/packs/:packId', (req: Request, res: Response) => {
  const rawPackId = String(req.params.packId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const publicPacksDir = path.resolve(process.cwd(), 'public', 'pyq-packs');
  const filePath = path.join(publicPacksDir, `${rawPackId}.json`);

  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      res.json(parsed);
      return;
    } catch {
      // fall through
    }
  }

  if (rawPackId === 'jee-advanced-papers') {
    res.json({
      packId: 'jee-advanced-papers',
      title: 'JEE Advanced Paper 1 & 2 Official Multi-Format Pack',
      questionCount: JEE_ADVANCED_PAPER_1_QUESTIONS.length,
      questions: JEE_ADVANCED_PAPER_1_QUESTIONS,
    });
    return;
  }

  res.json({
    packId: rawPackId || 'jee-main-shifts',
    title: 'JEE Main Official 75-Q Shift Pack',
    questionCount: CBT_MOCK_QUESTIONS.length,
    questions: CBT_MOCK_QUESTIONS,
  });
});

// 3. Server-Verified CBT Grading & Shift Percentile Calculation (/api/cbt/grade)
pyqAndCbtRouter.post('/cbt/grade', (req: Request, res: Response) => {
  const {
    questions = CBT_MOCK_QUESTIONS,
    responses = {},
    examMode = 'JEE Main',
    shiftDifficulty = 'Moderate',
  } = req.body || {};

  if (!Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({
      errorCode: 'EMPTY_CBT_QUESTIONS',
      message: 'A non-empty questions array is required for server CBT grading.',
    });
    return;
  }

  const graded = gradeCbtAttemptOnServer({
    questions,
    responses,
    examMode,
    shiftDifficulty,
  });

  res.json(graded);
});
