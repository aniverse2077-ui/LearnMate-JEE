import crypto from 'crypto';
import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authAndSecurity';

export const storageRouter = Router();

interface CloudSyncedAssetMetadata {
  objectPath: string;
  uid: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  updatedAtIso: string;
}

const cloudAssetRegistry = new Map<string, CloudSyncedAssetMetadata[]>();

// Generate a signed upload/download descriptor for cross-device PDF & material sync
storageRouter.post('/signed-url', (req: AuthenticatedRequest, res: Response) => {
  const uid = req.userUid || 'anonymous';
  const {
    fileName = 'chapter-notes.pdf',
    mimeType = 'application/pdf',
    operation = 'upload',
    sizeBytes = 0,
  } = req.body || {};

  const safeName = String(fileName)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 96);
  const bucket =
    process.env.VITE_FIREBASE_STORAGE_BUCKET || 'learnmate-jee-cloud-storage.appspot.com';
  const objectPath = `users/${uid}/materials/${safeName}`;
  const expiresAtSec = Math.floor(Date.now() / 1000) + 900; // 15-minute signed URL TTL
  const signature = crypto
    .createHmac('sha256', process.env.FIREBASE_SERVICE_ACCOUNT_JSON || 'learnmate-storage-signing-key')
    .update(`${operation}:${bucket}:${objectPath}:${expiresAtSec}`)
    .digest('hex');

  const signedUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
    bucket
  )}/o/${encodeURIComponent(objectPath)}?alt=media&expires=${expiresAtSec}&sig=${signature}`;

  if (operation === 'upload') {
    const existing = cloudAssetRegistry.get(uid) || [];
    const nextMeta: CloudSyncedAssetMetadata = {
      objectPath,
      uid,
      fileName: safeName,
      mimeType: String(mimeType),
      sizeBytes: Number(sizeBytes || 0),
      updatedAtIso: new Date().toISOString(),
    };
    cloudAssetRegistry.set(uid, [
      nextMeta,
      ...existing.filter((item) => item.objectPath !== objectPath),
    ]);
  }

  res.json({
    signedUrl,
    bucket,
    objectPath,
    operation,
    expiresAtIso: new Date(expiresAtSec * 1000).toISOString(),
  });
});

// List user's cloud-synced study assets across devices
storageRouter.get('/assets', (req: AuthenticatedRequest, res: Response) => {
  const uid = req.userUid || 'anonymous';
  res.json({
    uid,
    assets: cloudAssetRegistry.get(uid) || [],
  });
});
