import crypto from 'crypto';
import {
  adminGetDoc,
  adminListCollection,
  adminSetDoc,
} from '../server/persistence/firestoreAdminStore';

export type IngestionJobType = 'pdf_chunk' | 'youtube_ingest' | 'ocr_scan';
export type IngestionJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface IndexedMaterialChunk {
  chunkId: string;
  materialId: string;
  uid: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  timestampLabel?: string;
}

export interface MaterialIngestionRecord {
  materialId: string;
  uid: string;
  title: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
  sourceRef: string;
  contentHash: string;
  pageCount: number;
  extractionQuality: 'full' | 'partial' | 'needs_ocr' | 'unavailable';
  chunks: IndexedMaterialChunk[];
  createdAtIso: string;
}

export interface IngestionJobRecord {
  jobId: string;
  uid: string;
  jobType: IngestionJobType;
  status: IngestionJobStatus;
  progressPct: number;
  sourceLabel: string;
  materialId?: string;
  pageCount?: number;
  chunksIndexed?: number;
  deduplicated?: boolean;
  errorCode?: string;
  errorMessage?: string;
  createdAtIso: string;
  updatedAtIso: string;
  cancelled?: boolean;
}

const MAX_JOBS_STORED = 2000;
const MAX_MATERIALS_PER_USER = 100;
const MAX_ACTIVE_JOBS_PER_USER = 3;

const jobStore = new Map<string, IngestionJobRecord>();
// Map<uid, Map<materialId, MaterialIngestionRecord>>
const userMaterialsIndex = new Map<string, Map<string, MaterialIngestionRecord>>();

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(String(input || ''), 'utf8').digest('hex');
}

export function splitDocumentIntoChunks(params: {
  uid: string;
  materialId: string;
  rawText: string;
  maxCharsPerChunk?: number;
}): { chunks: IndexedMaterialChunk[]; pageCount: number; extractionQuality: 'full' | 'partial' | 'needs_ocr' } {
  const maxChars = params.maxCharsPerChunk || 2400;
  const clean = String(params.rawText || '').trim();
  if (!clean) {
    return { chunks: [], pageCount: 1, extractionQuality: 'needs_ocr' };
  }

  const pageMarkerRe = /\[Page\s+(\d+)\]\s*/i;
  const rawPages: { pageNumber: number; text: string; timestampLabel?: string }[] = [];

  if (pageMarkerRe.test(clean)) {
    const parts = clean.split(/\[Page\s+(\d+)\]\s*/i);
    for (let i = 1; i < parts.length; i += 2) {
      const pageNumber = Math.max(1, Number(parts[i]) || rawPages.length + 1);
      const text = (parts[i + 1] || '').trim();
      if (text) rawPages.push({ pageNumber, text });
    }
  } else {
    // Paragraph grouping into logical ~2000 char pages so 60+ page documents split cleanly
    const paras = clean.split(/\n{2,}|\r\n{2,}/).map((p) => p.trim()).filter(Boolean);
    let currentBuf = '';
    let pageNum = 1;
    for (const para of paras) {
      if (currentBuf.length + para.length > maxChars && currentBuf.length > 0) {
        rawPages.push({ pageNumber: pageNum, text: currentBuf.trim() });
        pageNum += 1;
        currentBuf = para;
      } else {
        currentBuf = currentBuf ? `${currentBuf}\n\n${para}` : para;
      }
    }
    if (currentBuf.trim()) {
      rawPages.push({ pageNumber: pageNum, text: currentBuf.trim() });
    }
  }

  const chunks: IndexedMaterialChunk[] = [];
  for (const pg of rawPages) {
    const tsMatch = pg.text.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
    if (pg.text.length <= maxChars) {
      chunks.push({
        chunkId: `chunk-p${pg.pageNumber}-0`,
        materialId: params.materialId,
        uid: params.uid,
        pageNumber: pg.pageNumber,
        chunkIndex: chunks.length,
        text: pg.text,
        timestampLabel: tsMatch?.[1],
      });
    } else {
      for (let offset = 0, partIdx = 0; offset < pg.text.length; offset += maxChars, partIdx += 1) {
        chunks.push({
          chunkId: `chunk-p${pg.pageNumber}-${partIdx}`,
          materialId: params.materialId,
          uid: params.uid,
          pageNumber: pg.pageNumber,
          chunkIndex: chunks.length,
          text: pg.text.slice(offset, offset + maxChars),
          timestampLabel: tsMatch?.[1],
        });
      }
    }
  }

  const emptyCount = rawPages.filter((p) => p.text.length < 25).length;
  const extractionQuality =
    chunks.length === 0
      ? 'needs_ocr'
      : emptyCount > rawPages.length * 0.35
      ? 'partial'
      : 'full';

  return {
    chunks,
    pageCount: Math.max(1, rawPages.length),
    extractionQuality,
  };
}

