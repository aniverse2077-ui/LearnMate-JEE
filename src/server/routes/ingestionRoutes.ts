import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authAndSecurity';
import { createRouteRateLimiter } from '../middleware/rateLimiterAndQuotas';
import {
  cancelUserIngestionJobPersistent,
  createIngestionJob,
  extractYouTubeVideoId,
  fetchAuthorizedYouTubeCaptions,
  getUserIngestionJob,
  ingestMaterialSynchronously,
  listUserIngestionJobsPersistent,
  parseSrtVttOrTimestampTranscript,
  persistIngestionRecordAndJob,
  retrieveTopKChunksForStudentPersistent,
  retryUserIngestionJob,
} from '../../services/ingestionJobsService';
import { detectJeeSubjectAndChapter } from '../../utils/jeeEngine';

export const ingestionRouter = Router();

const ingestRateLimit = createRouteRateLimiter({
  maxPerMinute: 25,
  keyPrefix: 'ingest',
  errorCode: 'INGEST_RATE_LIMIT',
});

ingestionRouter.use(ingestRateLimit);

ingestionRouter.get('/jobs', async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.userUid!;
  try {
    const jobs = await listUserIngestionJobsPersistent(uid);
    res.json({ uid, jobs });
  } catch (err: any) {
    res.status(err?.statusCode || 503).json({
      errorCode: err?.errorCode || 'PERSISTENCE_UNAVAILABLE',
      message: err?.message || 'Unable to list study ingestion jobs.',
      requestId: req.requestId,
    });
  }
});

ingestionRouter.get('/jobs/:jobId', (req: AuthenticatedRequest, res: Response) => {
  const uid = req.userUid!;
  const jobId = String(req.params.jobId || '');
  const job = getUserIngestionJob(uid, jobId);
  if (!job) {
    res.status(404).json({
      errorCode: 'JOB_NOT_FOUND',
      message: 'Ingestion job not found for your account.',
      requestId: req.requestId,
    });
    return;
  }
  res.json({ job });
});

ingestionRouter.post('/jobs/:jobId/cancel', async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.userUid!;
  const jobId = String(req.params.jobId || '');
  try {
    const job = await cancelUserIngestionJobPersistent(uid, jobId);
    if (!job) {
      res.status(404).json({
        errorCode: 'JOB_NOT_FOUND',
        message: 'Ingestion job not found for your account.',
        requestId: req.requestId,
      });
      return;
    }
    res.json({ job });
  } catch (err: any) {
    res.status(err?.statusCode || 503).json({
      errorCode: err?.errorCode || 'PERSISTENCE_UNAVAILABLE',
      message: err?.message || 'Unable to cancel ingestion job.',
      requestId: req.requestId,
    });
  }
});

ingestionRouter.post('/jobs/:jobId/retry', (req: AuthenticatedRequest, res: Response) => {
  const uid = req.userUid!;
  const jobId = String(req.params.jobId || '');
  const job = retryUserIngestionJob(uid, jobId);
  if (!job) {
    res.status(404).json({
      errorCode: 'JOB_NOT_FOUND',
      message: 'Ingestion job not found for your account.',
      requestId: req.requestId,
    });
    return;
  }
  res.json({ job });
});

// Multi-page PDF / text ingestion with SHA-256 deduplication and persistent chunk indexing
ingestionRouter.post('/document', async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.userUid!;
  const {
    materialId,
    title = 'Untitled Study Material',
    subject,
    chapter,
    sourceType = 'pdf',
    sourceRef = '',
    rawText = '',
  } = req.body || {};

  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    res.status(400).json({
      errorCode: 'EMPTY_DOCUMENT_TEXT',
      message:
        'Extracted document text is empty. For scanned image PDFs, run OCR extraction or paste text notes.',
      requestId: req.requestId,
    });
    return;
  }

  const jobCreated = createIngestionJob({
    uid,
    jobType: sourceType === 'photo' ? 'ocr_scan' : 'pdf_chunk',
    sourceLabel: String(title).slice(0, 140),
  });
  if (!jobCreated.allowed || !jobCreated.job) {
    res.status(429).json({
      errorCode: 'TOO_MANY_ACTIVE_JOBS',
      message: jobCreated.reason || 'Too many concurrent ingestion jobs.',
      requestId: req.requestId,
    });
    return;
  }

  const detected = detectJeeSubjectAndChapter(rawText.slice(0, 4000), String(title));
  const resolvedSubject =
    subject === 'Physics' || subject === 'Chemistry' || subject === 'Mathematics'
      ? subject
      : detected.subject;
  const resolvedChapter =
    typeof chapter === 'string' && chapter.trim() ? chapter.trim() : detected.chapter;

  const { record, deduplicated, job } = ingestMaterialSynchronously({
    uid,
    materialId: typeof materialId === 'string' ? materialId : undefined,
    title: String(title),
    subject: resolvedSubject,
    chapter: resolvedChapter,
    sourceType:
      sourceType === 'pdf' ||
      sourceType === 'photo' ||
      sourceType === 'youtube' ||
      sourceType === 'text' ||
      sourceType === 'drive'
        ? sourceType
        : 'pdf',
    sourceRef: String(sourceRef || title),
    rawText,
    jobId: jobCreated.job.jobId,
  });

  try {
    await persistIngestionRecordAndJob({ uid, record, job });
  } catch (err: any) {
    res.status(err?.statusCode || 503).json({
      errorCode: err?.errorCode || 'PERSISTENCE_UNAVAILABLE',
      message: err?.message || 'Unable to persist indexed material chunks.',
      requestId: req.requestId,
    });
    return;
  }

  res.json({
    status: 'INDEXED',
    deduplicated,
    job,
    material: {
      materialId: record.materialId,
      title: record.title,
      subject: record.subject,
      chapter: record.chapter,
      pageCount: record.pageCount,
      chunksIndexed: record.chunks.length,
      extractionQuality: record.extractionQuality,
      contentHash: record.contentHash,
    },
    chunksPreview: record.chunks.slice(0, 10),
  });
});

