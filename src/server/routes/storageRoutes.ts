import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Router, Response } from 'express';
import { getStorage } from 'firebase-admin/storage';
import { AuthenticatedRequest } from '../middleware/authAndSecurity';
import { getInitializedAdminApp } from '../studentAuth';
import { createRouteRateLimiter } from '../middleware/rateLimiterAndQuotas';
import {
  adminDeleteDoc,
  adminGetDoc,
  adminListCollection,
  adminSetDoc,
} from '../persistence/firestoreAdminStore';

export const storageRouter = Router();

export interface CloudSyncedAssetMetadata {
  assetId: string;
  objectPath: string;
  uid: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'pending' | 'uploaded';
  updatedAtIso: string;
  createdAtIso: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
]);
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

const storageRateLimit = createRouteRateLimiter({
  maxPerMinute: 30,
  keyPrefix: 'storage',
  errorCode: 'STORAGE_RATE_LIMIT',
});

storageRouter.use(storageRateLimit);

export function isOwnerStoragePath(uid: string, objectPath: string): boolean {
  if (!uid || uid === 'anonymous') return false;
  const expectedPrefix = `users/${uid}/materials/`;
  if (!objectPath.startsWith(expectedPrefix)) return false;
  const rel = objectPath.slice(expectedPrefix.length);
  return Boolean(rel && !rel.includes('..') && !rel.includes('/') && !rel.includes('\\'));
}

function getConfiguredStorageBucket(): string {
  const envBucket = process.env.VITE_FIREBASE_STORAGE_BUCKET?.trim();
  if (envBucket && !/placeholder|example|your[_-]/i.test(envBucket)) {
    return envBucket;
  }
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (typeof parsed?.storageBucket === 'string' && parsed.storageBucket.trim()) {
        return parsed.storageBucket.trim();
      }
    }
  } catch {
    // ignore invalid optional config
  }
  return '';
}

export function getStorageConfigurationStatus() {
  const adminApp = getInitializedAdminApp();
  const bucket = getConfiguredStorageBucket();
  const configured = Boolean(adminApp && bucket);
  return {
    configured,
    storageProvider: configured ? 'firebase_storage_gcs' : 'local_only',
    bucket: configured ? bucket : null,
    message: configured
      ? `Firebase Cloud Storage (${bucket}) is connected with owner-verified V4 signed URLs.`
      : 'Cloud Storage bucket / Admin SDK credentials are not configured on this server. Materials persist locally in IndexedDB only.',
  };
}

storageRouter.get('/status', (_req: AuthenticatedRequest, res: Response) => {
  res.json(getStorageConfigurationStatus());
});

