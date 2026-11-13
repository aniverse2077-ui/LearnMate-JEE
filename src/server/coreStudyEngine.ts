import { GoogleGenAI } from '@google/genai';
import { Response } from 'express';
import {
  CBTQuestion,
  CBTMockSummary,
  evaluateCBTMockAttempt,
  predictNtaPercentileAndAir,
  QuestionResponseState,
  ExamTrack,
} from '../utils/jeeEngine';

export function getValidatedGenAIClient(): GoogleGenAI {
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

export function sendStructuredUpstreamError(
  res: Response,
  error: any,
  contextLabel: string
): void {
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

export interface ServerVerifiedCbtGradeResult {
  summary: CBTMockSummary;
  scaledScoreOutOf300: number;
  percentilePrediction: ReturnType<typeof predictNtaPercentileAndAir>;
  verifiedAtIso: string;
  examMode: ExamTrack;
}

export function gradeCbtAttemptOnServer(params: {
  questions: CBTQuestion[];
  responses: Record<string, QuestionResponseState>;
  examMode?: ExamTrack;
  shiftDifficulty?: 'Easy' | 'Moderate' | 'Tough';
}): ServerVerifiedCbtGradeResult {
  const examMode: ExamTrack = params.examMode || 'JEE Main';
  const summary = evaluateCBTMockAttempt(params.questions, params.responses, examMode);
  const scaledScoreOutOf300 = Math.max(
    0,
    Math.min(300, Math.round((summary.totalScore / Math.max(1, summary.maxScore)) * 300))
  );
  const percentilePrediction = predictNtaPercentileAndAir({
    score: scaledScoreOutOf300,
    maxScore: 300,
    shiftDifficulty: params.shiftDifficulty || 'Moderate',
  });

  return {
    summary,
    scaledScoreOutOf300,
    percentilePrediction,
    verifiedAtIso: new Date().toISOString(),
    examMode,
  };
}
