import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';

process.env.LEARNMATE_SKIP_AUTO_LISTEN = 'true';
process.env.NODE_ENV = 'production';
process.env.ALLOW_DEV_AUTH_BYPASS = 'false';

const { createLearnMateExpressApp } = await import('../../server');
const {
  resetBillingStoresForTest,
  verifyWebhookSignature,
  processVerifiedWebhookEvent,
  getOrInitEntitlement,
} = await import('./routes/billingRoutes');
const { verifyStudentToken } = await import('./studentAuth');
const { retrieveTopKChunksForStudent, ingestMaterialSynchronously } = await import(
  '../services/ingestionJobsService'
);

async function startEphemeralServer() {
  const app = createLearnMateExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test('Fail-closed auth rejects missing, local_token, unsigned JWT, and x-learnmate-uid spoofing in production', async () => {
  const localRes = await verifyStudentToken('local_token_attacker');
  assert.equal(localRes.valid, false);

  const fakePayload = Buffer.from(JSON.stringify({ sub: 'attacker', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const fakeHeader = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'nonexistent' })).toString('base64url');
  const forgedJwt = `${fakeHeader}.${fakePayload}.invalidsignature`;
  const forgedRes = await verifyStudentToken(forgedJwt);
  assert.equal(forgedRes.valid, false);

  const srv = await startEphemeralServer();
  try {
    for (const ep of [
      '/api/ai/tutor',
      '/api/ai/think',
      '/api/ingest/youtube',
      '/api/storage/signed-url',
      '/api/commercial/entitlements',
      '/api/pyq/report-issue',
    ]) {
      const resp = await fetch(`${srv.baseUrl}${ep}`, {
        method: ep.includes('entitlements') ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-learnmate-uid': 'spoofed_uid',
          Authorization: 'Bearer local_token_spoofed',
        },
        body: ep.includes('entitlements') ? undefined : JSON.stringify({ prompt: 'test' }),
      });
      assert.equal(resp.status, 401, `Expected 401 on unauthenticated/spoofed ${ep}`);
    }
  } finally {
    await srv.close();
  }
});

