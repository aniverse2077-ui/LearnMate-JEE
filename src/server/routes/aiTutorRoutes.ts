import { Router, Response } from 'express';
import { ThinkingLevel, Type } from '@google/genai';
import { AuthenticatedRequest } from '../middleware/authAndSecurity';
import {
  generateWithModelFallback,
  getModelRoutingConfig,
  getValidatedGenAIClient,
  sendStructuredUpstreamError,
} from '../coreStudyEngine';
import { retrieveTopKChunksForStudentPersistent } from '../../services/ingestionJobsService';
import { sanitizeSvgMarkup } from '../../utils/svgSanitizer';

export const aiTutorRouter = Router();

function buildLanguageInstruction(language = 'English', teacherPersona = 'hinglish_faculty'): string {
  if (teacherPersona === 'pure_hindi' || language === 'Pure Hindi' || language === 'Hindi') {
    return 'Respond as an experienced Indian classroom teacher speaking in clear, natural Hindi (देवनागरी या सरल हिंदी शब्दों के साथ वैज्ञानिक सूत्र), explaining every step warmly.';
  }
  if (teacherPersona === 'indian_english') {
    return 'Respond as a warm, articulate Indian IIT-JEE professor speaking in natural Indian English classroom cadence ("Let us write the governing equation step by step...").';
  }
  if (language === 'Hinglish' || teacherPersona === 'hinglish_faculty') {
    return 'Respond as a senior Kota/IIT-JEE faculty mentor in natural Hinglish (warm classroom mix of Hindi and English technical terms, formulas, and step-by-step board explanations).';
  }
  return 'Respond as a clear, encouraging academic professor in standard English tailored for JEE Main & Advanced.';
}

const MATH_FORMAT_INSTRUCTION =
  'Format ALL mathematical, physics, and chemical equations using valid LaTeX syntax ($...$ for inline formulas and $$...$$ for display equations). Never mention the word KaTeX in your response. Highlight key definitions and fundamental laws in **bold** and highlight exceptions, boundary conditions, or common JEE exam traps in *italics*.';

