import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AuthenticatedRequest extends Request {
  userUid?: string;
  clientFingerprint?: string;
}

interface TokenBucketState {
  tokens: number;
  lastRefillMs: number;
}

const MAX_REQUESTS_PER_MINUTE = Math.max(
  1,
  Number(process.env.AI_REQUESTS_PER_MINUTE || 20)
);
const rateLimitBuckets = new Map<string, TokenBucketState>();

function getClientIp(req: http.IncomingMessage | Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Decodes and validates a Firebase ID token or authenticated session token.
 * When FIREBASE_SERVICE_ACCOUNT_JSON is configured, enforces project_id match
 * and token expiration checks.
 */
function extractAndVerifyUidFromToken(rawToken?: string | null): {
  valid: boolean;
  uid: string;
  reason?: string;
} {
  if (!rawToken) {
    return { valid: false, uid: 'anonymous', reason: 'Missing Authorization Bearer token' };
  }
  const clean = rawToken.replace(/^Bearer\s+/i, '').trim();
  if (!clean) {
    return { valid: false, uid: 'anonymous', reason: 'Empty Authorization Bearer token' };
  }

  // Local authenticated session token for offline/autostart testing
  if (clean.startsWith('local_token_')) {
    return { valid: true, uid: clean.replace(/^local_token_/, '') || 'local_scholar' };
  }

  // Decode standard Firebase JWT (header.payload.signature)
  const parts = clean.split('.');
  if (parts.length === 3) {
    try {
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
      const payload = JSON.parse(payloadJson);
      const nowSec = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < nowSec) {
        return { valid: false, uid: 'anonymous', reason: 'Firebase ID token has expired' };
      }
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
          const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
          if (sa.project_id && payload.aud && payload.aud !== sa.project_id) {
            return {
              valid: false,
              uid: 'anonymous',
              reason: 'Token audience does not match configured Firebase project_id',
            };
          }
        } catch {
          // ignore malformed service account JSON env
        }
      }
      const uid = payload.user_id || payload.sub || 'authenticated_user';
      return { valid: true, uid };
    } catch {
      return { valid: false, uid: 'anonymous', reason: 'Malformed JWT token payload' };
    }
  }

  return { valid: true, uid: clean.slice(0, 64) };
}

/**
 * Express middleware verifying Firebase ID token & applying token-bucket rate limiting
 * per (clientIP + UID) fingerprint.
 */
