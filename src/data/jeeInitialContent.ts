import { CBTQuestion, QuestionResponseState } from '../utils/jeeEngine';
import { Preset3DId } from '../components/ThreeSceneCanvas';
import { EXPANDED_NTA_58_CHAPTERS } from './expandedNta58Chapters';
import {
  buildGroundedMaterialStudyBundle,
  ContentProvenance,
  ExtractionQuality,
} from '../services/studyBundleBuilder';

export type { ContentProvenance, ExtractionQuality };

export interface NotePageData {
  pageNumber: number;
  heading: string;
  timestampRange?: string; // For up to 12-hour YouTube marathon lectures
  sections: {
    numberTitle: string;
    paragraphs?: string[];
    bullets?: string[];
    formulas?: string[];
  }[];
  aiTutorSummary: {
    english: string;
    hinglish: string;
  };
}

export interface MindMapSubNode {
  id: string;
  label: string;
  formulaLatex?: string;
  microNote: string;
}

export interface MindMapNodeItem {
  id: string;
  title: string;
  subtitle: string;
  colorClass: string;
  borderClass: string;
  pageRef: string;
  definition: string;
  example: string;
  commonTrap: string;
  formulaLatex?: string;
  badgeType?: 'High Weightage' | 'Formula' | 'Exception Trap';
  subNodes?: MindMapSubNode[];
}

export interface StickyNoteData {
  id: string;
  title: string;
  body: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  color: 'amber' | 'emerald' | 'indigo' | 'rose';
}

export interface FormulaCardEntry {
  id: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  title: string;
  formula: string;
  variables?: string;
  units?: string;
  notes: string;
}

export interface MaterialStudyBundle {
  materialId: string;
  title: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
  originalFileUrl?: string;
  originalMimeType?: string;
  rawText: string;
  provenance?: ContentProvenance;
  extractionQuality?: ExtractionQuality;
  contentHash?: string;
  pages: NotePageData[];
  mindMapNodes: MindMapNodeItem[];
  stickyNotes: StickyNoteData[];
  formulas: FormulaCardEntry[];
  quizQuestions: CBTQuestion[];
}

/**
 * Generates a grounded MaterialStudyBundle strictly from user-uploaded PDF,
 * Handwritten Photo, YouTube Transcript/SRT, Paste Text, or Google Drive material.
 * Never injects unrelated formula banks or fabricated lecture timestamps.
 */
export function generateMaterialStudyBundle(params: {
  materialId: string;
  title: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
  rawText: string;
  durationHours?: number;
  originalFileUrl?: string;
  originalMimeType?: string;
}): MaterialStudyBundle {
  return buildGroundedMaterialStudyBundle({
    ...params,
    fallbackQuizPool: typeof CBT_MOCK_QUESTIONS !== 'undefined' ? CBT_MOCK_QUESTIONS : [],
  });
}

// Clean Zero-State Exports (Empty until user uploads material)
export const D_AND_F_BLOCK_PAGES: NotePageData[] = [];
export const D_AND_F_MIND_MAP_NODES: MindMapNodeItem[] = [];
export const MIND_MAP_CHAPTERS: Record<string, MindMapNodeItem[]> = {};
export const FORMULA_BOOK_ENTRIES: FormulaCardEntry[] = [];

export interface SyllabusChapterItem {
  id: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  subDiscipline?: 'Mechanics' | 'Electrodynamics' | 'Optics & Modern' | 'Thermal & Waves' | 'Physical' | 'Inorganic' | 'Organic' | 'Algebra' | 'Calculus' | 'Coordinate & Vectors';
  chapter: string;
  classLevel: '11' | '12' | '11th' | '12th';
  weightage: 'High' | 'Medium' | 'Low';
  weightageTier: 'High' | 'Medium' | 'Low';
  examScope: 'Main+Advanced' | 'Advanced-Only';
  expectedQs: string;
  unitSummary: string;
  defaultCompleted: boolean;
}

export const JEE_SYLLABUS_DATA: SyllabusChapterItem[] = EXPANDED_NTA_58_CHAPTERS.map(
  (ch) => ({
    id: ch.id,
    subject: ch.subject,
    subDiscipline:
      ch.branch === 'Thermodynamics'
        ? 'Thermal & Waves'
        : ch.branch === 'Optics' || ch.branch === 'Modern'
        ? 'Optics & Modern'
        : ch.branch === 'Coordinate Geometry' || ch.branch === 'Vectors & 3D'
        ? 'Coordinate & Vectors'
        : (ch.branch as SyllabusChapterItem['subDiscipline']) || 'Mechanics',
    chapter: ch.chapterName,
    classLevel: ch.classLevel,
    weightage: ch.weightageTier,
    weightageTier: ch.weightageTier,
    examScope: ch.syllabusScope,
    expectedQs: ch.expectedQs,
    unitSummary: `${ch.unitName} (NCERT Ch. ${ch.ncertChapterNumber}, Weightage: ${ch.ntaWeightagePct}%) — Key Formulas: ${ch.keyFormulasLatex
      .map((f) => `$${f}$`)
      .join(' , ')}`,
    defaultCompleted: false,
  })
);

