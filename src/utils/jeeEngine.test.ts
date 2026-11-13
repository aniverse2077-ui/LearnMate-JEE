import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectJeeSubjectAndChapter,
  evaluateSingleQuestionMarks,
  calculateCBTSummary,
  calculateSM2Schedule,
  predictNtaPercentileAndAir,
  generateChapterShardZ,
  CBTQuestion,
} from './jeeEngine.ts';
import {
  generateMaterialStudyBundle,
  JEE_SYLLABUS_DATA,
  CBT_MOCK_QUESTIONS,
} from '../data/jeeInitialContent.ts';
import { validateAndIngestPYQPack } from '../services/pyqIngestionService.ts';

test('detectJeeSubjectAndChapter auto-identifies Physics, Chemistry, and Mathematics chapters', () => {
  const phys = detectJeeSubjectAndChapter(
    'Moment of inertia of a solid cylinder and parallel axis theorem I = I_cm + M d^2 with rolling torque',
    ''
  );
  assert.equal(phys.subject, 'Physics');
  assert.match(phys.chapter, /Rotational/i);

  const chem = detectJeeSubjectAndChapter(
    'Nernst equation E_cell, Kohlrausch law of molar conductivity and galvanic cell EMF',
    ''
  );
  assert.equal(chem.subject, 'Chemistry');
  assert.match(chem.chapter, /Electrochemistry/i);

  const math = detectJeeSubjectAndChapter(
    'Definite integration using King property and Leibniz rule for differentiation under integral sign',
    ''
  );
  assert.equal(math.subject, 'Mathematics');
  assert.match(math.chapter, /Integration/i);
});

test('JEE_SYLLABUS_DATA contains all 58 official NTA JEE Main & Advanced chapters (20 Physics, 20 Chemistry, 18 Mathematics)', () => {
  assert.equal(JEE_SYLLABUS_DATA.length, 58);
  const physCount = JEE_SYLLABUS_DATA.filter((c) => c.subject === 'Physics').length;
  const chemCount = JEE_SYLLABUS_DATA.filter((c) => c.subject === 'Chemistry').length;
  const mathCount = JEE_SYLLABUS_DATA.filter((c) => c.subject === 'Mathematics').length;
  assert.equal(physCount, 20);
  assert.equal(chemCount, 20);
  assert.equal(mathCount, 18);
  assert.ok(JEE_SYLLABUS_DATA.every((c) => c.weightageTier && c.examScope));
});

test('evaluateSingleQuestionMarks enforces +4/-1 for JEE Main Section A MCQ and +4/-1 for JEE Main Section B Numerical', () => {
  const mainMcq: CBTQuestion = {
    id: 'q1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Laws of Motion',
    stem: 'Sample MCQ',
    options: ['10 N', '20 N', '30 N', '40 N'],
    correctIndex: 1,
    explanation: 'F = ma',
    examType: 'JEE Main',
  };

  // Correct Section A MCQ -> +4
  const mcqRight = evaluateSingleQuestionMarks(mainMcq, {
    status: 'answered',
    selectedOption: 1,
    timeSpentSec: 30,
  });
  assert.equal(mcqRight.marksAwarded, 4);
  assert.equal(mcqRight.isCorrect, true);

  // Wrong Section A MCQ -> -1
  const mcqWrong = evaluateSingleQuestionMarks(mainMcq, {
    status: 'answered',
    selectedOption: 2,
    timeSpentSec: 30,
  });
  assert.equal(mcqWrong.marksAwarded, -1);
  assert.equal(mcqWrong.isCorrect, false);

  // Compulsory Section B Numerical in JEE Main -> +4 for correct, -1 for wrong, 0 for unattempted
  const mainNum: CBTQuestion = {
    id: 'q21',
    number: 21,
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Work, Energy and Power',
    stem: 'Sample Numerical',
    options: ['72'],
    correctIndex: 0,
    numericalAnswer: 72,
    explanation: 'W = 72 J',
    examType: 'JEE Main',
  };

  const numRight = evaluateSingleQuestionMarks(mainNum, {
    status: 'answered',
    selectedOption: null,
    numericalValue: '72',
    timeSpentSec: 45,
  });
  assert.equal(numRight.marksAwarded, 4);
  assert.equal(numRight.isCorrect, true);

  const numWrong = evaluateSingleQuestionMarks(mainNum, {
    status: 'answered',
    selectedOption: null,
    numericalValue: '55',
    timeSpentSec: 45,
  });
  assert.equal(numWrong.marksAwarded, -1);
  assert.equal(numWrong.isCorrect, false);

  const numSkipped = evaluateSingleQuestionMarks(mainNum, {
    status: 'not_answered',
    selectedOption: null,
    numericalValue: '',
    timeSpentSec: 10,
  });
  assert.equal(numSkipped.marksAwarded, 0);
  assert.equal(numSkipped.isAttempted, false);
});