export function createIngestionJob(params: {
  uid: string;
  jobType: IngestionJobType;
  sourceLabel: string;
}): { allowed: boolean; job?: IngestionJobRecord; reason?: string } {
  const activeForUser = Array.from(jobStore.values()).filter(
    (j) => j.uid === params.uid && (j.status === 'queued' || j.status === 'running')
  );
  if (activeForUser.length >= MAX_ACTIVE_JOBS_PER_USER) {
    return {
      allowed: false,
      reason: `Maximum ${MAX_ACTIVE_JOBS_PER_USER} concurrent ingestion jobs active. Wait or cancel a running job.`,
    };
  }

  if (jobStore.size >= MAX_JOBS_STORED) {
    const oldest = jobStore.keys().next().value;
    if (oldest !== undefined) jobStore.delete(oldest);
  }

  const nowIso = new Date().toISOString();
  const job: IngestionJobRecord = {
    jobId: `job-${crypto.randomUUID().slice(0, 12)}`,
    uid: params.uid,
    jobType: params.jobType,
    status: 'queued',
    progressPct: 5,
    sourceLabel: params.sourceLabel.slice(0, 180),
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };
  jobStore.set(job.jobId, job);
  return { allowed: true, job };
}

export function ingestMaterialSynchronously(params: {
  uid: string;
  materialId?: string;
  title: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
  sourceRef: string;
  rawText: string;
  jobId?: string;
}): {
  record: MaterialIngestionRecord;
  deduplicated: boolean;
  job?: IngestionJobRecord;
} {
  const hash = sha256Hex(`${params.title}::${params.rawText}`);
  const userMap = userMaterialsIndex.get(params.uid) || new Map<string, MaterialIngestionRecord>();
  userMaterialsIndex.set(params.uid, userMap);

  for (const existing of userMap.values()) {
    if (existing.contentHash === hash) {
      if (params.jobId) {
        const job = jobStore.get(params.jobId);
        if (job) {
          job.status = 'completed';
          job.progressPct = 100;
          job.materialId = existing.materialId;
          job.pageCount = existing.pageCount;
          job.chunksIndexed = existing.chunks.length;
          job.deduplicated = true;
          job.updatedAtIso = new Date().toISOString();
        }
      }
      return {
        record: existing,
        deduplicated: true,
        job: params.jobId ? jobStore.get(params.jobId) : undefined,
      };
    }
  }

  const materialId = params.materialId || `mat-${hash.slice(0, 12)}`;
  const { chunks, pageCount, extractionQuality } = splitDocumentIntoChunks({
    uid: params.uid,
    materialId,
    rawText: params.rawText,
  });

  if (userMap.size >= MAX_MATERIALS_PER_USER) {
    const oldestKey = userMap.keys().next().value;
    if (oldestKey !== undefined) userMap.delete(oldestKey);
  }

  const record: MaterialIngestionRecord = {
    materialId,
    uid: params.uid,
    title: params.title.slice(0, 200),
    subject: params.subject,
    chapter: params.chapter.slice(0, 120),
    sourceType: params.sourceType,
    sourceRef: params.sourceRef.slice(0, 500),
    contentHash: hash,
    pageCount,
    extractionQuality,
    chunks,
    createdAtIso: new Date().toISOString(),
  };

  userMap.set(materialId, record);

  if (params.jobId) {
    const job = jobStore.get(params.jobId);
    if (job && !job.cancelled) {
      job.status = 'completed';
      job.progressPct = 100;
      job.materialId = materialId;
      job.pageCount = pageCount;
      job.chunksIndexed = chunks.length;
      job.deduplicated = false;
      job.updatedAtIso = new Date().toISOString();
    }
  }

  return {
    record,
    deduplicated: false,
    job: params.jobId ? jobStore.get(params.jobId) : undefined,
  };
}

