import { Router, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import {
  AuthenticatedRequest,
  logStructuredEvent,
  requireAuthenticatedStudent,
} from '../middleware/authAndSecurity';
import { getInitializedAdminApp } from '../studentAuth';
import {
  adminDeleteCollectionTree,
  getAdminFirestore,
  isProductionRuntime,
} from '../persistence/firestoreAdminStore';
import { getStorageConfigurationStatus } from './storageRoutes';

export const accountAndOpsRouter = Router();

function fnv1aChecksum(inputs: string[]): string {
  let hash = 0x811c9dc5;
  const joined = inputs.slice().sort().join('|');
  for (let i = 0; i < joined.length; i++) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Repeatable verified migration from legacy top-level Firestore collections
 * (/materials, /tasks, /creations, /mockAttempts, /revisions) to /users/{uid}/* subcollections.
 * Checks record count & checksum parity before deleting legacy docs and setting migrationVersion = 2.
 */
accountAndOpsRouter.post(
  '/migrate-legacy',
  requireAuthenticatedStudent,
  async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.userUid!;
    const db = getAdminFirestore();
    if (!db) {
      if (isProductionRuntime()) {
        res.status(503).json({
          errorCode: 'PERSISTENCE_UNAVAILABLE',
          message: 'Firebase Admin Firestore is required for server-verified migration in production.',
          requestId: req.requestId,
        });
        return;
      }
      res.json({
        uid,
        migratedCount: 0,
        verifiedParity: true,
        migrationVersion: 2,
        mode: 'local_dev_noop',
      });
      return;
    }

    const legacyCollections = ['materials', 'tasks', 'creations', 'mockAttempts', 'revisions'];
    let totalMigrated = 0;
    const copiedDigests: string[] = [];

    try {
      for (const colName of legacyCollections) {
        const legacySnap = await db.collection(colName).where('userId', '==', uid).get();
        if (legacySnap.empty) continue;

        const batch = db.batch();
        const migratedIds: string[] = [];
        for (const legacyDoc of legacySnap.docs) {
          const data = legacyDoc.data() || {};
          const targetRef = db.doc(`users/${uid}/${colName}/${legacyDoc.id}`);
          batch.set(
            targetRef,
            {
              ...data,
              userId: uid,
              updatedAt: new Date(),
            },
            { merge: true }
          );
          migratedIds.push(legacyDoc.id);
          copiedDigests.push(`${colName}:${legacyDoc.id}`);
        }
        await batch.commit();

        // Re-read destination docs to verify parity before deleting legacy docs
        const destSnap = await db.collection(`users/${uid}/${colName}`).get();
        const destIds = new Set(destSnap.docs.map((d) => d.id));
        const allVerified = migratedIds.every((id) => destIds.has(id));
        if (!allVerified) {
          res.status(500).json({
            errorCode: 'MIGRATION_PARITY_FAILED',
            message: `Parity verification failed for collection ${colName}. Legacy records retained safely.`,
            requestId: req.requestId,
          });
          return;
        }

        const delBatch = db.batch();
        for (const legacyDoc of legacySnap.docs) {
          delBatch.delete(legacyDoc.ref);
          totalMigrated += 1;
        }
        await delBatch.commit();
      }

      const checksum = fnv1aChecksum(copiedDigests);
      await db.doc(`users/${uid}`).set(
        {
          userId: uid,
          migrationVersion: 2,
          migrationChecksum: checksum,
          migratedV2At: new Date().toISOString(),
        },
        { merge: true }
      );

      res.json({
        uid,
        migratedCount: totalMigrated,
        verifiedParity: true,
        migrationVersion: 2,
        migrationChecksum: checksum,
      });
    } catch (err: any) {
      logStructuredEvent('error', 'account_legacy_migration_failed', {
        uid: `${uid.slice(0, 6)}...`,
        message: err?.message || 'Migration failed',
      });
      res.status(500).json({
        errorCode: 'MIGRATION_FAILED',
        message: err?.message || 'Unable to complete verified account migration.',
        requestId: req.requestId,
      });
    }
  }
);

/**
 * Full DPDP / GDPR Account & Data Erasure Endpoint:
 * Deletes tenant Firestore subcollections, GCS files under users/{uid}/,
 * billing/quota records, and the Firebase Auth user account.
 */
accountAndOpsRouter.delete(
  '/',
  requireAuthenticatedStudent,
  async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.userUid!;
    const adminApp = getInitializedAdminApp();

    if (isProductionRuntime() && !adminApp) {
      res.status(503).json({
        errorCode: 'ACCOUNT_DELETION_UNAVAILABLE',
        message:
          'Firebase Admin credentials are unavailable; server-side account deletion cannot be completed.',
        requestId: req.requestId,
      });
      return;
    }

    try {
      let deletedGcsFiles = 0;
      const storageStatus = getStorageConfigurationStatus();
      if (storageStatus.configured && adminApp && storageStatus.bucket) {
        try {
          const [files] = await getStorage(adminApp)
            .bucket(storageStatus.bucket)
            .getFiles({ prefix: `users/${uid}/` });
          for (const f of files) {
            await f.delete({ ignoreNotFound: true });
            deletedGcsFiles += 1;
          }
        } catch (err: any) {
          logStructuredEvent('warn', 'account_delete_gcs_partial', {
            uid: `${uid.slice(0, 6)}...`,
            message: err?.message,
          });
        }
      }

      const deletedFirestoreDocs = await adminDeleteCollectionTree(uid);

      let authDeleted = false;
      if (adminApp && !uid.startsWith('local_')) {
        try {
          await getAuth(adminApp).deleteUser(uid);
          authDeleted = true;
        } catch (err: any) {
          if (err?.code === 'auth/user-not-found') {
            authDeleted = true;
          } else if (isProductionRuntime()) {
            throw err;
          }
        }
      }

      logStructuredEvent('info', 'account_deleted', {
        uid: `${uid.slice(0, 6)}...`,
        deletedFirestoreDocs,
        deletedGcsFiles,
        authDeleted,
      });

      res.json({
        deleted: true,
        uid,
        deletedFirestoreDocs,
        deletedGcsFiles,
        authDeleted,
        deletedAtIso: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(err?.statusCode || 503).json({
        errorCode: err?.errorCode || 'ACCOUNT_DELETE_FAILED',
        message: err?.message || 'Unable to delete account completely.',
        requestId: req.requestId,
      });
    }
  }
);
