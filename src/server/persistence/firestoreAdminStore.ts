import fs from 'fs';
import path from 'path';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getInitializedAdminApp } from '../studentAuth';

export class PersistenceUnavailableError extends Error {
  statusCode = 503;
  errorCode = 'PERSISTENCE_UNAVAILABLE';
  constructor(message = 'Persistent server database (Firebase Admin Firestore) is not configured in production.') {
    super(message);
    this.name = 'PersistenceUnavailableError';
  }
}

let cachedDbId: string | null | undefined;
function getConfiguredDatabaseId(): string | undefined {
  if (cachedDbId !== undefined) return cachedDbId || undefined;
  const fromEnv = process.env.VITE_FIREBASE_DATABASE_ID?.trim() || process.env.FIREBASE_DATABASE_ID?.trim();
  if (fromEnv && fromEnv !== '(default)') {
    cachedDbId = fromEnv;
    return fromEnv;
  }
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      const id = typeof parsed?.firestoreDatabaseId === 'string' ? parsed.firestoreDatabaseId.trim() : '';
      if (id && id !== '(default)') {
        cachedDbId = id;
        return id;
      }
    }
  } catch {
    // ignore invalid optional config
  }
  cachedDbId = '';
  return undefined;
}

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production';
}

export function getAdminFirestore(): Firestore | null {
  const adminApp = getInitializedAdminApp();
  if (!adminApp) return null;
  try {
    const dbId = getConfiguredDatabaseId();
    return dbId ? getFirestore(adminApp, dbId) : getFirestore(adminApp);
  } catch {
    return null;
  }
}

export function isAdminPersistenceReady(): boolean {
  return Boolean(getAdminFirestore());
}

/**
 * In-memory stores strictly limited to non-production development/test execution.
 * Production mode (`NODE_ENV === 'production'`) fails closed with 503 PERSISTENCE_UNAVAILABLE
 * whenever Firebase Admin Firestore is unavailable.
 */
const devMemoryStore = {
  docs: new Map<string, Record<string, any>>(),
};

function requireFirestoreOrDevMemory(env: NodeJS.ProcessEnv = process.env): Firestore | null {
  const db = getAdminFirestore();
  if (db) return db;
  if (isProductionRuntime(env)) {
    throw new PersistenceUnavailableError();
  }
  return null;
}

export async function adminGetDoc<T extends Record<string, any>>(
  collectionPath: string,
  docId: string
): Promise<T | null> {
  const db = requireFirestoreOrDevMemory();
  const fullKey = `${collectionPath}/${docId}`;
  if (!db) {
    const hit = devMemoryStore.docs.get(fullKey);
    return hit ? ({ ...hit } as T) : null;
  }
  const snap = await db.doc(fullKey).get();
  return snap.exists ? (snap.data() as T) : null;
}

export async function adminSetDoc(
  collectionPath: string,
  docId: string,
  data: Record<string, any>,
  merge = true
): Promise<void> {
  const db = requireFirestoreOrDevMemory();
  const fullKey = `${collectionPath}/${docId}`;
  if (!db) {
    const existing = merge ? devMemoryStore.docs.get(fullKey) || {} : {};
    devMemoryStore.docs.set(fullKey, { ...existing, ...data });
    return;
  }
  await db.doc(fullKey).set(data, { merge });
}

export async function adminDeleteDoc(collectionPath: string, docId: string): Promise<void> {
  const db = requireFirestoreOrDevMemory();
  const fullKey = `${collectionPath}/${docId}`;
  if (!db) {
    devMemoryStore.docs.delete(fullKey);
    return;
  }
  await db.doc(fullKey).delete();
}

export async function adminListCollection<T extends Record<string, any>>(
  collectionPath: string,
  limitCount = 100
): Promise<Array<T & { id: string }>> {
  const db = requireFirestoreOrDevMemory();
  if (!db) {
    const prefix = `${collectionPath}/`;
    const out: Array<T & { id: string }> = [];
    for (const [k, v] of devMemoryStore.docs.entries()) {
      if (k.startsWith(prefix)) {
        const rest = k.slice(prefix.length);
        if (!rest.includes('/')) {
          out.push({ id: rest, ...(v as T) });
        }
      }
    }
    return out.slice(0, limitCount);
  }
  const snap = await db.collection(collectionPath).limit(limitCount).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
}