export const DIAGRAM_SVG_PRESETS: Record<Preset3DId, string> = {
  Incline: `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrow-black" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#111827"/>
      </marker>
      <marker id="arrow-emerald" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#059669"/>
      </marker>
      <marker id="arrow-rose" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#DC2626"/>
      </marker>
      <marker id="arrow-indigo" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#4F46E5"/>
      </marker>
    </defs>
    <rect width="680" height="420" fill="#FFFFFF" />
    <polygon points="100,340 560,340 560,150" fill="#F1F5F9" stroke="#0F172A" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 190,340 A 90,90 0 0,0 182,306" fill="#DBEAFE" fill-opacity="0.7" stroke="#1E40AF" stroke-width="2.2"/>
    <text x="202" y="328" font-family="Georgia, serif" font-style="italic" font-size="24" fill="#1E40AF">θ</text>
    <g transform="translate(340, 241) rotate(-22.44)">
      <rect x="-58" y="-62" width="116" height="62" rx="4" fill="#E0E7FF" stroke="#1E1B4B" stroke-width="3"/>
      <text x="-10" y="-24" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="22" fill="#1E1B4B">m</text>
      <!-- Normal reaction N -->
      <line x1="0" y1="-62" x2="0" y2="-165" stroke="#059669" stroke-width="3.2" marker-end="url(#arrow-emerald)"/>
      <text x="-10" y="-176" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="23" fill="#059669">N</text>
      <!-- Friction f_s up the incline -->
      <line x1="58" y1="-31" x2="145" y2="-31" stroke="#4F46E5" stroke-width="3" marker-end="url(#arrow-indigo)"/>
      <text x="152" y="-25" font-family="Georgia, serif" font-style="italic" font-size="20" fill="#4F46E5">f = μN</text>
      <!-- mg sin(theta) down the incline -->
      <line x1="-58" y1="-31" x2="-148" y2="-31" stroke="#DC2626" stroke-width="2.5" stroke-dasharray="5,3" marker-end="url(#arrow-rose)"/>
      <text x="-235" y="-25" font-family="Georgia, serif" font-style="italic" font-size="19" fill="#DC2626">mg sin θ</text>
      <!-- mg cos(theta) into the incline -->
      <line x1="0" y1="0" x2="0" y2="95" stroke="#64748B" stroke-width="2.2" stroke-dasharray="5,3" marker-end="url(#arrow-black)"/>
      <text x="12" y="92" font-family="Georgia, serif" font-style="italic" font-size="18" fill="#334155">mg cos θ</text>
    </g>
    <!-- True Vertical Gravity mg -->
    <line x1="328" y1="212" x2="328" y2="332" stroke="#DC2626" stroke-width="3.4" marker-end="url(#arrow-rose)"/>
    <text x="290" y="362" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="24" fill="#DC2626">mg</text>
    <text x="110" y="52" font-family="Plus Jakarta Sans, sans-serif" font-weight="bold" font-size="16" fill="#0F172A">Free-Body Resolution: N = mg cos θ,  a = g(sin θ − μ cos θ)</text>
  </svg>`,
  'Convex Lens': `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrow-opt" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="#1E293B"/>
      </marker>
    </defs>
    <rect width="680" height="420" fill="#FFFFFF"/>
    <line x1="40" y1="210" x2="640" y2="210" stroke="#64748B" stroke-width="2" stroke-dasharray="6,4"/>
    <path d="M 340,75 Q 388,210 340,345 Q 292,210 340,75 Z" fill="#DBEAFE" fill-opacity="0.65" stroke="#1E40AF" stroke-width="3"/>
    <line x1="340" y1="75" x2="340" y2="345" stroke="#93C5FD" stroke-width="1.5" stroke-dasharray="4,4"/>
    <line x1="160" y1="210" x2="160" y2="120" stroke="#059669" stroke-width="3.5" marker-end="url(#arrow-opt)"/>
    <line x1="160" y1="120" x2="340" y2="120" stroke="#4F46E5" stroke-width="2.5"/>
    <line x1="340" y1="120" x2="540" y2="290" stroke="#4F46E5" stroke-width="2.5" marker-end="url(#arrow-opt)"/>
    <line x1="160" y1="120" x2="540" y2="290" stroke="#D97706" stroke-width="2.5" marker-end="url(#arrow-opt)"/>
    <line x1="510" y1="210" x2="510" y2="276" stroke="#DC2626" stroke-width="3.5" marker-end="url(#arrow-opt)"/>
    <circle cx="240" cy="210" r="4" fill="#1E293B"/><text x="230" y="232" font-family="Georgia, serif" font-style="italic" font-size="18">F₁</text>
    <circle cx="140" cy="210" r="4" fill="#1E293B"/><text x="126" y="232" font-family="Georgia, serif" font-style="italic" font-size="18">2F₁</text>
    <circle cx="440" cy="210" r="4" fill="#1E293B"/><text x="432" y="232" font-family="Georgia, serif" font-style="italic" font-size="18">F₂</text>
    <circle cx="540" cy="210" r="4" fill="#1E293B"/><text x="530" y="232" font-family="Georgia, serif" font-style="italic" font-size="18">2F₂</text>
    <text x="138" y="108" font-family="Georgia, serif" font-size="17" fill="#059669">Object (AB)</text>
    <text x="480" y="308" font-family="Georgia, serif" font-size="17" fill="#DC2626">Real Image (A'B')</text>
    <text x="195" y="48" font-family="Georgia, serif" font-style="italic" font-size="19" fill="#0F172A">1/v − 1/u = 1/f ,   m = v/u</text>
  </svg>`,
  'RC Circuit': `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="680" height="420" fill="#FFFFFF"/>
    <path d="M 150,280 L 150,120 L 240,120 L 252,102 L 272,138 L 292,102 L 312,138 L 332,102 L 344,120 L 520,120 L 520,188" fill="none" stroke="#0F172A" stroke-width="3"/>
    <line x1="485" y1="188" x2="555" y2="188" stroke="#4F46E5" stroke-width="4"/>
    <line x1="485" y1="215" x2="555" y2="215" stroke="#4F46E5" stroke-width="4"/>
    <path d="M 520,215 L 520,310 L 360,310" fill="none" stroke="#0F172A" stroke-width="3"/>
    <line x1="330" y1="310" x2="150" y2="310" stroke="#0F172A" stroke-width="3"/>
    <line x1="330" y1="285" x2="330" y2="335" stroke="#059669" stroke-width="4"/>
    <line x1="350" y1="297" x2="350" y2="323" stroke="#059669" stroke-width="2.5"/>
    <text x="275" y="85" font-family="Georgia, serif" font-style="italic" font-size="24" fill="#0F172A">R</text>
    <text x="572" y="210" font-family="Georgia, serif" font-style="italic" font-size="22" fill="#4F46E5">C (q(t) = CV(1 − e^(−t/RC)))</text>
    <text x="295" y="365" font-family="Georgia, serif" font-style="italic" font-size="21" fill="#059669">ε, Time Constant τ = RC</text>
  </svg>`,
  VSEPR: `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="680" height="420" fill="#FFFFFF"/>
    <polygon points="340,80 490,185 450,260 340,340 190,235 230,160" fill="#EEF2FF" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="5,5"/>
    <line x1="340" y1="210" x2="340" y2="85" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="340" y1="210" x2="340" y2="335" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="340" y1="210" x2="480" y2="175" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="340" y1="210" x2="200" y2="245" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="340" y1="210" x2="445" y2="255" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="340" y1="210" x2="235" y2="165" stroke="#1E293B" stroke-width="3.5"/>
    <circle cx="340" cy="210" r="32" fill="#4F46E5" stroke="#1E1B4B" stroke-width="2.5"/>
    <text x="322" y="217" font-family="Plus Jakarta Sans, sans-serif" font-weight="bold" font-size="18" fill="#FFFFFF">M³⁺</text>
    <circle cx="340" cy="80" r="20" fill="#10B981"/><text x="331" y="85" font-size="13" fill="#FFF" font-weight="bold">L</text>
    <circle cx="340" cy="340" r="20" fill="#10B981"/><text x="331" y="345" font-size="13" fill="#FFF" font-weight="bold">L</text>
    <circle cx="485" cy="175" r="20" fill="#10B981"/><text x="476" y="180" font-size="13" fill="#FFF" font-weight="bold">L</text>
    <circle cx="195" cy="245" r="20" fill="#10B981"/><text x="186" y="250" font-size="13" fill="#FFF" font-weight="bold">L</text>
    <circle cx="450" cy="255" r="20" fill="#10B981"/><text x="441" y="260" font-size="13" fill="#FFF" font-weight="bold">L</text>
    <circle cx="230" cy="165" r="20" fill="#10B981"/><text x="221" y="170" font-size="13" fill="#FFF" font-weight="bold">L</text>
    <text x="225" y="392" font-family="Georgia, serif" font-size="19" fill="#0F172A">Octahedral Geometry (sp³d² / d²sp³ · 90° &amp; 180° Bond Angles)</text>
  </svg>`,
  Parabola: `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="680" height="420" fill="#FFFFFF"/>
    <line x1="80" y1="210" x2="600" y2="210" stroke="#475569" stroke-width="2"/>
    <line x1="260" y1="40" x2="260" y2="380" stroke="#475569" stroke-width="2"/>
    <line x1="170" y1="40" x2="170" y2="380" stroke="#EF4444" stroke-width="2.5" stroke-dasharray="6,4"/>
    <path d="M 520,50 Q 0,210 520,370" fill="none" stroke="#4F46E5" stroke-width="3.5"/>
    <circle cx="350" cy="210" r="6" fill="#059669"/>
    <text x="342" y="236" font-family="Georgia, serif" font-style="italic" font-size="19" fill="#059669">Focus S(a, 0)</text>
    <text x="95" y="65" font-family="Georgia, serif" font-style="italic" font-size="17" fill="#EF4444">Directrix x = −a</text>
    <text x="455" y="105" font-family="Georgia, serif" font-style="italic" font-size="22" fill="#4F46E5">y² = 4ax (L.R. = 4a)</text>
  </svg>`,
  Ellipse: `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="680" height="420" fill="#FFFFFF"/>
    <line x1="60" y1="210" x2="620" y2="210" stroke="#475569" stroke-width="2"/>
    <line x1="340" y1="40" x2="340" y2="380" stroke="#475569" stroke-width="2"/>
    <ellipse cx="340" cy="210" rx="200" ry="115" fill="#EEF2FF" fill-opacity="0.5" stroke="#4F46E5" stroke-width="3.5"/>
    <circle cx="220" cy="210" r="5" fill="#DC2626"/><text x="202" y="235" font-family="Georgia, serif" font-style="italic" font-size="18">F₁(−ae, 0)</text>
    <circle cx="460" cy="210" r="5" fill="#DC2626"/><text x="442" y="235" font-family="Georgia, serif" font-style="italic" font-size="18">F₂(ae, 0)</text>
    <text x="445" y="95" font-family="Georgia, serif" font-style="italic" font-size="20" fill="#4F46E5">x²/a² + y²/b² = 1,  b² = a²(1 − e²)</text>
  </svg>`,
};

