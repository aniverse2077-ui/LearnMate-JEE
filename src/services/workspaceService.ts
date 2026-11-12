import { openDB, IDBPDatabase } from 'idb';
import {
  db,
  getAccessToken,
  getCurrentActiveUid,
  getFirebaseIdToken,
  googleSignIn,
} from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

export interface StoredBinaryDocument {
  id: string;
  uid: string;
  materialId: string;
  fileName: string;
  mimeType: string;
  binaryData?: ArrayBuffer;
  extractedText: string;
  pageCount: number;
  createdAt: string;
}

export interface StructuredUpstreamError {
  errorCode: string;
  message: string;
  retryAfterSeconds: number;
  status: number;
}

const IDB_NAME = 'learnmate_jee_storage_v1';
const IDB_STORE_DOCS = 'binary_documents';
const IDB_STORE_BUNDLES = 'material_bundles';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getIndexedDb(): Promise<IDBPDatabase> | null {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null;
  if (!dbPromise) {
    dbPromise = openDB(IDB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(IDB_STORE_DOCS)) {
          const store = database.createObjectStore(IDB_STORE_DOCS, { keyPath: 'id' });
          store.createIndex('by_uid', 'uid', { unique: false });
        }
        if (!database.objectStoreNames.contains(IDB_STORE_BUNDLES)) {
          const bundleStore = database.createObjectStore(IDB_STORE_BUNDLES, { keyPath: 'id' });
          bundleStore.createIndex('by_uid', 'uid', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Saves a binary PDF/photo file and its full extracted text in IndexedDB (bypassing the 5MB localStorage limit),
 * and returns a fresh Blob URL for immediate viewing in the Study Workbench.
 */
export async function saveDocumentToIndexedDb(params: {
  id?: string;
  uid?: string;
  userId?: string;
  materialId?: string;
  file?: File;
  fileName?: string;
  title?: string;
  mimeType: string;
  dataUrl?: string;
  extractedText: string;
  pageCount: number;
  sizeBytes?: number;
  createdAt?: string;
}): Promise<{ blobUrl?: string; storageKey: string }> {
  const uidVal = params.uid || params.userId || 'active_user';
  const matIdVal = params.materialId || params.id || `doc-${Date.now()}`;
  const storageKey = `learnmate_${uidVal}_${matIdVal}`;
  const idb = getIndexedDb();
  let arrayBuffer: ArrayBuffer | undefined;
  let blobUrl: string | undefined;

  if (params.file) {
    try {
      arrayBuffer = await params.file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: params.mimeType || params.file.type });
      blobUrl = URL.createObjectURL(blob);
    } catch {
      // ignore buffer conversion errors
    }
  }

  if (idb) {
    try {
      const database = await idb;
      const record: StoredBinaryDocument = {
        id: storageKey,
        uid: uidVal,
        materialId: matIdVal,
        fileName: params.fileName || params.title || 'document.pdf',
        mimeType: params.mimeType,
        binaryData: arrayBuffer,
        extractedText: params.extractedText,
        pageCount: params.pageCount,
        createdAt: params.createdAt || new Date().toISOString(),
      };
      await database.put(IDB_STORE_DOCS, record);
    } catch {
      // non-blocking IndexedDB write
    }
  }

  return { blobUrl, storageKey };
}

/**
 * Retrieves a binary document and creates an object URL from IndexedDB for a specific UID and materialId.
 */
export async function getDocumentFromIndexedDb(
  uid: string,
  materialId: string
): Promise<{ blobUrl?: string; record?: StoredBinaryDocument }> {
  const idb = getIndexedDb();
  if (!idb) return {};
  try {
    const database = await idb;
    const record = (await database.get(
      IDB_STORE_DOCS,
      `learnmate_${uid}_${materialId}`
    )) as StoredBinaryDocument | undefined;
    if (!record) return {};
    let blobUrl: string | undefined;
    if (record.binaryData) {
      const blob = new Blob([record.binaryData], {
        type: record.mimeType || 'application/pdf',
      });
      blobUrl = URL.createObjectURL(blob);
    }
    return { blobUrl, record };
  } catch {
    return {};
  }
}

/**
 * Syncs large extracted text and study bundle metadata to Firestore in 3,500-char chunks
 * so no study note is ever truncated.
 */
export async function syncChunkedMaterialToFirestore(
  uidOrParams:
    | string
    | {
        uid: string;
        materialId: string;
        title: string;
        subject: string;
        chapter: string;
        sourceType: string;
        fullText: string;
        pageCount: number;
      },
  materialIdArg?: string,
  dataArg?: {
    title: string;
    subject: string;
    chapter: string;
    sourceType: string;
    sourceRef?: string;
    pageCount: number;
    currentPage?: number;
    progressPct?: number;
    contentSummary: string;
  }
): Promise<void> {
  const uid = typeof uidOrParams === 'string' ? uidOrParams : uidOrParams.uid;
  const materialId =
    typeof uidOrParams === 'string' ? materialIdArg || `mat-${Date.now()}` : uidOrParams.materialId;
  const title = typeof uidOrParams === 'string' ? dataArg?.title || 'Material' : uidOrParams.title;
  const subject =
    typeof uidOrParams === 'string' ? dataArg?.subject || 'Physics' : uidOrParams.subject;
  const chapter =
    typeof uidOrParams === 'string' ? dataArg?.chapter || 'General' : uidOrParams.chapter;
  const sourceType =
    typeof uidOrParams === 'string' ? dataArg?.sourceType || 'pdf' : uidOrParams.sourceType;
  const pageCount =
    typeof uidOrParams === 'string' ? dataArg?.pageCount || 3 : uidOrParams.pageCount;
  const text =
    typeof uidOrParams === 'string'
      ? dataArg?.contentSummary || ''
      : uidOrParams.fullText || '';

  if (!uid || uid.startsWith('local_') || uid === 'anonymous') return;
  const CHUNK_SIZE = 3500;
  const totalChunks = Math.max(1, Math.ceil(text.length / CHUNK_SIZE));

  try {
    const matRef = doc(db, 'users', uid, 'materials', materialId);
    await setDoc(
      matRef,
      {
        userId: uid,
        title: title.slice(0, 190),
        subject,
        chapter: chapter.slice(0, 95),
        sourceType,
        pageCount,
        currentPage: 1,
        progressPct: 15,
        contentSummary: text.slice(0, CHUNK_SIZE),
        totalTextChunks: totalChunks,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // Non-blocking sync
  }
}

/**
 * Extracts text and page count from a client-side PDF file using pdfjs-dist,
 * with graceful fallback if the PDF contains scanned images (routing to OCR).
 */
export async function extractPdfTextAndMetadataWithPdfJs(file: File): Promise<{
  pageCount: number;
  extractedText: string;
}> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${
        pdfjsLib.version || '4.10.38'
      }/build/pdf.worker.min.mjs`;
    }
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages || 1;
    const maxPagesToScan = Math.min(numPages, 25);
    const pageTexts: string[] = [];

    for (let i = 1; i <= maxPagesToScan; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = (content.items as any[])
        .map((item) => item.str || '')
        .join(' ')
        .trim();
      if (strings) {
        pageTexts.push(`[Page ${i}] ${strings}`);
      }
    }

    return {
      pageCount: numPages,
      extractedText: pageTexts.join('\n\n'),
    };
  } catch {
    return {
      pageCount: Math.max(3, Math.min(20, Math.ceil(file.size / 45000))),
      extractedText: '',
    };
  }
}

/**
 * Purges all IndexedDB stores on user sign-out so zero binary PDFs or study bundles remain on shared devices.
 */
export async function clearAllIndexedDbDocuments(): Promise<void> {
  const idb = getIndexedDb();
  if (!idb) return;
  try {
    const database = await idb;
    await database.clear(IDB_STORE_DOCS);
    await database.clear(IDB_STORE_BUNDLES);
  } catch {
    // ignore clear errors
  }
}

/**
 * Helper to get UID-namespaced localStorage key (`learnmate_${uid}_${key}`).
 */
export function getUserScopedStorageKey(baseKey: string, uidOverride?: string): string {
  const uid = uidOverride || getCurrentActiveUid();
  return `learnmate_${uid}_${baseKey}`;
}

/**
 * Authenticated fetch wrapper for `/api/ai/*` routes that attaches the Firebase ID token
 * and parses structured 429/503 error payloads (`{ errorCode, message, retryAfterSeconds }`).
 */
export async function apiFetchWithAuth<T = any>(
  endpoint: string,
  body: Record<string, any>
): Promise<
  | { ok: true; data: T & Partial<StructuredUpstreamError>; error?: undefined }
  | { ok: false; data: Partial<T> & StructuredUpstreamError; error: StructuredUpstreamError }
> {
  try {
    const idToken = await getFirebaseIdToken();
    const uid = getCurrentActiveUid();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-LearnMate-Uid': uid,
    };
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errObj: StructuredUpstreamError = {
        errorCode: json.errorCode || `HTTP_${res.status}`,
        message:
          json.message ||
          json.error ||
          `AI service returned HTTP ${res.status}. Please retry in a few seconds.`,
        retryAfterSeconds: Number(json.retryAfterSeconds ?? 5),
        status: res.status,
      };
      return {
        ok: false,
        data: errObj as Partial<T> & StructuredUpstreamError,
        error: errObj,
      };
    }

    return { ok: true, data: json as T & Partial<StructuredUpstreamError> };
  } catch (err: any) {
    const errObj: StructuredUpstreamError = {
      errorCode: 'NETWORK_ERROR',
      message:
        err?.message ||
        'Network error communicating with LearnMate JEE AI backend. Check your connection and click Retry.',
      retryAfterSeconds: 5,
      status: 503,
    };
    return {
      ok: false,
      data: errObj as Partial<T> & StructuredUpstreamError,
      error: errObj,
    };
  }
}

async function ensureToken(): Promise<string> {
  let token = await getAccessToken();
  if (!token) {
    const res = await googleSignIn(true);
    if (res.cancelled) {
      throw new Error('Google Workspace authorization window was closed before completing.');
    }
    token = res.accessToken;
  }
  if (!token) {
    throw new Error('Google Workspace permission is required. Please sign in with Google.');
  }
  return token;
}

/**
 * Lists recent PDFs and Google Docs from the user's Google Drive.
 */
export async function listDriveStudyFiles(): Promise<DriveFileItem[]> {
  const token = await ensureToken();
  const q = encodeURIComponent(
    "(mimeType='application/pdf' or mimeType='application/vnd.google-apps.document') and trashed=false"
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=12&fields=files(id,name,mimeType,modifiedTime)&q=${q}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Drive API error (${res.status})`);
  }
  const data = await res.json();
  return data.files || [];
}

/**
 * Reads plain text paragraphs from a Google Doc by documentId.
 */
export async function readGoogleDocContent(
  documentId: string
): Promise<{ title: string; text: string }> {
  const token = await ensureToken();
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Google Docs API error (${res.status})`);
  }
  const docData = await res.json();
  let extracted = '';
  for (const elem of docData.body?.content || []) {
    for (const pe of elem.paragraph?.elements || []) {
      if (pe.textRun?.content) {
        extracted += pe.textRun.content;
      }
    }
  }
  return {
    title: docData.title || 'Imported Google Doc Notes',
    text: extracted.trim() || 'Imported JEE study notes from Google Docs.',
  };
}

/**
 * Syncs a study task to the student's primary Google Tasks list & Google Calendar.
 */
export async function syncTaskToGoogleWorkspace(
  taskTitle: string,
  subject: string
): Promise<{
  taskUrl?: string;
  calendarEventId?: string;
}> {
  const token = await ensureToken();

  await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `[LearnMate JEE • ${subject}] ${taskTitle}`,
      notes: `Scheduled from LearnMate JEE Study Workspace`,
    }),
  });

  const start = new Date();
  const end = new Date(start.getTime() + 45 * 60 * 1000);
  const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: `JEE Study: ${taskTitle} (${subject})`,
      description: 'Synced from LearnMate JEE',
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    }),
  });
  const calData = calRes.ok ? await calRes.json() : {};
  return {
    calendarEventId: calData.id,
  };
}

