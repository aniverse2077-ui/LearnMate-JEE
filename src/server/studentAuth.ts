import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getApps, initializeApp, cert, App as FirebaseAdminApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export interface TokenVerificationResult {
  valid: boolean;
  uid: string;
  email?: string;
  emailVerified?: boolean;
  isDevBypass?: boolean;
  errorCode?: string;
  reason?: string;
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: Record<string, string> | null = null;
let cachedCertsExpiresAt = 0;
let cachedAppletConfig: { projectId?: string; storageBucket?: string } | null | undefined;

function getFallbackAppletConfig(): { projectId?: string; storageBucket?: string } {
  if (cachedAppletConfig !== undefined) return cachedAppletConfig || {};
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      cachedAppletConfig = {
        projectId: typeof parsed?.projectId === 'string' ? parsed.projectId.trim() : '',
        storageBucket: typeof parsed?.storageBucket === 'string' ? parsed.storageBucket.trim() : '',
      };
      return cachedAppletConfig;
    }
  } catch {
    // ignore invalid optional config
  }
  cachedAppletConfig = {};
  return {};
}

function getFallbackAppletProjectId(): string {
  return getFallbackAppletConfig().projectId || '';
}

export function isDevAuthBypassAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'development' && env.ALLOW_DEV_AUTH_BYPASS === 'true';
}

export function getInitializedAdminApp(): FirebaseAdminApp | null {
  const existing = getApps();
  if (existing.length > 0) {
    return existing[0];
  }
  const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!rawSa) {
    return null;
  }
  try {
    const parsed = JSON.parse(rawSa);
    const fallbackBucket = getFallbackAppletConfig().storageBucket;
    const resolvedBucket =
      fallbackBucket || process.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || '';
    return initializeApp({
      credential: cert(parsed),
      projectId: parsed.project_id,
      ...(resolvedBucket ? { storageBucket: resolvedBucket } : {}),
    });
  } catch {
    return null;
  }
}

export function isAuthAdminReady(): boolean {
  return Boolean(getInitializedAdminApp());
}