test('evaluateSingleQuestionMarks enforces JEE Advanced partial marking (+4/-2/+3/+2/+1) and Non-Negative Integer (+4/0)', () => {
  const advMulti: CBTQuestion = {
    id: 'adv-1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Rotational Motion',
    stem: 'Multi-choice',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    correctIndices: [0, 1, 2, 3],
    explanation: 'All 4 correct',
    examType: 'JEE Advanced',
    advancedFormat: 'multiple',
  };

  // All 4 correct -> +4
  assert.equal(
    evaluateSingleQuestionMarks(advMulti, {
      status: 'answered',
      selectedOption: null,
      selectedOptions: [0, 1, 2, 3],
      timeSpentSec: 60,
    }).marksAwarded,
    4
  );

  // 3 of 4 correct, zero wrong -> +3 partial
  assert.equal(
    evaluateSingleQuestionMarks(advMulti, {
      status: 'answered',
      selectedOption: null,
      selectedOptions: [0, 1, 2],
      timeSpentSec: 60,
    }).marksAwarded,
    3
  );

  // 2 of 4 correct, zero wrong -> +2 partial
  assert.equal(
    evaluateSingleQuestionMarks(advMulti, {
      status: 'answered',
      selectedOption: null,
      selectedOptions: [0, 1],
      timeSpentSec: 60,
    }).marksAwarded,
    2
  );

  // 1 of 4 correct, zero wrong -> +1 partial
  assert.equal(
    evaluateSingleQuestionMarks(advMulti, {
      status: 'answered',
      selectedOption: null,
      selectedOptions: [0],
      timeSpentSec: 60,
    }).marksAwarded,
    1
  );

  // Any wrong option chosen -> -2
  const advThreeCorrect: CBTQuestion = {
    ...advMulti,
    correctIndices: [0, 1, 2],
  };
  assert.equal(
    evaluateSingleQuestionMarks(advThreeCorrect, {
      status: 'answered',
      selectedOption: null,
      selectedOptions: [0, 1, 3], // 3 is wrong
      timeSpentSec: 60,
    }).marksAwarded,
    -2
  );

  // JEE Advanced Numerical -> +4 correct, 0 wrong
  const advNum: CBTQuestion = {
    id: 'adv-num',
    number: 4,
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Capacitance',
    stem: 'Adv Numerical',
    options: ['2'],
    correctIndex: 0,
    numericalAnswer: 2,
    explanation: '2 uF',
    examType: 'JEE Advanced',
    advancedFormat: 'numerical',
  };
  assert.equal(
    evaluateSingleQuestionMarks(advNum, {
      status: 'answered',
      selectedOption: null,
      numericalValue: '99',
      timeSpentSec: 40,
    }).marksAwarded,
    0
  );
});

test('SuperMemo SM-2 algorithm and Shift Percentile Predictor compute accurate intervals and ranks', () => {
  // First review with Good (quality=4) -> interval 1, repetition 1
  const r1 = calculateSM2Schedule({
    quality: 4,
    repetition: 0,
    interval: 1,
    efactor: 2.5,
  });
  assert.equal(r1.interval, 1);
  assert.equal(r1.repetition, 1);

  // Second review with Good (quality=4) -> interval 6, repetition 2
  const r2 = calculateSM2Schedule({
    quality: 4,
    repetition: r1.repetition,
    interval: r1.interval,
    efactor: r1.efactor,
  });
  assert.equal(r2.interval, 6);
  assert.equal(r2.repetition, 2);

  // Third review with Easy (quality=5) -> interval = round(6 * 2.5) = 15, efactor increases
  const r3 = calculateSM2Schedule({
    quality: 5,
    repetition: r2.repetition,
    interval: r2.interval,
    efactor: r2.efactor,
  });
  assert.equal(r3.interval, 15);
  assert.ok(r3.efactor > r2.efactor);

  // Lapse (quality=1) -> resets interval to 1 and repetition to 0
  const lapsed = calculateSM2Schedule({
    quality: 1,
    repetition: r3.repetition,
    interval: r3.interval,
    efactor: r3.efactor,
  });
  assert.equal(lapsed.interval, 1);
  assert.equal(lapsed.repetition, 0);

  // Shift Percentile Predictor
  const predHigh = predictNtaPercentileAndAir({
    score: 245,
    maxScore: 300,
    shiftDifficulty: 'Tough',
  });
  assert.ok(predHigh.percentile >= 99.8);
  assert.equal(predHigh.cutoffCleared, true);

  // ShardZ generator
  const shards = generateChapterShardZ('Electrostatics', 'Physics');
  assert.equal(shards.length, 3);
  assert.equal(shards[0].durationMinutes, 15);
  assert.equal(shards[0].masteryQuestions.length, 3);
});

