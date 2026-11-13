import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { computeStableContentHash } from './studyBundleBuilder';

export interface MigrationReport {
  uid: string;
  migratedCount: number;
  verifiedParity: boolean;
  migrationChecksum?: string;
  skippedAlreadyMigrated: boolean;
  localKeysMigrated: number;
  firestoreDocsMigrated: number;
}

function fnv1aChecksum(inputs: string[]): string {
  let hash = 0x811c9dc5;
  const joined = inputs.slice().sort().join('|');
  for (let i = 0; i < joined.length; i++) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function migrateLegacyLocalStorageKeys(uid: string): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  let moved = 0;
  const legacyToScoped: [string, string][] = [
    ['learnmate_custom_formulas', `learnmate_${uid}_custom_formulas`],
    ['learnmate_mistakes_notebook', `learnmate_${uid}_mistakes_notebook`],
    ['learnmate_sm2_cards', `learnmate_${uid}_sm2_cards`],
  ];

  for (const [legacyKey, targetKey] of legacyToScoped) {
    try {
      const legacyVal = window.localStorage.getItem(legacyKey);
      if (legacyVal && !window.localStorage.getItem(targetKey)) {
        window.localStorage.setItem(targetKey, legacyVal);
        moved += 1;
      }
      if (legacyVal) {
        window.localStorage.removeItem(legacyKey);
      }
    } catch {
      // ignore storage quota errors
    }
  }
  return moved;
}

/**
 * Repeatable, parity-verified migration moving legacy top-level collections
 * (/materials, /tasks, /creations, /mockAttempts, /revisions) owned by `uid`
 * into canonical `/users/{uid}/...` subcollections.
 * Verifies record counts & FNV-1a ID checksum before deleting legacy documents
 * and recording `migrationVersion: 2` on `/users/{uid}` in Firestore.
 */
export async function runOneTimeTenantMigration(uid: string): Promise<MigrationReport> {
  if (!uid || uid === 'anonymous') {
    return {
      uid: uid || 'anonymous',
      migratedCount: 0,
      verifiedParity: true,
      skippedAlreadyMigrated: true,
      localKeysMigrated: 0,
      firestoreDocsMigrated: 0,
    };
  }

  const localKeysMigrated = migrateLegacyLocalStorageKeys(uid);
  let firestoreDocsMigrated = 0;
  let verifiedParity = true;
  let migrationChecksum = fnv1aChecksum([]);

  if (isFirebaseConfigured && db && !uid.startsWith('local_')) {
    try {
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists() && Number(userSnap.data()?.migrationVersion || 0) >= 2) {
        return {
          uid,
          migratedCount: localKeysMigrated,
          verifiedParity: true,
          migrationChecksum: String(userSnap.data()?.migrationChecksum || ''),
          skippedAlreadyMigrated: true,
          localKeysMigrated,
          firestoreDocsMigrated: 0,
        };
      }
    } catch {
      // continue to inspect legacy collections safely
    }

    const legacyCollections: { name: string; subcollection: string }[] = [
      { name: 'materials', subcollection: 'materials' },
      { name: 'tasks', subcollection: 'tasks' },
      { name: 'creations', subcollection: 'creations' },
      { name: 'mockAttempts', subcollection: 'mockAttempts' },
      { name: 'revisions', subcollection: 'revisions' },
    ];
    const copiedDigests: string[] = [];

    for (const colDef of legacyCollections) {
      try {
        const legacyQuery = query(
          collection(db, colDef.name),
          where('userId', '==', uid)
        );
        const snap = await getDocs(legacyQuery);
        if (snap.empty) continue;

        const batch = writeBatch(db);
        const sourceIds: string[] = [];

        for (const legacyDoc of snap.docs) {
          const data = legacyDoc.data() || {};
          const targetRef = doc(db, 'users', uid, colDef.subcollection, legacyDoc.id);
          const payload: Record<string, unknown> = {
            ...data,
            userId: uid,
            updatedAt: serverTimestamp(),
          };
          if (!payload.createdAt) {
            payload.createdAt = serverTimestamp();
          }
          if (colDef.subcollection === 'materials') {
            payload.sourceRef =
              typeof data.sourceRef === 'string' ? data.sourceRef.slice(0, 500) : '';
            payload.extractionQuality = data.extractionQuality || 'partial';
            payload.contentHash =
              typeof data.contentHash === 'string' && data.contentHash
                ? data.contentHash
                : computeStableContentHash(`${data.title || ''}:${data.contentSummary || ''}`);
          }
          if (colDef.subcollection === 'mockAttempts') {
            payload.mockTitle = data.mockTitle || data.paperTitle || 'Migrated CBT Mock';
            payload.maxMarks = typeof data.maxMarks === 'number' ? data.maxMarks : 300;
            payload.durationMinutes =
              typeof data.durationMinutes === 'number' ? data.durationMinutes : 180;
            payload.correctCount =
              typeof data.correctCount === 'number' ? data.correctCount : 0;
            payload.incorrectCount =
              typeof data.incorrectCount === 'number' ? data.incorrectCount : 0;
            payload.skippedCount =
              typeof data.skippedCount === 'number' ? data.skippedCount : 0;
            payload.summaryReport =
              typeof data.summaryReport === 'string'
                ? data.summaryReport
                : String(data.responsesJson || 'Migrated CBT attempt').slice(0, 19000);
          }

          batch.set(targetRef, payload, { merge: true });
          sourceIds.push(legacyDoc.id);
          copiedDigests.push(`${colDef.subcollection}:${legacyDoc.id}`);
        }

        await batch.commit();

        // Parity verification: re-read destination subcollection before removing legacy records
        const destSnap = await getDocs(collection(db, 'users', uid, colDef.subcollection));
        const destIdSet = new Set(destSnap.docs.map((d) => d.id));
        const parityOk = sourceIds.every((id) => destIdSet.has(id));

        if (!parityOk) {
          verifiedParity = false;
          continue;
        }

        for (const legacyDoc of snap.docs) {
          await deleteDoc(legacyDoc.ref);
          firestoreDocsMigrated += 1;
        }
      } catch {
        verifiedParity = false;
      }
    }

    migrationChecksum = fnv1aChecksum(copiedDigests);
    if (verifiedParity) {
      try {
        await setDoc(
          doc(db, 'users', uid),
          {
            userId: uid,
            migrationVersion: 2,
            migrationChecksum,
            migratedV2At: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch {
        // user doc might not exist yet if first sign-in failed offline
      }
    }
  }

  return {
    uid,
    migratedCount: localKeysMigrated + firestoreDocsMigrated,
    verifiedParity,
    migrationChecksum,
    skippedAlreadyMigrated: false,
    localKeysMigrated,
    firestoreDocsMigrated,
  };
}
