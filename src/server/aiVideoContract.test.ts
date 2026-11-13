import test from 'node:test';
import assert from 'node:assert/strict';

process.env.LEARNMATE_SKIP_AUTO_LISTEN = 'true';

const { buildGeminiVideoInteractionRequest, extractVideoOutputFromInteraction } = await import(
  './routes/aiTutorRoutes'
);

test('buildGeminiVideoInteractionRequest enforces gemini-omni-1.2-flash Interactions contract', () => {
  const textReq = buildGeminiVideoInteractionRequest({
    prompt: 'Wave optics interference fringes',
    aspectRatio: '16:9',
  });
  assert.equal(textReq.model, 'gemini-omni-1.2-flash');
  assert.equal(textReq.response_format.type, 'video');
  assert.equal(textReq.response_format.aspect_ratio, '16:9');
  assert.equal(textReq.response_format.duration, '8s');
  assert.equal(textReq.response_format.resolution, '720p');
  assert.equal(typeof textReq.input, 'string');

  // Invalid aspect ratio falls back safely to 16:9 and image+text forms multimodal array
  const imgReq = buildGeminiVideoInteractionRequest({
    prompt: 'Ray optics lens image formation',
    aspectRatio: 'invalid-ratio',
    imageBase64: 'data:image/png;base64,AAAA',
    imageMimeType: 'image/png',
  });
  assert.equal(imgReq.response_format.aspect_ratio, '16:9');
  assert.ok(Array.isArray(imgReq.input));
  assert.equal(imgReq.input[0].type, 'image');
  assert.equal(imgReq.input[0].data, 'AAAA');
});

test('extractVideoOutputFromInteraction handles output_video, outputs array uri/data, and empty payloads', () => {
  assert.equal(
    extractVideoOutputFromInteraction({ output_video: { data: 'QUJD', mime_type: 'video/mp4' } }),
    'data:video/mp4;base64,QUJD'
  );
  assert.equal(
    extractVideoOutputFromInteraction({ outputs: [{ type: 'video', uri: 'https://example.com/v.mp4' }] }),
    'https://example.com/v.mp4'
  );
  assert.equal(extractVideoOutputFromInteraction({ outputs: [{ type: 'text', text: 'nope' }] }), null);
  assert.equal(extractVideoOutputFromInteraction(null), null);
});