// 0. Unified Citation-Aware AI Tutor Endpoint (/api/ai/tutor)
aiTutorRouter.post('/tutor', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.userUid!;
    const {
      question,
      prompt,
      chapter = '',
      subject = '',
      materialId,
      currentPage,
      context = '',
      contextMode = 'open_jee',
      difficultyLevel = 'jee_main',
      language = 'Hinglish',
      teacherPersona = 'hinglish_faculty',
      socraticMode = false,
      hintLevel,
      action = 'explain',
      imageBase64,
      imageMimeType = 'image/png',
    } = req.body || {};

    const queryText = String(question || prompt || '').trim();
    if (!queryText) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'A question or prompt is required.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    // Retrieve top-K grounded chunks scoped strictly to this authenticated student (with Firestore persistence)
    const matchedChunks = await retrieveTopKChunksForStudentPersistent({
      uid,
      materialId: typeof materialId === 'string' ? materialId : undefined,
      query: `${chapter} ${queryText}`,
      topK: 4,
      currentPage: typeof currentPage === 'number' ? currentPage : undefined,
    });

    const citations = matchedChunks.map((c) => ({
      chunkId: c.chunkId,
      materialId: c.materialId,
      pageNumber: c.pageNumber,
      timestampLabel: c.timestampLabel || null,
      snippet: c.text.slice(0, 180),
    }));

    const retrievedContext =
      matchedChunks.length > 0
        ? matchedChunks
            .map((c) => `[Source Page ${c.pageNumber}${c.timestampLabel ? ` @ ${c.timestampLabel}` : ''}]: ${c.text}`)
            .join('\n\n')
        : String(context || '').slice(0, 6000);

    // Fail-safe in strict material mode when neither chunks nor context match
    if (contextMode === 'strict_material' && !retrievedContext.trim()) {
      res.json({
        answer:
          'I could not find grounded passages in your currently selected study material for this question. Please open the relevant material or switch to Open JEE Mode to answer from general JEE syllabus.',
        text:
          'I could not find grounded passages in your currently selected study material for this question. Please open the relevant material or switch to Open JEE Mode to answer from general JEE syllabus.',
        citations: [],
        contextMode,
        verificationStatus: 'insufficient_material_context',
        modelUsed: 'none',
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();
    const langInstruction = buildLanguageInstruction(language, teacherPersona);

    const difficultyRule =
      difficultyLevel === 'board'
        ? 'DIFFICULTY CALIBRATION (NCERT / BOARD LEVEL): Focus on crystal-clear intuitive fundamentals and direct NCERT formula steps.'
        : difficultyLevel === 'jee_advanced'
        ? 'DIFFICULTY CALIBRATION (JEE ADVANCED LEVEL): Emphasize multi-concept coupling, differential derivations, degenerate/boundary cases, and rigor.'
        : 'DIFFICULTY CALIBRATION (JEE MAIN 2027 LEVEL): Balance conceptual speed, +4/-1 elimination traps, and Section B numerical rounding precision.';

    const modeRule =
      contextMode === 'strict_material'
        ? 'STRICT MATERIAL CONTEXT MODE: Answer ONLY using the Source Context excerpts below. Cite page numbers inline as [Page N]. If a detail is absent from the source excerpts, explicitly state that it is not present in the provided source.'
        : 'OPEN JEE TUTOR MODE: Ground explanations in the student’s material citations ([Page N]) where relevant and extend freely across the full JEE Main/Advanced syllabus.';

    const actionRule =
      action === 'unit_check'
        ? 'DIMENSIONAL & UNIT AUDIT: Explicitly verify LHS and RHS SI dimensions $[M^a L^b T^c]$ and common unit pitfalls.'
        : action === 'recheck_quiz'
        ? 'CONCEPT RECHECK: Provide a crisp recap followed by 1 quick self-check numerical/MCQ problem and its hidden verification key.'
        : socraticMode || hintLevel
        ? `SOCRATIC HINT STEP ${hintLevel || 1} OF 3: Guide with a conceptual clue and governing formula without spoiling the final numeric answer.`
        : 'Structure clearly: 1) Core Law & Citations, 2) Step-by-Step Derivation, 3) Common Exam Trap.';

    const parts: any[] = [];
    if (typeof imageBase64 === 'string' && imageBase64.trim()) {
      const cleanedB64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim();
      if (cleanedB64.length > 0 && cleanedB64.length <= 12_000_000) {
        parts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: cleanedB64,
          },
        });
      }
    }

    parts.push({
      text: `Subject: ${subject || 'JEE STEM'} | Chapter: ${chapter || 'General'}\nQuestion: ${queryText}\n\nRetrieved Material Excerpts:\n${
        retrievedContext || 'No uploaded material selected (Open JEE Syllabus context).'
      }`,
    });

    const primaryModel = difficultyLevel === 'jee_advanced' ? models.thinking : models.fast;
    const { result, modelUsed, fallbackUsed } = await generateWithModelFallback(
      primaryModel,
      models.lite,
      (model) =>
        ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            systemInstruction: `You are LearnMate JEE Classroom Tutor. ${langInstruction} ${MATH_FORMAT_INSTRUCTION} ${difficultyRule} ${modeRule} ${actionRule}`,
          },
        })
    );

    const answerText = result.text ?? '';
    res.json({
      answer: answerText,
      text: answerText,
      citations,
      contextMode,
      difficultyLevel,
      verificationStatus: citations.length > 0 ? 'grounded_with_citations' : 'open_jee_syllabus',
      modelUsed,
      fallbackUsed,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/tutor', req.requestId);
  }
});