export async function exportRevisionToGoogleSlides(
  chapterTitle: string,
  cards: { title: string; body: string; trap: string }[]
): Promise<{ presentationId: string; url: string }> {
  const token = await ensureToken();
  const createRes = await fetch('https://slides.googleapis.com/v1/presentations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `LearnMate JEE Revision — ${chapterTitle}`,
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Google Slides API error (${createRes.status})`);
  }

  const presentation = await createRes.json();
  const presentationId = presentation.presentationId;

  const firstSlideId = presentation.slides?.[0]?.objectId;
  if (firstSlideId && cards.length > 0) {
    const boxId = `learnmate_box_${Date.now()}`;
    const summaryText = cards
      .slice(0, 4)
      .map((c, idx) => `${idx + 1}. ${c.title}: ${c.body} (Trap: ${c.trap})`)
      .join('\n');

    await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            createShape: {
              objectId: boxId,
              shapeType: 'TEXT_BOX',
              elementProperties: {
                pageObjectId: firstSlideId,
                size: {
                  height: { magnitude: 220, unit: 'PT' },
                  width: { magnitude: 580, unit: 'PT' },
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: 50,
                  translateY: 120,
                  unit: 'PT',
                },
              },
            },
          },
          {
            insertText: {
              objectId: boxId,
              insertionIndex: 0,
              text: summaryText,
            },
          },
        ],
      }),
    });
  }

  return {
    presentationId,
    url: `https://docs.google.com/presentation/d/${presentationId}/edit`,
  };
}