test('generateMaterialStudyBundle builds source-grounded pages without boilerplate formula injection and validates PYQ provenance', () => {
  const multiPageSource = [
    '[Page 1] Parallel axis theorem states $$I = I_{cm} + M d^2$$ for rigid bodies.',
    '[Page 2] Rotational kinetic energy is $K = \\frac{1}{2} I \\omega^2$.',
    '[Page 3] Rolling without slipping requires $v_{cm} = \\omega R$.',
  ].join('\n\n');

  const bundle = generateMaterialStudyBundle({
    materialId: 'test-mat-1',
    title: 'Rotational Dynamics Lecture Notes',
    subject: 'Physics',
    chapter: 'Rotational Motion',
    sourceType: 'pdf',
    rawText: multiPageSource,
    originalFileUrl: 'blob:https://example.com/sample.pdf',
    originalMimeType: 'application/pdf',
  });

  assert.equal(bundle.pages.length, 3);
  assert.equal(bundle.pages[0].sections.length, 4);
  assert.ok(bundle.formulas.some((f) => f.formula.includes('I_{cm}')));
  assert.equal(bundle.formulas.some((f) => f.formula.includes('varepsilon_0')), false);
  assert.equal(/katex/i.test(JSON.stringify(bundle)), false);
  assert.equal(CBT_MOCK_QUESTIONS.length, 75);
  assert.ok(CBT_MOCK_QUESTIONS.some((q) => q.provenanceType === 'LEARNMATE_ORIGINAL'));

  const packRes = validateAndIngestPYQPack([
    {
      id: 'pyq-2025-1',
      year: 2025,
      shift: 'Jan 22 Shift 1',
      examType: 'JEE Main',
      subject: 'Physics',
      chapterId: 'syl-phys-6',
      chapterName: 'Rotational Motion',
      difficulty: 'Moderate',
      questionType: 'Numerical',
      stemLatex: 'Find moment of inertia in $\\text{kg}\\cdot\\text{m}^2$:',
      numericalAnswer: 12,
      solutionLatex: '$$I = 12\\text{ kg}\\cdot\\text{m}^2$$',
      conceptTags: ['Moment of Inertia', 'Parallel Axis Theorem'],
    },
  ]);
  assert.equal(packRes.valid, true);
  assert.equal(packRes.questions.length, 1);
  assert.equal(packRes.questions[0].section, 'Section B');
  assert.equal(packRes.questions[0].provenanceType, 'RECONSTRUCTED_WITH_SOURCE');
});

test('Multi-exam evaluation supports BITSAT (+3/-1) and NEET UG (+4/-1) plus 12-hour marathon timestamp chunking', async () => {
  const { parseOrGenerateMarathonTimestampChunks } = await import('./jeeEngine.ts');

  const bitsatQ: CBTQuestion = {
    id: 'b-1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Kinematics',
    stem: 'BITSAT sample',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    explanation: 'Ans A',
    examType: 'BITSAT',
  };

  assert.equal(
    evaluateSingleQuestionMarks(bitsatQ, {
      status: 'answered',
      selectedOption: 0,
      timeSpentSec: 25,
    }).marksAwarded,
    3
  );
  assert.equal(
    evaluateSingleQuestionMarks(bitsatQ, {
      status: 'answered',
      selectedOption: 2,
      timeSpentSec: 25,
    }).marksAwarded,
    -1
  );

  const neetQ: CBTQuestion = {
    ...bitsatQ,
    id: 'n-1',
    examType: 'NEET UG',
  };
  assert.equal(
    evaluateSingleQuestionMarks(neetQ, {
      status: 'answered',
      selectedOption: 0,
      timeSpentSec: 25,
    }).marksAwarded,
    4
  );

  const chunks = parseOrGenerateMarathonTimestampChunks(
    '00:00:00 Coulomb Law & Vector Form\n01:30:00 Gauss Law & Applications\n03:15:00 Electric Dipole Torque',
    6,
    'Electrostatics'
  );
  assert.equal(chunks.length, 3);
  assert.equal(chunks[1].seconds, 5400);
  assert.match(chunks[1].topicTitle, /Gauss Law/);

  const autoChunks = parseOrGenerateMarathonTimestampChunks('General marathon notes', 6, 'Optics');
  assert.ok(autoChunks.length >= 4);
  assert.equal(autoChunks[0].seconds, 0);
});

