import cors from 'cors';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import http from 'http';
import { verifyStudentToken } from '../studentAuth';

export interface AuthenticatedRequest extends Request {
  userUid?: string;
  userEmail?: string;
  clientFingerprint?: string;
  isDevBypass?: boolean;
}

export function getClientIp(req: http.IncomingMessage | Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export function computeRequestFingerprint(
  req: http.IncomingMessage | Request,
  uid: string
): string {
  const ip = getClientIp(req);
  const safeUid = (uid || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return `${ip}:${safeUid}`;
}

export function isOriginAllowed(
  origin: string | undefined,
  configuredOrigins: string[] = []
): boolean {
  if (!origin) return true;
  if (
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.endsWith('.run.app') ||
    origin.endsWith('.onrender.com') ||
    configuredOrigins.includes(origin)
  ) {
    return true;
  }
  return false;
}

export function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  });
}

export function createCorsMiddleware() {
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, configuredOrigins)) {
        callback(null, true);
      } else {
        callback(new Error('Origin not allowed by LearnMate JEE CORS policy'));
      }
    },
    credentials: true,
  });
}

export async function authenticateStudentMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const isProd = process.env.NODE_ENV === 'production';

  if (authHeader) {
    const clean = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (isProd && clean.startsWith('local_token_')) {
      res.status(401).json({
        error: 'UNAUTHORIZED_DEV_TOKEN_IN_PROD',
        errorCode: 'UNAUTHORIZED_DEV_TOKEN_IN_PROD',
        message: 'Development bypass tokens are prohibited in production.',
        retryAfterSeconds: 0,
      });
      return;
    }

    const verification = await verifyStudentToken(authHeader);
    if (!verification.valid) {
      if (
        isProd ||
        verification.errorCode === 'UNAUTHORIZED_DEV_TOKEN_IN_PROD' ||
        Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
      ) {
        res.status(401).json({
          error: verification.errorCode || 'UNAUTHORIZED_TOKEN',
          errorCode: verification.errorCode || 'UNAUTHORIZED_TOKEN',
          message: verification.reason || 'Invalid or expired authentication token.',
          retryAfterSeconds: 0,
        });
        return;
      }
    }

    const uid = verification.valid ? verification.uid : 'guest_scholar';
    req.userUid = uid;
    req.userEmail = verification.email;
    req.isDevBypass = verification.isDevBypass;
    req.clientFingerprint = computeRequestFingerprint(req, uid);
    next();
    return;
  }

  const customUidHeader = req.headers['x-learnmate-uid'];
  const fallbackUid =
    !isProd && typeof customUidHeader === 'string' && customUidHeader.trim()
      ? customUidHeader.trim().slice(0, 64)
      : 'anonymous';

  req.userUid = fallbackUid;
  req.clientFingerprint = computeRequestFingerprint(req, fallbackUid);
  next();
}
