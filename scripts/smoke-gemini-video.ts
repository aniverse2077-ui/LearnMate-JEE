import 'dotenv/config';
import { getValidatedGenAIClient } from '../src/server/coreStudyEngine';
import {
  buildGeminiVideoInteractionRequest,
  extractVideoOutputFromInteraction,
} from '../src/server/routes/aiTutorRoutes';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.log(
      '[smoke:gemini-video] GEMINI_API_KEY is not set in environment; verified static request contract only (live API skipped).'
    );
    const req = buildGeminiVideoInteractionRequest({
      prompt: 'Convex lens ray optics focal convergence',
      aspectRatio: '16:9',
    });
    console.log('[smoke:gemini-video] Contract payload:', JSON.stringify(req));
    process.exit(0);
  }

  const ai = getValidatedGenAIClient();
  const payload = buildGeminiVideoInteractionRequest({
    prompt: 'Simple pendulum SHM oscillation showing restoring torque',
    aspectRatio: '16:9',
  });
  console.log(`[smoke:gemini-video] Calling live Interactions API with model=${payload.model}...`);
  const interaction = await (ai.interactions.create as any)(payload, { timeout: 120000 });
  const videoUrl = extractVideoOutputFromInteraction(interaction);
  if (!videoUrl) {
    console.error('[smoke:gemini-video] Received empty video output:', JSON.stringify(interaction).slice(0, 400));
    process.exit(1);
  }
  console.log(`[smoke:gemini-video] Success! Returned video output (${videoUrl.slice(0, 64)}...)`);
}

main().catch((err) => {
  console.error('[smoke:gemini-video] Error:', err?.message || err);
  process.exit(1);
});