export async function adminDeleteCollectionTree(uid: string): Promise<number> {
  const db = requireFirestoreOrDevMemory();
  let deleted = 0;

  if (!db) {
    const prefixes = [
      `users/${uid}/`,
      `storage_assets/${uid}/`,
      `billing_entitlements/${uid}`,
      `billing_invoices/${uid}/`,
    ];
    for (const key of Array.from(devMemoryStore.docs.keys())) {
      if (
        key === `users/${uid}` ||
        prefixes.some((p) => key.startsWith(p)) ||
        key.includes(`_${uid}`)
      ) {
        devMemoryStore.docs.delete(key);
        deleted += 1;
      }
    }
    return deleted;
  }

  const subcollections = [
    'materials',
    'tasks',
    'creations',
    'mockAttempts',
    'revisions',
    'flashcards',
    'studyJobs',
    'cbtDrafts',
    'entitlements',
    'billingEvents',
  ];

  for (const sub of subcollections) {
    const snap = await db.collection(`users/${uid}/${sub}`).get();
    for (const d of snap.docs) {
      if (sub === 'materials') {
        const chunksSnap = await db.collection(`users/${uid}/materials/${d.id}/chunks`).get();
        for (const c of chunksSnap.docs) {
          await c.ref.delete();
          deleted += 1;
        }
      }
      await d.ref.delete();
      deleted += 1;
    }
  }

  const assetSnap = await db.collection(`storage_assets/${uid}/items`).get();
  for (const a of assetSnap.docs) {
    await a.ref.delete();
    deleted += 1;
  }

  const invSnap = await db.collection(`billing_invoices/${uid}/items`).get();
  for (const inv of invSnap.docs) {
    await inv.ref.delete();
    deleted += 1;
  }

  await db.doc(`billing_entitlements/${uid}`).delete().catch(() => {});
  await db.doc(`users/${uid}`).delete().catch(() => {});
  deleted += 1;

  return deleted;
}

export async function adminRunDailyQuotaIncrement(params: {
  uid: string;
  dayIso: string;
  tier: 'free' | 'pro' | 'institute';
  maxRequestsPerDay: number;
  maxTokensPerDay: number;
  estimatedTokens: number;
}): Promise<{
  allowed: boolean;
  requestsUsed: number;
  tokensUsed: number;
}> {
  const db = requireFirestoreOrDevMemory();
  const docKey = `daily_usage_quotas/${params.dayIso}_${params.uid}`;

  if (!db) {
    const existing = devMemoryStore.docs.get(docKey);
    const used = existing && existing.dayIso === params.dayIso ? Number(existing.requestsUsed || 0) : 0;
    const tokUsed = existing && existing.dayIso === params.dayIso ? Number(existing.tokensUsed || 0) : 0;
    if (used + 1 > params.maxRequestsPerDay) {
      return { allowed: false, requestsUsed: used, tokensUsed: tokUsed };
    }
    const nextUsed = used + 1;
    const nextTok = tokUsed + params.estimatedTokens;
    devMemoryStore.docs.set(docKey, {
      uid: params.uid,
      dayIso: params.dayIso,
      tier: params.tier,
      requestsUsed: nextUsed,
      tokensUsed: nextTok,
      updatedAtIso: new Date().toISOString(),
    });
    return { allowed: true, requestsUsed: nextUsed, tokensUsed: nextTok };
  }

  const docRef = db.doc(docKey);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.exists ? snap.data() || {} : {};
    const used = data.dayIso === params.dayIso ? Number(data.requestsUsed || 0) : 0;
    const tokUsed = data.dayIso === params.dayIso ? Number(data.tokensUsed || 0) : 0;
    if (used + 1 > params.maxRequestsPerDay) {
      return { allowed: false, requestsUsed: used, tokensUsed: tokUsed };
    }
    const nextUsed = used + 1;
    const nextTok = tokUsed + params.estimatedTokens;
    tx.set(
      docRef,
      {
        uid: params.uid,
        dayIso: params.dayIso,
        tier: params.tier,
        requestsUsed: nextUsed,
        tokensUsed: nextTok,
        updatedAtIso: new Date().toISOString(),
      },
      { merge: true }
    );
    return { allowed: true, requestsUsed: nextUsed, tokensUsed: nextTok };
  });
}

export function resetDevPersistenceMemoryForTest(): void {
  devMemoryStore.docs.clear();
}