// Base high-yield PYQ templates used to construct the full 75-Question NTA JEE Main Paper
// (25 Physics: 20 MCQ + 5 Numerical, 25 Chemistry: 20 MCQ + 5 Numerical, 25 Mathematics: 20 MCQ + 5 Numerical)
const BASE_PHYSICS_MCQS: Omit<CBTQuestion, 'id' | 'number'>[] = [
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Laws of Motion',
    stem: 'A block of mass $m = 2\\text{ kg}$ rests on a smooth inclined plane of angle $\\theta = 30^\\circ$. The normal reaction $N$ exerted by the incline is (take $g = 10\\text{ m/s}^2$):',
    stemHindi: '$m = 2\\text{ kg}$ द्रव्यमान का एक गुटका $\\theta = 30^\\circ$ कोण वाले चिकने नत समतल पर रखा है। समतल द्वारा लगाया गया अभिलंब प्रतिक्रिया बल $N$ है ($g = 10\\text{ m/s}^2$):',
    options: ['$10\\text{ N}$', '$10\\sqrt{3}\\text{ N}$', '$20\\text{ N}$', '$5\\text{ N}$'],
    optionsHindi: ['$10\\text{ N}$', '$10\\sqrt{3}\\text{ N}$', '$20\\text{ N}$', '$5\\text{ N}$'],
    correctIndex: 1,
    explanation: '**Equilibrium perpendicular to incline**: $N = mg\\cos(30^\\circ) = 2 \\times 10 \\times \\frac{\\sqrt{3}}{2} = 10\\sqrt{3}\\text{ N}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024 Shift 1',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Electrostatics & Capacitors',
    stem: 'A parallel plate capacitor of capacitance $C$ is charged to potential $V$. If the separation between plates is doubled after disconnecting the battery, the new electrostatic energy stored is:',
    stemHindi: 'धारिता $C$ के एक समांतर प्लेट संधारित्र को विभव $V$ तक आवेशित किया जाता है। बैटरी हटाने के बाद प्लेटों के बीच की दूरी दोगुनी करने पर संचित ऊर्जा होगी:',
    options: ['$\\frac{1}{2}CV^2$', '$CV^2$', '$\\frac{1}{4}CV^2$', '$2CV^2$'],
    optionsHindi: ['$\\frac{1}{2}CV^2$', '$CV^2$', '$\\frac{1}{4}CV^2$', '$2CV^2$'],
    correctIndex: 1,
    explanation: '*Battery disconnected implies charge $Q = CV$ remains constant.* Since $C\' = C/2$, new energy $U\' = \\frac{Q^2}{2C\'} = 2\\left(\\frac{1}{2}CV^2\\right) = CV^2$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024 Shift 2',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Rotational Motion',
    stem: 'The moment of inertia of a uniform solid sphere of mass $M$ and radius $R$ about a tangent to its surface is:',
    stemHindi: 'द्रव्यमान $M$ और त्रिज्या $R$ के एकसमान ठोस गोले का उसकी स्पर्श रेखा के परितः जड़त्व आघूर्ण है:',
    options: ['$\\frac{2}{5}MR^2$', '$\\frac{7}{5}MR^2$', '$\\frac{5}{3}MR^2$', '$\\frac{3}{5}MR^2$'],
    optionsHindi: ['$\\frac{2}{5}MR^2$', '$\\frac{7}{5}MR^2$', '$\\frac{5}{3}MR^2$', '$\\frac{3}{5}MR^2$'],
    correctIndex: 1,
    explanation: '**Parallel Axis Theorem**: $I_{\\text{tangent}} = I_{\\text{CM}} + MR^2 = \\frac{2}{5}MR^2 + MR^2 = \\frac{7}{5}MR^2$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Current Electricity',
    stem: 'Three identical resistors of $6\\,\\Omega$ each are connected in parallel across an ideal $12\\text{ V}$ cell. The total current drawn from the cell is:',
    stemHindi: '$6\\,\\Omega$ के तीन समान प्रतिरोध $12\\text{ V}$ सेल के समांतर क्रम में जुड़े हैं। सेल से प्रवाहित कुल धारा है:',
    options: ['$2\\text{ A}$', '$6\\text{ A}$', '$4\\text{ A}$', '$1.5\\text{ A}$'],
    optionsHindi: ['$2\\text{ A}$', '$6\\text{ A}$', '$4\\text{ A}$', '$1.5\\text{ A}$'],
    correctIndex: 1,
    explanation: '$R_{\\text{eq}} = \\frac{6}{3} = 2\\,\\Omega \\implies I = \\frac{V}{R_{\\text{eq}}} = \\frac{12}{2} = 6\\text{ A}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Ray & Wave Optics',
    stem: 'In Young’s double-slit experiment, if the slit separation $d$ is halved and screen distance $D$ is doubled, the fringe width $\\beta$ becomes:',
    stemHindi: 'यंग के द्वि-झिरी प्रयोग में यदि $d$ को आधा और $D$ को दोगुना कर दिया जाए, तो फ्रिंज चौड़ाई $\\beta$ हो जाती है:',
    options: ['$2\\beta$', '$4\\beta$', '$\\beta/2$', 'Unchanged'],
    optionsHindi: ['$2\\beta$', '$4\\beta$', '$\\beta/2$', 'अपूर्वर्तित'],
    correctIndex: 1,
    explanation: '**Fringe width formula**: $\\beta = \\frac{\\lambda D}{d}$. With $D\'=2D$ and $d\'=d/2$, $\\beta\' = \\frac{\\lambda(2D)}{d/2} = 4\\beta$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024',
  },
];

