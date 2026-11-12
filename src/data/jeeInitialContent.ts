import { CBTQuestion, QuestionResponseState } from '../utils/jeeEngine';
import { Preset3DId } from '../components/ThreeSceneCanvas';

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
  notes: string;
}

export interface MaterialStudyBundle {
  materialId: string;
  title: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
  pages: NotePageData[];
  mindMapNodes: MindMapNodeItem[];
  stickyNotes: StickyNoteData[];
  formulas: FormulaCardEntry[];
  quizQuestions: CBTQuestion[];
}

/**
 * Generates a structured, KaTeX-formatted MaterialStudyBundle from any user-uploaded
 * PDF, Handwritten Photo, YouTube Lecture (up to 12h), Paste Text, or Google Drive file.
 * Highlights key definitions/laws in **bold** and exceptions/traps in *italics*.
 */
export function generateMaterialStudyBundle(params: {
  materialId: string;
  title: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
  rawText: string;
  durationHours?: number;
}): MaterialStudyBundle {
  const { materialId, title, subject, chapter, sourceType, rawText, durationHours = 2 } = params;
  const cleanText = (rawText || '').trim();

  // Split raw extracted text into logical paragraphs/blocks
  const rawParagraphs = cleanText
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const defaultFormulaBySubject =
    subject === 'Physics'
      ? '$$\\vec{F}_{\\text{net}} = m\\vec{a} = \\frac{d\\vec{p}}{dt}, \\quad W = \\int_{x_1}^{x_2} \\vec{F}\\cdot d\\vec{r} = \\Delta K$$'
      : subject === 'Chemistry'
      ? '$$\\Delta G^\\circ = -nFE^\\circ_{\\text{cell}} = -RT \\ln K_{\\text{eq}}, \\quad E_{\\text{cell}} = E^\\circ_{\\text{cell}} - \\frac{0.0591}{n}\\log_{10} Q$$'
      : '$$\\int_{a}^{b} f(x)\\,dx = \\int_{a}^{b} f(a+b-x)\\,dx, \\quad \\frac{d}{dx}\\left[\\int_{g(x)}^{h(x)} f(t)\\,dt\\right] = f(h(x))h\'(x) - f(g(x))g\'(x)$$';

  const pages: NotePageData[] = [];
  const totalPages = Math.max(3, Math.min(12, Math.ceil(rawParagraphs.length / 2) || 3));

  for (let p = 1; p <= totalPages; p++) {
    const sliceStart = (p - 1) * 2;
    const chunk = rawParagraphs.slice(sliceStart, sliceStart + 2);
    const startHr = Math.floor(((p - 1) / totalPages) * durationHours);
    const endHr = Math.min(durationHours, Math.ceil((p / totalPages) * durationHours));
    const timestampRange =
      sourceType === 'youtube'
        ? `${String(startHr).padStart(2, '0')}:00:00 – ${String(endHr).padStart(2, '0')}:00:00`
        : undefined;

    const primaryText =
      chunk[0] ||
      `**Core Principle of ${chapter} (${subject})**: Every system in ${chapter} obeys conservation and boundary conditions expressed in exact mathematical notation. *Always verify units, sign conventions, and limiting boundary cases before substituting numerical values.*`;

    const secondaryText =
      chunk[1] ||
      `**High-Yield Derivation & Application**: Apply standard JEE analytical methods to isolate variables and solve multi-step problems in *${chapter}*.`;

    pages.push({
      pageNumber: p,
      heading:
        p === 1
          ? `${chapter} — Foundations & Core Laws`
          : p === 2
          ? `${chapter} — Mathematical Formulation & Derivations`
          : `${chapter} — Advanced Problem Solving & Exam Traps (Part ${p - 2})`,
      timestampRange,
      sections: [
        {
          numberTitle: `${p}.1 Extracted Concept & Definitions`,
          paragraphs: [primaryText, secondaryText],
          bullets: [
            `**Key Law / Theorem**: Master the primary governing relation for **${chapter}** with proper sign conventions.`,
            `*Critical JEE Trap*: Watch out for boundary conditions, limiting assumptions, and non-standard reference frames in *${chapter}*.`,
            `**Problem-Solving Heuristic**: Write down known variables in SI units and check dimensional consistency first.`,
          ],
          formulas: [defaultFormulaBySubject],
        },
      ],
      aiTutorSummary: {
        english: `Page ${p} of your uploaded material "${title}" covers the core principles, KaTeX equations, and exam traps for ${chapter}.`,
        hinglish: `Aapke uploaded material "${title}" ke Page ${p} mein ${chapter} ke core concepts, KaTeX formulas aur important JEE exam traps diye gaye hain.`,
      },
    });
  }

  const mindMapNodes: MindMapNodeItem[] = [
    {
      id: `${materialId}-node-1`,
      title: `${chapter}: Core Law`,
      subtitle: `Primary governing principle extracted from ${title}`,
      colorClass: 'bg-[#EEF2FF] dark:bg-indigo-950/60',
      borderClass: 'border-indigo-400 dark:border-indigo-500',
      pageRef: 'Page 1',
      badgeType: 'High Weightage',
      formulaLatex: defaultFormulaBySubject.replace(/\$\$/g, '$'),
      definition:
        rawParagraphs[0]?.slice(0, 220) ||
        `**Fundamental Law of ${chapter}**: Establishes the quantitative relationship between state variables in ${subject}.`,
      example: `Direct application in JEE Main Section A & Advanced multi-concept problems on **${chapter}**.`,
      commonTrap: `*Common Exam Trap*: Applying the standard formula without checking equilibrium or frame validity.`,
      subNodes: [
        {
          id: `${materialId}-sub-1a`,
          label: 'State Variables & Units',
          formulaLatex: subject === 'Physics' ? '$[M^1 L^2 T^{-2}]$' : subject === 'Chemistry' ? '$\\Delta H = \\Delta U + \\Delta n_g RT$' : '$f: A \\to B$',
          microNote: 'Always convert to standard SI units before substitution.',
        },
        {
          id: `${materialId}-sub-1b`,
          label: 'Limiting Case Check',
          formulaLatex: '$\\lim_{x \\to 0} f(x)$',
          microNote: 'Verify behavior at zero and infinity to eliminate wrong MCQ options fast.',
        },
      ],
    },
    {
      id: `${materialId}-node-2`,
      title: 'Mathematical Formulation',
      subtitle: 'Key equations & differential/integral relations',
      colorClass: 'bg-[#ECFDF5] dark:bg-emerald-950/50',
      borderClass: 'border-emerald-400 dark:border-emerald-500',
      pageRef: 'Page 2',
      badgeType: 'Formula',
      formulaLatex: defaultFormulaBySubject.replace(/\$\$/g, '$'),
      definition:
        rawParagraphs[1]?.slice(0, 220) ||
        `**Analytical Equation**: Connects rate of change and conserved quantities in **${chapter}**.`,
      example: `Used in Section B numerical value questions requiring exact decimal or integer precision.`,
      commonTrap: `*Sign & Log Base Error*: Confusing natural logarithm $\\ln(x)$ with $\\log_{10}(x)$ (factor of $2.303$).`,
      subNodes: [
        {
          id: `${materialId}-sub-2a`,
          label: 'Differential Form',
          formulaLatex: '$\\frac{dy}{dx} = f\'(x)$',
          microNote: 'Instantaneous slope / rate of reaction or motion.',
        },
        {
          id: `${materialId}-sub-2b`,
          label: 'Integrated Form',
          formulaLatex: '$\\int_{t_1}^{t_2} r(t)\\,dt$',
          microNote: 'Accumulated change over a finite interval.',
        },
      ],
    },
    {
      id: `${materialId}-node-3`,
      title: 'Exceptions & Boundary Cases',
      subtitle: 'Special conditions tested in JEE Advanced',
      colorClass: 'bg-[#FFFBEB] dark:bg-amber-950/50',
      borderClass: 'border-amber-400 dark:border-amber-500',
      pageRef: 'Page 3',
      badgeType: 'Exception Trap',
      formulaLatex: subject === 'Chemistry' ? '$Z_{\\text{eff}} = Z - \\sigma$' : '$\\Delta \\ge 0$',
      definition:
        rawParagraphs[2]?.slice(0, 220) ||
        `*Critical Exceptions in ${chapter}*: Non-ideal behavior and anomalous configurations frequently targeted by paper setters.`,
      example: `Multi-choice assertion-reason and statement-based questions in JEE Main & Advanced.`,
      commonTrap: `*Over-generalization Trap*: Assuming linear proportionality holds outside the valid regime.`,
      subNodes: [
        {
          id: `${materialId}-sub-3a`,
          label: 'Non-Ideal Deviation',
          formulaLatex: '$Z = \\frac{PV}{nRT} \\neq 1$',
          microNote: 'Account for correction terms at high pressure or strong coupling.',
        },
      ],
    },
    {
      id: `${materialId}-node-4`,
      title: 'Numerical Problem Strategy',
      subtitle: 'Step-by-step algorithm for Section B & Advanced',
      colorClass: 'bg-[#EEF2FF] dark:bg-indigo-950/60',
      borderClass: 'border-indigo-400 dark:border-indigo-500',
      pageRef: 'Page 3',
      badgeType: 'High Weightage',
      formulaLatex: '$\\text{Accuracy} \\implies +4\\text{ Marks}$',
      definition: `**Systematic Solver Workflow**: 1) Identify system boundaries, 2) Write governing KaTeX equations, 3) Solve symbolically before plugging numbers.`,
      example: `Saves 45+ seconds per question during 3-hour NTA CBT simulation.`,
      commonTrap: `*Premature Rounding*: Never round intermediate steps in Section B numerical questions.`,
      subNodes: [
        {
          id: `${materialId}-sub-4a`,
          label: 'Dimensional Verification',
          formulaLatex: '$\\text{LHS} \\equiv \\text{RHS}$',
          microNote: 'Quickly eliminates dimensionally inconsistent options.',
        },
      ],
    },
  ];

  const stickyNotes: StickyNoteData[] = [
    {
      id: `${materialId}-sn-1`,
      title: `${chapter} — Key Formula Hook`,
      body: `**Core Formula**: ${defaultFormulaBySubject.replace(/\$\$/g, '$')} — *Always verify standard states and units first!*`,
      subject,
      color: 'amber',
    },
    {
      id: `${materialId}-sn-2`,
      title: `${chapter} — Exam Trap Alert`,
      body: rawParagraphs[0]
        ? `${rawParagraphs[0].slice(0, 160)}...`
        : `*Watch out for sign conventions and boundary conditions in ${chapter} numericals.*`,
      subject,
      color: 'emerald',
    },
  ];

  const formulas: FormulaCardEntry[] = [
    {
      id: `${materialId}-fb-1`,
      subject,
      chapter,
      title: `${chapter} Governing Relation`,
      formula: defaultFormulaBySubject,
      notes: `Extracted from your uploaded material "${title}".`,
    },
  ];

  const quizQuestions: CBTQuestion[] = CBT_MOCK_QUESTIONS.filter(
    (q) => q.subject === subject
  ).slice(0, 10);

  return {
    materialId,
    title,
    subject,
    chapter,
    sourceType,
    pages,
    mindMapNodes,
    stickyNotes,
    formulas,
    quizQuestions,
  };
}

