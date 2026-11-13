import { openDB, IDBPDatabase } from 'idb';
import {
  db,
  isFirebaseConfigured,
  getAccessToken,
  getCurrentActiveUid,
  getFirebaseIdToken,
  googleSignIn,
} from '../firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { computeStableContentHash, splitSourceIntoPages } from './studyBundleBuilder';

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
  details?: Record<string, unknown>;
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
 * Syncs large extracted text and study material metadata to canonical `/users/{uid}/materials/{materialId}`
 * and `/users/{uid}/materials/{materialId}/chunks/{chunkId}` in compliance with strict Firestore rules.
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
        sourceRef?: string;
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
    extractionQuality?: 'full' | 'partial' | 'needs_ocr' | 'unavailable';
  }
): Promise<{ synced: boolean; error?: string }> {
  if (!isFirebaseConfigured || !db) {
    return { synced: false, error: 'Firebase client is not configured; saved locally in IndexedDB.' };
  }
  const uid = typeof uidOrParams === 'string' ? uidOrParams : uidOrParams.uid;
  const materialId = (
    typeof uidOrParams === 'string' ? materialIdArg || `mat-${Date.now()}` : uidOrParams.materialId
  )
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
  const title = typeof uidOrParams === 'string' ? dataArg?.title || 'Material' : uidOrParams.title;
  const subject =
    typeof uidOrParams === 'string' ? dataArg?.subject || 'Physics' : uidOrParams.subject;
  const chapter =
    typeof uidOrParams === 'string' ? dataArg?.chapter || 'General' : uidOrParams.chapter;
  const sourceType =
    typeof uidOrParams === 'string' ? dataArg?.sourceType || 'pdf' : uidOrParams.sourceType;
  const sourceRef =
    (typeof uidOrParams === 'string' ? dataArg?.sourceRef : uidOrParams.sourceRef) || title;
  const pageCount = Math.max(
    1,
    Math.min(500, typeof uidOrParams === 'string' ? dataArg?.pageCount || 1 : uidOrParams.pageCount)
  );
  const fullText =
    typeof uidOrParams === 'string' ? dataArg?.contentSummary || '' : uidOrParams.fullText || '';

  if (!uid || uid.startsWith('local_') || uid === 'anonymous') {
    return { synced: false };
  }

  const contentHash = computeStableContentHash(`${title}:${fullText}`);
  const extractionQuality =
    typeof uidOrParams === 'string' && dataArg?.extractionQuality
      ? dataArg.extractionQuality
      : fullText.trim().length > 150
      ? 'full'
      : fullText.trim().length > 0
      ? 'partial'
      : 'needs_ocr';

  try {
    const matRef = doc(db, 'users', uid, 'materials', materialId);
    const existingSnap = await getDoc(matRef).catch(() => null);
    const createdAtVal = existingSnap?.exists()
      ? existingSnap.data()?.createdAt || serverTimestamp()
      : serverTimestamp();

    await setDoc(matRef, {
      userId: uid,
      title: title.slice(0, 190),
      subject:
        subject === 'Physics' || subject === 'Chemistry' || subject === 'Mathematics'
          ? subject
          : 'Physics',
      chapter: chapter.slice(0, 115) || 'General',
      sourceType:
        sourceType === 'pdf' ||
        sourceType === 'photo' ||
        sourceType === 'youtube' ||
        sourceType === 'text' ||
        sourceType === 'drive'
          ? sourceType
          : 'pdf',
      sourceRef: sourceRef.slice(0, 480),
      pageCount,
      currentPage: Math.max(1, dataArg?.currentPage || 1),
      contentSummary: fullText.slice(0, 39000),
      extractionQuality,
      contentHash,
      createdAt: createdAtVal,
      updatedAt: serverTimestamp(),
    });

    // Store full page chunks in `/users/{uid}/materials/{materialId}/chunks/{chunkId}` (up to 120 chunks)
    const docType =
      dataArg?.sourceType === 'photo' ||
      dataArg?.sourceType === 'youtube' ||
      dataArg?.sourceType === 'text' ||
      dataArg?.sourceType === 'drive'
        ? dataArg.sourceType
        : 'pdf';
    const pages = splitSourceIntoPages(fullText, docType).slices.slice(0, 120);
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (!page.text.trim()) continue;
      const chunkId = `chunk_${String(i + 1).padStart(4, '0')}`;
      const chunkRef = doc(db, 'users', uid, 'materials', materialId, 'chunks', chunkId);
      await setDoc(chunkRef, {
        userId: uid,
        materialId,
        pageNumber: Math.max(1, Math.min(500, page.pageNumber)),
        chunkIndex: i,
        text: page.text.slice(0, 19000),
        ...(page.timestampRange ? { timestampLabel: page.timestampRange.slice(0, 40) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return { synced: true };
  } catch (err: any) {
    const msg =
      err?.code === 'permission-denied'
        ? 'Cloud sync blocked by Firestore permissions (email verification may be required). Saved locally.'
        : `Cloud sync failed (${err?.message || 'network error'}). Saved locally in IndexedDB.`;
    return { synced: false, error: msg };
  }
}

/**
 * Configures local Vite-bundled pdf.js worker (no external CDN dependency).
 */
async function loadPdfJsConfigured() {
  const pdfjsLib = await import('pdfjs-dist');
  if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      const workerMod: any = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      if (workerMod?.default) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default;
      }
    } catch {
      // Leave unset in environments without bundler ?url support
    }
  }
  return pdfjsLib;
}

/**
 * Extracts text and real page count from a client-side PDF file using pdfjs-dist across ALL pages (up to 250 pages),
 * identifies scanned/image-only pages (`text.length < 40`) for OCR, and never invents fake page counts from `file.size`.
 */
export async function extractPdfTextAndMetadataWithPdfJs(
  file: File,
  onProgress?: (pct: number, currentPage: number, totalPages: number) => void
): Promise<{
  pageCount: number;
  extractedText: string;
  scannedPagesCount: number;
  scannedPageNumbers: number[];
  extractionError?: string;
}> {
  try {
    const pdfjsLib = await loadPdfJsConfigured();
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages || 1;
    const maxPagesToScan = Math.min(numPages, 250);
    const pageTexts: string[] = [];
    const scannedPageNumbers: number[] = [];

    for (let i = 1; i <= maxPagesToScan; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = (content.items as any[])
        .map((item) => item.str || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (strings.length >= 40) {
        pageTexts.push(`[Page ${i}] ${strings}`);
      } else {
        if (strings.length >= 8) {
          pageTexts.push(`[Page ${i}] ${strings}`);
        }
        scannedPageNumbers.push(i);
      }
      if (onProgress && (i === 1 || i % 5 === 0 || i === maxPagesToScan)) {
        onProgress(Math.round((i / maxPagesToScan) * 100), i, maxPagesToScan);
      }
    }

    return {
      pageCount: numPages,
      extractedText: pageTexts.join('\n\n'),
      scannedPagesCount: scannedPageNumbers.length,
      scannedPageNumbers,
    };
  } catch (err: any) {
    return {
      pageCount: 1,
      extractedText: '',
      scannedPagesCount: 0,
      scannedPageNumbers: [],
      extractionError:
        err?.message || 'Unable to parse PDF binary locally. Check that the file is not encrypted or corrupted.',
    };
  }
}

/**
 * Renders scanned/image-only PDF pages onto an offscreen canvas in batches of 3
 * and sends them to `/api/ai/analyze` for vision OCR extraction.
 */
export async function extractScannedPdfPagesViaOcr(
  file: File,
  scannedPageNumbers: number[],
  onProgress?: (completed: number, total: number) => void
): Promise<{ ocrTextByPage: Map<number, string>; errors: string[] }> {
  const ocrTextByPage = new Map<number, string>();
  const errors: string[] = [];
  if (!scannedPageNumbers.length || typeof document === 'undefined') {
    return { ocrTextByPage, errors };
  }

  const maxOcrPages = scannedPageNumbers.slice(0, 60);
  try {
    const pdfjsLib = await loadPdfJsConfigured();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const batchSize = 3;

    for (let idx = 0; idx < maxOcrPages.length; idx += batchSize) {
      const batch = maxOcrPages.slice(idx, idx + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (pageNum) => {
          try {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.35 });
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(viewport.width));
            canvas.height = Math.max(1, Math.round(viewport.height));
            const ctx = canvas.getContext('2d');
            if (!ctx) return { pageNum, text: '', error: 'Canvas 2D context unavailable' };
            await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            const base64 = dataUrl.split(',')[1] || '';
            const res = await apiFetchWithAuth<{ text?: string }>('/api/ai/analyze', {
              mediaBase64: base64,
              mimeType: 'image/jpeg',
              sourceType: 'photo',
              prompt: `Transcribe ALL printed/handwritten text and LaTeX equations ($...$ / $$...$$) from Page ${pageNum} verbatim. Output clean JEE study notes for Page ${pageNum} only.`,
            });
            if (!res.ok) {
              return { pageNum, text: '', error: res.error.message };
            }
            return { pageNum, text: (res.data.text || '').trim(), error: '' };
          } catch (e: any) {
            return { pageNum, text: '', error: e?.message || `Page ${pageNum} render failed` };
          }
        })
      );

      for (const item of batchResults) {
        if (item.text) {
          ocrTextByPage.set(item.pageNum, `[Page ${item.pageNum}] ${item.text}`);
        } else if (item.error && errors.length < 3) {
          errors.push(`Page ${item.pageNum}: ${item.error}`);
        }
      }

      if (onProgress) {
        onProgress(Math.min(maxOcrPages.length, idx + batch.length), maxOcrPages.length);
      }
    }
  } catch (err: any) {
    errors.push(err?.message || 'PDF OCR initialization failed.');
  }

  return { ocrTextByPage, errors };
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
 * Builds standard authenticated JSON request headers using Firebase ID token (never sends spoofable X-LearnMate-Uid).
 */