const BASE_PHYSICS_NUMERICALS: Omit<CBTQuestion, 'id' | 'number'>[] = [
  {
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Work, Energy and Power',
    stem: 'A particle moves along the $x$-axis from $x = 0$ to $x = 4\\text{ m}$ under a variable force $F(x) = (3x^2 + 2)\\text{ N}$. The work done (in Joules) is:',
    stemHindi: 'एक कण परिवर्ती बल $F(x) = (3x^2 + 2)\\text{ N}$ के अधीन $x = 0$ से $x = 4\\text{ m}$ तक गति करता है। किया गया कार्य (Joule में) है:',
    options: ['64', '72', '50', '48'],
    correctIndex: 1,
    numericalAnswer: 72,
    explanation: '$$W = \\int_{0}^{4} (3x^2 + 2)\\,dx = \\left[x^3 + 2x\\right]_0^4 = 64 + 8 = 72\\text{ J}$$',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024 Numerical',
  },
];

const BASE_CHEM_MCQS: Omit<CBTQuestion, 'id' | 'number'>[] = [
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'd & f Block Elements',
    stem: 'Which of the following 3d-series ions has the maximum spin-only magnetic moment ($\\mu_{\\text{spin}} = \\sqrt{n(n+2)}\\text{ BM}$)?',
    stemHindi: 'निम्नलिखित में से किस आयन का प्रचक्रण-मात्र चुंबकीय आघूर्ण ($\\mu_{\\text{spin}}$) अधिकतम है?',
    options: ['$\\text{Sc}^{3+}$', '$\\text{Ti}^{3+}$', '$\\text{Mn}^{2+}$', '$\\text{Zn}^{2+}$'],
    optionsHindi: ['$\\text{Sc}^{3+}$', '$\\text{Ti}^{3+}$', '$\\text{Mn}^{2+}$', '$\\text{Zn}^{2+}$'],
    correctIndex: 2,
    explanation: '$\\text{Mn}^{2+}$ ($[\\text{Ar}]\\,3d^5$) has $n = 5$ unpaired electrons $\\implies \\mu = \\sqrt{5(5+2)} = \\sqrt{35} \\approx 5.92\\text{ BM}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024 Shift 1',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Electrochemistry',
    stem: 'For the cell reaction $\\text{Zn(s)} + \\text{Cu}^{2+}(0.01\\text{ M}) \\to \\text{Zn}^{2+}(1.0\\text{ M}) + \\text{Cu(s)}$ with $E^\\circ_{\\text{cell}} = 1.10\\text{ V}$ at $298\\text{ K}$, the EMF $E_{\\text{cell}}$ is approximately:',
    stemHindi: 'सेल अभिक्रिया $\\text{Zn(s)} + \\text{Cu}^{2+}(0.01\\text{ M}) \\to \\text{Zn}^{2+}(1.0\\text{ M}) + \\text{Cu(s)}$ के लिए $298\\text{ K}$ पर $E_{\\text{cell}}$ का मान है:',
    options: ['$1.04\\text{ V}$', '$1.16\\text{ V}$', '$1.10\\text{ V}$', '$0.98\\text{ V}$'],
    optionsHindi: ['$1.04\\text{ V}$', '$1.16\\text{ V}$', '$1.10\\text{ V}$', '$0.98\\text{ V}$'],
    correctIndex: 0,
    explanation: '**Nernst Equation**: $E_{\\text{cell}} = 1.10 - \\frac{0.0591}{2}\\log_{10}\\left(\\frac{1.0}{0.01}\\right) = 1.10 - 0.02955 \\times 2 \\approx 1.04\\text{ V}$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024 Shift 2',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Chemical Bonding & VSEPR',
    stem: 'Which of the following molecules has a T-shaped geometry according to VSEPR theory?',
    stemHindi: 'VSEPR सिद्धांत के अनुसार निम्नलिखित में से किस अणु की ज्यामिति T-आकार की है?',
    options: ['$\\text{BF}_3$', '$\\text{ClF}_3$', '$\\text{SF}_4$', '$\\text{XeF}_4$'],
    optionsHindi: ['$\\text{BF}_3$', '$\\text{ClF}_3$', '$\\text{SF}_4$', '$\\text{XeF}_4$'],
    correctIndex: 1,
    explanation: '$\\text{ClF}_3$ has $3$ bond pairs and $2$ equatorial lone pairs ($sp^3d$, trigonal bipyramidal electronic geometry) $\\implies$ **bent T-shaped** molecular geometry.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Coordination Compounds',
    stem: 'The crystal field stabilization energy (CFSE) for a high-spin $d^4$ octahedral complex is:',
    stemHindi: 'उच्च-प्रचक्रण $d^4$ अष्टफलकीय संकुल के लिए क्रिस्टल क्षेत्र स्थायीकरण ऊर्जा (CFSE) है:',
    options: ['$-0.6\\,\\Delta_o$', '$-1.6\\,\\Delta_o + P$', '$-1.2\\,\\Delta_o$', '$-0.4\\,\\Delta_o$'],
    optionsHindi: ['$-0.6\\,\\Delta_o$', '$-1.6\\,\\Delta_o + P$', '$-1.2\\,\\Delta_o$', '$-0.4\\,\\Delta_o$'],
    correctIndex: 0,
    explanation: 'For high-spin $d^4$ ($t_{2g}^3 e_g^1$), $\\text{CFSE} = 3(-0.4\\,\\Delta_o) + 1(+0.6\\,\\Delta_o) = -0.6\\,\\Delta_o$.',
    difficultyBucket: 'Advanced Climb',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Chemical Thermodynamics',
    stem: 'For a spontaneous process at constant temperature and pressure, the Gibbs free energy change satisfies:',
    stemHindi: 'नियत ताप और दाब पर स्वतः प्रवर्तित प्रक्रम के लिए गिब्स मुक्त ऊर्जा परिवर्तन है:',
    options: ['$\\Delta G_{T,P} < 0$', '$\\Delta G_{T,P} > 0$', '$\\Delta G_{T,P} = 0$', '$\\Delta H > 0$'],
    optionsHindi: ['$\\Delta G_{T,P} < 0$', '$\\Delta G_{T,P} > 0$', '$\\Delta G_{T,P} = 0$', '$\\Delta H > 0$'],
    correctIndex: 0,
    explanation: '**Criterion of Spontaneity**: At constant $T$ and $P$, $\\Delta G = \\Delta H - T\\Delta S < 0$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
];