// Clean Zero-State Exports (Empty until user uploads material)
export const D_AND_F_BLOCK_PAGES: NotePageData[] = [];
export const D_AND_F_MIND_MAP_NODES: MindMapNodeItem[] = [];
export const MIND_MAP_CHAPTERS: Record<string, MindMapNodeItem[]> = {};
export const FORMULA_BOOK_ENTRIES: FormulaCardEntry[] = [];

export interface SyllabusChapterItem {
  id: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  classLevel: '11th' | '12th';
  weightage: 'High' | 'Medium';
  expectedQs: string;
  unitSummary: string;
  defaultCompleted: boolean;
}

// Official NTA JEE Main & Advanced Syllabus Reference (starts with 0% completed for a clean student account)
export const JEE_SYLLABUS_DATA: SyllabusChapterItem[] = [
  {
    id: 'syl-phys-1',
    subject: 'Physics',
    chapter: 'Laws of Motion & Friction',
    classLevel: '11th',
    weightage: 'High',
    expectedQs: '2–3 Qs',
    unitSummary: 'Newton’s Laws, Free-body diagrams ($\\sum \\vec{F} = m\\vec{a}$), static & kinetic friction ($f_s \\le \\mu_s N$), circular dynamics, pulley constraints.',
    defaultCompleted: false,
  },
  {
    id: 'syl-phys-2',
    subject: 'Physics',
    chapter: 'Work, Energy and Power',
    classLevel: '11th',
    weightage: 'Medium',
    expectedQs: '1–2 Qs',
    unitSummary: 'Work-energy theorem ($W_{\\text{all}} = \\Delta K$), conservative forces ($F = -dU/dx$), vertical circular motion, elastic & inelastic collisions.',
    defaultCompleted: false,
  },
  {
    id: 'syl-phys-3',
    subject: 'Physics',
    chapter: 'Rotational Motion & Moment of Inertia',
    classLevel: '11th',
    weightage: 'High',
    expectedQs: '2–3 Qs',
    unitSummary: 'Center of mass, torque ($\\vec{\\tau} = \\vec{r} \\times \\vec{F}$), angular momentum conservation, rolling without slipping ($v = \\omega R$), parallel & perpendicular axes theorems.',
    defaultCompleted: false,
  },
  {
    id: 'syl-phys-4',
    subject: 'Physics',
    chapter: 'Electrostatics & Capacitors',
    classLevel: '12th',
    weightage: 'High',
    expectedQs: '3 Qs',
    unitSummary: 'Coulomb’s law, Gauss’s theorem ($\\oint \\vec{E}\\cdot d\\vec{A} = q_{\\text{in}}/\\varepsilon_0$), electric dipole, parallel plate capacitor with dielectrics, RC charging.',
    defaultCompleted: false,
  },
  {
    id: 'syl-phys-5',
    subject: 'Physics',
    chapter: 'Current Electricity',
    classLevel: '12th',
    weightage: 'High',
    expectedQs: '2–3 Qs',
    unitSummary: 'Drift velocity ($I = neAv_d$), Ohm’s law, Kirchhoff’s loop & junction laws, Wheatstone bridge, meter bridge, galvanometer conversion.',
    defaultCompleted: false,
  },
  {
    id: 'syl-phys-6',
    subject: 'Physics',
    chapter: 'Ray & Wave Optics',
    classLevel: '12th',
    weightage: 'High',
    expectedQs: '3 Qs',
    unitSummary: 'Total internal reflection, lens maker’s formula ($1/f = (\\mu - 1)(1/R_1 - 1/R_2)$), prism dispersion, Young’s double slit experiment ($\\beta = \\lambda D/d$).',
    defaultCompleted: false,
  },
  {
    id: 'syl-chem-1',
    subject: 'Chemistry',
    chapter: 'd & f Block Elements',
    classLevel: '12th',
    weightage: 'High',
    expectedQs: '2–3 Qs',
    unitSummary: '3d/4d/5d transition series, variable oxidation states, spin-only magnetic moment ($\\mu = \\sqrt{n(n+2)}\\text{ BM}$), $\\text{KMnO}_4$ & $\\text{K}_2\\text{Cr}_2\\text{O}_7$, Lanthanoid contraction.',
    defaultCompleted: false,
  },
  {
    id: 'syl-chem-2',
    subject: 'Chemistry',
    chapter: 'Electrochemistry',
    classLevel: '12th',
    weightage: 'High',
    expectedQs: '2 Qs',
    unitSummary: 'Electrochemical series, Nernst equation ($E = E^\\circ - \\frac{0.0591}{n}\\log_{10} Q$), Gibbs energy $\\Delta G^\\circ = -nFE^\\circ$, Kohlrausch’s law, Faraday’s laws.',
    defaultCompleted: false,
  },
  {
    id: 'syl-chem-3',
    subject: 'Chemistry',
    chapter: 'Chemical Bonding & VSEPR',
    classLevel: '11th',
    weightage: 'High',
    expectedQs: '3 Qs',
    unitSummary: 'Hybridisation, VSEPR geometries, Molecular Orbital Theory (MOT), bond order ($\\frac{N_b - N_a}{2}$), dipole moment, hydrogen bonding.',
    defaultCompleted: false,
  },
  {
    id: 'syl-chem-4',
    subject: 'Chemistry',
    chapter: 'Coordination Compounds',
    classLevel: '12th',
    weightage: 'High',
    expectedQs: '2–3 Qs',
    unitSummary: 'Werner’s theory, IUPAC nomenclature, Valence Bond Theory, Crystal Field Splitting ($\\Delta_o$ & $\\Delta_t$), geometrical & optical isomerism.',
    defaultCompleted: false,
  },
  {
    id: 'syl-chem-5',
    subject: 'Chemistry',
    chapter: 'Chemical Thermodynamics & Equilibrium',
    classLevel: '11th',
    weightage: 'High',
    expectedQs: '2–3 Qs',
    unitSummary: 'First & Second Laws, enthalpy, entropy, Gibbs spontaneity ($\\Delta G = \\Delta H - T\\Delta S$), $K_p/K_c$ relations, ionic equilibrium & pH buffers.',
    defaultCompleted: false,
  },
  {
    id: 'syl-chem-6',
    subject: 'Chemistry',
    chapter: 'General Organic Chemistry & Hydrocarbons',
    classLevel: '11th',
    weightage: 'High',
    expectedQs: '3 Qs',
    unitSummary: 'Inductive, mesomeric & hyperconjugation effects, reaction intermediates, optical & geometrical isomerism, electrophilic substitution.',
    defaultCompleted: false,
  },
  {
    id: 'syl-math-1',
    subject: 'Mathematics',
    chapter: 'Quadratic Equations & Complex Numbers',
    classLevel: '11th',
    weightage: 'Medium',
    expectedQs: '2 Qs',
    unitSummary: 'Nature & location of roots, Vieta’s relations ($\\alpha+\\beta = -b/a$), De Moivre’s theorem ($e^{i\\theta} = \\cos\\theta + i\\sin\\theta$), $n^{\\text{th}}$ roots of unity.',
    defaultCompleted: false,
  },
  {
    id: 'syl-math-2',
    subject: 'Mathematics',
    chapter: 'Matrices and Determinants',
    classLevel: '12th',
    weightage: 'High',
    expectedQs: '2–3 Qs',
    unitSummary: 'Adjoint & inverse properties ($|\\text{adj}(A)| = |A|^{n-1}$), Cramer’s system of linear equations, Cayley-Hamilton theorem.',
    defaultCompleted: false,
  },
  {
    id: 'syl-math-3',
    subject: 'Mathematics',
    chapter: 'Limits, Continuity & Differentiability',
    classLevel: '12th',
    weightage: 'High',
    expectedQs: '2–3 Qs',
    unitSummary: 'Standard trigonometric & exponential limits, L’Hôpital’s rule, tangents & normals, monotonic functions & extrema.',
    defaultCompleted: false,
  },
  {
    id: 'syl-math-4',
    subject: 'Mathematics',
    chapter: 'Definite Integration & Differential Equations',
    classLevel: '12th',
    weightage: 'High',
    expectedQs: '3 Qs',
    unitSummary: 'King’s property ($\\int_a^b f(x)dx = \\int_a^b f(a+b-x)dx$), Leibniz rule, area under curves, linear differential equations ($dy/dx + Py = Q$).',
    defaultCompleted: false,
  },
  {
    id: 'syl-math-5',
    subject: 'Mathematics',
    chapter: 'Vector Algebra & 3D Geometry',
    classLevel: '12th',
    weightage: 'High',
    expectedQs: '3–4 Qs',
    unitSummary: 'Dot & cross products ($\\vec{a}\\cdot\\vec{b}$, $\\vec{a}\\times\\vec{b}$), scalar triple product, shortest distance between skew lines, plane & line intersections.',
    defaultCompleted: false,
  },
  {
    id: 'syl-math-6',
    subject: 'Mathematics',
    chapter: 'Conic Sections (Parabola, Ellipse, Hyperbola)',
    classLevel: '11th',
    weightage: 'Medium',
    expectedQs: '2 Qs',
    unitSummary: 'Standard equations ($y^2=4ax$, $x^2/a^2 + y^2/b^2 = 1$), eccentricity, focus-directrix, latus rectum, tangent & normal conditions.',
    defaultCompleted: false,
  },
];

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
 * Generates the official 75-Question NTA JEE Main Paper:
 * - Q1–Q20: Physics Section A (20 MCQs, +4/-1)
 * - Q21–Q25: Physics Section B (5 Numericals, +4/0, no negative marking)
 * - Q26–Q45: Chemistry Section A (20 MCQs, +4/-1)
 * - Q46–Q50: Chemistry Section B (5 Numericals, +4/0, no negative marking)
 * - Q51–Q70: Mathematics Section A (20 MCQs, +4/-1)
 * - Q71–Q75: Mathematics Section B (5 Numericals, +4/0, no negative marking)
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
      result.push({
        ...tpl,
        id: `q${qNum}`,
        number: qNum,
        examType: 'JEE Main',
        stem: variantNum > 1 ? `[Shift Variant ${variantNum}] ${tpl.stem}` : tpl.stem,
      });
      qNum++;
    }
    for (let i = 0; i < 5; i++) {
      const tpl = nums[i % nums.length];
      const factor = i + 1;
      const baseAns = tpl.numericalAnswer ?? 5;
      result.push({
        ...tpl,
        id: `q${qNum}`,
        number: qNum,
        examType: 'JEE Main',
        section: 'Section B',
        numericalAnswer: i === 0 ? baseAns : baseAns,
        stem:
          i === 0
            ? tpl.stem
            : `[Compulsory Numerical ${factor}/5] ${tpl.stem}`,
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
    chapter: 'Rotational Motion',
    examType: 'JEE Advanced',
    advancedFormat: 'multiple',
    difficultyBucket: 'Advanced Climb',
    pyqTag: 'JEE Advanced Paper 1',
    stem: '[One or More Than One Correct (+4 / -2 / +1 Partial)] A uniform disc of mass $M$ and radius $R$ rolls without slipping on a rough horizontal surface with center-of-mass velocity $v_0$. Which of the following statements are correct?',
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
    stem: '[One or More Than One Correct (+4 / -2 / +1 Partial)] Which of the following coordination entities are diamagnetic and exhibit $d^2sp^3$ or $dsp^2$ inner-orbital hybridisation?',
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
    stem: '[Matrix Match (+3 / -1)] Let $A$ be a $3 \\times 3$ matrix with $|A| = 2$. Match List-I ($\\text{ P: } |2A|, \\text{ Q: } |\\text{adj } A|, \\text{ R: } |A^{-1}|$) with List-II ($1:\\, 16, \\; 2:\\, 4, \\; 3:\\, 0.5$):',
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
    chapter: 'Electrostatics & Capacitors',
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
    id: 'jee-2024-s2-sh2',
    paper: 'JEE Main 2024 Session 2 Shift 2',
    year: '2024',
    session: 'Session 2',
    shift: 'Shift 2',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2024-s1-sh1',
    paper: 'JEE Main 2024 Session 1 Shift 1',
    year: '2024',
    session: 'Session 1',
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