export async function persistIngestionRecordAndJob(params: {
  uid: string;
  record: MaterialIngestionRecord;
  job?: IngestionJobRecord;
}): Promise<void> {
  if (params.job) {
    await adminSetDoc(
      `users/${params.uid}/studyJobs`,
      params.job.jobId,
      {
        userId: params.uid,
        jobType: params.job.jobType,
        status: params.job.status,
        progressPct: params.job.progressPct,
        sourceLabel: params.job.sourceLabel,
        materialId: params.job.materialId || params.record.materialId,
        pageCount: params.job.pageCount || params.record.pageCount,
        chunksIndexed: params.job.chunksIndexed || params.record.chunks.length,
        deduplicated: Boolean(params.job.deduplicated),
        createdAtIso: params.job.createdAtIso,
        updatedAtIso: params.job.updatedAtIso,
      },
      true
    );
  }
  const chunksToPersist = params.record.chunks.slice(0, 120);
  for (const chunk of chunksToPersist) {
    await adminSetDoc(
      `users/${params.uid}/materials/${params.record.materialId}/chunks`,
      chunk.chunkId,
      {
        userId: params.uid,
        materialId: params.record.materialId,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text.slice(0, 19000),
        ...(chunk.timestampLabel ? { timestampLabel: chunk.timestampLabel } : {}),
        createdAtIso: params.record.createdAtIso,
      },
      true
    );
  }
}

export function retrieveTopKChunksForStudent(params: {
  uid: string;
  materialId?: string;
  query: string;
  topK?: number;
  currentPage?: number;
}): IndexedMaterialChunk[] {
  const topK = Math.max(1, Math.min(8, params.topK || 4));
  const userMap = userMaterialsIndex.get(params.uid);
  if (!userMap || userMap.size === 0) return [];

  const materials = params.materialId
    ? ([userMap.get(params.materialId)].filter(Boolean) as MaterialIngestionRecord[])
    : Array.from(userMap.values());

  const allChunks = materials.flatMap((m) => m.chunks);
  return scoreChunksByQuery(allChunks, params.query, topK, params.currentPage);
}

export async function retrieveTopKChunksForStudentPersistent(params: {
  uid: string;
  materialId?: string;
  query: string;
  topK?: number;
  currentPage?: number;
}): Promise<IndexedMaterialChunk[]> {
  const localHits = retrieveTopKChunksForStudent(params);
  if (localHits.length > 0) return localHits;

  if (!params.materialId) return [];
  const topK = Math.max(1, Math.min(8, params.topK || 4));
  const persistedChunks = await adminListCollection<IndexedMaterialChunk>(
    `users/${params.uid}/materials/${params.materialId}/chunks`,
    120
  );
  return scoreChunksByQuery(persistedChunks, params.query, topK, params.currentPage);
}