test('Fail-closed production health & CORS policy blocks untrusted cross-origins while allowing APP_URL & same-origin', async () => {
  const prevAppUrl = process.env.APP_URL;
  process.env.APP_URL = 'https://ais-dev-7au4igqypnxvdbpj6i4mzp-354611551291.asia-northeast1.run.app';
  const srv = await startEphemeralServer();
  try {
    const health = await fetch(`${srv.baseUrl}/api/health`);
    // In production runtime without Admin SDK credentials, /api/health must fail closed with 503 degraded
    assert.equal(health.status, 503);
    const json = (await health.json()) as any;
    assert.equal(json.status, 'degraded');
    assert.equal(json.paymentsConfigured, false);
    assert.equal(json.storageConfigured, false);

    // Cloud Run APP_URL and paired shared preview origin must pass CORS cleanly
    const devOriginResp = await fetch(`${srv.baseUrl}/api/commercial/plans`, {
      headers: { Origin: process.env.APP_URL },
    });
    assert.equal(devOriginResp.status, 200);
    assert.equal(devOriginResp.headers.get('access-control-allow-origin'), process.env.APP_URL);

    const sharedOrigin = 'https://ais-pre-7au4igqypnxvdbpj6i4mzp-354611551291.asia-northeast1.run.app';
    const sharedOriginResp = await fetch(`${srv.baseUrl}/api/commercial/plans`, {
      headers: { Origin: sharedOrigin },
    });
    assert.equal(sharedOriginResp.status, 200);
    assert.equal(sharedOriginResp.headers.get('access-control-allow-origin'), sharedOrigin);

    // Same-origin matching Host must pass even in production
    const hostHeader = new URL(srv.baseUrl).host;
    const sameOriginResp = await fetch(`${srv.baseUrl}/api/commercial/plans`, {
      headers: { Origin: `http://${hostHeader}` },
    });
    assert.equal(sameOriginResp.status, 200);

    // Untrusted arbitrary third-party origin must fail closed with 403 CORS_FORBIDDEN
    const evilOriginResp = await fetch(`${srv.baseUrl}/api/commercial/plans`, {
      headers: { Origin: 'https://evil-attacker.example.com' },
    });
    assert.equal(evilOriginResp.status, 403);
    const evilJson = (await evilOriginResp.json()) as any;
    assert.equal(evilJson.errorCode, 'CORS_FORBIDDEN');
  } finally {
    if (prevAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = prevAppUrl;
    await srv.close();
  }
});

test('Payment webhook HMAC verification, idempotency, and honest 503 checkout state', async () => {
  resetBillingStoresForTest();
  const prevNodeEnv = process.env.NODE_ENV;
  const prevSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  const prevKey = process.env.RAZORPAY_KEY_SECRET;
  delete process.env.PAYMENT_WEBHOOK_SECRET;
  delete process.env.RAZORPAY_KEY_SECRET;

  const srv = await startEphemeralServer();
  try {
    const plansResp = await fetch(`${srv.baseUrl}/api/commercial/plans`);
    assert.equal(plansResp.status, 200);
    const plansJson = (await plansResp.json()) as any;
    assert.equal(plansJson.paymentsConfigured, false);

    // Upgrade endpoint must never return 200 (blocks client self-upgrade)
    const upgradeResp = await fetch(`${srv.baseUrl}/api/commercial/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'pro' }),
    });
    assert.ok(upgradeResp.status === 401 || upgradeResp.status === 403);

    // Webhook rejects unconfigured secret with 503
    const unconfHook = await fetch(`${srv.baseUrl}/api/commercial/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'evt-1', eventType: 'subscription.activated', uid: 'u1' }),
    });
    assert.equal(unconfHook.status, 503);

    // Switch to non-production test persistence to verify HMAC, idempotency replay, and refund revocation
    process.env.NODE_ENV = 'test';
    const secret = 'test_webhook_secret_12345';
    process.env.PAYMENT_WEBHOOK_SECRET = secret;
    const payloadObj = {
      eventId: 'evt-valid-1',
      eventType: 'subscription.activated',
      uid: 'student_alpha',
      tier: 'pro',
      billingCycle: 'monthly',
      amountInr: 499,
    };
    const rawBody = JSON.stringify(payloadObj);
    const validSig = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

    assert.equal(verifyWebhookSignature(rawBody, validSig, secret), true);
    assert.equal(verifyWebhookSignature(rawBody, '00'.repeat(32), secret), false);

    const badSigResp = await fetch(`${srv.baseUrl}/api/commercial/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-learnmate-signature': 'deadbeef'.repeat(8),
      },
      body: rawBody,
    });
    assert.equal(badSigResp.status, 401);

    const goodHookResp = await fetch(`${srv.baseUrl}/api/commercial/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-learnmate-signature': validSig,
      },
      body: rawBody,
    });
    assert.equal(goodHookResp.status, 200);
    const hookJson = (await goodHookResp.json()) as any;
    assert.equal(hookJson.entitlement.tier, 'pro');
    assert.equal(hookJson.duplicate, false);

    // Duplicate replay is idempotent
    const replay = await processVerifiedWebhookEvent({
      eventId: 'evt-valid-1',
      eventType: 'subscription.activated',
      uid: 'student_alpha',
      tier: 'pro',
    });
    assert.equal(replay.duplicate, true);
    assert.equal((await getOrInitEntitlement('student_alpha')).tier, 'pro');

    // Refund revokes paid entitlement back to free
    await processVerifiedWebhookEvent({
      eventId: 'evt-refund-1',
      eventType: 'charge.refunded',
      uid: 'student_alpha',
    });
    assert.equal((await getOrInitEntitlement('student_alpha')).tier, 'free');
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    if (prevSecret === undefined) delete process.env.PAYMENT_WEBHOOK_SECRET;
    else process.env.PAYMENT_WEBHOOK_SECRET = prevSecret;
    if (prevKey === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = prevKey;
    await srv.close();
  }
});

test('Tenant isolation prevents student B from retrieving chunks indexed by student A', () => {
  ingestMaterialSynchronously({
    uid: 'student_A_uid',
    materialId: 'secret-mat-A',
    title: 'Student A Private Physics Secret Notes',
    subject: 'Physics',
    chapter: 'Electrostatics',
    sourceType: 'text',
    sourceRef: 'notes.txt',
    rawText: '[Page 1] Secret Gauss Law formula phi = q_in / epsilon_0 for student A.',
  });

  const hitsForA = retrieveTopKChunksForStudent({
    uid: 'student_A_uid',
    query: 'Gauss Law epsilon',
    topK: 4,
  });
  assert.ok(hitsForA.length > 0);

  const hitsForB = retrieveTopKChunksForStudent({
    uid: 'student_B_uid',
    materialId: 'secret-mat-A',
    query: 'Gauss Law epsilon',
    topK: 4,
  });
  assert.equal(hitsForB.length, 0);
});
