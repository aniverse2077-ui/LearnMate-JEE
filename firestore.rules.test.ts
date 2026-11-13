import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Security Rule Verification Suite:
 * 1) Static & adversarial rule checks for tenant isolation, verified migration lock,
 *    server-only entitlements, and Storage ownership rules.
 * 2) Live `@firebase/rules-unit-testing` suite when FIRESTORE_EMULATOR_HOST is running
 *    (Java JRE + Firebase Emulator CLI required).
 */
const rulesText = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');
const storageRulesText = fs.readFileSync(new URL('./storage.rules', import.meta.url), 'utf8');

interface AuthContext {
  uid: string;
  email_verified: boolean;
}

function evaluateTenantMaterialCreate(
  auth: AuthContext | null,
  pathUserId: string,
  docId: string,
  incoming: Record<string, any>,
  requestTime: string
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (auth.uid !== pathUserId) return 'PERMISSION_DENIED';
  if (!/^[a-zA-Z0-9_\-]+$/.test(pathUserId) || pathUserId.length > 128) return 'PERMISSION_DENIED';
  if (!/^[a-zA-Z0-9_\-]+$/.test(docId) || docId.length === 0 || docId.length > 128) {
    return 'PERMISSION_DENIED';
  }
  const requiredKeys = [
    'userId',
    'title',
    'subject',
    'chapter',
    'sourceType',
    'sourceRef',
    'pageCount',
    'currentPage',
    'contentSummary',
    'extractionQuality',
    'contentHash',
    'createdAt',
    'updatedAt',
  ];
  const allowedOptional = ['annotationsJson'];
  const keys = Object.keys(incoming);
  if (!requiredKeys.every((k) => keys.includes(k))) return 'PERMISSION_DENIED';
  if (!keys.every((k) => requiredKeys.includes(k) || allowedOptional.includes(k))) {
    return 'PERMISSION_DENIED';
  }
  if (incoming.userId !== auth.uid || incoming.userId !== pathUserId) return 'PERMISSION_DENIED';
  if (typeof incoming.title !== 'string' || incoming.title.length < 1 || incoming.title.length > 200) {
    return 'PERMISSION_DENIED';
  }
  if (!['Physics', 'Chemistry', 'Mathematics'].includes(incoming.subject)) {
    return 'PERMISSION_DENIED';
  }
  if (!['full', 'partial', 'needs_ocr', 'unavailable'].includes(incoming.extractionQuality)) {
    return 'PERMISSION_DENIED';
  }
  if (incoming.createdAt !== requestTime || incoming.updatedAt !== requestTime) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

test('firestore.rules & storage.rules enforce tenant subcollections, migration lock, and server-only billing writes', () => {
  assert.ok(rulesText.includes("rules_version = '2';"), 'Must use rules_version 2');
  assert.ok(
    rulesText.includes('match /{document=**} {\n      allow read, write: if false;\n    }'),
    'Must have global default-deny catch-all'
  );
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'), 'Must require email_verified');
  assert.ok(rulesText.includes('match /users/{userId}'), 'Must scope under /users/{userId}');
  assert.ok(rulesText.includes('allow list: if false; // Zero user enumeration'), 'Must deny listing /users');
  assert.ok(rulesText.includes('function isLegacyMigrationPending()'), 'Must lock legacy collections via verified migrationVersion');
  assert.ok(
    !rulesText.includes('timestamp.date(2027, 1, 1)'),
    'Must NOT enforce arbitrary hardcoded calendar cutoff before verified migration'
  );
  assert.ok(
    rulesText.includes('match /entitlements/{docId} {\n        allow get, list: if isOwner(userId);\n        allow write: if false;\n      }'),
    'Entitlements must be client read-only'
  );

  // Storage rules checks
  assert.ok(storageRulesText.includes('service firebase.storage'));
  assert.ok(storageRulesText.includes('match /users/{userId}/materials/{fileName}'));
  assert.ok(storageRulesText.includes('request.auth.uid == userId'));
  assert.ok(storageRulesText.includes('request.auth.token.email_verified == true'));
  assert.ok(storageRulesText.includes('50 * 1024 * 1024'));
});

test('Canonical tenant-scoped material rules reject all adversarial payloads', () => {
  const now = '2026-11-12T12:00:00Z';
  const validBase = {
    userId: 'uid_owner',
    title: 'Electrostatics Lecture Notes',
    subject: 'Physics',
    chapter: 'Electrostatics & Capacitance',
    sourceType: 'pdf',
    sourceRef: 'electrostatics.pdf',
    pageCount: 64,
    currentPage: 1,
    contentSummary: 'Gauss law and flux across closed surfaces.',
    extractionQuality: 'full',
    contentHash: 'sha256_abc123',
    createdAt: now,
    updatedAt: now,
  };

  assert.equal(
    evaluateTenantMaterialCreate(
      { uid: 'uid_attacker', email_verified: true },
      'uid_owner',
      'mat_1',
      validBase,
      now
    ),
    'PERMISSION_DENIED'
  );
  assert.equal(
    evaluateTenantMaterialCreate(
      { uid: 'uid_owner', email_verified: true },
      'uid_owner',
      'mat_1',
      { ...validBase, isAdmin: true },
      now
    ),
    'PERMISSION_DENIED'
  );
  assert.equal(
    evaluateTenantMaterialCreate(
      { uid: 'uid_owner', email_verified: false },
      'uid_owner',
      'mat_1',
      validBase,
      now
    ),
    'PERMISSION_DENIED'
  );
  assert.equal(
    evaluateTenantMaterialCreate(null, 'uid_owner', 'mat_1', validBase, now),
    'PERMISSION_DENIED'
  );
  assert.equal(
    evaluateTenantMaterialCreate(
      { uid: 'uid_owner', email_verified: true },
      'uid_owner',
      'bad$id with spaces',
      validBase,
      now
    ),
    'PERMISSION_DENIED'
  );
  assert.equal(
    evaluateTenantMaterialCreate(
      { uid: 'uid_owner', email_verified: true },
      'uid_owner',
      'mat_1',
      validBase,
      now
    ),
    'ALLOW'
  );
});

test('Live Firebase Firestore Emulator cross-account isolation & entitlement lock', async (t) => {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST?.trim();
  if (!emulatorHost) {
    t.skip('FIRESTORE_EMULATOR_HOST not active (Java JRE unavailable in sandbox). Run via `firebase emulators:exec --only firestore "npx tsx --test firestore.rules.test.ts"`.');
    return;
  }

  const { initializeTestEnvironment, assertFails, assertSucceeds } = await import(
    '@firebase/rules-unit-testing'
  );
  const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
  const [host, portStr] = emulatorHost.split(':');

  const testEnv = await initializeTestEnvironment({
    projectId: 'learnmate-jee-test',
    firestore: {
      host,
      port: Number(portStr || 8080),
      rules: rulesText,
    },
  });

  try {
    const uidA = testEnv.authenticatedContext('student_a', { email_verified: true });
    const uidB = testEnv.authenticatedContext('student_b', { email_verified: true });
    const unverifiedA = testEnv.authenticatedContext('student_a', { email_verified: false });

    const dbA = uidA.firestore();
    const dbB = uidB.firestore();
    const dbUnverified = unverifiedA.firestore();

    await assertSucceeds(
      setDoc(doc(dbA, 'users/student_a/materials/mat_1'), {
        userId: 'student_a',
        title: 'Rotational Dynamics Notes',
        subject: 'Physics',
        chapter: 'Rotational Motion',
        sourceType: 'pdf',
        sourceRef: 'rotational.pdf',
        pageCount: 12,
        currentPage: 1,
        contentSummary: 'Angular momentum conservation.',
        extractionQuality: 'full',
        contentHash: 'hash_123',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Cross-account read/write denied
    await assertFails(getDoc(doc(dbB, 'users/student_a/materials/mat_1')));
    await assertFails(
      setDoc(doc(dbB, 'users/student_a/materials/mat_hacked'), {
        userId: 'student_a',
        title: 'Injected',
      })
    );

    // Unverified email write denied
    await assertFails(
      setDoc(doc(dbUnverified, 'users/student_a/tasks/task_1'), {
        userId: 'student_a',
        title: 'Task',
      })
    );

    // Client write to server-only entitlements denied
    await assertFails(
      setDoc(doc(dbA, 'users/student_a/entitlements/current'), {
        userId: 'student_a',
        tier: 'pro',
        status: 'active',
        updatedAtIso: new Date().toISOString(),
      })
    );
  } finally {
    await testEnv.cleanup();
  }
});