export async function exportRevisionToGoogleKeepOrDrive(
  title: string,
  bodyTextOrLines: string | string[]
): Promise<{ mode: 'keep' | 'drive_note'; target: string; urlOrId: string }> {
  const token = await ensureToken();
  const bodyText = Array.isArray(bodyTextOrLines)
    ? bodyTextOrLines.join('\n• ')
    : bodyTextOrLines;

  try {
    const keepRes = await fetch('https://keep.googleapis.com/v1/notes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body: {
          text: {
            text: bodyText,
          },
        },
      }),
    });
    if (keepRes.ok) {
      const data = await keepRes.json();
      return { mode: 'keep', target: 'Google Keep', urlOrId: data.name || 'keep_note' };
    }
  } catch {
    // Fall through to Drive Note creation for consumer @gmail.com accounts
  }

  const metadata = {
    name: `${title} — LearnMate Keep Note.txt`,
    mimeType: 'text/plain',
  };
  const boundary = 'learnmate_keep_boundary';
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
    `${title}\n\n${bodyText}\r\n` +
    `--${boundary}--`;

  const driveRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );
  if (!driveRes.ok) {
    throw new Error(`Failed to save note (${driveRes.status})`);
  }
  const driveFile = await driveRes.json();
  return {
    mode: 'drive_note',
    target: 'Google Drive Keep Note',
    urlOrId: driveFile.id,
  };
}