const BASE_CHEM_NUMERICALS: Omit<CBTQuestion, 'id' | 'number'>[] = [
  {
    subject: 'Chemistry',
    section: 'Section B',
    chapter: 'Chemical Bonding',
    stem: 'According to VSEPR theory, the number of lone pairs on the central $\\text{S}$ atom in an $\\text{SF}_6$ molecule is:',
    stemHindi: 'VSEPR सिद्धांत के अनुसार, $\\text{SF}_6$ अणु में केंद्रीय $\\text{S}$ परमाणु पर एकाकी इलेक्ट्रॉन युग्मों (lone pairs) की संख्या है:',
    options: ['0', '1', '2', '3'],
    correctIndex: 0,
    numericalAnswer: 0,
    explanation: '$\\text{SF}_6$ has 6 bond pairs and $0$ lone pairs around the central $\\text{S}$ atom ($sp^3d^2$ octahedral).',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024 Numerical',
  },
];

const BASE_MATH_MCQS: Omit<CBTQuestion, 'id' | 'number'>[] = [
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Matrices and Determinants',
    stem: 'If $A$ is a $3 \\times 3$ non-singular matrix such that $|A| = 5$, then $|\\text{adj}(A)|$ is equal to:',
    stemHindi: 'यदि $A$ एक $3 \\times 3$ व्युत्क्रमणीय आव्यूह है जैसे कि $|A| = 5$, तो $|\\text{adj}(A)|$ का मान है:',
    options: ['$5$', '$25$', '$125$', '$1/5$'],
    optionsHindi: ['$5$', '$25$', '$125$', '$1/5$'],
    correctIndex: 1,
    explanation: 'For an $n \\times n$ matrix $A$, $|\\text{adj}(A)| = |A|^{n-1} = 5^{3-1} = 25$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024 Shift 1',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Limits, Continuity & Differentiability',
    stem: 'Evaluate the limit $\\lim_{x \\to 0} \\frac{\\sin(5x)}{x}$:',
    stemHindi: '$\\lim_{x \\to 0} \\frac{\\sin(5x)}{x}$ का मान ज्ञात कीजिए:',
    options: ['$0$', '$1$', '$5$', '$1/5$'],
    optionsHindi: ['$0$', '$1$', '$5$', '$1/5$'],
    correctIndex: 2,
    explanation: '$$\\lim_{x \\to 0} 5 \\cdot \\frac{\\sin(5x)}{5x} = 5 \\times 1 = 5$$',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Definite Integration',
    stem: 'The value of the definite integral $I = \\int_{-\\pi/2}^{\\pi/2} \\sin^5(x)\\,dx$ is:',
    stemHindi: 'निश्चित समाकलन $I = \\int_{-\\pi/2}^{\\pi/2} \\sin^5(x)\\,dx$ का मान है:',
    options: ['$0$', '$1$', '$2/5$', '$\\pi/2$'],
    optionsHindi: ['$0$', '$1$', '$2/5$', '$\\pi/2$'],
    correctIndex: 0,
    explanation: 'Since $f(-x) = \\sin^5(-x) = -\\sin^5(x) = -f(x)$ is an **odd function**, $\\int_{-a}^{a} f(x)\\,dx = 0$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024 Shift 2',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Quadratic Equations & Maxima-Minima',
    stem: 'If $f(x) = x^2 - 4x + 5$ for $x \\in \\mathbb{R}$, then the minimum value of $f(x)$ is:',
    stemHindi: 'यदि $f(x) = x^2 - 4x + 5$ है, तो $f(x)$ का न्यूनतम मान क्या होगा?',
    options: ['$0$', '$1$', '$2$', '$4$'],
    optionsHindi: ['$0$', '$1$', '$2$', '$4$'],
    correctIndex: 1,
    explanation: 'Completing the square: $f(x) = (x - 2)^2 + 1 \\ge 1$ for all $x \\in \\mathbb{R}$. Minimum is $1$ at $x = 2$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Conic Sections',
    stem: 'The length of the latus rectum of the standard parabola $y^2 = 16x$ is:',
    stemHindi: 'परवलय $y^2 = 16x$ के नाभिलंब (latus rectum) की लंबाई है:',
    options: ['$4$', '$8$', '$16$', '$32$'],
    optionsHindi: ['$4$', '$8$', '$16$', '$32$'],
    correctIndex: 2,
    explanation: 'For $y^2 = 4ax$, the length of the latus rectum is $4a = 16$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
];

const BASE_MATH_NUMERICALS: Omit<CBTQuestion, 'id' | 'number'>[] = [
  {
    subject: 'Mathematics',
    section: 'Section B',
    chapter: 'Vector Algebra & 3D Geometry',
    stem: 'If $|\\vec{a}| = 3$, $|\\vec{b}| = 4$ and $|\\vec{a} + \\vec{b}| = 5$, then the numerical value of $|\\vec{a} - \\vec{b}|$ is:',
    stemHindi: 'यदि $|\\vec{a}| = 3$, $|\\vec{b}| = 4$ और $|\\vec{a} + \\vec{b}| = 5$ है, तो $|\\vec{a} - \\vec{b}|$ का संख्यात्मक मान है:',
    options: ['3', '4', '5', '7'],
    correctIndex: 2,
    numericalAnswer: 5,
    explanation: '$$|\\vec{a} + \\vec{b}|^2 + |\\vec{a} - \\vec{b}|^2 = 2(|\\vec{a}|^2 + |\\vec{b}|^2) \\implies 25 + |\\vec{a} - \\vec{b}|^2 = 2(9 + 16) = 50 \\implies |\\vec{a} - \\vec{b}| = 5$$',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024 Numerical',
  },
];

/**
 * Generates a full 75-Question NTA JEE Main 2027 Blueprint Mock:
 * - Q1–Q20: Physics Section A (20 MCQs, +4/-1)
 * - Q21–Q25: Physics Section B (5 Compulsory Numericals, +4/-1)
 * - Q26–Q45: Chemistry Section A (20 MCQs, +4/-1)
 * - Q46–Q50: Chemistry Section B (5 Compulsory Numericals, +4/-1)
 * - Q51–Q70: Mathematics Section A (20 MCQs, +4/-1)
 * - Q71–Q75: Mathematics Section B (5 Compulsory Numericals, +4/-1)
 * Base items are tagged RECONSTRUCTED_WITH_SOURCE; drill variants are explicitly labeled LEARNMATE_ORIGINAL.
 */