// Generate a real V4 signed upload/download URL with persistent Firestore metadata & existence checks
storageRouter.post('/signed-url', async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.userUid;
  if (!uid || uid === 'anonymous') {
    res.status(401).json({
      errorCode: 'AUTH_REQUIRED',
      message: 'Sign in required for cloud storage operations.',
      requestId: req.requestId,
    });
    return;
  }

  const {
    fileName = 'chapter-notes.pdf',
    mimeType = 'application/pdf',
    operation = 'upload',
    sizeBytes = 0,
    assetId: requestedAssetId,
  } = req.body || {};

  const safeMime = String(mimeType).toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES.has(safeMime)) {
    res.status(400).json({
      errorCode: 'UNSUPPORTED_MIME_TYPE',
      message: `MIME type "${safeMime}" is not allowed. Allowed: PDF, PNG, JPEG, WEBP, TXT.`,
      requestId: req.requestId,
    });
    return;
  }

  const parsedSize = Number(sizeBytes || 0);
  if (!Number.isFinite(parsedSize) || parsedSize < 0 || parsedSize > MAX_UPLOAD_BYTES) {
    res.status(400).json({
      errorCode: 'INVALID_FILE_SIZE',
      message: `File size must be between 0 and ${MAX_UPLOAD_BYTES} bytes (50 MB).`,
      requestId: req.requestId,
    });
    return;
  }

  if (operation !== 'upload' && operation !== 'download') {
    res.status(400).json({
      errorCode: 'INVALID_STORAGE_OPERATION',
      message: 'Operation must be "upload" or "download".',
      requestId: req.requestId,
    });
    return;
  }

  const safeName =
    String(fileName)
      .replace(/[/\\]+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 96) || 'material.pdf';

  const status = getStorageConfigurationStatus();
  const adminApp = getInitializedAdminApp();
  if (!status.configured || !adminApp || !status.bucket) {
    res.status(503).json({
      errorCode: 'CLOUD_STORAGE_NOT_CONFIGURED',
      storageProvider: 'local_only',
      message: status.message,
      requestId: req.requestId,
    });
    return;
  }

  try {
    const assetId =
      typeof requestedAssetId === 'string' && /^[a-zA-Z0-9_-]{4,80}$/.test(requestedAssetId)
        ? requestedAssetId
        : `asset_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

    let objectPath = `users/${uid}/materials/${assetId}_${safeName}`;
    if (operation === 'download' && requestedAssetId) {
      const stored = await adminGetDoc<CloudSyncedAssetMetadata>(
        `storage_assets/${uid}/items`,
        assetId
      );
      if (!stored) {
        res.status(404).json({
          errorCode: 'ASSET_NOT_FOUND',
          message: 'Requested storage asset was not found for this student account.',
          requestId: req.requestId,
        });
        return;
      }
      objectPath = stored.objectPath;
    }

    if (!isOwnerStoragePath(uid, objectPath)) {
      res.status(403).json({
        errorCode: 'STORAGE_OWNERSHIP_DENIED',
        message: 'Requested object path violates tenant ownership prefix.',
        requestId: req.requestId,
      });
      return;
    }

    const file = getStorage(adminApp).bucket(status.bucket).file(objectPath);

    if (operation === 'download') {
      const [exists] = await file.exists();
      if (!exists) {
        res.status(404).json({
          errorCode: 'OBJECT_NOT_IN_BUCKET',
          message: 'File has not been uploaded to Cloud Storage yet.',
          requestId: req.requestId,
        });
        return;
      }
    }

    const expiresAtMs = Date.now() + 15 * 60 * 1000;
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: operation === 'upload' ? 'write' : 'read',
      expires: expiresAtMs,
      ...(operation === 'upload' ? { contentType: safeMime } : {}),
    });

    const nowIso = new Date().toISOString();
    if (operation === 'upload') {
      const nextMeta: CloudSyncedAssetMetadata = {
        assetId,
        objectPath,
        uid,
        fileName: safeName,
        mimeType: safeMime,
        sizeBytes: parsedSize,
        status: 'pending',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      };
      await adminSetDoc(`storage_assets/${uid}/items`, assetId, nextMeta, true);
    }

    res.json({
      ok: true,
      storageConfigured: true,
      assetId,
      signedUrl,
      storageProvider: 'firebase_storage_gcs',
      bucket: status.bucket,
      objectPath,
      operation,
      expiresAtIso: new Date(expiresAtMs).toISOString(),
    });
  } catch (err: any) {
    res.status(err?.statusCode || 503).json({
      errorCode: err?.errorCode || 'STORAGE_SIGNING_FAILED',
      storageProvider: 'local_only',
      message: err?.message || 'Unable to generate V4 signed storage URL.',
      requestId: req.requestId,
    });
  }
});

// Verify GCS object actually exists before promoting asset metadata to uploaded
storageRouter.post('/confirm-upload', async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.userUid;
  if (!uid || uid === 'anonymous') {
    res.status(401).json({
      errorCode: 'AUTH_REQUIRED',
      message: 'Sign in required.',
      requestId: req.requestId,
    });
    return;
  }

  const assetId = String(req.body?.assetId || '').trim();
  if (!assetId) {
    res.status(400).json({
      errorCode: 'INVALID_ASSET_ID',
      message: 'assetId is required to confirm upload.',
      requestId: req.requestId,
    });
    return;
  }

  const status = getStorageConfigurationStatus();
  const adminApp = getInitializedAdminApp();
  if (!status.configured || !adminApp || !status.bucket) {
    res.status(503).json({
      errorCode: 'CLOUD_STORAGE_NOT_CONFIGURED',
      message: status.message,
      requestId: req.requestId,
    });
    return;
  }

  try {
    const asset = await adminGetDoc<CloudSyncedAssetMetadata>(
      `storage_assets/${uid}/items`,
      assetId
    );
    if (!asset || asset.uid !== uid || !isOwnerStoragePath(uid, asset.objectPath)) {
      res.status(404).json({
        errorCode: 'ASSET_NOT_FOUND',
        message: 'Upload asset record not found for this account.',
        requestId: req.requestId,
      });
      return;
    }

    const file = getStorage(adminApp).bucket(status.bucket).file(asset.objectPath);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({
        errorCode: 'OBJECT_NOT_IN_BUCKET',
        message: 'Object has not finished uploading to Cloud Storage.',
        requestId: req.requestId,
      });
      return;
    }

    const updated: CloudSyncedAssetMetadata = {
      ...asset,
      status: 'uploaded',
      updatedAtIso: new Date().toISOString(),
    };
    await adminSetDoc(`storage_assets/${uid}/items`, assetId, updated, true);
    res.json({ ok: true, asset: updated });
  } catch (err: any) {
    res.status(err?.statusCode || 503).json({
      errorCode: err?.errorCode || 'CONFIRM_UPLOAD_FAILED',
      message: err?.message || 'Unable to verify uploaded object.',
      requestId: req.requestId,
    });
  }
});

// Delete a user-owned Cloud Storage binary and its metadata record
storageRouter.delete('/assets/:assetId', async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.userUid;
  if (!uid || uid === 'anonymous') {
    res.status(401).json({
      errorCode: 'AUTH_REQUIRED',
      message: 'Sign in required.',
      requestId: req.requestId,
    });
    return;
  }

  const assetId = String(req.params?.assetId || '').trim();
  try {
    const asset = await adminGetDoc<CloudSyncedAssetMetadata>(
      `storage_assets/${uid}/items`,
      assetId
    );
    if (!asset || asset.uid !== uid || !isOwnerStoragePath(uid, asset.objectPath)) {
      res.status(404).json({
        errorCode: 'ASSET_NOT_FOUND',
        message: 'Storage asset not found for this student account.',
        requestId: req.requestId,
      });
      return;
    }

    const status = getStorageConfigurationStatus();
    const adminApp = getInitializedAdminApp();
    if (status.configured && adminApp && status.bucket) {
      await getStorage(adminApp)
        .bucket(status.bucket)
        .file(asset.objectPath)
        .delete({ ignoreNotFound: true });
    }

    await adminDeleteDoc(`storage_assets/${uid}/items`, assetId);
    res.json({ deleted: true, assetId });
  } catch (err: any) {
    res.status(err?.statusCode || 503).json({
      errorCode: err?.errorCode || 'DELETE_ASSET_FAILED',
      message: err?.message || 'Failed to delete storage asset.',
      requestId: req.requestId,
    });
  }
});

// List user's persisted cloud-synced study assets across devices
storageRouter.get('/assets', async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.userUid;
  if (!uid || uid === 'anonymous') {
    res.status(401).json({
      errorCode: 'AUTH_REQUIRED',
      message: 'Sign in required.',
      requestId: req.requestId,
    });
    return;
  }
  try {
    const assets = await adminListCollection<CloudSyncedAssetMetadata>(
      `storage_assets/${uid}/items`,
      100
    );
    res.json({
      uid,
      ...getStorageConfigurationStatus(),
      assets,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 503).json({
      errorCode: err?.errorCode || 'LIST_ASSETS_FAILED',
      message: err?.message || 'Unable to list persistent cloud storage assets.',
      requestId: req.requestId,
    });
  }
});