// 1. Deep Reasoning / High Thinking Endpoint (configured reasoning model with safe fallback)
aiTutorRouter.post('/think', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.userUid!;
    const {
      prompt,
      language = 'English',
      teacherPersona = 'hinglish_faculty',
      isVoiceTeacher = false,
      context = '',
      materialId,
      currentPage,
      mode = 'doubt',
      contextMode = 'open_jee',
      socraticHintStep,
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'Prompt is required.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();
    const langInstruction = buildLanguageInstruction(language, teacherPersona);

    if (mode === 'custom_set') {
      const { result, modelUsed } = await generateWithModelFallback(
        models.reasoning,
        models.fast,
        (model) =>
          ai.models.generateContent({
            model,
            contents: `Generate a JEE practice question set for topic "${prompt}". Context: ${String(context).slice(0, 4000)}. ${langInstruction} ${MATH_FORMAT_INSTRUCTION}`,
            config: {
              systemInstruction:
                'You are a senior IIT-JEE faculty member creating high-yield JEE questions. Return a JSON array of 5 questions with id, subject, section ("Section A"), text, options (array of 4 strings), correctIndex (0-3), chapter, and explanation. Use $...$ for all math/physics/chemistry symbols.',
              ...(model === models.reasoning
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
                : {}),
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
          })
      );
      res.json({
        questions: JSON.parse((result.text ?? '[]').trim()),
        provenanceType: 'AI_GENERATED',
        modelUsed,
      });
      return;
    }

    const retrieved = await retrieveTopKChunksForStudentPersistent({
      uid,
      materialId: typeof materialId === 'string' ? materialId : undefined,
      query: prompt,
      topK: 4,
      currentPage: typeof currentPage === 'number' ? currentPage : undefined,
    });

    const citations = retrieved.map((c) => ({
      chunkId: c.chunkId,
      pageNumber: c.pageNumber,
      timestampLabel: c.timestampLabel || null,
      snippet: c.text.slice(0, 160),
    }));

    const effectiveContext =
      retrieved.length > 0
        ? retrieved
            .map((c) => `[Source Page ${c.pageNumber}]: ${c.text}`)
            .join('\n\n')
        : String(context || '').slice(0, 6000);

    const contextModeRule =
      contextMode === 'strict_material'
        ? 'STRICT MATERIAL CONTEXT MODE: Answer strictly based on the provided Study Material Context below and cite page numbers ([Page N]). If absent from the material, state clearly that it is outside the uploaded material.'
        : 'OPEN JEE TUTOR MODE: Answer any JEE Main or JEE Advanced Physics, Chemistry, or Mathematics doubt comprehensively, citing uploaded material pages where helpful.';

    const socraticInstruction =
      socraticHintStep === 1
        ? 'SOCRATIC CLUE COIN — HINT 1 OF 3 (CONCEPT & GOVERNING LAW CUE ONLY): Do NOT reveal the final numerical answer or full derivation yet. Give ONLY Hint 1 and ask a guiding question.'
        : socraticHintStep === 2
        ? 'SOCRATIC CLUE COIN — HINT 2 OF 3 (EQUATION SETUP & BOUNDARY CONDITIONS): Do NOT reveal the final answer yet. Show variable substitution and ask the student to simplify.'
        : socraticHintStep === 3
        ? 'SOCRATIC CLUE COIN — HINT 3 OF 3 (INTERMEDIATE STEP): Show the key intermediate algebraic/calculus step and exam trap, leaving final arithmetic to the student.'
        : isVoiceTeacher
        ? 'Act like a dedicated live classroom teacher standing at the board. Walk through the derivation step-by-step in cohesive spoken paragraphs and finish with a warm check-in question.'
        : 'Break down every solution into: 1) **Core Concept & Governing Formula**, 2) **Step-by-Step Derivation & Solution**, and 3) *Common JEE Exam Trap to Avoid*, followed by a brief check-in question.';

    const { result, modelUsed, fallbackUsed } = await generateWithModelFallback(
      models.reasoning,
      models.fast,
      (model) =>
        ai.models.generateContent({
          model,
          contents: `Student Question / Request: ${prompt}\n\nActive Study Material Context:\n${
            effectiveContext || 'General JEE Main & Advanced Syllabus'
          }`,
          config: {
            systemInstruction: `You are LearnMate JEE's Senior Classroom Teacher. ${langInstruction} ${MATH_FORMAT_INSTRUCTION} ${contextModeRule} ${socraticInstruction}`,
            ...(model === models.reasoning
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
              : {}),
          },
        })
    );

    res.json({
      text: result.text ?? '',
      citations,
      modelUsed,
      fallbackUsed,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/think', req.requestId);
  }
});

// 2. Low-Latency Fast Responses (gemini-3.1-flash-lite)
aiTutorRouter.post('/fast', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, language = 'English', context = '' } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'Prompt is required.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();
    const langInstruction =
      language === 'Hindi'
        ? 'Explain in crisp, friendly Hindi (2-4 bullet points max).'
        : language === 'Hinglish'
        ? 'Explain in crisp, friendly Hinglish (2-4 bullet points max).'
        : 'Explain in crisp, intuitive English (2-4 bullet points max).';

    const { result, modelUsed } = await generateWithModelFallback(
      models.lite,
      models.fast,
      (model) =>
        ai.models.generateContent({
          model,
          contents: `${prompt.slice(0, 4000)}\nContext: ${String(context).slice(0, 4000)}`,
          config: {
            systemInstruction: `You are a fast JEE intuition coach. ${langInstruction} Format all math/physics/chemistry expressions in LaTeX ($...$ or $$...$$), highlight key laws in **bold**, and highlight exceptions in *italics*. Never mention the word KaTeX.`,
          },
        })
    );

    res.json({ text: result.text ?? '', modelUsed });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/fast', req.requestId);
  }
});

