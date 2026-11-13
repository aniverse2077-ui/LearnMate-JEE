import { Router, Response } from 'express';
import { ThinkingLevel, Type } from '@google/genai';
import { AuthenticatedRequest } from '../middleware/authAndSecurity';
import {
  getValidatedGenAIClient,
  sendStructuredUpstreamError,
} from '../coreStudyEngine';

export const aiTutorRouter = Router();

// 1. Deep Reasoning / High Thinking Endpoint (gemini-4-carbon with ThinkingLevel.HIGH)
aiTutorRouter.post('/think', async (req: AuthenticatedRequest, res: Response) => {
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
      teacherPersona === 'pure_hindi' || language === 'Pure Hindi' || language === 'Hindi'
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
aiTutorRouter.post('/fast', async (req: AuthenticatedRequest, res: Response) => {
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
      language === 'Hindi'
        ? 'Explain in crisp, friendly Hindi (2-4 bullet points max).'
        : language === 'Hinglish'
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
aiTutorRouter.post('/analyze', async (req: AuthenticatedRequest, res: Response) => {
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

// 4. General Tasks + Google Search Grounding (gemini-4-hydrogen)
aiTutorRouter.post('/search', async (req: AuthenticatedRequest, res: Response) => {
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
        model: 'gemini-4-hydrogen',
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
      model: 'gemini-4-hydrogen',
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
aiTutorRouter.post('/image-pro', async (req: AuthenticatedRequest, res: Response) => {
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
aiTutorRouter.post('/image-edit', async (req: AuthenticatedRequest, res: Response) => {
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
aiTutorRouter.post('/video', async (req: AuthenticatedRequest, res: Response) => {
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
aiTutorRouter.post('/transcribe', async (req: AuthenticatedRequest, res: Response) => {
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
aiTutorRouter.post('/tts', async (req: AuthenticatedRequest, res: Response) => {
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
aiTutorRouter.post('/music', async (req: AuthenticatedRequest, res: Response) => {
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