export async function getAuthenticatedRequestHeaders(): Promise<Record<string, string>> {
  const idToken = await getFirebaseIdToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }
  return headers;
}

/**
 * Authenticated fetch wrapper for `/api/*` routes that attaches the Firebase ID token
 * and parses structured 401/403/422/429/503 error payloads.
 */
export async function apiFetchWithAuth<T = any>(
  endpoint: string,
  body?: Record<string, any>,
  method: 'POST' | 'GET' | 'DELETE' = 'POST'
): Promise<
  | { ok: true; data: T; error?: undefined }
  | { ok: false; data: Partial<T>; error: StructuredUpstreamError }
> {
  try {
    const headers = await getAuthenticatedRequestHeaders();

    const res = await fetch(endpoint, {
      method,
      headers,
      body: method === 'GET' || !body ? undefined : JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errObj: StructuredUpstreamError = {
        errorCode: json.errorCode || `HTTP_${res.status}`,
        message:
          json.message ||
          json.error ||
          `Service returned HTTP ${res.status}. Please retry in a few seconds.`,
        retryAfterSeconds: Number(json.retryAfterSeconds ?? 5),
        status: res.status,
        details: json,
      };
      return {
        ok: false,
        data: json as Partial<T>,
        error: errObj,
      };
    }

    return { ok: true, data: json as T };
  } catch (err: any) {
    const errObj: StructuredUpstreamError = {
      errorCode: 'NETWORK_ERROR',
      message:
        err?.message ||
        'Network error communicating with LearnMate JEE backend. Check your connection and retry.',
      retryAfterSeconds: 5,
      status: 503,
    };
    return {
      ok: false,
      data: {} as Partial<T>,
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
 * Auto-saves in-progress CBT mock exam state to UID-scoped localStorage and canonical
 * `/users/{uid}/cbtDrafts/{draftId}` every 15s and on response updates.
 */
export async function saveCbtInProgressDraft(draft: CbtInProgressDraft): Promise<void> {
  const uid = getCurrentActiveUid();
  try {
    const key = getUserScopedStorageKey('cbt_in_progress', uid);
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // ignore quota errors
  }

  if (!isFirebaseConfigured || !db || !uid || uid.startsWith('local_') || uid === 'anonymous') {
    return;
  }
  try {
    const safeId = `cbt_draft_${draft.examMode}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    const draftRef = doc(db, 'users', uid, 'cbtDrafts', safeId);
    const existingSnap = await getDoc(draftRef).catch(() => null);
    const createdAtVal = existingSnap?.exists()
      ? existingSnap.data()?.createdAt || serverTimestamp()
      : serverTimestamp();

    await setDoc(draftRef, {
      userId: uid,
      mockTitle: `${draft.examMode} In-Progress Draft`.slice(0, 190),
      remainingSeconds: Math.max(0, Math.min(21600, Math.round(draft.secondsRemaining))),
      responsesJson: JSON.stringify({
        examMode: draft.examMode,
        currentQNumber: draft.currentQNumber,
        focusSwitchCount: draft.focusSwitchCount,
        responses: draft.responses,
        savedAt: draft.savedAt,
      }).slice(0, 145000),
      createdAt: createdAtVal,
      updatedAt: serverTimestamp(),
    });
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
 * Syncs Mistake Book, SM-2 Flashcards, and Custom Formulas to canonical
 * `/users/{uid}/revisions/{revisionId}` while preserving instant localStorage responsiveness.
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

  if (!isFirebaseConfigured || !db || !uid || uid.startsWith('local_') || uid === 'anonymous') {
    return;
  }
  try {
    const safeId = `sync_${collectionKey}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    const syncRef = doc(db, 'users', uid, 'revisions', safeId);
    const existingSnap = await getDoc(syncRef).catch(() => null);
    const createdAtVal = existingSnap?.exists()
      ? existingSnap.data()?.createdAt || serverTimestamp()
      : serverTimestamp();

    const cardType =
      collectionKey === 'mistakes'
        ? 'mistake'
        : collectionKey === 'custom_formulas'
        ? 'formula'
        : 'flashcard';
    await setDoc(syncRef, {
      userId: uid,
      chapter: 'All Chapters',
      subject: 'Physics',
      cardType,
      title: `Synced ${collectionKey} (${items.length})`,
      body: JSON.stringify(items).slice(0, 4800),
      trapOrTip: `Cloud synced (${items.length} items)`,
      createdAt: createdAtVal,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // non-blocking cloud sync
  }
}

/**
 * Persists freehand vector annotation strokes per material across sessions
 * (UID-scoped localStorage + canonical `/users/{uid}/creations/{id}`).
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

  if (!isFirebaseConfigured || !db || !uid || uid.startsWith('local_') || uid === 'anonymous') {
    return;
  }
  try {
    const safeId = `ann_${materialId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    const annRef = doc(db, 'users', uid, 'creations', safeId);
    const existingSnap = await getDoc(annRef).catch(() => null);
    const createdAtVal = existingSnap?.exists()
      ? existingSnap.data()?.createdAt || serverTimestamp()
      : serverTimestamp();

    await setDoc(annRef, {
      userId: uid,
      title: `Annotations for ${materialId}`.slice(0, 190),
      prompt: `Freehand vector strokes (${strokes.length})`,
      category: 'diagram',
      subject: 'All',
      sourceLabel: materialId.slice(0, 190),
      payload: JSON.stringify(strokes).slice(0, 95000),
      createdAt: createdAtVal,
      updatedAt: serverTimestamp(),
    });
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

export interface SignedCloudStorageTicket {
  ok: boolean;
  storageProvider: 'firebase-cloud-storage' | 'unconfigured';
  storageConfigured: boolean;
  assetId?: string;
  objectPath?: string;
  signedUrl?: string;
  expiresInSeconds?: number;
  errorCode?: string;
  message?: string;
}

/**
 * Requests a real Cloud Storage V4 signed URL from `/api/storage/signed-url`.
 * Returns honest `storageConfigured: false` when bucket/credentials are absent (never returns a fake local fallback URL).
 */
export async function requestSignedCloudStorageUrl(params: {
  fileName: string;
  mimeType: string;
  operation?: 'upload' | 'download';
  sizeBytes?: number;
  assetId?: string;
}): Promise<SignedCloudStorageTicket> {
  const res = await apiFetchWithAuth<SignedCloudStorageTicket>('/api/storage/signed-url', {
    fileName: params.fileName,
    mimeType: params.mimeType,
    operation: params.operation || 'upload',
    sizeBytes: params.sizeBytes || 0,
    ...(params.assetId ? { assetId: params.assetId } : {}),
  });

  if (!res.ok) {
    return {
      ok: false,
      storageProvider: 'unconfigured',
      storageConfigured: false,
      errorCode: res.error.errorCode,
      message: res.error.message,
    };
  }
  return res.data as SignedCloudStorageTicket;
}

export async function confirmCloudUpload(assetId: string) {
  return apiFetchWithAuth<{ ok: boolean; asset: any }>('/api/storage/confirm-upload', {
    assetId,
  });
}

export async function deleteCloudAsset(assetId: string) {
  return apiFetchWithAuth<{ deleted: boolean; assetId: string }>(
    `/api/storage/assets/${encodeURIComponent(assetId)}`,
    undefined,
    'DELETE'
  );
}

export async function deleteAccountOnServer() {
  return apiFetchWithAuth<{
    deleted: boolean;
    deletedFirestoreDocs: number;
    deletedGcsFiles: number;
    authDeleted: boolean;
  }>('/api/account', undefined, 'DELETE');
}

export async function verifySinglePyqAnswerOnServer(params: {
  questionId: string;
  selectedOption?: number;
  selectedOptions?: number[];
  numericalValue?: string | number;
}) {
  return apiFetchWithAuth<{
    questionId: string;
    isCorrect: boolean;
    correctIndex: number;
    correctIndices?: number[];
    numericalAnswer?: number;
    explanation: string;
    keyVersion: string;
  }>('/api/pyq/verify-answer', params);
}

export async function gradeCbtAttemptOnServerApi(params: {
  questions?: any[];
  questionIds?: string[];
  attemptType?: 'official_mock' | 'custom_drill';
  responses: Record<string, any>;
  examMode: string;
  shiftDifficulty?: 'Easy' | 'Moderate' | 'Tough';
}) {
  return apiFetchWithAuth<{
    summary: any;
    scaledScoreOutOf300: number;
    percentilePrediction: any;
    verifiedAtIso: string;
    examMode: string;
    keyVersion: string;
    questionSolutions: Record<
      string,
      {
        correctIndex: number;
        correctIndices?: number[];
        numericalAnswer?: number;
        explanation: string;
      }
    >;
  }>('/api/cbt/grade', params);
}

export async function ingestDocumentOnServer(params: {
  materialId?: string;
  title: string;
  subject?: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter?: string;
  sourceType?: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
  sourceRef?: string;
  rawText: string;
}) {
  return apiFetchWithAuth('/api/ingest/document', params);
}

export async function ingestYouTubeOnServer(params: {
  url: string;
  transcriptText?: string;
  title?: string;
}) {
  return apiFetchWithAuth('/api/ingest/youtube', params);
}

export async function fetchCommercialPlans() {
  try {
    const res = await fetch('/api/commercial/plans');
    const json = await res.json();
    return { ok: res.ok, data: json };
  } catch {
    return { ok: false, data: { paymentsConfigured: false, plans: [] } };
  }
}

export async function fetchCommercialEntitlements() {
  const idToken = await getFirebaseIdToken();
  if (!idToken) {
    const plansRes = await fetchCommercialPlans();
    return {
      ok: true as const,
      data: {
        uid: getCurrentActiveUid(),
        tier: 'free' as const,
        status: 'active' as const,
        billingCycle: 'none' as const,
        currentPeriodEndIso: null,
        cancelAtPeriodEnd: false,
        paymentsConfigured: Boolean(plansRes.data?.paymentsConfigured),
      },
    };
  }
  return apiFetchWithAuth<{
    uid: string;
    tier: 'free' | 'pro' | 'institute';
    status: 'active' | 'grace_period' | 'cancelled' | 'expired';
    billingCycle: 'monthly' | 'annual' | 'none';
    currentPeriodEndIso: string | null;
    cancelAtPeriodEnd: boolean;
    paymentsConfigured: boolean;
    quota?: { used: number; limit: number; remaining: number };
  }>('/api/commercial/entitlements', undefined, 'GET');
}

export async function fetchBillingInvoices() {
  const idToken = await getFirebaseIdToken();
  if (!idToken) {
    return {
      ok: true as const,
      data: {
        uid: getCurrentActiveUid(),
        invoices: [],
      },
    };
  }
  return apiFetchWithAuth<{
    uid: string;
    invoices: {
      invoiceId: string;
      planId: string;
      amountInr: number;
      currency: string;
      status: string;
      createdAtIso: string;
    }[];
  }>('/api/commercial/invoices', undefined, 'GET');
}

export async function createBillingCheckoutSession(params: {
  planId: 'pro_aspirant' | 'institute_cohort';
  billingCycle: 'monthly' | 'annual';
}) {
  return apiFetchWithAuth('/api/commercial/checkout', params);
}

export async function reportQuestionIssueOnServer(params: {
  questionId: string;
  issueType:
    | 'wrong_answer_key'
    | 'typo_or_latex'
    | 'missing_diagram'
    | 'provenance_mismatch'
    | 'other';
  details: string;
}) {
  return apiFetchWithAuth('/api/pyq/report-issue', params);
}

/**
 * Deletes all tenant-scoped Firestore subcollections & root profile for explicit GDPR/DPDP account deletion.
 */
export async function purgeUserFirestoreData(uid: string): Promise<number> {
  if (!isFirebaseConfigured || !db || !uid || uid.startsWith('local_')) return 0;
  let deleted = 0;
  const subcollections = [
    'materials',
    'tasks',
    'creations',
    'mockAttempts',
    'revisions',
    'flashcards',
    'studyJobs',
    'cbtDrafts',
  ];
  for (const sub of subcollections) {
    try {
      const snap = await getDocs(collection(db, 'users', uid, sub));
      for (const d of snap.docs) {
        if (sub === 'materials') {
          const chunkSnap = await getDocs(collection(db, 'users', uid, 'materials', d.id, 'chunks'));
          for (const c of chunkSnap.docs) {
            await deleteDoc(c.ref);
            deleted += 1;
          }
        }
        await deleteDoc(d.ref);
        deleted += 1;
      }
    } catch {
      // continue deleting remaining collections
    }
  }
  try {
    await deleteDoc(doc(db, 'users', uid));
    deleted += 1;
  } catch {
    // ignore
  }
  return deleted;
}

/**
 * Lazy-loads key-stripped official shift PYQ JSON packs from `/api/pyq/packs/:packId` (or static `/pyq-packs/*.json` fallback)
 * and caches under versioned key `learnmate_pyq_pack_v2_${packId}`.
 */
export async function fetchLazyPyqPack(
  packId: 'jee-main-shifts' | 'jee-advanced-papers'
): Promise<any> {
  const cacheKey = `learnmate_pyq_pack_v2_${packId}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // ignore storage read error
  }

  let data: any = null;
  try {
    const apiRes = await fetch(`/api/pyq/packs/${packId}`);
    if (apiRes.ok) {
      data = await apiRes.json();
    }
  } catch {
    // fallback to static pack
  }

  if (!data) {
    const res = await fetch(`/pyq-packs/${packId}.json`);
    if (!res.ok) {
      throw new Error(`Failed to fetch PYQ pack ${packId}`);
    }
    data = await res.json();
  }

  try {
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch {
    // ignore quota
  }
  return data;
}