// 3. Multimodal Image & Verified Transcript Analysis (gemini-4-argon -> gemini-4-hydrogen fallback)
aiTutorRouter.post('/analyze', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      prompt,
      mediaBase64,
      mimeType,
      youtubeUrl,
      transcriptOrOutline = '',
      sourceType = 'photo',
    } = req.body || {};

    // Honest enforcement: never let AI hallucinate video notes from a URL without transcript text!
    if (youtubeUrl && String(transcriptOrOutline || '').trim().length < 30 && !mediaBase64) {
      res.status(422).json({
        errorCode: 'CAPTIONS_UNAVAILABLE',
        message:
          'YouTube transcript or timestamped captions are required before AI analysis. Paste captions or use /api/ingest/youtube first.',
        requestId: req.requestId,
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();

    const parts: any[] = [];
    if (typeof mediaBase64 === 'string' && mediaBase64.trim() && mimeType) {
      const cleanedB64 = mediaBase64.replace(/^data:[^;]+;base64,/, '').trim();
      parts.push({
        inlineData: {
          data: cleanedB64,
          mimeType: String(mimeType),
        },
      });
    }

    const analysisPrompt = youtubeUrl
      ? `Organize these verified YouTube lecture captions/transcript excerpts (${youtubeUrl}) into source-cited JEE notes without inventing content outside the transcript:\nTranscript:\n"${String(transcriptOrOutline).slice(0, 12000)}"\nUser focus: "${prompt || 'Complete structured chapter notes with timestamp citations'}"`
      : prompt ||
        'Perform high-accuracy OCR and concept extraction on this uploaded handwritten/printed JEE study material. Extract equations accurately in LaTeX ($...$ and $$...$$) without ever adding unrelated chapters or formulas. Do not mention the word KaTeX.';

    parts.push({ text: analysisPrompt });

    const { result, modelUsed, fallbackUsed } = await generateWithModelFallback(
      models.thinking,
      models.fast,
      (model) =>
        ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            systemInstruction:
              'You are LearnMate JEE Multimodal & Handwritten Document Analyzer. Extract text, equations ($...$ and $$...$$), **bold** key concepts, and *italic* exceptions faithfully from ONLY the uploaded document or transcript. Never output the word KaTeX.',
          },
        })
    );

    res.json({
      text: result.text ?? '',
      sourceType,
      modelUsed,
      fallbackUsed,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/analyze', req.requestId);
  }
});