function scoreChunksByQuery(
  allChunks: IndexedMaterialChunk[],
  queryStr: string,
  topK: number,
  currentPage?: number
): IndexedMaterialChunk[] {
  if (allChunks.length === 0) return [];
  const queryTerms = String(queryStr || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const scored = allChunks.map((chunk) => {
    const lower = chunk.text.toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      if (lower.includes(term)) {
        const occurrences = Math.min(4, lower.split(term).length - 1);
        score += 3 + occurrences;
      }
    }
    if (currentPage && chunk.pageNumber === currentPage) {
      score += 4;
    }
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score || a.chunk.pageNumber - b.chunk.pageNumber);
  return scored.slice(0, topK).map((s) => s.chunk);
}

export async function listUserIngestionJobsPersistent(uid: string): Promise<IngestionJobRecord[]> {
  const mem = listUserIngestionJobs(uid);
  const persisted = await adminListCollection<IngestionJobRecord>(`users/${uid}/studyJobs`, 30);
  const byId = new Map<string, IngestionJobRecord>();
  for (const j of persisted) {
    byId.set(j.jobId || j.id, { ...j, jobId: j.jobId || j.id, uid });
  }
  for (const j of mem) {
    byId.set(j.jobId, j);
  }
  return Array.from(byId.values())
    .sort((a, b) => String(b.updatedAtIso || '').localeCompare(String(a.updatedAtIso || '')))
    .slice(0, 30);
}

export function listUserIngestionJobs(uid: string): IngestionJobRecord[] {
  return Array.from(jobStore.values())
    .filter((j) => j.uid === uid)
    .sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso))
    .slice(0, 30);
}

export function getUserIngestionJob(uid: string, jobId: string): IngestionJobRecord | null {
  const job = jobStore.get(jobId);
  if (!job || job.uid !== uid) return null;
  return job;
}

export async function cancelUserIngestionJobPersistent(
  uid: string,
  jobId: string
): Promise<IngestionJobRecord | null> {
  const job = cancelUserIngestionJob(uid, jobId);
  if (job) {
    await adminSetDoc(`users/${uid}/studyJobs`, job.jobId, job, true);
    return job;
  }
  const existing = await adminGetDoc<IngestionJobRecord>(`users/${uid}/studyJobs`, jobId);
  if (!existing) return null;
  const cancelled = {
    ...existing,
    jobId,
    uid,
    cancelled: true,
    status: 'cancelled' as const,
    updatedAtIso: new Date().toISOString(),
  };
  await adminSetDoc(`users/${uid}/studyJobs`, jobId, cancelled, true);
  return cancelled;
}

export function cancelUserIngestionJob(uid: string, jobId: string): IngestionJobRecord | null {
  const job = jobStore.get(jobId);
  if (!job || job.uid !== uid) return null;
  if (job.status === 'queued' || job.status === 'running') {
    job.cancelled = true;
    job.status = 'cancelled';
    job.updatedAtIso = new Date().toISOString();
  }
  return job;
}

export function retryUserIngestionJob(uid: string, jobId: string): IngestionJobRecord | null {
  const job = jobStore.get(jobId);
  if (!job || job.uid !== uid) return null;
  job.cancelled = false;
  job.status = 'queued';
  job.progressPct = 10;
  job.errorCode = undefined;
  job.errorMessage = undefined;
  job.updatedAtIso = new Date().toISOString();
  return job;
}

export function extractYouTubeVideoId(rawUrl: string): string | null {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const vParam = parsed.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['shorts', 'live', 'embed', 'v'].includes(parts[0])) {
        return /^[a-zA-Z0-9_-]{11}$/.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  }
  return null;
}

export interface ParsedTranscriptSegment {
  timestampLabel: string;
  seconds: number;
  text: string;
}

/**
 * Parses WebVTT, SRT, or `[HH:MM:SS]` / `MM:SS` pasted YouTube transcripts up to 12 hours (43,200s).
 */