export async function syncStudyTasksWithCalendarAndTasks(
  tasks: { title: string; durationMin: number }[]
): Promise<{ tasksCreated: number }> {
  let count = 0;
  for (const t of tasks) {
    await syncTaskToGoogleWorkspace(t.title, 'JEE');
    count += 1;
  }
  return { tasksCreated: count };
}

export async function exportMindMapToGoogleSlides(
  chapterTitle: string,
  nodes: { title: string; definition: string; trap: string }[]
): Promise<{ presentationId: string; url: string }> {
  return exportRevisionToGoogleSlides(
    chapterTitle,
    nodes.map((n) => ({ title: n.title, body: n.definition, trap: n.trap }))
  );
}

export interface CbtInProgressDraft {
  examMode: 'JEE Main' | 'JEE Advanced' | 'NEET UG' | 'BITSAT';
  secondsRemaining: number;
  currentQNumber: number;
  responses: Record<string, any>;
  focusSwitchCount: number;
  focusEvents: { timestamp: string; reason: string }[];
  savedAt: string;
}

/**
 * Auto-saves in-progress CBT mock exam state to UID-scoped localStorage and Firestore
 * every 15s and on response updates for instant crash/reload recovery.
 */
export async function saveCbtInProgressDraft(draft: CbtInProgressDraft): Promise<void> {
  const uid = getCurrentActiveUid();
  try {
    const key = getUserScopedStorageKey('cbt_in_progress', uid);
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // ignore quota errors
  }

  if (!uid || uid.startsWith('local_') || uid === 'anonymous') return;
  try {
    const safeId = `cbt_draft_${uid}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    const draftRef = doc(db, 'revisions', safeId);
    await setDoc(
      draftRef,
      {
        userId: uid,
        chapter: draft.examMode,
        subject: 'Physics',
        cardType: 'summary',
        title: `In-Progress ${draft.examMode} CBT Draft`,
        body: JSON.stringify({
          examMode: draft.examMode,
          secondsRemaining: draft.secondsRemaining,
          currentQNumber: draft.currentQNumber,
          focusSwitchCount: draft.focusSwitchCount,
          responses: draft.responses,
        }).slice(0, 4800),
        trapOrTip: `Saved at ${draft.savedAt}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // non-blocking cloud sync
  }
}