// 4. General Tasks + Google Search Grounding + Sanitized SVG Diagram Maker (gemini-4-hydrogen)
aiTutorRouter.post('/search', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, useSearch = true, mode = 'search' } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'Prompt is required.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();

    if (mode === 'svg_diagram') {
      const { result, modelUsed } = await generateWithModelFallback(
        models.fast,
        models.lite,
        (model) =>
          ai.models.generateContent({
            model,
            contents: `Create a clean, textbook-accurate scientific SVG diagram for JEE: "${prompt.slice(0, 1000)}". Return ONLY valid <svg viewBox="0 0 680 420" ...>...</svg> markup with crisp black/indigo strokes, clear arrows, angle arcs, and italic mathematical labels. Never include <script>, event handlers, or external URLs.`,
            config: {
              systemInstruction:
                'Output ONLY raw valid <svg>...</svg> code (no markdown fences) with viewBox="0 0 680 420", white background, clean vector lines, arrows, and academic serif math labels.',
            },
          })
      );
      const raw = (result.text ?? '').replace(/```svg|```xml|```/g, '').trim();
      const safeSvg = sanitizeSvgMarkup(raw);
      if (!safeSvg) {
        res.status(502).json({
          errorCode: 'INVALID_SVG_OUTPUT',
          message: 'Generated diagram did not contain valid safe SVG markup. Please retry.',
          requestId: req.requestId,
        });
        return;
      }
      res.json({ svg: safeSvg, modelUsed });
      return;
    }

    const { result, modelUsed } = await generateWithModelFallback(
      models.fast,
      models.lite,
      (model) =>
        ai.models.generateContent({
          model,
          contents: prompt.slice(0, 4000),
          config: useSearch
            ? {
                tools: [{ googleSearch: {} }],
                systemInstruction:
                  'You are LearnMate JEE Search-Grounded Assistant. Provide accurate, up-to-date JEE Main, JEE Advanced, NTA, and NCERT information.',
              }
            : {
                systemInstruction: 'You are LearnMate JEE Study Assistant.',
              },
        })
    );

    const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = chunks
      .map((chunk: any) => ({
        title: chunk.web?.title || 'Verified Source',
        uri: chunk.web?.uri || '',
      }))
      .filter((s: any) => Boolean(s.uri));

    res.json({
      text: result.text ?? '',
      sources,
      modelUsed,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/search', req.requestId);
  }
});

// 5. High-Res Concept Visual Generation (gemini-3-pro-image)
aiTutorRouter.post('/image-pro', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, aspectRatio = '16:9', imageSize = '1K' } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'Prompt is required for visual generation.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();
    const response = await ai.models.generateContent({
      model: models.image,
      contents: `High-clarity scientific textbook educational diagram for JEE student: ${prompt.slice(0, 1000)}. Clean white paper style, high contrast labels, zero clutter.`,
      config: {
        imageConfig: {
          aspectRatio,
          imageSize,
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData) {
        res.json({
          imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        });
        return;
      }
    }

    res.status(503).json({
      errorCode: 'IMAGE_GENERATION_EMPTY',
      message: 'No image data returned from image generation model. Please retry.',
      retryAfterSeconds: 5,
      requestId: req.requestId,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/image-pro', req.requestId);
  }
});

// 6. Fast Visual Editing / Problem Diagram Markup (gemini-nano-banana-2.1)
aiTutorRouter.post('/image-edit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, imageBase64, mimeType = 'image/png' } = req.body || {};
    if (!prompt) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'Prompt is required for image editing.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();
    const parts: any[] = [];
    if (typeof imageBase64 === 'string' && imageBase64.trim()) {
      const cleaned = imageBase64.replace(/^data:[^;]+;base64,/, '').trim();
      parts.push({ inlineData: { data: cleaned, mimeType } });
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: models.imageEdit,
      contents: { parts },
    });

    const resParts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of resParts) {
      if (part.inlineData) {
        res.json({
          imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        });
        return;
      }
    }

    res.status(503).json({
      errorCode: 'IMAGE_EDIT_EMPTY',
      message: 'No edited image returned. Please retry.',
      retryAfterSeconds: 5,
      requestId: req.requestId,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/image-edit', req.requestId);
  }
});

// 7. Animated Concept Lesson Video Generation (gemini-omni-1.2-flash Interactions API)
export function buildGeminiVideoInteractionRequest(params: {
  prompt: string;
  aspectRatio?: string;
  imageBase64?: string;
  imageMimeType?: string;
}) {
  const allowedAspectRatios = new Set(['16:9', '9:16', '1:1', '4:3', '3:4']);
  const safeAspect = allowedAspectRatios.has(String(params.aspectRatio || ''))
    ? String(params.aspectRatio)
    : '16:9';
  const promptText = `Create a concise 8-second scientifically accurate educational STEM animation for an IIT-JEE aspirant showing clearly: ${String(
    params.prompt
  ).slice(0, 600)}`;

  const cleanedImg =
    typeof params.imageBase64 === 'string'
      ? params.imageBase64.replace(/^data:[^;]+;base64,/, '').trim()
      : '';

  const input = cleanedImg
    ? [
        {
          type: 'image',
          mime_type: String(params.imageMimeType || 'image/png'),
          data: cleanedImg,
        },
        { type: 'text', text: promptText },
      ]
    : promptText;

  return {
    model: 'gemini-omni-1.2-flash',
    input,
    background: false,
    store: false,
    stream: false,
    response_format: {
      type: 'video',
      aspect_ratio: safeAspect,
      duration: '8s',
      resolution: '720p',
    },
  };
}

export function extractVideoOutputFromInteraction(interaction: any): string | null {
  const directVideo = interaction?.output_video;
  if (directVideo?.data) {
    const mime = directVideo.mime_type || 'video/mp4';
    return `data:${mime};base64,${directVideo.data}`;
  }
  if (directVideo?.uri) {
    return String(directVideo.uri);
  }
  const outputs = Array.isArray(interaction?.outputs) ? interaction.outputs : [];
  for (const output of outputs) {
    if (output?.type === 'video' && output?.data) {
      const mime = output.mime_type || 'video/mp4';
      return `data:${mime};base64,${output.data}`;
    }
    if (output?.type === 'video' && output?.uri) {
      return String(output.uri);
    }
  }
  return null;
}

aiTutorRouter.post('/video', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, aspectRatio = '16:9', imageBase64, imageMimeType } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'Prompt is required for video generation.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    const ai = getValidatedGenAIClient();
    const requestPayload = buildGeminiVideoInteractionRequest({
      prompt,
      aspectRatio,
      imageBase64,
      imageMimeType,
    });
    const interaction = await (ai.interactions.create as any)(requestPayload, {
      timeout: 300000,
    });

    const videoUrl = extractVideoOutputFromInteraction(interaction);
    if (videoUrl) {
      res.json({
        videoUrl,
        modelUsed: 'gemini-omni-1.2-flash',
      });
      return;
    }

    res.status(503).json({
      errorCode: 'VIDEO_GENERATION_EMPTY',
      message: 'No video output returned from gemini-omni-1.2-flash. Please retry.',
      retryAfterSeconds: 5,
      requestId: req.requestId,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/video', req.requestId);
  }
});

// 8. Audio Transcription (gemini-3.5-transcribe)
aiTutorRouter.post('/transcribe', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body || {};
    if (!audioBase64) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'audioBase64 is required.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();
    const response = await ai.models.generateContent({
      model: models.transcribe,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: String(audioBase64).replace(/^data:[^;]+;base64,/, '').trim(),
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
    sendStructuredUpstreamError(res, error, '/api/ai/transcribe', req.requestId);
  }
});

// 9. Text-to-Speech (gemini-3.8-flash-tts)
aiTutorRouter.post('/tts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { text, voiceName = 'Kore', teacherPersona = 'hinglish_faculty' } = req.body || {};
    if (!text) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'Text is required for TTS.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
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

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();
    const response = await ai.models.generateContent({
      model: models.tts,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Tutor: <breath> ${String(text).slice(0, 4000)}`,
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
        requestId: req.requestId,
      });
      return;
    }

    res.json({
      audioUrl: `data:audio/wav;base64,${base64Audio}`,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/tts', req.requestId);
  }
});

// 10. Focus Music Generation with Lyria 3
aiTutorRouter.post('/music', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      prompt = 'Calm ambient lo-fi study instrumental for deep JEE physics problem solving',
      durationType = 'clip',
    } = req.body || {};
    const ai = getValidatedGenAIClient();
    const modelName = durationType === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';

    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      contents: String(prompt).slice(0, 500),
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
        requestId: req.requestId,
      });
      return;
    }

    res.json({
      audioUrl: `data:${mimeType};base64,${audioBase64}`,
      modelUsed: modelName,
      description,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/music', req.requestId);
  }
});
