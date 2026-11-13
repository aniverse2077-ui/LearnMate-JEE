import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { LiveServerMessage, Modality } from '@google/genai';
import { verifyStudentToken } from '../studentAuth';
import {
  computeRequestFingerprint,
  isOriginAllowed,
  logStructuredEvent,
} from '../middleware/authAndSecurity';
import { consumeDailyUidQuota, consumeTokenBucket } from '../middleware/rateLimiterAndQuotas';
import { getValidatedGenAIClient } from '../coreStudyEngine';

const MAX_WS_PAYLOAD_BYTES = 1024 * 1024; // 1 MB per frame
const WS_IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

function safeWsSend(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export function extractWsAuthToken(request: http.IncomingMessage): string {
  if (request.headers.authorization) {
    return String(request.headers.authorization);
  }
  const protocolHeader = request.headers['sec-websocket-protocol'];
  if (typeof protocolHeader === 'string') {
    const parts = protocolHeader.split(',').map((p) => p.trim());
    const authProto = parts.find((p) => p.startsWith('learnmate-auth.'));
    if (authProto) {
      return `Bearer ${authProto.slice('learnmate-auth.'.length)}`;
    }
  }
  // Security: Query-string ?token= URL credentials are intentionally unsupported.
  return '';
}

export function attachVoiceLiveWebSocketServer(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_WS_PAYLOAD_BYTES,
    handleProtocols: (protocols: Set<string>) => {
      for (const proto of protocols) {
        if (proto.startsWith('learnmate-auth.')) {
          return proto;
        }
      }
      return protocols.values().next().value || false;
    },
  });

  server.on('upgrade', async (request, socket, head) => {
    let pathname = '';
    try {
      const parsedUrl = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      pathname = parsedUrl.pathname;
    } catch {
      socket.destroy();
      return;
    }

    if (pathname !== '/api/live') {
      return;
    }

    const originHeader = request.headers.origin;
    if (!isOriginAllowed(originHeader, undefined, process.env, request.headers)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    const rawToken = extractWsAuthToken(request);
    const verification = await verifyStudentToken(rawToken);
    if (!verification.valid || !verification.uid || verification.uid === 'anonymous') {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const fingerprint = computeRequestFingerprint(request, verification.uid);
    const bucket = consumeTokenBucket(fingerprint);
    if (!bucket.allowed) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const quotaResult = await consumeDailyUidQuota(verification.uid, 900);
      if (!quotaResult.allowed) {
        socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
        socket.destroy();
        return;
      }
    } catch {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, verification.uid);
    });
  });

  wss.on('connection', async (clientWs: WebSocket, _request: http.IncomingMessage, uid?: string) => {
    let liveSession: any = null;
    let lastActivityAt = Date.now();

    const heartbeatTimer = setInterval(() => {
      if (Date.now() - lastActivityAt > WS_IDLE_TIMEOUT_MS) {
        safeWsSend(clientWs, {
          errorCode: 'LIVE_WS_IDLE_TIMEOUT',
          error: 'Voice tutor session closed due to 15 minutes of inactivity.',
        });
        clientWs.close(1000, 'Idle timeout');
        return;
      }
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.ping();
      }
    }, 25000);

    try {
      const ai = getValidatedGenAIClient();
      const sessionPromise = ai.live.connect({
        model: process.env.GEMINI_MODEL_LIVE || 'gemini-3.8-live',
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
            lastActivityAt = Date.now();
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              safeWsSend(clientWs, { inputTranscript: content.inputTranscription.text });
            }
            if (content?.outputTranscription?.text) {
              safeWsSend(clientWs, { outputTranscript: content.outputTranscription.text });
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                safeWsSend(clientWs, { audio: part.inlineData.data });
              }
            }
            if (content?.interrupted) {
              safeWsSend(clientWs, { interrupted: true });
            }
          },
          onerror: (err: any) => {
            safeWsSend(clientWs, {
              errorCode: 'LIVE_WS_ERROR',
              error: err?.message || 'Live API error',
              retryAfterSeconds: 5,
            });
          },
        },
      });

      liveSession = await sessionPromise;
      safeWsSend(clientWs, { status: 'connected' });

      clientWs.on('message', (raw) => {
        lastActivityAt = Date.now();
        try {
          const text = raw.toString();
          if (text.length > MAX_WS_PAYLOAD_BYTES) {
            safeWsSend(clientWs, {
              errorCode: 'PAYLOAD_TOO_LARGE',
              error: 'Audio/text frame exceeds 1 MB limit.',
            });
            return;
          }
          const msg = JSON.parse(text);
          if (typeof msg?.audio === 'string' && msg.audio.length > 0) {
            sessionPromise
              .then((s) =>
                s.sendRealtimeInput({
                  audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
                })
              )
              .catch(() => {
                // handled in close/onerror
              });
          } else if (typeof msg?.text === 'string' && msg.text.trim().length > 0) {
            sessionPromise
              .then((s) =>
                s.sendRealtimeInput({
                  text: msg.text.slice(0, 4000),
                })
              )
              .catch(() => {
                // handled in close/onerror
              });
          }
        } catch {
          logStructuredEvent('warn', 'ws_malformed_message', {
            uid: uid ? `${uid.slice(0, 6)}...` : 'unknown',
          });
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
      logStructuredEvent('error', 'ws_live_init_failed', {
        uid: uid ? `${uid.slice(0, 6)}...` : 'unknown',
        errorCode: error?.errorCode || 'LIVE_SESSION_UNAVAILABLE',
      });
      safeWsSend(clientWs, {
        errorCode: error?.errorCode || 'LIVE_SESSION_UNAVAILABLE',
        error: error?.message || 'Failed to connect to Gemini 3.8 Live',
        retryAfterSeconds: 10,
      });
      if (clientWs.readyState === clientWs.OPEN || clientWs.readyState === clientWs.CONNECTING) {
        clientWs.close();
      }
    }
  });

  return wss;
}