// Top-K retrieval endpoint scoped strictly to the authenticated student
ingestionRouter.post('/retrieve', async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.userUid!;
  const { materialId, query = '', topK = 4, currentPage } = req.body || {};

  try {
    const chunks = await retrieveTopKChunksForStudentPersistent({
      uid,
      materialId: typeof materialId === 'string' ? materialId : undefined,
      query: String(query),
      topK: Number(topK || 4),
      currentPage: typeof currentPage === 'number' ? currentPage : undefined,
    });

    res.json({
      uid,
      materialId: materialId || null,
      chunks,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 503).json({
      errorCode: err?.errorCode || 'PERSISTENCE_UNAVAILABLE',
      message: err?.message || 'Unable to retrieve indexed chunks.',
      requestId: req.requestId,
    });
  }
});

// Honest YouTube URL-only public captionTracks attempt + SRT/VTT parser + fail-closed 422 (no hallucinated notes!)
ingestionRouter.post('/youtube', async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.userUid!;
  const { url = '', transcriptText = '', title: customTitle } = req.body || {};

  const videoId = extractYouTubeVideoId(String(url));
  if (!videoId) {
    res.status(400).json({
      errorCode: 'INVALID_YOUTUBE_URL',
      message:
        'Please enter a valid YouTube lecture URL (youtube.com/watch?v=..., youtu.be/..., /shorts/..., or /live/...).',
      requestId: req.requestId,
    });
    return;
  }

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

  let oembedTitle = typeof customTitle === 'string' && customTitle.trim() ? customTitle.trim() : '';
  let authorName = '';
  let thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  let oembedVerified = false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const oembedResp = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (oembedResp.ok) {
      const data = (await oembedResp.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      if (data.title && !oembedTitle) oembedTitle = data.title;
      if (data.author_name) authorName = data.author_name;
      if (data.thumbnail_url) thumbnailUrl = data.thumbnail_url;
      oembedVerified = true;
    }
  } catch {
    // oEmbed optional if offline
  }

  const cleanTranscript = String(transcriptText || '').trim();
  let parsedSegments = parseSrtVttOrTimestampTranscript(cleanTranscript);
  let extractedVia = 'user_transcript';

  // If URL-only without pasted transcript, try genuine public YouTube timedtext captionTracks
  if (!cleanTranscript) {
    const autoCaptions = await fetchAuthorizedYouTubeCaptions(videoId);
    if (autoCaptions.length > 0) {
      parsedSegments = autoCaptions;
      extractedVia = 'youtube_caption_tracks';
    }
  }

  // Fail closed: Never fabricate lecture timestamps or notes when no genuine captions/transcript exist!
  if (parsedSegments.length === 0 && cleanTranscript.length < 40) {
    res.status(422).json({
      status: 'CAPTIONS_UNAVAILABLE',
      errorCode: 'CAPTIONS_UNAVAILABLE',
      videoId,
      canonicalUrl,
      oembedVerified,
      metadata: {
        title: oembedTitle || `YouTube Video (${videoId})`,
        authorName: authorName || null,
        thumbnailUrl,
      },
      message:
        'Public YouTube captions are unavailable or disabled for this video. Paste the lecture transcript, WebVTT/SRT captions, or timestamped chapter outline below so LearnMate builds strictly source-cited notes without inventing facts.',
      requestId: req.requestId,
    });
    return;
  }

  const formattedTranscript =
    parsedSegments.length > 0
      ? parsedSegments.map((s) => `[${s.timestampLabel}] ${s.text}`).join('\n')
      : cleanTranscript;

  const detected = detectJeeSubjectAndChapter(
    formattedTranscript.slice(0, 4000),
    oembedTitle || `YouTube Lecture ${videoId}`
  );

  const jobCreated = createIngestionJob({
    uid,
    jobType: 'youtube_ingest',
    sourceLabel: oembedTitle || canonicalUrl,
  });

  const { record, deduplicated, job } = ingestMaterialSynchronously({
    uid,
    title: oembedTitle || `${detected.chapter} (${videoId})`,
    subject: detected.subject,
    chapter: detected.chapter,
    sourceType: 'youtube',
    sourceRef: canonicalUrl,
    rawText: formattedTranscript,
    jobId: jobCreated.job?.jobId,
  });

  try {
    await persistIngestionRecordAndJob({ uid, record, job });
  } catch (err: any) {
    res.status(err?.statusCode || 503).json({
      errorCode: err?.errorCode || 'PERSISTENCE_UNAVAILABLE',
      message: err?.message || 'Unable to persist YouTube study material.',
      requestId: req.requestId,
    });
    return;
  }

  res.json({
    status: 'VERIFIED_FROM_TRANSCRIPT',
    provenance: 'source_extracted',
    extractedVia,
    videoId,
    canonicalUrl,
    oembedVerified,
    deduplicated,
    job,
    metadata: {
      title: record.title,
      authorName: authorName || null,
      thumbnailUrl,
    },
    segmentsCount: parsedSegments.length,
    segments: parsedSegments.slice(0, 100),
    material: {
      materialId: record.materialId,
      title: record.title,
      subject: record.subject,
      chapter: record.chapter,
      pageCount: record.pageCount,
      chunksIndexed: record.chunks.length,
      extractionQuality: record.extractionQuality,
      rawText: formattedTranscript,
    },
  });
});
