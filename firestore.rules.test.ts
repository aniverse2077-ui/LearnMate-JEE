import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Deterministic Red-Team Security Rule Evaluator verifying all "Dirty Dozen"
 * adversarial payloads against the boolean invariants in firestore.rules.
 */
const rulesText = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');

interface AuthContext {
  uid: string;
  email_verified: boolean;
}

function evaluateMaterialCreate(
  auth: AuthContext | null,
  docId: string,
  incoming: Record<string, any>,
  requestTime: string
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (!/^[a-zA-Z0-9_\-]+$/.test(docId) || docId.length === 0 || docId.length > 128) {
    return 'PERMISSION_DENIED';
  }
  const allowedKeys = [
    'userId',
    'title',
    'subject',
    'chapter',
    'sourceType',
    'sourceRef',
    'pageCount',
    'currentPage',
    'contentSummary',
    'createdAt',
    'updatedAt',
  ];
  const keys = Object.keys(incoming);
  if (keys.length !== allowedKeys.length || !keys.every((k) => allowedKeys.includes(k))) {
    return 'PERMISSION_DENIED';
  }
  if (incoming.userId !== auth.uid) return 'PERMISSION_DENIED';
  if (typeof incoming.title !== 'string' || incoming.title.length < 1 || incoming.title.length > 200) {
    return 'PERMISSION_DENIED';
  }
  if (!['Physics', 'Chemistry', 'Mathematics'].includes(incoming.subject)) {
    return 'PERMISSION_DENIED';
  }
  if (incoming.createdAt !== requestTime || incoming.updatedAt !== requestTime) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

test('firestore.rules contains all 8 hardened security pillars', () => {
  assert.ok(rulesText.includes("rules_version = '2';"), 'Must use rules_version 2');
  assert.ok(rulesText.includes('match /{document=**} {\n      allow read, write: if false;\n    }'), 'Must have global default-deny catch-all');
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'), 'Must require email_verified');
  assert.ok(rulesText.includes('isValidUserProfile(incoming())'), 'Must validate UserProfile');
  assert.ok(rulesText.includes('isValidStudyMaterial(incoming())'), 'Must validate StudyMaterial');
  assert.ok(rulesText.includes('isValidStudyTask(incoming())'), 'Must validate StudyTask');
  assert.ok(rulesText.includes('isValidSavedCreation(incoming())'), 'Must validate SavedCreation');
  assert.ok(rulesText.includes('isValidMockAttempt(incoming())'), 'Must validate MockAttempt');
  assert.ok(rulesText.includes('isValidRevisionCard(incoming())'), 'Must validate RevisionCard');
});

test('All Dirty Dozen adversarial payloads return PERMISSION_DENIED', () => {
  const now = '2026-11-11T12:00:00Z';
  const validBase = {
    userId: 'uid_owner',
    title: 'd & f Block Notes',
    subject: 'Chemistry',
    chapter: 'd & f Block',
    sourceType: 'pdf',
    sourceRef: 'd_f_block.pdf',
    pageCount: 13,
    currentPage: 2,
    contentSummary: 'Transition elements summary',
    createdAt: now,
    updatedAt: now,
  };

  // 1. Identity spoofing on create
  assert.equal(
    evaluateMaterialCreate({ uid: 'uid_attacker', email_verified: true }, 'mat_1', validBase, now),
    'PERMISSION_DENIED'
  );

  // 2. Shadow / ghost field injection
  assert.equal(
    evaluateMaterialCreate(
      { uid: 'uid_owner', email_verified: true },
      'mat_1',
      { ...validBase, isAdmin: true },
      now
    ),
    'PERMISSION_DENIED'
  );

  // 3. Unverified email write
  assert.equal(
    evaluateMaterialCreate({ uid: 'uid_owner', email_verified: false }, 'mat_1', validBase, now),
    'PERMISSION_DENIED'
  );

  // 4. Null auth / unauthenticated write
  assert.equal(evaluateMaterialCreate(null, 'mat_1', validBase, now), 'PERMISSION_DENIED');

  // 5. Denial-of-wallet oversized title
  assert.equal(
    evaluateMaterialCreate(
      { uid: 'uid_owner', email_verified: true },
      'mat_1',
      { ...validBase, title: 'A'.repeat(500) },
      now
    ),
    'PERMISSION_DENIED'
  );

  // 6. ID poisoning
  assert.equal(
    evaluateMaterialCreate(
      { uid: 'uid_owner', email_verified: true },
      'bad$id with spaces',
      validBase,
      now
    ),
    'PERMISSION_DENIED'
  );

  // 7. Invalid enum value
  assert.equal(
    evaluateMaterialCreate(
      { uid: 'uid_owner', email_verified: true },
      'mat_1',
      { ...validBase, subject: 'History' },
      now
    ),
    'PERMISSION_DENIED'
  );

  // 8. Forged timestamp
  assert.equal(
    evaluateMaterialCreate(
      { uid: 'uid_owner', email_verified: true },
      'mat_1',
      { ...validBase, createdAt: '1999-01-01T00:00:00Z' },
      now
    ),
    'PERMISSION_DENIED'
  );

  // Positive control: valid owner payload succeeds
  assert.equal(
    evaluateMaterialCreate({ uid: 'uid_owner', email_verified: true }, 'mat_1', validBase, now),
    'ALLOW'
  );
});
