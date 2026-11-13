import http from 'http';
import { WebSocketServer } from 'ws';
import { LiveServerMessage, Modality } from '@google/genai';
import { verifyStudentToken } from '../studentAuth';
import { computeRequestFingerprint } from '../middleware/authAndSecurity';
import { consumeTokenBucket } from '../middleware/rateLimiterAndQuotas';
import { getValidatedGenAIClient } from '../coreStudyEngine';

export function attachVoiceLiveWebSocketServer(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    const parsedUrl = new URL(request.url || '', `http://${request.headers.host}`);
    if (parsedUrl.pathname !== '/api/live') {
      return;
    }

    const tokenParam =
      parsedUrl.searchParams.get('token') || request.headers.authorization || '';
    const isProd = process.env.NODE_ENV === 'production';

    const verification = await verifyStudentToken(tokenParam);
    if (
      !verification.valid &&
      (isProd ||
        verification.errorCode === 'UNAUTHORIZED_DEV_TOKEN_IN_PROD' ||
        Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
    ) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const uid = verification.valid ? verification.uid : 'guest_scholar';
    const fingerprint = computeRequestFingerprint(request, uid);
    const bucket = consumeTokenBucket(fingerprint);
    if (!bucket.allowed) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (clientWs) => {
    let liveSession: any = null;
    const heartbeatTimer = setInterval(() => {
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.ping();
      }
    }, 25000);

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
              clientWs.send(
                JSON.stringify({ inputTranscript: content.inputTranscription.text })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ outputTranscript: content.outputTranscription.text })
              );
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
        clearInterval(heartbeatTimer);
        if (liveSession) {
          try {
            liveSession.close();
          } catch {
            // ignore
          }
        }
      });
    } catch (error: any) {
      clearInterval(heartbeatTimer);
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

  return wss;
}