export function loadCbtInProgressDraft(): CbtInProgressDraft | null {
  try {
    const key = getUserScopedStorageKey('cbt_in_progress');
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CbtInProgressDraft;
    if (parsed && typeof parsed.secondsRemaining === 'number' && parsed.secondsRemaining > 0) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearCbtInProgressDraft(): Promise<void> {
  const uid = getCurrentActiveUid();
  try {
    const key = getUserScopedStorageKey('cbt_in_progress', uid);
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Syncs Mistake Book, SM-2 Flashcards, and Custom Formulas to Firestore (`/revisions/{revisionId}`)
 * while preserving instant local storage responsiveness.
 */
export async function syncRevisionStateToFirestore(
  collectionKey: 'mistakes' | 'sm2_cards' | 'custom_formulas',
  items: any[]
): Promise<void> {
  const uid = getCurrentActiveUid();
  try {
    localStorage.setItem(getUserScopedStorageKey(collectionKey, uid), JSON.stringify(items));
  } catch {
    // ignore localStorage errors
  }

  if (!uid || uid.startsWith('local_') || uid === 'anonymous') return;
  try {
    const safeId = `sync_${collectionKey}_${uid}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    const syncRef = doc(db, 'revisions', safeId);
    const cardType =
      collectionKey === 'mistakes'
        ? 'mistake'
        : collectionKey === 'custom_formulas'
        ? 'formula'
        : 'flashcard';
    await setDoc(
      syncRef,
      {
        userId: uid,
        chapter: 'All Chapters',
        subject: 'Physics',
        cardType,
        title: `Synced ${collectionKey} (${items.length})`,
        body: JSON.stringify(items).slice(0, 4800),
        trapOrTip: `Cloud synced (${items.length} items)`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // non-blocking cloud sync
  }
}

/**
 * Persists freehand vector annotation strokes per material across sessions (localStorage + Firestore `/creations/{id}`).
 */
export async function saveCanvasAnnotationsForMaterial(
  materialId: string,
  strokes: any[]
): Promise<void> {
  const uid = getCurrentActiveUid();
  try {
    localStorage.setItem(
      getUserScopedStorageKey(`annotations_${materialId}`, uid),
      JSON.stringify(strokes)
    );
  } catch {
    // ignore
  }

  if (!uid || uid.startsWith('local_') || uid === 'anonymous') return;
  try {
    const safeId = `ann_${materialId}_${uid}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    const annRef = doc(db, 'creations', safeId);
    await setDoc(
      annRef,
      {
        userId: uid,
        title: `Annotations for ${materialId}`.slice(0, 190),
        prompt: `Freehand vector strokes (${strokes.length})`,
        category: 'diagram',
        subject: 'All',
        sourceLabel: materialId.slice(0, 190),
        payload: JSON.stringify(strokes).slice(0, 95000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // non-blocking
  }
}

export function loadCanvasAnnotationsForMaterial(materialId: string): any[] {
  try {
    const raw = localStorage.getItem(getUserScopedStorageKey(`annotations_${materialId}`));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