export function buildFull75JeeMainQuestions(): CBTQuestion[] {
  const result: CBTQuestion[] = [];
  let qNum = 1;

  const appendSubjectQuestions = (
    mcqs: Omit<CBTQuestion, 'id' | 'number'>[],
    nums: Omit<CBTQuestion, 'id' | 'number'>[]
  ) => {
    for (let i = 0; i < 20; i++) {
      const tpl = mcqs[i % mcqs.length];
      const variantNum = Math.floor(i / mcqs.length) + 1;
      const isVariant = variantNum > 1;
      result.push({
        ...tpl,
        id: `q${qNum}`,
        number: qNum,
        examType: 'JEE Main',
        examVersion: 'jee-main-2027-paper1',
        provenanceType: isVariant ? 'LEARNMATE_ORIGINAL' : 'RECONSTRUCTED_WITH_SOURCE',
        verificationStatus: isVariant ? 'unverified' : 'reconstructed',
        pyqTag: isVariant ? `LearnMate Practice Drill (Variant ${variantNum})` : tpl.pyqTag,
        stem: isVariant ? `[Practice Variant ${variantNum}] ${tpl.stem}` : tpl.stem,
      });
      qNum++;
    }
    for (let i = 0; i < 5; i++) {
      const tpl = nums[i % nums.length];
      const factor = i + 1;
      const isVariant = i > 0;
      const baseAns = tpl.numericalAnswer ?? 5;
      result.push({
        ...tpl,
        id: `q${qNum}`,
        number: qNum,
        examType: 'JEE Main',
        examVersion: 'jee-main-2027-paper1',
        section: 'Section B',
        provenanceType: isVariant ? 'LEARNMATE_ORIGINAL' : 'RECONSTRUCTED_WITH_SOURCE',
        verificationStatus: isVariant ? 'unverified' : 'reconstructed',
        pyqTag: isVariant ? `LearnMate Section B Drill ${factor}/5` : tpl.pyqTag,
        numericalAnswer: baseAns,
        stem: isVariant
          ? `[Compulsory Numerical Drill ${factor}/5] ${tpl.stem}`
          : tpl.stem,
      });
      qNum++;
    }
  };

  appendSubjectQuestions(BASE_PHYSICS_MCQS, BASE_PHYSICS_NUMERICALS);
  appendSubjectQuestions(BASE_CHEM_MCQS, BASE_CHEM_NUMERICALS);
  appendSubjectQuestions(BASE_MATH_MCQS, BASE_MATH_NUMERICALS);

  return result;
}

export const CBT_MOCK_QUESTIONS: CBTQuestion[] = buildFull75JeeMainQuestions();

export const JEE_ADVANCED_PAPER_QUESTIONS: CBTQuestion[] = [
  {
    id: 'adv-q1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Rotational Motion & Rigid Body Dynamics',
    examType: 'JEE Advanced',
    advancedFormat: 'multiple',
    difficultyBucket: 'Advanced Climb',
    pyqTag: 'JEE Advanced Paper 1',
    stem: '[One or More Than One Correct (+4 / -2 / Partial)] A uniform disc of mass $M$ and radius $R$ rolls without slipping on a rough horizontal surface with center-of-mass velocity $v_0$. Which of the following statements are correct?',
    options: [
      'Speed of the topmost point is $2v_0$',
      'Speed of the point of contact with the ground is $0$',
      'Total kinetic energy of the rolling disc is $\\frac{3}{4}Mv_0^2$',
      'Angular momentum about the point of contact is $\\frac{1}{2}MRv_0$',
    ],
    correctIndex: 0,
    correctIndices: [0, 1, 2],
    explanation: '**Pure Rolling ($v_0 = \\omega R$)**: 1) Topmost speed $= v_0 + \\omega R = 2v_0$, 2) Contact point velocity $= v_0 - \\omega R = 0$, 3) $K_{\\text{total}} = \\frac{1}{2}Mv_0^2 + \\frac{1}{2}\\left(\\frac{1}{2}MR^2\\right)\\omega^2 = \\frac{3}{4}Mv_0^2$. *(Angular momentum about contact point is $L = I_{\\text{CM}}\\omega + Mv_0R = \\frac{3}{2}MRv_0$, so D is false).*',
  },
  {
    id: 'adv-q2',
    number: 2,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Coordination Compounds',
    examType: 'JEE Advanced',
    advancedFormat: 'multiple',
    difficultyBucket: 'Advanced Climb',
    pyqTag: 'JEE Advanced Paper 1',
    stem: '[One or More Than One Correct (+4 / -2 / Partial)] Which of the following coordination entities are diamagnetic and exhibit $d^2sp^3$ or $dsp^2$ inner-orbital hybridisation?',
    options: [
      '$[\\text{Fe(CN)}_6]^{4-}$',
      '$[\\text{Co(NH}_3)_6]^{3+}$',
      '$[\\text{Ni(CN)}_4]^{2-}$',
      '$[\\text{NiCl}_4]^{2-}$',
    ],
    correctIndex: 0,
    correctIndices: [0, 1, 2],
    explanation: '$\\text{CN}^-$ and $\\text{NH}_3$ (with $\\text{Co}^{3+}$) act as strong-field ligands causing spin pairing ($n=0$, diamagnetic). $[\\text{NiCl}_4]^{2-}$ is tetrahedral $sp^3$ with $2$ unpaired electrons (paramagnetic).',
  },
  {
    id: 'adv-q3',
    number: 3,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Matrices and Determinants',
    examType: 'JEE Advanced',
    advancedFormat: 'matrix',
    difficultyBucket: 'Advanced Climb',
    pyqTag: 'JEE Advanced Paper 2',
    matrixListI: [
      'P: $|2A|$ for $3\\times 3$ matrix $A$ with $|A|=2$',
      'Q: $|\\text{adj}(A)|$ for $3\\times 3$ matrix $A$ with $|A|=2$',
      'R: $|A^{-1}|$ for $3\\times 3$ matrix $A$ with $|A|=2$',
    ],
    matrixListII: ['1: $16$', '2: $4$', '3: $0.5$'],
    stem: '[Matrix-Match (List-I / List-II) (+3 / -1)] Let $A$ be a $3 \\times 3$ non-singular matrix with $|A| = 2$. Match List-I with List-II:',
    options: [
      'P → 1, Q → 2, R → 3',
      'P → 2, Q → 1, R → 3',
      'P → 1, Q → 3, R → 2',
      'P → 3, Q → 2, R → 1',
    ],
    correctIndex: 0,
    explanation: 'For $n=3, |A|=2$: $|2A| = 2^3|A| = 16$ (P→1); $|\\text{adj } A| = |A|^{3-1} = 4$ (Q→2); $|A^{-1}| = 1/|A| = 0.5$ (R→3).',
  },
  {
    id: 'adv-q4',
    number: 4,
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Capacitance & Dielectrics',
    examType: 'JEE Advanced',
    advancedFormat: 'numerical',
    difficultyBucket: 'Advanced Climb',
    pyqTag: 'JEE Advanced Numerical',
    stem: '[Non-Negative Integer (+4 / 0)] Six identical capacitors of capacitance $C = 2\\,\\mu\\text{F}$ each are arranged in a balanced Wheatstone bridge network. The equivalent capacitance (in $\\mu\\text{F}$) between the input terminals is:',
    options: ['2', '4', '6', '1'],
    correctIndex: 0,
    numericalAnswer: 2,
    explanation: 'In a balanced 5-capacitor Wheatstone bridge where each arm is $C = 2\\,\\mu\\text{F}$, the central bridge capacitor carries zero charge, so $C_{\\text{eq}} = C = 2\\,\\mu\\text{F}$.',
  },
  {
    id: 'adv-q5',
    number: 5,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Thermodynamics & Kinetic Theory of Gases',
    examType: 'JEE Advanced',
    advancedFormat: 'paragraph',
    difficultyBucket: 'Advanced Climb',
    pyqTag: 'JEE Advanced Comprehension Pair',
    paragraphContext:
      'PARAGRAPH FOR Q5: One mole of an ideal monatomic gas ($\\gamma = 5/3$) undergoes a reversible cyclic process $A \\to B \\to C \\to A$. Process $A \\to B$ is an isothermal expansion at temperature $T_0 = 300\\text{ K}$ from volume $V_0$ to $2V_0$. Process $B \\to C$ is an isochoric cooling, and $C \\to A$ is an adiabatic compression back to the initial state.',
    stem: '[Paragraph / Comprehension Linked (+3 / -1)] The work done by the gas during the isothermal expansion $A \\to B$ is:',
    options: [
      '$300R\\ln 2$',
      '$500R\\ln 2$',
      '$150R\\ln 2$',
      '$600R\\ln 2$',
    ],
    correctIndex: 0,
    explanation: 'For reversible isothermal expansion of $n = 1$ mole at $T_0 = 300\\text{ K}$: $W_{AB} = nRT_0\\ln\\left(\\frac{V_B}{V_A}\\right) = 300R\\ln 2$.',
  },
];

