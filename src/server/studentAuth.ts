import crypto from 'crypto';
import { getApps, initializeApp, cert, App as FirebaseAdminApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export interface TokenVerificationResult {
  valid: boolean;
  uid: string;
  email?: string;
  isDevBypass?: boolean;
  errorCode?: string;
  reason?: string;
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: Record<string, string> | null = null;
let cachedCertsExpiresAt = 0;

function getInitializedAdminApp(): FirebaseAdminApp | null {
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
    return initializeApp({
      credential: cert(parsed),
      projectId: parsed.project_id,
    });
  } catch {
    return null;
  }
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
 * - Never trusts unverified base64 JWT payloads.
 * - Rejects `local_token_*` in production with UNAUTHORIZED_DEV_TOKEN_IN_PROD.
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

    const allowDevBypass =
      env.NODE_ENV === 'development' && env.ALLOW_DEV_AUTH_BYPASS === 'true';
    if (!allowDevBypass) {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'DEV_AUTH_BYPASS_DISABLED',
        reason:
          'local_token_ requires NODE_ENV=development and ALLOW_DEV_AUTH_BYPASS=true.',
      };
    }

    const extractedUid = clean.replace(/^local_token_/, '').trim() || 'dev_scholar';
    return {
      valid: true,
      uid: extractedUid.slice(0, 64),
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
  if (adminApp) {
    try {
      const decoded = await getAuth(adminApp).verifyIdToken(clean, true);
      return {
        valid: true,
        uid: decoded.uid,
        email: decoded.email,
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

  // Path 2: Cryptographic RS256 signature verification against Google SecureToken x509 certificates
  try {
    const headerJson = Buffer.from(parts[0], 'base64url').toString('utf-8');
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
    const header = JSON.parse(headerJson);
    const payload = JSON.parse(payloadJson);

    if (header.alg !== 'RS256' || !header.kid) {
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

    const expectedProjectId =
      env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || '';
    if (expectedProjectId) {
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
    if (!uid) {
      return {
        valid: false,
        uid: 'anonymous',
        errorCode: 'MISSING_SUB_CLAIM',
        reason: 'Verified token is missing sub/user_id claim.',
      };
    }

    return {
      valid: true,
      uid,
      email: payload.email,
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