export function parseSrtVttOrTimestampTranscript(rawTranscript: string): ParsedTranscriptSegment[] {
  const clean = String(rawTranscript || '')
    .replace(/^WEBVTT[^\n]*\n/i, '')
    .trim();
  if (!clean) return [];

  const segments: ParsedTranscriptSegment[] = [];
  const lines = clean.split(/\r?\n/);

  const cueRe = /(?:(\d{1,2}):)?(\d{2}):(\d{2})(?:[.,]\d+)?\s*-->\s*(?:(?:\d{1,2}:)?\d{2}:\d{2}(?:[.,]\d+)?)/;
  let currentCueTs: { label: string; sec: number } | null = null;
  let cueBuffer: string[] = [];

  const flushCue = () => {
    if (currentCueTs && cueBuffer.length > 0) {
      const text = cueBuffer.join(' ').replace(/<[^>]+>/g, '').trim();
      if (text) {
        segments.push({
          timestampLabel: currentCueTs.label,
          seconds: currentCueTs.sec,
          text,
        });
      }
    }
    currentCueTs = null;
    cueBuffer = [];
  };

  let detectedCues = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushCue();
      continue;
    }
    if (/^\d+$/.test(line)) continue;
    const cueMatch = cueRe.exec(line);
    if (cueMatch) {
      detectedCues = true;
      flushCue();
      const hrs = Number(cueMatch[1] || 0);
      const mins = Number(cueMatch[2]);
      const secs = Number(cueMatch[3]);
      const totalSec = Math.min(43200, hrs * 3600 + mins * 60 + secs);
      currentCueTs = {
        label: `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
        sec: totalSec,
      };
    } else if (currentCueTs) {
      cueBuffer.push(line);
    }
  }
  flushCue();

  if (detectedCues && segments.length > 0) {
    return segments;
  }

  const lineTsRe = /^\[?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]?\s*[-–—:]?\s*(.+)$/;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const m = lineTsRe.exec(line);
    if (m) {
      const hrs = m[1] !== undefined ? Number(m[1]) : 0;
      const mins = Number(m[2]);
      const secs = Number(m[3]);
      if (mins < 60 && secs < 60 && hrs <= 12) {
        const totalSec = hrs * 3600 + mins * 60 + secs;
        segments.push({
          timestampLabel: `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
          seconds: totalSec,
          text: m[4].trim(),
        });
      }
    }
  }

  return segments;
}

/**
 * Attempts authorized public YouTube caption extraction ONLY via official API / watch-page captionTracks.
 * Returns `[]` if captions are unavailable/disabled/blocked — caller must fail closed with 422 and NEVER invent content.
 */
export async function fetchAuthorizedYouTubeCaptions(
  videoId: string
): Promise<ParsedTranscriptSegment[]> {
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!watchRes.ok) return [];
    const html = await watchRes.text();
    const marker = '"captionTracks":';
    const idx = html.indexOf(marker);
    if (idx === -1) return [];

    const bracketStart = html.indexOf('[', idx + marker.length);
    if (bracketStart === -1) return [];

    // Bounded balanced bracket slice for captionTracks JSON array
    let depth = 0;
    let end = -1;
    for (let i = bracketStart; i < Math.min(html.length, bracketStart + 20000); i++) {
      if (html[i] === '[') depth += 1;
      else if (html[i] === ']') {
        depth -= 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end === -1) return [];
    const tracksJson = html.slice(bracketStart, end).replace(/\\u0026/g, '&');
    const tracks = JSON.parse(tracksJson) as Array<{
      baseUrl?: string;
      languageCode?: string;
      kind?: string;
    }>;
    const preferred =
      tracks.find((t) => t.languageCode?.startsWith('en') && t.kind !== 'asr') ||
      tracks.find((t) => t.languageCode?.startsWith('en')) ||
      tracks.find((t) => t.languageCode?.startsWith('hi')) ||
      tracks[0];
    if (!preferred?.baseUrl || !preferred.baseUrl.startsWith('https://www.youtube.com/')) {
      return [];
    }

    const vttUrl = preferred.baseUrl.includes('fmt=')
      ? preferred.baseUrl
      : `${preferred.baseUrl}&fmt=vtt`;
    const vttResp = await fetch(vttUrl, { signal: controller.signal });
    if (!vttResp.ok) return [];
    const vttText = await vttResp.text();
    return parseSrtVttOrTimestampTranscript(vttText);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function clearIngestionStateForTest(): void {
  jobStore.clear();
  userMaterialsIndex.clear();
}
