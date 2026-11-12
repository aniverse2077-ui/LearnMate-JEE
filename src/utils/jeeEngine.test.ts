import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCBTSummary,
  evaluateSingleQuestionMarks,
  evaluateMathFunction,
  findRootsAndExtrema,
  findCurveIntersections,
  computeCombination,
  computeDeterminant3x3,
  computeVectorOps,
  detectJeeSubjectAndChapter,
  CBTQuestion,
  QuestionResponseState,
} from './jeeEngine';

const SAMPLE_QUESTIONS: CBTQuestion[] = [
  {
    id: 'q1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Kinematics',
    stem: 'Sample MCQ',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 1,
    explanation: 'B is correct',
    examType: 'JEE Main',
  },
  {
    id: 'q2',
    number: 2,
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Kinematics',
    stem: 'Sample Numerical',
    options: ['10', '20', '30', '40'],
    correctIndex: 2,
    numericalAnswer: 30,
    explanation: '30 is correct',
    examType: 'JEE Main',
  },
  {
    id: 'q3',
    number: 3,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Calculus',
    stem: 'Sample JEE Advanced Multi-Choice',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    correctIndices: [0, 2, 3],
    explanation: 'A, C, D are correct',
    examType: 'JEE Advanced',
    advancedFormat: 'multiple',
  },
];

test('JEE Main Section B numerical has 0 negative marking on wrong answer per 2025/26 NTA rules', () => {
  const responses: Record<string, QuestionResponseState> = {
    q1: { status: 'answered', selectedOption: 0, timeSpentSec: 40 }, // Wrong MCQ -> -1
    q2: { status: 'answered', selectedOption: null, numericalValue: '99', timeSpentSec: 50 }, // Wrong Numerical -> 0
  };
  const summary = calculateCBTSummary(SAMPLE_QUESTIONS.slice(0, 2), responses);
  assert.equal(summary.score, -1);
  assert.equal(summary.incorrectCount, 2);
});

test('JEE Advanced multi-choice partial marking awards +1 per correct option and -2 if any wrong chosen', () => {
  const qAdv = SAMPLE_QUESTIONS[2];
  // Partial correct (2 of 3 correct options chosen, 0 wrong) -> +2
  const partialRes = evaluateSingleQuestionMarks(qAdv, {
    status: 'answered',
    selectedOption: null,
    selectedOptions: [0, 2],
    timeSpentSec: 60,
  });
  assert.equal(partialRes.marksAwarded, 2);

  // Full correct (all 3 chosen) -> +4
  const fullRes = evaluateSingleQuestionMarks(qAdv, {
    status: 'answered',
    selectedOption: null,
    selectedOptions: [0, 2, 3],
    timeSpentSec: 60,
  });
  assert.equal(fullRes.marksAwarded, 4);

  // One wrong option chosen -> -2
  const wrongRes = evaluateSingleQuestionMarks(qAdv, {
    status: 'answered',
    selectedOption: null,
    selectedOptions: [0, 1],
    timeSpentSec: 60,
  });
  assert.equal(wrongRes.marksAwarded, -2);
});

test('Desmos math engine evaluates parameter sliders, roots, extrema, and intersections', () => {
  const val = evaluateMathFunction('y = a*x^2 - c', 3, { a: 2, c: 8 });
  assert.equal(val, 10);

  const pts = findRootsAndExtrema('y = x^2 - 4', -5, 5);
  const roots = pts.filter((p) => p.type === 'root').map((p) => p.x);
  assert.ok(roots.some((r) => Math.abs(r - -2) < 0.05));
  assert.ok(roots.some((r) => Math.abs(r - 2) < 0.05));

  const minima = pts.filter((p) => p.type === 'min');
  assert.ok(minima.some((m) => Math.abs(m.x) < 0.05 && Math.abs(m.y - -4) < 0.05));

  const inter = findCurveIntersections('y = x^2 - 4', 'y = 0', -5, 5);
  assert.ok(inter.length >= 2);
});

test('Scientific calculator combinatorics, 3x3 determinant, and vector dot/cross products', () => {
  assert.equal(computeCombination(10, 3), 120);
  const det = computeDeterminant3x3([
    [1, 0, 0],
    [0, 2, 0],
    [0, 0, 3],
  ]);
  assert.equal(det, 6);
  const vec = computeVectorOps([1, 0, 0], [0, 1, 0]);
  assert.equal(vec.dot, 0);
  assert.deepEqual(vec.cross, [0, 0, 1]);
  assert.equal(vec.angleDeg, 90);
});

test('Auto-classifier identifies Physics, Chemistry, and Mathematics chapters without user subject selection', () => {
  const chem = detectJeeSubjectAndChapter(
    'Nernst equation E_cell = E0 - 0.0591/n log Q, Kohlrausch law and molar conductivity in galvanic cell'
  );
  assert.equal(chem.subject, 'Chemistry');
  assert.equal(chem.chapter, 'Electrochemistry');

  const math = detectJeeSubjectAndChapter(
    'Definite integration using King property and Leibniz rule for area under curve'
  );
  assert.equal(math.subject, 'Mathematics');
  assert.equal(math.chapter, 'Definite & Indefinite Integration');

  const phys = detectJeeSubjectAndChapter(
    'Moment of inertia parallel axis theorem, torque and pure rolling without slipping'
  );
  assert.equal(phys.subject, 'Physics');
  assert.equal(phys.chapter, 'Rotational Motion');
});