export const NEET_UG_PAPER_QUESTIONS: CBTQuestion[] = [
  {
    id: 'neet-q1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Current Electricity & Electrical Measuring Instruments',
    examType: 'NEET UG',
    difficultyBucket: 'Must-Do',
    pyqTag: 'NEET UG Pattern (+4 / -1)',
    stem: '[NEET UG Physics (+4 / -1)] Three resistors of $2\\,\\Omega, 3\\,\\Omega$, and $6\\,\\Omega$ are connected in parallel across a $6\\text{ V}$ ideal battery. The total current drawn from the battery is:',
    options: ['$6\\text{ A}$', '$3\\text{ A}$', '$1\\text{ A}$', '$9\\text{ A}$'],
    correctIndex: 0,
    explanation: '$$\\frac{1}{R_{\\text{eq}}} = \\frac{1}{2} + \\frac{1}{3} + \\frac{1}{6} = 1\\,\\Omega^{-1} \\implies R_{\\text{eq}} = 1\\,\\Omega, \\quad I = \\frac{V}{R_{\\text{eq}}} = \\frac{6}{1} = 6\\text{ A}$$',
  },
  {
    id: 'neet-q2',
    number: 2,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Chemical Bonding & Molecular Structure (VSEPR & MOT)',
    examType: 'NEET UG',
    difficultyBucket: 'Must-Do',
    pyqTag: 'NEET UG Pattern (+4 / -1)',
    stem: '[NEET UG Chemistry (+4 / -1)] Which of the following pairs of species have identical bond order according to Molecular Orbital Theory?',
    options: [
      '$\\text{CN}^-$ and $\\text{CO}$',
      '$\\text{O}_2^-$ and $\\text{NO}^+$',
      '$\\text{N}_2$ and $\\text{O}_2^{2-}$',
      '$\\text{B}_2$ and $\\text{C}_2$',
    ],
    correctIndex: 0,
    explanation: 'Both $\\text{CN}^-$ ($14\\,e^-$) and $\\text{CO}$ ($14\\,e^-$) are isoelectronic with $\\text{N}_2$ and have a bond order of $3.0$.',
  },
  {
    id: 'neet-q3',
    number: 3,
    subject: 'Chemistry',
    subTrackLabel: 'Biology (Botany & Zoology)',
    section: 'Section A',
    chapter: 'Amines, Diazonium Salts, Biomolecules & Practical Organic Chemistry',
    examType: 'NEET UG',
    difficultyBucket: 'Must-Do',
    pyqTag: 'NEET UG Biology / Biomolecules (+4 / -1)',
    stem: '[NEET UG Biology — Genetics & Molecular Biology (+4 / -1)] In a double-stranded DNA molecule, if Cytosine ($C$) constitutes $30\\%$ of the total nitrogenous bases, what is the percentage of Thymine ($T$) according to Chargaff’s rule?',
    options: ['$20\\%$', '$30\\%$', '$40\\%$', '$60\\%$'],
    correctIndex: 0,
    explanation: 'By Chargaff’s equivalence rule, $G = C = 30\\%$, so $G + C = 60\\%$. The remaining $A + T = 40\\%$, and since $A = T$, Thymine $T = 20\\%$.',
  },
  {
    id: 'neet-q4',
    number: 4,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Modern Physics (Dual Nature, Atoms, Nuclei & Semiconductors)',
    examType: 'NEET UG',
    difficultyBucket: 'Beginner',
    pyqTag: 'NEET UG Pattern (+4 / -1)',
    stem: '[NEET UG Physics (+4 / -1)] The half-life of a radioactive isotope is $15\\text{ minutes}$. What fraction of the initial undecayed nuclei remains after $60\\text{ minutes}$?',
    options: ['$\\frac{1}{16}$', '$\\frac{1}{8}$', '$\\frac{1}{4}$', '$\\frac{1}{32}$'],
    correctIndex: 0,
    explanation: 'Number of half-lives $n = \\frac{t}{T_{1/2}} = \\frac{60}{15} = 4$. Remaining fraction $\\frac{N}{N_0} = \\left(\\frac{1}{2}\\right)^4 = \\frac{1}{16}$.',
  },
  {
    id: 'neet-q5',
    number: 5,
    subject: 'Chemistry',
    subTrackLabel: 'Biology (Botany & Zoology)',
    section: 'Section A',
    chapter: 'Chemical Kinetics & Nuclear Chemistry',
    examType: 'NEET UG',
    difficultyBucket: 'Must-Do',
    pyqTag: 'NEET UG Biology / Enzyme Kinetics (+4 / -1)',
    stem: '[NEET UG Biology — Enzyme Catalysis (+4 / -1)] In competitive inhibition of an enzyme-catalyzed reaction, the inhibitor binds to the active site and alters the kinetic parameters such that:',
    options: [
      'Apparent $K_m$ increases while $V_{\\max}$ remains unchanged',
      'Both $K_m$ and $V_{\\max}$ decrease',
      'Apparent $K_m$ remains unchanged while $V_{\\max}$ decreases',
      'Apparent $K_m$ decreases while $V_{\\max}$ increases',
    ],
    correctIndex: 0,
    explanation: 'A competitive inhibitor competes with the substrate for the active site, increasing apparent $K_m$, while high substrate concentration can still achieve the same $V_{\\max}$.',
  },
];

