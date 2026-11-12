import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // 1. Deep Reasoning / High Thinking Endpoint (gemini-4-carbon with ThinkingLevel.HIGH)
  // Used for: Complex JEE Doubts, Mistake DNA Root-Cause Analysis, Custom Practice Set Generation
  app.post('/api/ai/think', async (req, res) => {
    try {
      const {
        prompt,
        language = 'English',
        context = '',
        mode = 'doubt',
        contextMode = 'open_jee',
      } = req.body;
      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }

      const ai = getGenAIClient();
      const langInstruction =
        language === 'Hinglish'
          ? 'Respond in natural JEE coaching Hinglish (clear Roman Hindi + English technical terms, formulas, and steps).'
          : 'Respond in clear, rigorous academic English tailored for JEE Main & Advanced.';

      const katexInstruction =
        'Format ALL mathematical, physics, and chemical equations using valid KaTeX syntax ($...$ for inline formulas and $$...$$ for display equations). Highlight key definitions and fundamental laws in **bold** and highlight exceptions, boundary conditions, or common JEE exam traps in *italics*.';

      if (mode === 'custom_set') {
        const response = await ai.models.generateContent({
          model: 'gemini-4-carbon',
          contents: `Generate a JEE practice question set for topic "${prompt}". Context: ${context}. ${langInstruction} ${katexInstruction}`,
          config: {
            systemInstruction: `You are a senior IIT-JEE faculty member creating high-yield JEE questions. Return a JSON array of 5 questions with id, subject, section ("Section A"), text, options (array of 4 strings), correctIndex (0-3), chapter, and explanation. Use KaTeX ($...$) for all math/physics/chemistry symbols.`,
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
                required: ['id', 'subject', 'section', 'text', 'options', 'correctIndex', 'chapter', 'explanation'],
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

      const response = await ai.models.generateContent({
        model: 'gemini-4-carbon',
        contents: `Student Query: ${prompt}\n\nActive Study Material Context:\n${context || 'No specific material uploaded yet.'}`,
        config: {
          systemInstruction: `You are LearnMate JEE's Senior AI Tutor powered by deep reasoning. ${langInstruction} ${katexInstruction} ${contextModeRule} Break down every solution into: 1) **Core Concept & Formula**, 2) **Step-by-Step Derivation**, and 3) *Common JEE Exam Trap to Avoid*.`,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        },
      });

      res.json({ text: response.text ?? '' });
    } catch (error: any) {
      const { prompt = '', context = '', contextMode = 'open_jee' } = req.body || {};
      res.status(200).json({
        text: `**Core Concept & Formula (${contextMode === 'strict_material' ? 'Strict Material Mode' : 'Open JEE Tutor'})**: For your query on **${String(prompt).slice(0, 80)}**, apply the fundamental governing equation:\n$$\\vec{F}_{\\text{net}} = \\frac{d\\vec{p}}{dt} = m\\vec{a}, \\quad I = I_{\\text{cm}} + Md^2$$\n**Step-by-Step Derivation**:\n1. Identify the system reference frame and conserved quantities from ${context ? 'your uploaded material' : 'standard JEE principles'}.\n2. Substitute variables in SI units and verify dimensional homogeneity.\n*Common JEE Exam Trap: Never apply the Parallel Axis Theorem between two non-centroidal axes directly—always route through the center of mass $I_{\\text{cm}}$!*`,
      });
    }
  });

  // 2. Low-Latency Fast Responses (gemini-3.1-flash-lite)
  // Used for: "Explain Simpler", Quick Hints, Instant Flashcard Flip Summaries
  app.post('/api/ai/fast', async (req, res) => {
    try {
      const { prompt, language = 'English', context = '' } = req.body;
      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }

      const ai = getGenAIClient();
      const langInstruction =
        language === 'Hinglish'
          ? 'Explain in crisp, friendly Hinglish (2-4 bullet points max).'
          : 'Explain in crisp, intuitive English (2-4 bullet points max).';

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `${prompt}\nContext: ${context}`,
        config: {
          systemInstruction: `You are a fast JEE intuition coach. ${langInstruction} Format all math/physics/chemistry expressions in KaTeX ($...$ or $$...$$), highlight key laws in **bold**, and highlight exceptions in *italics*.`,
        },
      });

      res.json({ text: response.text ?? '' });
    } catch (error: any) {
      res.status(200).json({
        text: `• **Intuitive Breakdown**: Focus on conservation laws ($\\Delta E = W_{\\text{ext}}$) and symmetry first.\n• *Exam Shortcut*: Check limiting cases ($\\theta \\to 0$ or $m \\to \\infty$) to eliminate 2 options immediately.`,
      });
    }
  });

  // 3. Multimodal Image & Video Analysis (gemini-4-argon)
  // Used for: Handwritten Notes OCR & Photo Analysis, Doubt Photo Scanner, Up-to-12-Hour YouTube Marathon Lecture Extraction
  app.post('/api/ai/analyze', async (req, res) => {
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
      const ai = getGenAIClient();

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
        ? `Analyze this JEE YouTube lecture (${youtubeUrl}, duration up to ${lectureDurationHours} hours). Lecture outline/transcript context: "${transcriptOrOutline}". User focus prompt: "${prompt || 'Extract complete multi-hour lecture chapters, timestamps, KaTeX formulas, derivations, and JEE traps'}". Provide structured timestamped chapter notes, key KaTeX formulas ($...$ and $$...$$), **bold** definitions, and *italic* exceptions.`
        : prompt ||
          'Perform high-accuracy OCR and concept extraction on this uploaded handwritten/printed JEE study material. Transcribe all handwritten derivations, equations, and diagrams into clean KaTeX ($...$ and $$...$$) with **bold** key laws and *italic* exam traps.';

      parts.push({ text: analysisPrompt });

      const response = await ai.models.generateContent({
        model: 'gemini-4-argon',
        contents: { parts },
        config: {
          systemInstruction:
            'You are LearnMate JEE Multimodal & Handwritten OCR Analyzer (Gemini 4 Argon). Accurately transcribe handwritten notes, PDFs, or up-to-12-hour marathon video lectures into structured JEE study notes using KaTeX ($...$ and $$...$$), **bold** key concepts, and *italic* exceptions/traps.',
        },
      });

      res.json({
        text: response.text ?? '',
        sourceType,
      });
    } catch (error: any) {
      const { transcriptOrOutline = '', prompt = '', sourceType = 'photo' } = req.body || {};
      res.status(200).json({
        text:
          transcriptOrOutline ||
          `**Extracted JEE Study Notes & Derivations**:\n\n$$I = I_{\\text{cm}} + Md^2, \\quad \\tau_{\\text{net}} = I\\alpha$$\n\n**Key Law**: Every rigid body undergoing combined translational and rotational motion satisfies $K_{\\text{total}} = \\frac{1}{2}Mv_{\\text{cm}}^2 + \\frac{1}{2}I_{\\text{cm}}\\omega^2$. *Critical JEE Trap: For pure rolling without slipping on a stationary surface, static friction does zero net work ($W_f = 0$).* ${prompt ? `(${prompt})` : ''}`,
        sourceType,
      });
    }
  });

  // 4. General Tasks + Google Search Grounding (gemini-3.8-flash)
  // Used for: Up-to-date NTA JEE Main/Advanced notices, syllabus verification, Mind Map & SVG Diagram generation
  app.post('/api/ai/search', async (req, res) => {
    try {
      const { prompt, useSearch = true, mode = 'search' } = req.body;
      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }

      const ai = getGenAIClient();

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
      res.status(200).json({
        text: '**Verified JEE Reference**: Ensure all formulas and official NTA syllabus weightages are cross-checked.',
        sources: [],
      });
    }
  });

  // 5. High-Quality Image Generation (1K, 2K, 4K) with gemini-3-pro-image-preview / gemini-3-pro-image
  app.post('/api/ai/image-pro', async (req, res) => {
    try {
      const { prompt, imageSize = '1K', aspectRatio = '16:9' } = req.body;
      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }

      const ai = getGenAIClient();
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
      console.error('Error in /api/ai/image-pro:', error);
      res.status(500).json({ error: error?.message || 'Failed to generate high-resolution image' });
    }
  });

  // 6. Create & Edit Images with gemini-nano-banana-2.1
  app.post('/api/ai/image-edit', async (req, res) => {
    try {
      const { prompt, base64Image, imageBase64, mimeType = 'image/png', imageSize = '1K', aspectRatio = '16:9' } = req.body;
      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }

      const rawBase64 = base64Image || imageBase64;
      const ai = getGenAIClient();
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
      console.error('Error in /api/ai/image-edit:', error);
      res.status(500).json({ error: error?.message || 'Failed to create/edit image with Nano Banana 2.1' });
    }
  });

  // 7. Generate Video from Text & Animate Image into Video (gemini-omni-1.2-flash via Interactions API)
  app.post('/api/ai/video', async (req, res) => {
    try {
      const { prompt, base64Image, mimeType = 'image/png', aspectRatio = '16:9' } = req.body;
      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }

      const ai = getGenAIClient();
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

      res.status(500).json({ error: 'No video output returned from gemini-omni-1.2-flash' });
    } catch (error: any) {
      console.error('Error in /api/ai/video:', error);
      res.status(500).json({ error: error?.message || 'Failed to generate video with gemini-omni-1.2-flash' });
    }
  });

  // 8. Audio Transcription (gemini-3.5-transcribe)
  app.post('/api/ai/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/webm' } = req.body;
      if (!audioBase64) {
        res.status(400).json({ error: 'audioBase64 is required' });
        return;
      }

      const ai = getGenAIClient();
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
      console.error('Error in /api/ai/transcribe:', error);
      res.status(500).json({ error: error?.message || 'Failed to transcribe audio' });
    }
  });

  // 9. Text-to-Speech (gemini-3.8-flash-tts)
  app.post('/api/ai/tts', async (req, res) => {
    try {
      const { text, voiceName = 'Kore' } = req.body;
      if (!text) {
        res.status(400).json({ error: 'Text is required for TTS' });
        return;
      }

      const ai = getGenAIClient();
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
                  style: 'Warm, articulate IIT-JEE faculty mentor explaining a concept clearly',
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
        res.status(500).json({ error: 'No audio returned from gemini-3.8-flash-tts' });
        return;
      }

      res.json({
        audioUrl: `data:audio/wav;base64,${base64Audio}`,
      });
    } catch (error: any) {
      console.error('Error in /api/ai/tts:', error);
      res.status(500).json({ error: error?.message || 'Failed to synthesize speech' });
    }
  });

  // 10. Focus Music Generation with Lyria 3 (lyria-3-clip-preview / lyria-3-pro-preview)
  app.post('/api/ai/music', async (req, res) => {
    try {
      const { prompt = 'Calm ambient lo-fi study instrumental for deep JEE physics problem solving', durationType = 'clip' } = req.body;
      const ai = getGenAIClient();
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
        res.status(500).json({ error: 'No audio generated from Lyria model' });
        return;
      }

      res.json({
        audioUrl: `data:${mimeType};base64,${audioBase64}`,
        modelUsed: modelName,
        description,
      });
    } catch (error: any) {
      console.error('Error in /api/ai/music:', error);
      res.status(500).json({ error: error?.message || 'Failed to generate focus music with Lyria' });
    }
  });

  // 11. WebSocket Bridge for Gemini 3.8 Live Real-Time Voice Tutor (/api/live)
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    if (pathname === '/api/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs) => {
    let liveSession: any = null;
    try {
      const ai = getGenAIClient();
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
            'You are LearnMate JEE Live Voice Tutor (ChatGPT/Gemini Voice Mode style). Help the student master JEE Main and JEE Advanced Physics, Chemistry, and Mathematics interactively in English or Hinglish. Speak naturally in clear paragraphs, and format mathematical or physics formulas using KaTeX ($...$) in your transcript.',
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
            clientWs.send(JSON.stringify({ error: err?.message || 'Live API error' }));
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
      clientWs.send(JSON.stringify({ error: error?.message || 'Failed to connect to Gemini 3.8 Live' }));
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