async function fetchGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedCerts && now < cachedCertsExpiresAt) {
    return cachedCerts;
  }
  const resp = await fetch(GOOGLE_CERTS_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch Google JWKS x509 certs: HTTP ${resp.status}`);
  }
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600 * 1000;
  cachedCerts = (await resp.json()) as Record<string, string>;
  cachedCertsExpiresAt = now + ttlMs;
  return cachedCerts;
}

/**
 * Cryptographically verifies a Firebase ID token or strictly gated dev bypass token.
 * - Never trusts unverified JWT payloads or spoofed headers.
 * - Rejects `local_token_*` in production and whenever ALLOW_DEV_AUTH_BYPASS !== 'true'.
 * - Fails closed in production when Firebase Admin SDK is unavailable (revocation checks required).
 */
export async function verifyStudentToken(
  authHeaderOrToken?: string | null,
  envOverride?: NodeJS.ProcessEnv
): Promise<TokenVerificationResult> {
  const env = envOverride || process.env;
  if (!authHeaderOrToken) {
    return {
      valid: false,
      uid: 'anonymous',
      errorCode: 'MISSING_AUTH_TOKEN',
      reason: 'Missing Authorization Bearer token',
    };
  }

  const clean = authHeaderOrToken.replace(/^Bearer\s+/i, '').trim();
  if (!clean) {
    return {
      valid: false,
      uid: 'anonymous',
      errorCode: 'EMPTY_AUTH_TOKEN',
      reason: 'Empty Authorization Bearer token',
    };
  }

  // Strictly gate `local_token_` behind NODE_ENV === 'development' && ALLOW_DEV_AUTH_BYPASS === 'true'
  if (clean.startsWith('local_token_')) {
    if (env.NODE_ENV === 'production') {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'UNAUTHORIZED_DEV_TOKEN_IN_PROD',
        reason: 'Development bypass tokens are strictly prohibited in production.',
      };
    }

    if (!isDevAuthBypassAllowed(env)) {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'DEV_AUTH_BYPASS_DISABLED',
        reason:
          'local_token_ requires NODE_ENV=development and ALLOW_DEV_AUTH_BYPASS=true.',
      };
    }

    const extractedUid = clean
      .replace(/^local_token_/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .trim();
    if (!extractedUid) {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'INVALID_DEV_TOKEN',
        reason: 'Dev bypass token must contain a valid UID suffix.',
      };
    }
    return {
      valid: true,
      uid: extractedUid.slice(0, 64),
      emailVerified: true,
      isDevBypass: true,
    };
  }

  // Must be a 3-part JWT (header.payload.signature)
  const parts = clean.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return {
      valid: false,
      uid: 'anonymous',
      errorCode: 'MALFORMED_JWT',
      reason: 'Token must be a standard 3-segment signed JWT.',
    };
  }

  // Path 1: Verify via firebase-admin when FIREBASE_SERVICE_ACCOUNT_JSON is configured
  const adminApp = getInitializedAdminApp();
  if (adminApp && !envOverride) {
    try {
      const decoded = await getAuth(adminApp).verifyIdToken(clean, true);
      return {
        valid: true,
        uid: decoded.uid,
        email: decoded.email,
        emailVerified: Boolean(decoded.email_verified),
      };
    } catch (err: any) {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'FIREBASE_ADMIN_VERIFY_FAILED',
        reason: err?.message || 'Firebase Admin ID token verification failed.',
      };
    }
  }

  // Fail closed in production when Firebase Admin SDK is absent (cannot check revoked tokens)
  if (env.NODE_ENV === 'production' && env.ALLOW_UNREVOKED_CERT_FALLBACK !== 'true') {
    return {
      valid: false,
      uid: 'anonymous',
      errorCode: 'AUTH_ADMIN_NOT_CONFIGURED',
      reason:
        'Firebase Admin SDK credentials are required in production for ID token & revocation verification.',
    };
  }

  // Path 2 (Non-production / explicit opt-in): Cryptographic RS256 verification against Google x509 certs
  try {
    const headerJson = Buffer.from(parts[0], 'base64url').toString('utf-8');
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
    const header = JSON.parse(headerJson);
    const payload = JSON.parse(payloadJson);

    if (header.alg !== 'RS256' || !header.kid || typeof header.kid !== 'string') {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'UNSUPPORTED_JWT_ALG',
        reason: 'JWT header must specify RS256 and a valid key ID (kid).',
      };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'TOKEN_EXPIRED',
        reason: 'Firebase ID token has expired.',
      };
    }
    if (typeof payload.iat === 'number' && payload.iat > nowSec + 300) {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'TOKEN_ISSUED_IN_FUTURE',
        reason: 'Firebase ID token iat claim is in the future.',
      };
    }
    if (typeof payload.auth_time === 'number' && payload.auth_time > nowSec + 300) {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'INVALID_AUTH_TIME',
        reason: 'Firebase ID token auth_time claim is invalid.',
      };
    }

    const expectedProjectId =
      (!envOverride ? getFallbackAppletProjectId() : '') ||
      env.VITE_FIREBASE_PROJECT_ID?.trim() ||
      env.FIREBASE_PROJECT_ID?.trim() ||
      getFallbackAppletProjectId();

    if (!expectedProjectId) {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'FIREBASE_PROJECT_NOT_CONFIGURED',
        reason:
          'Firebase Project ID is not configured on the server; refusing unverified audience claims.',
      };
    }

    if (payload.aud !== expectedProjectId) {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'INVALID_AUDIENCE',
        reason: `Token audience (${payload.aud}) does not match project (${expectedProjectId}).`,
      };
    }
    const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
    if (payload.iss !== expectedIssuer) {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'INVALID_ISSUER',
        reason: `Token issuer (${payload.iss}) does not match ${expectedIssuer}.`,
      };
    }

    const certs = await fetchGooglePublicCerts();
    const certPem = certs[header.kid];
    if (!certPem) {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'UNKNOWN_SIGNING_KEY',
        reason: `No matching Google public certificate found for kid=${header.kid}.`,
      };
    }

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();

    const signatureBuffer = Buffer.from(parts[2], 'base64url');
    const signatureValid = verifier.verify(certPem, signatureBuffer);
    if (!signatureValid) {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'INVALID_SIGNATURE',
        reason: 'Cryptographic RSA-SHA256 signature verification failed.',
      };
    }

    const uid = String(payload.user_id || payload.sub || '').trim();
    if (!uid || !/^[a-zA-Z0-9_:-]{1,128}$/.test(uid)) {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'MISSING_SUB_CLAIM',
        reason: 'Verified token is missing a valid sub/user_id claim.',
      };
    }

    return {
      valid: true,
      uid,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      emailVerified: Boolean(payload.email_verified),
    };
  } catch (err: any) {
    return {
      valid: false,
      uid: 'anonymous',
      errorCode: 'TOKEN_VERIFICATION_ERROR',
      reason: err?.message || 'Failed to cryptographically verify token.',
    };
  }
}