export const BITSAT_PAPER_QUESTIONS: CBTQuestion[] = [
  {
    id: 'bitsat-q1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Kinematics (1D & 2D Projectile Motion)',
    examType: 'BITSAT',
    difficultyBucket: 'Must-Do',
    pyqTag: 'BITSAT Speed CBT (+3 / -1)',
    stem: '[BITSAT Physics (+3 / -1)] A projectile has the same horizontal range $R$ for two angles of projection $\\theta_1$ and $\\theta_2$. If $t_1$ and $t_2$ are the respective times of flight, then $t_1 t_2$ is equal to:',
    options: ['$\\frac{2R}{g}$', '$\\frac{R}{g}$', '$\\frac{4R}{g}$', '$\\frac{R}{2g}$'],
    correctIndex: 0,
    explanation: 'For complementary angles $\\theta_2 = 90^\\circ - \\theta_1$: $t_1 t_2 = \\frac{2u\\sin\\theta_1}{g}\\cdot\\frac{2u\\cos\\theta_1}{g} = \\frac{2}{g}\\left(\\frac{u^2\\sin 2\\theta_1}{g}\\right) = \\frac{2R}{g}$.',
  },
  {
    id: 'bitsat-q2',
    number: 2,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Solutions & Colligative Properties',
    examType: 'BITSAT',
    difficultyBucket: 'Must-Do',
    pyqTag: 'BITSAT Speed CBT (+3 / -1)',
    stem: '[BITSAT Chemistry (+3 / -1)] Assuming $100\\%$ ionization in dilute aqueous solution, which of the following $0.1\\text{ M}$ solutions exhibits the highest boiling point?',
    options: [
      '$\\text{Al}_2(\\text{SO}_4)_3$',
      '$\\text{BaCl}_2$',
      '$\\text{NaCl}$',
      '$\\text{C}_6\\text{H}_{12}\\text{O}_6$ (Glucose)',
    ],
    correctIndex: 0,
    explanation: '$\\text{Al}_2(\\text{SO}_4)_3$ dissociates into $5$ ions ($i = 5$), giving the maximum elevation in boiling point $\\Delta T_b = i K_b m$.',
  },
  {
    id: 'bitsat-q3',
    number: 3,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Limits, Continuity & Differentiability',
    examType: 'BITSAT',
    difficultyBucket: 'Must-Do',
    pyqTag: 'BITSAT Speed CBT (+3 / -1)',
    stem: '[BITSAT Mathematics (+3 / -1)] The value of $\\lim_{x \\to 0} \\frac{1 - \\cos(2x)}{x^2}$ is:',
    options: ['$2$', '$1$', '$4$', '$0$'],
    correctIndex: 0,
    explanation: '$$\\lim_{x \\to 0} \\frac{2\\sin^2 x}{x^2} = 2\\left(\\lim_{x \\to 0}\\frac{\\sin x}{x}\\right)^2 = 2$$',
  },
  {
    id: 'bitsat-q4',
    number: 4,
    subject: 'Mathematics',
    subTrackLabel: 'English & Logical Reasoning',
    section: 'Section A',
    chapter: 'Sequences, Series, Sets & Trigonometry',
    examType: 'BITSAT',
    difficultyBucket: 'Beginner',
    pyqTag: 'BITSAT Logical Reasoning (+3 / -1)',
    stem: '[BITSAT Logical Reasoning (+3 / -1)] Find the missing number in the series: $3, 10, 29, 66, 127, ?$',
    options: ['$218$', '$216$', '$220$', '$198$'],
    correctIndex: 0,
    explanation: 'Pattern is $n^3 + 2$ for $n = 1, 2, 3, 4, 5, 6$: $6^3 + 2 = 216 + 2 = 218$.',
  },
];

// Clean initial CBT responses: Q1 visited (not_answered), all others not_visited
export const INITIAL_CBT_RESPONSES: Record<string, QuestionResponseState> = {
  q1: { status: 'not_answered', selectedOption: null, timeSpentSec: 0 },
};

export const OFFICIAL_PAPERS_LIST = [
  {
    id: 'jee-2025-s1-sh1',
    paper: 'JEE Main 2025 Session 1 Shift 1 (75 Qs · New Pattern)',
    year: '2025',
    session: 'Session 1',
    shift: 'Shift 1',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2024-s2-sh1',
    paper: 'JEE Main 2024 Session 2 Shift 1',
    year: '2024',
    session: 'Session 2',
    shift: 'Shift 1',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-adv-2024-p1',
    paper: 'JEE Advanced 2024 Paper 1 (Multi-Choice & Matrix)',
    year: '2024',
    session: 'Paper 1',
    shift: 'Morning',
    chapter: 'All Chapters',
  },
  {
    id: 'neet-ug-2025-full',
    paper: 'NEET UG 2025 Full Mock (Physics, Chemistry & Biology • +4/-1)',
    year: '2025',
    session: 'Annual',
    shift: 'Afternoon',
    chapter: 'All Chapters',
  },
  {
    id: 'bitsat-2025-s1',
    paper: 'BITSAT 2025 Session 1 Speed CBT (PCM + English & LR • +3/-1)',
    year: '2025',
    session: 'Session 1',
    shift: 'Slot 1',
    chapter: 'All Chapters',
  },
];

export const CHAPTER_ANALYSIS_DEFAULT = [
  {
    chapter: 'Laws of Motion',
    subject: 'Physics' as const,
    marks: '28 / 30',
    time: '24 min',
    accuracy: 93.3,
  },
  {
    chapter: 'Work, Energy and Power',
    subject: 'Physics' as const,
    marks: '24 / 30',
    time: '27 min',
    accuracy: 80.0,
  },
  {
    chapter: 'Current Electricity',
    subject: 'Physics' as const,
    marks: '19 / 30',
    time: '29 min',
    accuracy: 63.3,
  },
  {
    chapter: 'd & f Block Elements',
    subject: 'Chemistry' as const,
    marks: '26 / 30',
    time: '21 min',
    accuracy: 86.7,
  },
  {
    chapter: 'Chemical Bonding',
    subject: 'Chemistry' as const,
    marks: '26 / 30',
    time: '25 min',
    accuracy: 86.7,
  },
  {
    chapter: 'Organic Chemistry – Basics',
    subject: 'Chemistry' as const,
    marks: '28 / 30',
    time: '22 min',
    accuracy: 93.3,
  },
  {
    chapter: 'Quadratic Equations & Maxima-Minima',
    subject: 'Mathematics' as const,
    marks: '27 / 30',
    time: '23 min',
    accuracy: 90.0,
  },
  {
    chapter: 'Matrices and Determinants',
    subject: 'Mathematics' as const,
    marks: '25 / 30',
    time: '26 min',
    accuracy: 83.3,
  },
  {
    chapter: 'Definite Integration',
    subject: 'Mathematics' as const,
    marks: '22 / 30',
    time: '28 min',
    accuracy: 73.3,
  },
];