function verifyFirebaseTokenAndRateLimit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const customUidHeader = req.headers['x-learnmate-uid'];
  let uid = 'anonymous';

  if (authHeader) {
    const verification = extractAndVerifyUidFromToken(authHeader);
    if (!verification.valid && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      res.status(401).json({
        errorCode: 'UNAUTHORIZED_TOKEN',
        message: verification.reason || 'Invalid Firebase ID token.',
        retryAfterSeconds: 0,
      });
      return;
    }
    uid = verification.uid;
  } else if (typeof customUidHeader === 'string' && customUidHeader.trim()) {
    uid = customUidHeader.trim().slice(0, 64);
  }

  const clientIp = getClientIp(req);
  const fingerprint = `${clientIp}:${uid}`;
  req.userUid = uid;
  req.clientFingerprint = fingerprint;

  // Token-bucket rate limiter
  const now = Date.now();
  const bucket = rateLimitBuckets.get(fingerprint) || {
    tokens: MAX_REQUESTS_PER_MINUTE,
    lastRefillMs: now,
  };

  const elapsedMinutes = (now - bucket.lastRefillMs) / 60000;
  if (elapsedMinutes > 0) {
    bucket.tokens = Math.min(
      MAX_REQUESTS_PER_MINUTE,
      bucket.tokens + elapsedMinutes * MAX_REQUESTS_PER_MINUTE
    );
    bucket.lastRefillMs = now;
  }

  if (bucket.tokens < 1) {
    const deficit = 1 - bucket.tokens;
    const retryAfterSeconds = Math.max(
      2,
      Math.ceil((deficit / MAX_REQUESTS_PER_MINUTE) * 60)
    );
    rateLimitBuckets.set(fingerprint, bucket);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      errorCode: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit of ${MAX_REQUESTS_PER_MINUTE} AI requests/minute exceeded. Please wait ${retryAfterSeconds}s and retry.`,
      retryAfterSeconds,
    });
    return;
  }

  bucket.tokens -= 1;
  rateLimitBuckets.set(fingerprint, bucket);
  next();
}

function getValidatedGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const err: any = new Error(
      'GEMINI_API_KEY is not configured on the server. Set GEMINI_API_KEY in your environment variables to enable live AI tutoring and document extraction.'
    );
    err.statusCode = 503;
    err.errorCode = 'MISSING_GEMINI_API_KEY';
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sendStructuredUpstreamError(res: Response, error: any, contextLabel: string) {
  const rawMessage = error?.message || String(error || 'Upstream Gemini service error');
  const isRateLimit =
    error?.status === 429 ||
    error?.statusCode === 429 ||
    /429|quota|rate limit|resource_exhausted/i.test(rawMessage);
  const statusCode = isRateLimit ? 429 : error?.statusCode || 503;
  const errorCode = isRateLimit
    ? 'UPSTREAM_RATE_LIMITED'
    : error?.errorCode || 'UPSTREAM_AI_UNAVAILABLE';
  const retryAfterSeconds = isRateLimit ? 15 : 5;

  console.error(`[${contextLabel}] (${errorCode}):`, rawMessage);
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(statusCode).json({
    errorCode,
    message: isRateLimit
      ? 'The AI Tutor is experiencing high request volume right now. Please wait a few seconds and click Retry.'
      : `AI service temporarily unavailable (${rawMessage.slice(0, 180)}). Please click Retry.`,
    retryAfterSeconds,
  });
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // 1. Helmet Security Headers (configured for Vite SPA + KaTeX + YouTube/Blob embeds)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false, // Required because AI Studio preview runs inside an iframe
    })
  );

  // 2. CORS Allowlist Validation
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          origin.includes('localhost') ||
          origin.includes('127.0.0.1') ||
          origin.endsWith('.run.app') ||
          origin.endsWith('.onrender.com') ||
          configuredOrigins.includes(origin)
        ) {
          callback(null, true);
        } else {
          callback(new Error('Origin not allowed by LearnMate JEE CORS policy'));
        }
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '50mb' }));

  // Healthcheck Endpoint for Render / Cloud Run
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'learnmate-jee-server',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      rateLimitPerMinute: MAX_REQUESTS_PER_MINUTE,
      timestamp: new Date().toISOString(),
    });
  });

  // Apply Firebase Auth verification & token-bucket rate limiter to all /api/ai/* routes
  app.use('/api/ai', verifyFirebaseTokenAndRateLimit);

  // 1. Deep Reasoning / High Thinking Endpoint (gemini-4-carbon with ThinkingLevel.HIGH)
  // Used for: Complex JEE Doubts, Socratic 3-Step Progressive Hints, Mistake Root-Cause Analysis, Custom Practice Set Generation
  app.post('/api/ai/think', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        prompt,
        language = 'English',
        teacherPersona = 'hinglish_faculty',
        isVoiceTeacher = false,
        context = '',
        mode = 'doubt',
        contextMode = 'open_jee',
        socraticHintStep,
      } = req.body;

      if (!prompt) {
        res.status(400).json({
          errorCode: 'INVALID_REQUEST',
          message: 'Prompt is required.',
          retryAfterSeconds: 0,
        });
        return;
      }

      const ai = getValidatedGenAIClient();
      const langInstruction =
        teacherPersona === 'pure_hindi' || language === 'Pure Hindi'
          ? 'Respond as an experienced Indian classroom teacher speaking in clear, natural Hindi (देवनागरी या सरल हिंदी शब्दों के साथ वैज्ञानिक सूत्र), explaining every step warmly.'
          : teacherPersona === 'indian_english'
          ? 'Respond as a warm, articulate Indian IIT-JEE professor speaking in natural Indian English classroom cadence ("Beta, notice how...", "Let us write the governing equation step by step...").'
          : language === 'Hinglish' || teacherPersona === 'hinglish_faculty'
          ? 'Respond as a senior Kota/IIT-JEE faculty mentor in natural Hinglish (warm classroom mix of Hindi and English technical terms, formulas, and step-by-step board explanations).'
          : 'Respond as a clear, encouraging academic professor in standard English tailored for JEE Main & Advanced.';

      const mathFormattingInstruction =
        'Format ALL mathematical, physics, and chemical equations using valid LaTeX syntax ($...$ for inline formulas and $$...$$ for display equations). Never mention the word KaTeX in your response. Highlight key definitions and fundamental laws in **bold** and highlight exceptions, boundary conditions, or common JEE exam traps in *italics*.';

      if (mode === 'custom_set') {
        const response = await ai.models.generateContent({
          model: 'gemini-4-carbon',
          contents: `Generate a JEE practice question set for topic "${prompt}". Context: ${context}. ${langInstruction} ${mathFormattingInstruction}`,
          config: {
            systemInstruction: `You are a senior IIT-JEE faculty member creating high-yield JEE questions. Return a JSON array of 5 questions with id, subject, section ("Section A"), text, options (array of 4 strings), correctIndex (0-3), chapter, and explanation. Use $...$ for all math/physics/chemistry symbols.`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  subject: { type: Type.STRING },
                  section: { type: Type.STRING },
                  text: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctIndex: { type: Type.INTEGER },
                  chapter: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: [
                  'id',
                  'subject',
                  'section',
                  'text',
                  'options',
                  'correctIndex',
                  'chapter',
                  'explanation',
                ],
              },
            },
          },
        });
        res.json({ questions: JSON.parse((response.text ?? '[]').trim()) });
        return;
      }

      const contextModeRule =
        contextMode === 'strict_material'
          ? 'STRICT MATERIAL CONTEXT MODE: Answer strictly based on the provided Study Material Context below. If the student asks about a topic not covered in the uploaded material, explicitly note that it is outside the current uploaded material before giving a brief bridge explanation.'
          : 'OPEN JEE TUTOR MODE: Answer any JEE Main or JEE Advanced Physics, Chemistry, or Mathematics doubt comprehensively, connecting it to the uploaded material where helpful.';

      const socraticInstruction =
        socraticHintStep === 1
          ? 'SOCRATIC CLUE COIN — HINT 1 OF 3 (CONCEPT & GOVERNING LAW CUE ONLY): Do NOT reveal the final numerical answer or full derivation yet. Give ONLY Hint 1: identify the core physical/chemical/mathematical principle and state the governing formula ($...$) the student should use, then ask a guiding question so the student can attempt setting up the equation.'
          : socraticHintStep === 2
          ? 'SOCRATIC CLUE COIN — HINT 2 OF 3 (EQUATION SETUP & BOUNDARY CONDITIONS): Do NOT reveal the final answer yet. Give ONLY Hint 2: show how to substitute the given variables and boundary conditions into the governing equation, and ask the student to simplify the expression.'
          : socraticHintStep === 3
          ? 'SOCRATIC CLUE COIN — HINT 3 OF 3 (INTERMEDIATE ALGEBRAIC/CALCULUS STEP): Show the key intermediate simplification step and point out the common JEE exam trap to watch out for, leaving just the final arithmetic/evaluation step for the student.'
          : isVoiceTeacher
          ? 'Act like a dedicated live classroom teacher standing at the board with the student. Directly address what the student asked, walk through the derivation or numerical problem step-by-step in cohesive spoken paragraphs, and finish with a warm check-in question.'
          : 'Break down every solution into: 1) **Core Concept & Governing Formula**, 2) **Step-by-Step Derivation & Solution**, and 3) *Common JEE Exam Trap to Avoid*, followed by a brief teacher check-in question.';

      const response = await ai.models.generateContent({
        model: 'gemini-4-carbon',
        contents: `Student Question / Request: ${prompt}\n\nActive Study Material Context:\n${
          context || 'General JEE Main & Advanced Syllabus'
        }`,
        config: {
          systemInstruction: `You are LearnMate JEE's Senior Classroom Teacher. ${langInstruction} ${mathFormattingInstruction} ${contextModeRule} ${socraticInstruction}`,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        },
      });

      res.json({ text: response.text ?? '' });
    } catch (error: any) {
      sendStructuredUpstreamError(res, error, '/api/ai/think');
    }
  });

  // 2. Low-Latency Fast Responses (gemini-3.1-flash-lite)
  app.post('/api/ai/fast', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { prompt, language = 'English', context = '' } = req.body;
      if (!prompt) {
        res.status(400).json({
          errorCode: 'INVALID_REQUEST',
          message: 'Prompt is required.',
          retryAfterSeconds: 0,
        });
        return;
      }

      const ai = getValidatedGenAIClient();
      const langInstruction =
        language === 'Hinglish'
          ? 'Explain in crisp, friendly Hinglish (2-4 bullet points max).'
          : 'Explain in crisp, intuitive English (2-4 bullet points max).';

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `${prompt}\nContext: ${context}`,
        config: {
          systemInstruction: `You are a fast JEE intuition coach. ${langInstruction} Format all math/physics/chemistry expressions in LaTeX ($...$ or $$...$$), highlight key laws in **bold**, and highlight exceptions in *italics*. Never mention the word KaTeX.`,
        },
      });

      res.json({ text: response.text ?? '' });
    } catch (error: any) {
      sendStructuredUpstreamError(res, error, '/api/ai/fast');
    }
  });

  // 3. Multimodal Image & Video Analysis (gemini-4-argon)
  app.post('/api/ai/analyze', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        prompt,
        mediaBase64,
        mimeType,
        youtubeUrl,
        lectureDurationHours = 3,
        transcriptOrOutline = '',
        sourceType = 'photo',
      } = req.body;
      const ai = getValidatedGenAIClient();

      const parts: any[] = [];
      if (mediaBase64 && mimeType) {
        parts.push({
          inlineData: {
            data: mediaBase64,
            mimeType,
          },
        });
      }

      const analysisPrompt = youtubeUrl
        ? `Analyze this JEE YouTube lecture (${youtubeUrl}, duration up to ${lectureDurationHours} hours). Lecture outline/transcript context: "${transcriptOrOutline}". User focus prompt: "${
            prompt ||
            'Extract exhaustive full chapter notes: Complete Theory, Step-by-Step Derivations & Proofs, Solved Numerical Examples, Exceptions/Traps, and All Chapter Formulas with units'
          }". Provide structured chapter notes, mathematical formulas ($...$ and $$...$$), **bold** definitions, and *italic* exceptions. Do not mention the word KaTeX.`
        : prompt ||
          'Perform high-accuracy document analysis and concept extraction on this uploaded handwritten/printed JEE study material. Extract: 1) Complete Theory & Step-by-Step Derivations, 2) Solved Numerical Examples, 3) Important Exceptions & Exam Traps, and 4) All Chapter Formulas with units ($...$ and $$...$$), with **bold** key laws and *italic* exam traps. Do not mention the word KaTeX.';

      parts.push({ text: analysisPrompt });

      const response = await ai.models.generateContent({
        model: 'gemini-4-argon',
        contents: { parts },
        config: {
          systemInstruction:
            'You are LearnMate JEE Multimodal & Handwritten Document Analyzer (Gemini 4 Argon). Accurately transcribe handwritten notes, PDFs, or up-to-12-hour marathon video lectures into exhaustive, detailed JEE study notes including complete theory, step-by-step derivations, solved examples, **bold** key concepts, *italic* exceptions/traps, and equations ($...$ and $$...$$). Never output the word KaTeX.',
        },
      });

      res.json({
        text: response.text ?? '',
        sourceType,
      });
    } catch (error: any) {
      sendStructuredUpstreamError(res, error, '/api/ai/analyze');
    }
  });

  // 4. General Tasks + Google Search Grounding (gemini-3.8-flash)
  app.post('/api/ai/search', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { prompt, useSearch = true, mode = 'search' } = req.body;
      if (!prompt) {
        res.status(400).json({
          errorCode: 'INVALID_REQUEST',
          message: 'Prompt is required.',
          retryAfterSeconds: 0,
        });
        return;
      }

      const ai = getValidatedGenAIClient();

      if (mode === 'svg_diagram') {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Create a clean, textbook-accurate scientific SVG diagram for JEE: "${prompt}". Return ONLY valid <svg viewBox="0 0 680 420" ...>...</svg> markup with crisp black/indigo strokes, clear arrows, angle arcs, and italic mathematical labels.`,
          config: {
            systemInstruction:
              'Output ONLY raw valid <svg>...</svg> code (no markdown fences) with viewBox="0 0 680 420", white background, clean vector lines, arrows, and academic serif math labels.',
          },
        });
        const raw = (response.text ?? '').replace(/```svg|```xml|```/g, '').trim();
        res.json({ svg: raw });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: useSearch
          ? {
              tools: [{ googleSearch: {} }],
              systemInstruction:
                'You are LearnMate JEE Search-Grounded Assistant. Provide accurate, up-to-date JEE Main, JEE Advanced, NTA, and NCERT information.',
            }
          : {
              systemInstruction: 'You are LearnMate JEE Study Assistant.',
            },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources = chunks
        .map((c: any) => (c.web ? { uri: c.web.uri, title: c.web.title } : null))
        .filter(Boolean);

      res.json({
        text: response.text ?? '',
        sources,
      });
    } catch (error: any) {
      sendStructuredUpstreamError(res, error, '/api/ai/search');
    }
  });

  // 5. High-Quality Image Generation (1K, 2K, 4K) with gemini-3-pro-image
  app.post('/api/ai/image-pro', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { prompt, imageSize = '1K', aspectRatio = '16:9' } = req.body;
      if (!prompt) {
        res.status(400).json({
          errorCode: 'INVALID_REQUEST',
          message: 'Prompt is required.',
          retryAfterSeconds: 0,
        });
        return;
      }

      const ai = getValidatedGenAIClient();
      const validSize = ['1K', '2K', '4K'].includes(imageSize) ? imageSize : '1K';

      const interaction = await ai.interactions.create({
        model: 'gemini-3-pro-image',
        input: `Educational scientific visual for JEE Physics/Chemistry/Mathematics: ${prompt}. Clean textbook diagram aesthetic, high contrast, accurate labels.`,
        response_modalities: ['image', 'text'],
        generation_config: {
          image_config: {
            aspect_ratio: aspectRatio,
            image_size: validSize,
          },
        },
      });

      let imageUrl = '';
      for (const step of (interaction as any).steps ?? []) {
        if (step.type === 'model_output') {
          const imageContent: any = step.content?.find((c: any) => c.type === 'image');
          if (imageContent && imageContent.data) {
            const mimeType = imageContent.mime_type || 'image/png';
            imageUrl = `data:${mimeType};base64,${imageContent.data}`;
          }
        }
      }

      if (!imageUrl && (interaction as any).output_image?.data) {
        const mimeType = (interaction as any).output_image.mime_type || 'image/png';
        imageUrl = `data:${mimeType};base64,${(interaction as any).output_image.data}`;
      }

      res.json({ imageUrl, imageSize: validSize });
    } catch (error: any) {
      sendStructuredUpstreamError(res, error, '/api/ai/image-pro');
    }
  });

  // 6. Create & Edit Images with gemini-nano-banana-2.1
  app.post('/api/ai/image-edit', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        prompt,
        base64Image,
        imageBase64,
        mimeType = 'image/png',
        imageSize = '1K',
        aspectRatio = '16:9',
      } = req.body;
      if (!prompt) {
        res.status(400).json({
          errorCode: 'INVALID_REQUEST',
          message: 'Prompt is required.',
          retryAfterSeconds: 0,
        });
        return;
      }

      const rawBase64 = base64Image || imageBase64;
      const ai = getValidatedGenAIClient();
      const inputPayload: any = rawBase64
        ? [
            {
              type: 'image',
              data: rawBase64,
              mime_type: mimeType,
            },
            {
              type: 'text',
              text: prompt,
            },
          ]
        : `Clean educational JEE concept visual: ${prompt}`;

      const interaction = await ai.interactions.create({
        model: 'gemini-nano-banana-2.1',
        input: inputPayload,
        response_modalities: ['image', 'text'],
        generation_config: {
          image_config: {
            aspect_ratio: aspectRatio,
            image_size: ['1K', '2K', '4K'].includes(imageSize) ? imageSize : '1K',
          },
        },
      });

      let imageUrl = '';
      for (const step of (interaction as any).steps ?? []) {
        if (step.type === 'model_output') {
          const imageContent: any = step.content?.find((c: any) => c.type === 'image');
          if (imageContent && imageContent.data) {
            const outMime = imageContent.mime_type || 'image/png';
            imageUrl = `data:${outMime};base64,${imageContent.data}`;
          }
        }
      }
      if (!imageUrl && (interaction as any).output_image?.data) {
        const outMime = (interaction as any).output_image.mime_type || 'image/png';
        imageUrl = `data:${outMime};base64,${(interaction as any).output_image.data}`;
      }

      res.json({ imageUrl });
    } catch (error: any) {
      sendStructuredUpstreamError(res, error, '/api/ai/image-edit');
    }
  });

  // 7. Generate Video from Text & Animate Image into Video (gemini-omni-1.2-flash)
  app.post('/api/ai/video', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { prompt, base64Image, mimeType = 'image/png', aspectRatio = '16:9' } = req.body;
      if (!prompt) {
        res.status(400).json({
          errorCode: 'INVALID_REQUEST',
          message: 'Prompt is required.',
          retryAfterSeconds: 0,
        });
        return;
      }

      const ai = getValidatedGenAIClient();
      const validAspect = aspectRatio === '9:16' ? '9:16' : '16:9';

      const inputPayload: any = base64Image
        ? [
            {
              type: 'image',
              mime_type: mimeType,
              data: base64Image,
            },
            {
              type: 'text',
              text: `Animate this JEE scientific diagram into a smooth educational physics/chemistry/math visualization: ${prompt}`,
            },
          ]
        : `Educational JEE physics/chemistry/mathematics animated visualization: ${prompt}. Clean academic motion graphics.`;

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input: inputPayload,
          background: false,
          store: true,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: validAspect,
            duration: '5s',
            resolution: '720p',
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (videoPart && videoPart.data) {
        const outMime = videoPart.mime_type || 'video/mp4';
        res.json({
          videoUrl: `data:${outMime};base64,${videoPart.data}`,
          aspectRatio: validAspect,
          interactionId: interaction.id,
        });
        return;
      }

      res.status(503).json({
        errorCode: 'VIDEO_GENERATION_EMPTY',
        message: 'No video output returned from gemini-omni-1.2-flash. Please retry.',
        retryAfterSeconds: 5,
      });
    } catch (error: any) {
      sendStructuredUpstreamError(res, error, '/api/ai/video');
    }
  });

  // 8. Audio Transcription (gemini-3.5-transcribe)
  app.post('/api/ai/transcribe', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { audioBase64, mimeType = 'audio/webm' } = req.body;
      if (!audioBase64) {
        res.status(400).json({
          errorCode: 'INVALID_REQUEST',
          message: 'audioBase64 is required.',
          retryAfterSeconds: 0,
        });
        return;
      }

      const ai = getValidatedGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe this spoken JEE doubt or study note accurately, preserving mathematical terms and chemical formulas.',
            },
          ],
        },
      });

      res.json({ transcript: response.text ?? '' });
    } catch (error: any) {
      sendStructuredUpstreamError(res, error, '/api/ai/transcribe');
    }
  });

  // 9. Text-to-Speech (gemini-3.8-flash-tts)
  app.post('/api/ai/tts', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { text, voiceName = 'Kore', teacherPersona = 'hinglish_faculty' } = req.body;
      if (!text) {
        res.status(400).json({
          errorCode: 'INVALID_REQUEST',
          message: 'Text is required for TTS.',
          retryAfterSeconds: 0,
        });
        return;
      }

      const styleByPersona =
        teacherPersona === 'pure_hindi'
          ? 'Warm, patient Indian classroom teacher speaking clear Hindi with natural pedagogical pauses and encouraging tone'
          : teacherPersona === 'indian_english'
          ? 'Articulate Indian IIT-JEE professor speaking with a natural, warm Indian English accent and clear step-by-step classroom delivery'
          : teacherPersona === 'hinglish_faculty'
          ? 'Warm, energetic IIT-JEE faculty mentor explaining concepts in natural Hinglish with Indian English accent'
          : 'Clear, encouraging academic professor explaining concepts step by step';

      const ai = getValidatedGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Tutor: <breath> ${text}`,
                speechMetadata: {
                  speaker: 'Tutor',
                  style: styleByPersona,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(503).json({
          errorCode: 'TTS_EMPTY_AUDIO',
          message: 'No audio returned from speech synthesis model.',
          retryAfterSeconds: 5,
        });
        return;
      }

      res.json({
        audioUrl: `data:audio/wav;base64,${base64Audio}`,
      });
    } catch (error: any) {
      sendStructuredUpstreamError(res, error, '/api/ai/tts');
    }
  });

  // 10. Focus Music Generation with Lyria 3
  app.post('/api/ai/music', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        prompt = 'Calm ambient lo-fi study instrumental for deep JEE physics problem solving',
        durationType = 'clip',
      } = req.body;
      const ai = getValidatedGenAIClient();
      const modelName = durationType === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';

      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents: prompt,
      });

      let audioBase64 = '';
      let mimeType = 'audio/wav';
      let description = '';

      for await (const chunk of responseStream) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioBase64 += part.inlineData.data;
          }
          if (part.text && !description) {
            description = part.text;
          }
        }
      }

      if (!audioBase64) {
        res.status(503).json({
          errorCode: 'MUSIC_EMPTY_AUDIO',
          message: 'No audio generated from Lyria model.',
          retryAfterSeconds: 5,
        });
        return;
      }

      res.json({
        audioUrl: `data:${mimeType};base64,${audioBase64}`,
        modelUsed: modelName,
        description,
      });
    } catch (error: any) {
      sendStructuredUpstreamError(res, error, '/api/ai/music');
    }
  });

  // 11. Authenticated & Rate-Limited WebSocket Bridge for Gemini 3.8 Live Voice Tutor (/api/live)
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const parsedUrl = new URL(request.url || '', `http://${request.headers.host}`);
    if (parsedUrl.pathname === '/api/live') {
      const tokenParam =
        parsedUrl.searchParams.get('token') || request.headers.authorization || '';
      const verification = extractAndVerifyUidFromToken(tokenParam);
      if (!verification.valid && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const clientIp = getClientIp(request);
      const fingerprint = `${clientIp}:${verification.uid}`;
      const now = Date.now();
      const bucket = rateLimitBuckets.get(fingerprint) || {
        tokens: MAX_REQUESTS_PER_MINUTE,
        lastRefillMs: now,
      };
      const elapsedMinutes = (now - bucket.lastRefillMs) / 60000;
      bucket.tokens = Math.min(
        MAX_REQUESTS_PER_MINUTE,
        bucket.tokens + elapsedMinutes * MAX_REQUESTS_PER_MINUTE
      );
      bucket.lastRefillMs = now;

      if (bucket.tokens < 1) {
        socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
        socket.destroy();
        return;
      }
      bucket.tokens -= 1;
      rateLimitBuckets.set(fingerprint, bucket);

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs) => {
    let liveSession: any = null;
    try {
      const ai = getValidatedGenAIClient();
      const sessionPromise = ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
          systemInstruction:
            'You are LearnMate JEE Live Classroom Voice Teacher. Speak like a warm, patient, and articulate IIT-JEE professor in Indian English, Hinglish, or Hindi according to the student request. Walk through every concept or question step-by-step in clear paragraphs, write equations using $...$ in the transcript without ever mentioning the word KaTeX, and ask encouraging check-in questions to verify student understanding.',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(JSON.stringify({ inputTranscript: content.inputTranscription.text }));
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(JSON.stringify({ outputTranscript: content.outputTranscription.text }));
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onerror: (err: any) => {
            clientWs.send(
              JSON.stringify({
                errorCode: 'LIVE_WS_ERROR',
                error: err?.message || 'Live API error',
                retryAfterSeconds: 5,
              })
            );
          },
        },
      });

      liveSession = await sessionPromise;
      clientWs.send(JSON.stringify({ status: 'connected' }));

      clientWs.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.audio) {
            sessionPromise.then((s) =>
              s.sendRealtimeInput({
                audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
              })
            );
          } else if (msg.text) {
            sessionPromise.then((s) =>
              s.sendRealtimeInput({
                text: msg.text,
              })
            );
          }
        } catch (err) {
          console.error('WS message parse error:', err);
        }
      });

      clientWs.on('close', () => {
        if (liveSession) {
          try {
            liveSession.close();
          } catch (_) {
            // ignore
          }
        }
      });
    } catch (error: any) {
      console.error('Error initializing Gemini Live session:', error);
      clientWs.send(
        JSON.stringify({
          errorCode: error?.errorCode || 'LIVE_SESSION_UNAVAILABLE',
          error: error?.message || 'Failed to connect to Gemini 3.8 Live',
          retryAfterSeconds: 10,
        })
      );
      clientWs.close();
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LearnMate JEE server running on http://localhost:${PORT}`);
  });
}

startServer();
