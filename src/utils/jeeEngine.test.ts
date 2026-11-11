import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCBTSummary,
  transitionQuestionStatus,
  evaluateMathFunction,
  calculateStatistics,
  validateIdFormat,
  CBTQuestion,
  QuestionResponseState,
} from './jeeEngine';

const sampleQuestions: CBTQuestion[] = [
  {
    id: 'q1',
    number: 1,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Quadratic Equations',
    stem: 'If f(x) = x^2 - 4x + 5, then the minimum value of f(x) is:',
    options: ['0', '1', '2', '4'],
    correctIndex: 1,
    explanation: 'f(x) = (x - 2)^2 + 1 >= 1.',
  },
  {
    id: 'q2',
    number: 2,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Laws of Motion',
    stem: 'Acceleration of a block on a smooth incline of angle 30 deg is:',
    options: ['g', 'g/2', 'g*sqrt(3)/2', 'g/3'],
    correctIndex: 1,
    explanation: 'a = g sin(30) = g/2.',
  },
  {
    id: 'q3',
    number: 3,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'd & f Block',
    stem: 'Which Group 12 element is not considered a typical transition metal?',
    options: ['Fe', 'Cu', 'Zn', 'Cr'],
    correctIndex: 2,
    explanation: 'Zn has a completely filled 3d10 subshell in ground and +2 oxidation state.',
  },
];

test('NTA CBT marking scheme awards +4 for correct, -1 for wrong, and 0 for skipped', () => {
  const responses: Record<string, QuestionResponseState> = {
    q1: { status: 'answered', selectedOption: 1, timeSpentSec: 90 }, // Correct (+4)
    q2: { status: 'answered_marked', selectedOption: 0, timeSpentSec: 120 }, // Wrong (-1)
    q3: { status: 'marked', selectedOption: null, timeSpentSec: 45 }, // Skipped (0)
  };

  const summary = calculateCBTSummary(sampleQuestions, responses);
  assert.equal(summary.score, 3);
  assert.equal(summary.maxMarks, 12);
  assert.equal(summary.correctCount, 1);
  assert.equal(summary.incorrectCount, 1);
  assert.equal(summary.skippedCount, 1);
  assert.equal(summary.accuracy, 50.0);
});

test('Question palette state transitions match NTA CBT rules', () => {
  assert.equal(transitionQuestionStatus(null, 'save_next'), 'not_answered');
  assert.equal(transitionQuestionStatus(2, 'save_next'), 'answered');
  assert.equal(transitionQuestionStatus(null, 'mark_review'), 'marked');
  assert.equal(transitionQuestionStatus(1, 'mark_review'), 'answered_marked');
  assert.equal(transitionQuestionStatus(3, 'clear'), 'not_answered');
});

test('Graphing math evaluator plots y = x^2 - 4 accurately', () => {
  assert.equal(evaluateMathFunction('y = x^2 - 4', 0), -4);
  assert.equal(evaluateMathFunction('y = x^2 - 4', 2), 0);
  assert.equal(evaluateMathFunction('y = x^2 - 4', -3), 5);
  assert.equal(evaluateMathFunction('2x + 3', 4), 11);
});

test('Statistics calculator computes mean, median, variance, and standard deviation', () => {
  const stats = calculateStatistics([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(stats.count, 8);
  assert.equal(stats.mean, 5);
  assert.equal(stats.median, 4.5);
  assert.equal(stats.variance, 4);
  assert.equal(stats.stdDev, 2);
});

test('Firestore document ID guard blocks poisoned IDs', () => {
  assert.equal(validateIdFormat('mat_2027_01'), true);
  assert.equal(validateIdFormat('bad id with spaces!'), false);
  assert.equal(validateIdFormat(''), false);
});
