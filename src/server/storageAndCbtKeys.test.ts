import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { isOwnerStoragePath } from './routes/storageRoutes';
import { stripQuestionAnswerKeys } from './data/authoritativeAnswerKeys';
import { gradeCbtAttemptOnServer } from './coreStudyEngine';
import { CBT_MOCK_QUESTIONS } from '../data/jeeInitialContent';

test('isOwnerStoragePath strictly isolates storage paths to authenticated UID directory', () => {
  assert.equal(isOwnerStoragePath('user_123', 'users/user_123/materials/notes.pdf'), true);
  assert.equal(isOwnerStoragePath('user_123', 'users/user_999/materials/notes.pdf'), false);
  assert.equal(isOwnerStoragePath('user_123', 'users/user_123/materials/../user_999/notes.pdf'), false);
  assert.equal(isOwnerStoragePath('anonymous', 'users/anonymous/materials/notes.pdf'), false);
});

test('Public static PYQ packs strip authoritative answer keys and explanations', () => {
  const packsDir = path.resolve(process.cwd(), 'public', 'pyq-packs');
  for (const filename of ['jee-main-shifts.json', 'jee-advanced-papers.json']) {
    const filePath = path.join(packsDir, filename);
    assert.equal(fs.existsSync(filePath), true, `Missing ${filename}`);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.equal(parsed.answerKeysStripped, true);
    assert.ok(Array.isArray(parsed.questions) && parsed.questions.length > 0);
    for (const q of parsed.questions) {
      assert.equal(q.correctIndex, undefined, `${filename} leaked correctIndex`);
      assert.equal(q.correctIndices, undefined, `${filename} leaked correctIndices`);
      assert.equal(q.numericalAnswer, undefined, `${filename} leaked numericalAnswer`);
      assert.equal(q.explanation, undefined, `${filename} leaked explanation`);
    }
  }
});

test('stripQuestionAnswerKeys removes all grading fields and server grading ignores forged client keys', () => {
  const q1 = CBT_MOCK_QUESTIONS[0];
  const stripped = stripQuestionAnswerKeys(q1);
  assert.equal((stripped as any).correctIndex, undefined);
  assert.equal((stripped as any).explanation, undefined);

  // Forge client question payload with wrong correctIndex and pass to official_mock grader
  const wrongIdx = (q1.correctIndex + 1) % q1.options.length;
  const forgedQuestion = { ...q1, correctIndex: wrongIdx, explanation: 'forged explanation' };
  const gradedWithTrueAnswer = gradeCbtAttemptOnServer({
    questions: [forgedQuestion],
    attemptType: 'official_mock',
    responses: {
      [q1.id]: {
        status: 'answered',
        selectedOption: q1.correctIndex,
        timeSpentSec: 30,
      },
    },
    examMode: 'JEE Main',
  });
  // Server must award +4 for the authoritative answer key, ignoring the forged client key
  assert.equal(gradedWithTrueAnswer.summary.totalScore, 4);
  assert.equal(gradedWithTrueAnswer.summary.correctCount, 1);

  // Unknown question ID must fail closed for official_mock
  assert.throws(
    () =>
      gradeCbtAttemptOnServer({
        questionIds: ['nonexistent-official-id'],
        attemptType: 'official_mock',
        responses: {},
      }),
    /Unknown official question ID/
  );
});
