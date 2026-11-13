import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getExamSpecByVersion, OFFICIAL_EXAM_SPECS } from '../config/examSpecs';
import { evaluateSingleQuestionMarks } from './jeeEngine';
import { buildGroundedMaterialStudyBundle, splitSourceIntoPages } from '../services/studyBundleBuilder';
import {
  extractYouTubeVideoId,
  parseSrtVttOrTimestampTranscript,
  splitDocumentIntoChunks,
} from '../services/ingestionJobsService';

test('Official JEE Main 2027 Paper 1 spec enforces 75 compulsory Qs and -1 Section B negative marking', () => {
  const spec = getExamSpecByVersion('jee-main-2027-paper1');
  assert.equal(spec.totalQuestions, 75);
  assert.equal(spec.maxMarks, 300);
  const secB = spec.sections.find((s) => s.id === 'Section B');
  assert.ok(secB);
  assert.equal(secB.compulsoryAttemptCount, 5);
  assert.equal(secB.correctMarks, 4);
  assert.equal(secB.wrongMarks, -1);

  const histSpec = OFFICIAL_EXAM_SPECS['jee-main-2024-historical'];
  assert.equal(histSpec.totalQuestions, 90);
});

test('Official question evaluator applies strict Section B -1 and JEE Advanced 0 negative marking cleanly', () => {
  const mainNumQ = {
    id: 'q-main-num',
    number: 21,
    subject: 'Physics' as const,
    section: 'Section B' as const,
    chapter: 'Electrostatics',
    stem: 'Find E',
    options: [],
    correctIndex: 0,
    numericalAnswer: 42,
    numericalTolerance: 0.01,
    explanation: 'E = 42',
    examType: 'JEE Main' as const,
  };

  assert.equal(
    evaluateSingleQuestionMarks(mainNumQ, {
      status: 'answered',
      selectedOption: null,
      numericalValue: '42',
      timeSpentSec: 10,
    }).marksAwarded,
    4
  );

  // Wrong numerical in JEE Main 2027 gets -1
  assert.equal(
    evaluateSingleQuestionMarks(mainNumQ, {
      status: 'answered',
      selectedOption: null,
      numericalValue: '41',
      timeSpentSec: 10,
    }).marksAwarded,
    -1
  );

  // Strict rounding rejects 42.6 when tolerance is tight
  assert.equal(
    evaluateSingleQuestionMarks(mainNumQ, {
      status: 'answered',
      selectedOption: null,
      numericalValue: '42.6',
      timeSpentSec: 10,
    }).isCorrect,
    false
  );

  const advNumQ = {
    ...mainNumQ,
    id: 'q-adv-num',
    examType: 'JEE Advanced' as const,
    advancedFormat: 'numerical' as const,
  };
  assert.equal(
    evaluateSingleQuestionMarks(advNumQ, {
      status: 'answered',
      selectedOption: null,
      numericalValue: '99',
      timeSpentSec: 10,
    }).marksAwarded,
    0
  );
});

test('Grounded study bundle builder preserves multi-page text and never injects unrelated formulas', () => {
  const pagesText = Array.from({ length: 62 }, (_, idx) => {
    const p = idx + 1;
    return `[Page ${p}] Thermodynamics lecture note page ${p}: First law states $$\\Delta Q = \\Delta U + P\\Delta V$$ for ideal gas processes.`;
  }).join('\n\n');

  const bundle = buildGroundedMaterialStudyBundle({
    materialId: 'mat-thermo-62p',
    title: 'Thermodynamics 62-Page Notes.pdf',
    subject: 'Physics',
    chapter: 'Thermodynamics',
    sourceType: 'pdf',
    rawText: pagesText,
  });

  assert.equal(bundle.pages.length, 62);
  assert.equal(bundle.extractionQuality, 'full');
  assert.equal(bundle.provenance, 'source_extracted');
  assert.ok(bundle.formulas.some((f) => f.formula.includes('\\Delta Q')));
  // Verify unrelated chapter formulas (like Rotational Inertia or Biot-Savart) are NOT fabricated into Thermodynamics bundle
  const joinedFormulas = bundle.formulas.map((f) => f.formula).join(' ');
  assert.ok(!joinedFormulas.includes('Biot'));
  assert.ok(!joinedFormulas.includes('I_{com}'));

  const split = splitSourceIntoPages('', 'pdf');
  assert.equal(split.extractionQuality, 'needs_ocr');
});

test('Long 60+ page document chunker indexes all pages without clipping', () => {
  const raw = Array.from({ length: 65 }, (_, i) => `[Page ${i + 1}] Electrostatics Gauss law note ${i + 1}.`).join('\n\n');
  const { chunks, pageCount } = splitDocumentIntoChunks({
    uid: 'student-1',
    materialId: 'mat-65',
    rawText: raw,
  });
  assert.equal(pageCount, 65);
  assert.equal(chunks.length, 65);
  assert.equal(chunks[64].pageNumber, 65);
});

test('YouTube URL parser supports watch, shorts, live, youtu.be and parses SRT/VTT captions accurately', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=120'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://evil.example.com/watch?v=12345'), null);

  const srt = `1
00:00:05,000 --> 00:00:12,000
Newton second law relates net external force F to rate of change of momentum dp/dt.

2
00:05:10,000 --> 00:05:25,000
For variable mass rocket propulsion, thrust equals v_rel * (dm/dt).`;

  const segments = parseSrtVttOrTimestampTranscript(srt);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].timestampLabel, '00:00:05');
  assert.match(segments[0].text, /Newton second law/);
  assert.equal(segments[1].timestampLabel, '00:05:10');
});

test('Lazy PYQ JSON packs include provenance metadata and partial archive disclosures', () => {
  const mainPack = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'public/pyq-packs/jee-main-shifts.json'), 'utf8')
  );
  const advPack = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'public/pyq-packs/jee-advanced-papers.json'), 'utf8')
  );

  assert.equal(mainPack.isPartialArchive, true);
  assert.ok(Array.isArray(mainPack.questions) && mainPack.questions.length > 0);
  for (const q of mainPack.questions) {
    assert.ok(q.provenanceType);
    assert.ok(q.examVersion);
  }

  assert.equal(advPack.isPartialArchive, true);
  assert.ok(Array.isArray(advPack.questions) && advPack.questions.length > 0);
});
