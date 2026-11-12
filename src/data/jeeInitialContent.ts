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
  pages: NotePageData[];
  mindMapNodes: MindMapNodeItem[];
  stickyNotes: StickyNoteData[];
  formulas: FormulaCardEntry[];
  quizQuestions: CBTQuestion[];
}

/**
 * Generates a comprehensive MaterialStudyBundle from any user-uploaded
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
  originalFileUrl?: string;
  originalMimeType?: string;
}): MaterialStudyBundle {
  const {
    materialId,
    title,
    subject,
    chapter,
    sourceType,
    rawText,
    durationHours = 2,
    originalFileUrl,
    originalMimeType,
  } = params;
  const cleanText = (rawText || '').trim();

  // Split raw extracted text into logical paragraphs/blocks
  const rawParagraphs = cleanText
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Extract any explicit $$...$$ or $...$ formulas present in the uploaded material text
  const extractedRawFormulas: string[] = [];
  const displayRegex = /\$\$([\s\S]+?)\$\$/g;
  let match: RegExpExecArray | null;
  while ((match = displayRegex.exec(cleanText)) !== null) {
    const eq = `$$${match[1].trim()}$$`;
    if (!extractedRawFormulas.includes(eq)) extractedRawFormulas.push(eq);
  }
  // Strip display math first before scanning for inline $...$ equations
  const textWithoutDisplayMath = cleanText.replace(/\$\$[\s\S]+?\$\$/g, ' ');
  const inlineRegex = /\$([^$\n]+?)\$/g;
  while ((match = inlineRegex.exec(textWithoutDisplayMath)) !== null) {
    const inner = match[1].trim();
    if (inner.includes('=') || inner.includes('\\int') || inner.includes('\\frac') || inner.includes('\\Delta')) {
      const eq = `$$${inner}$$`;
      if (!extractedRawFormulas.includes(eq)) extractedRawFormulas.push(eq);
    }
  }

  const subjectFormulaBank =
    subject === 'Physics'
      ? [
          {
            title: `${chapter} — Fundamental Dynamical Law`,
            formula: '$$\\vec{F}_{\\text{net}} = \\frac{d\\vec{p}}{dt} = m\\vec{a}, \\quad W_{\\text{all}} = \\int_{r_1}^{r_2} \\vec{F}\\cdot d\\vec{r} = \\Delta K$$',
            variables: '$\\vec{F}_{\\text{net}}$: Net resultant force, $\\vec{p} = m\\vec{v}$: Linear momentum, $W_{\\text{all}}$: Total work done by all forces, $\\Delta K$: Change in kinetic energy',
            units: 'Force: $\\text{N} = \\text{kg}\\cdot\\text{m/s}^2$ $[M^1L^1T^{-2}]$, Work/Energy: $\\text{J} = \\text{N}\\cdot\\text{m}$ $[M^1L^2T^{-2}]$',
            notes: `Primary conservation and work-energy relation for ${chapter}.`,
          },
          {
            title: `${chapter} — Rotational & Field Conservation Relation`,
            formula: '$$\\vec{\\tau}_{\\text{ext}} = \\frac{d\\vec{L}}{dt} = I\\vec{\\alpha}, \\quad I = I_{\\text{cm}} + Md^2, \\quad K_{\\text{total}} = \\frac{1}{2}Mv_{\\text{cm}}^2 + \\frac{1}{2}I_{\\text{cm}}\\omega^2$$',
            variables: '$\\vec{\\tau}_{\\text{ext}}$: External torque, $\\vec{L}$: Angular momentum, $I_{\\text{cm}}$: Centroidal moment of inertia, $d$: Parallel axis separation',
            units: 'Torque: $\\text{N}\\cdot\\text{m}$, Moment of Inertia: $\\text{kg}\\cdot\\text{m}^2$ $[M^1L^2T^0]$, $\\omega$: $\\text{rad/s}$',
            notes: `Used for multi-body dynamics, pure rolling ($v_{\\text{cm}} = \\omega R$), and angular impulse calculations.`,
          },
          {
            title: `${chapter} — Physical Constants & Limiting Relations`,
            formula: '$$g = 9.8\\text{ m/s}^2, \\quad \\varepsilon_0 = 8.854 \\times 10^{-12}\\text{ C}^2/\\text{N}\\cdot\\text{m}^2, \\quad c = 3 \\times 10^8\\text{ m/s}$$',
            variables: '$g$: Acceleration due to gravity, $\\varepsilon_0$: Vacuum permittivity, $c$: Speed of light in vacuum',
            units: 'Standard SI Base & Derived Units',
            notes: `Essential constants and dimensional scaling for ${chapter} numerical problems.`,
          },
        ]
      : subject === 'Chemistry'
      ? [
          {
            title: `${chapter} — Thermodynamic & Electrochemical Equilibrium`,
            formula: '$$\\Delta G^\\circ = -nFE^\\circ_{\\text{cell}} = -2.303\\,RT \\log_{10} K_{\\text{eq}}, \\quad E_{\\text{cell}} = E^\\circ_{\\text{cell}} - \\frac{0.0591}{n}\\log_{10} Q$$',
            variables: '$\\Delta G^\\circ$: Standard Gibbs free energy, $n$: Moles of electrons transferred, $F = 96485\\text{ C/mol}$: Faraday constant, $Q$: Reaction quotient',
            units: '$\\Delta G^\\circ$: $\\text{J/mol}$ or $\\text{kJ/mol}$, $E_{\\text{cell}}$: $\\text{V}$ (Volts), $R = 8.314\\text{ J}\\cdot\\text{mol}^{-1}\\text{K}^{-1}$',
            notes: `Connects cell potential, reaction spontaneity, and equilibrium constant at $T = 298\\text{ K}$.`,
          },
          {
            title: `${chapter} — Rate Law, Activation Energy & Molecular Properties`,
            formula: '$$k = A e^{-E_a / RT}, \\quad \\ln\\left(\\frac{k_2}{k_1}\\right) = \\frac{E_a}{R}\\left(\\frac{1}{T_1} - \\frac{1}{T_2}\\right), \\quad \\mu_{\\text{spin}} = \\sqrt{n(n+2)}\\text{ BM}$$',
            variables: '$k$: Rate constant, $E_a$: Activation energy, $A$: Arrhenius pre-exponential factor, $n$: Number of unpaired electrons',
            units: '$E_a$: $\\text{J/mol}$, Magnetic moment $\\mu$: Bohr Magneton ($\\text{BM}$)',
            notes: `Governs temperature dependence of reaction rates and electronic spin properties in ${chapter}.`,
          },
          {
            title: `${chapter} — Standard Chemical Constants & Colligative Relations`,
            formula: '$$\\pi = iCRT, \\quad \\Delta T_b = i K_b m, \\quad N_A = 6.022 \\times 10^{23}\\text{ mol}^{-1}$$',
            variables: '$i$: van’t Hoff factor, $C$: Molarity, $m$: Molality, $K_b$: Ebullioscopic constant',
            units: 'Concentration: $\\text{mol/L}$ ($\\text{M}$) or $\\text{mol/kg}$ ($\\text{m}$), Pressure: $\\text{atm}$ or $\\text{Pa}$',
            notes: `Always account for dissociation/association via the van’t Hoff factor $i = 1 + (\\nu - 1)\\alpha$.`,
          },
        ]
      : [
          {
            title: `${chapter} — Fundamental Calculus & King’s Definite Integral Property`,
            formula: '$$\\int_{a}^{b} f(x)\\,dx = \\int_{a}^{b} f(a+b-x)\\,dx, \\quad \\frac{d}{dx}\\left[\\int_{g(x)}^{h(x)} f(t)\\,dt\\right] = f(h(x))h\'(x) - f(g(x))g\'(x)$$',
            variables: '$a, b$: Lower and upper limits of integration, $g(x), h(x)$: Differentiable variable limits (Leibniz Rule)',
            units: 'Dimensionless analytical identity / Area in square units',
            notes: `First-choice property for definite integrals and functional equations in ${chapter}.`,
          },
          {
            title: `${chapter} — Algebraic, Matrix & Vector Identities`,
            formula: '$$|\\text{adj}(A)| = |A|^{n-1}, \\quad A^{-1} = \\frac{\\text{adj}(A)}{|A|}, \\quad |\\vec{a} \\times \\vec{b}|^2 + (\\vec{a}\\cdot\\vec{b})^2 = |\\vec{a}|^2|\\vec{b}|^2$$',
            variables: '$A$: Non-singular square matrix of order $n$, $\\text{adj}(A)$: Adjoint matrix, $\\vec{a}, \\vec{b}$: Vectors in $\\mathbb{R}^3$',
            units: 'Order $n \\in \\mathbb{N}$, Angle $\\theta \\in [0, \\pi]$ radians',
            notes: `High-frequency identity for JEE Main & Advanced linear algebra and 3D geometry problems.`,
          },
          {
            title: `${chapter} — Series Expansion & Limiting Behavior`,
            formula: '$$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1, \\quad \\lim_{x \\to 0} \\frac{e^x - 1}{x} = 1, \\quad e^{i\\theta} = \\cos\\theta + i\\sin\\theta$$',
            variables: '$x$: Real or complex argument in radians, $\\theta$: Principal argument ($-\\pi < \\theta \\le \\pi$)',
            units: 'Angles strictly in radians for calculus limits',
            notes: `Use Taylor expansion up to the first non-vanishing degree when L’Hôpital’s rule becomes lengthy.`,
          },
        ];

  const defaultFormulaBySubject = subjectFormulaBank[0].formula;

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
      `**Complete Theoretical Foundation of ${chapter} (${subject})**: Every physical, chemical, or mathematical system in **${chapter}** is governed by conservation principles, constitutive equations, and boundary conditions. Understanding the exact assumptions behind each law is essential before applying any formula.`;

    const secondaryText =
      chunk[1] ||
      `**Step-by-Step Analytical Proof & Derivation**: Starting from first principles, isolate the differential element or state variable, apply the governing law for **${chapter}**, and integrate or simplify across the domain limits to obtain the closed-form result.`;

    const pageFormulaEntry = subjectFormulaBank[(p - 1) % subjectFormulaBank.length];
    const extraExtractedFormula = extractedRawFormulas[p - 1];

    pages.push({
      pageNumber: p,
      heading:
        p === 1
          ? `${chapter} — Complete Theory, First Principles & Derivations`
          : p === 2
          ? `${chapter} — Mathematical Proofs, Solved Examples & Methods`
          : `${chapter} — Edge Cases, Exam Traps & Complete Formula Compendium (Part ${p - 2})`,
      timestampRange,
      sections: [
        {
          numberTitle: `${p}.1 Complete Theory, Step-by-Step Derivations & Proofs`,
          paragraphs: [
            primaryText,
            secondaryText,
            `**Step-by-Step Derivation Walkthrough**: (Step 1) Define the reference frame, domain, or standard state for **${chapter}**. (Step 2) Express the infinitesimal or algebraic relationship linking the primary variables (${pageFormulaEntry.variables}). (Step 3) Apply boundary conditions and combine terms to arrive at the governing equation below.`,
          ],
          bullets: [
            `**Fundamental Law & Physical Meaning**: Master the exact statement and domain of validity for **${chapter}** before plugging in numerical values.`,
            `**Derivation Prerequisite**: Verify whether coefficients are constant or variable across the interval before integrating or algebraic elimination.`,
          ],
          formulas: extraExtractedFormula
            ? [extraExtractedFormula, pageFormulaEntry.formula]
            : [pageFormulaEntry.formula],
        },
        {
          numberTitle: `${p}.2 Solved Numerical Examples & Step-by-Step Problem-Solving Methods`,
          paragraphs: [
            `**Representative JEE Main & Advanced Solved Example (Page ${p})**: Consider a standard system in **${chapter}** where initial state parameters are specified in SI units and we must determine the final state response and rate of change.`,
            `**Systematic 4-Step Solution Method**:\n1. **Identify Given Data & Target Unknown**: Convert all given quantities into consistent units (${pageFormulaEntry.units}).\n2. **Select Governing Equation**: Apply ${pageFormulaEntry.title} without premature numerical approximation.\n3. **Symbolic Simplification**: Cancel common factors symbolically to minimize arithmetic errors.\n4. **Final Substitution & Verification**: Compute the numerical answer and verify dimensional homogeneity.`,
          ],
          bullets: [
            `**Speed Heuristic for Objective MCQs**: Check dimensional consistency and extreme limiting cases ($x \\to 0$ or $x \\to \\infty$) to eliminate 2 distractor options immediately.`,
            `**Precision Rule for Section B Numericals**: Retain full fractional or radical form until the very last line of calculation.`,
          ],
          formulas: [subjectFormulaBank[p % subjectFormulaBank.length].formula],
        },
        {
          numberTitle: `${p}.3 Important Exceptions, Edge Cases & Common JEE Exam Traps`,
          paragraphs: [
            `*Critical Boundary Conditions & Exceptions in ${chapter}*: Paper setters frequently test non-ideal regimes, discontinuous boundaries, or special electronic/geometric configurations where textbook shortcuts fail.`,
          ],
          bullets: [
            `*Common Exam Trap 1 (Frame & Sign Convention)*: Never apply standard formulas across non-inertial frames, non-standard electrode conditions, or undefined domain points without adding the correction term.`,
            `*Common Exam Trap 2 (Logarithm & Unit Conversion)*: Watch out for the factor of $2.303$ between natural log ($\\ln$) and base-10 log ($\\log_{10}$), and always convert $\\text{cm}$, $\\text{g}$, or $^\\circ\\text{C}$ to $\\text{m}$, $\\text{kg}$, and $\\text{K}$.`,
            `*Edge Case Alert*: When net external force, torque, orfree energy change equals zero, explicitly check whether the system is in stable, unstable, or neutral equilibrium.`,
          ],
        },
        {
          numberTitle: `${p}.4 Chapter Formulas, Constants & Dimensional Units`,
          paragraphs: [
            `**Variables & Definitions**: ${pageFormulaEntry.variables}`,
            `**Standard Units & Dimensions**: ${pageFormulaEntry.units} — ${pageFormulaEntry.notes}`,
          ],
          bullets: [
            `**Formula Book Sync**: Every equation and constant in this section is automatically indexed into your Revise Formula Book for rapid pre-exam review.`,
          ],
          formulas: [
            pageFormulaEntry.formula,
            subjectFormulaBank[(p + 1) % subjectFormulaBank.length].formula,
          ],
        },
      ],
      aiTutorSummary: {
        english: `Page ${p} of "${title}" provides the complete theory, step-by-step derivations, solved numerical methodology, exam traps, and dimensional formulas for ${chapter}.`,
        hinglish: `"${title}" ke Page ${p} mein ${chapter} ki complete theory, step-by-step derivations, solved examples, important exam traps aur saare formulas detail mein diye gaye hain.`,
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
      definition: `**Systematic Solver Workflow**: 1) Identify system boundaries, 2) Write governing equations, 3) Solve symbolically before plugging numbers.`,
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
    ...subjectFormulaBank.map((item, idx) => ({
      id: `${materialId}-fb-${idx + 1}`,
      subject,
      chapter,
      title: item.title,
      formula: item.formula,
      variables: item.variables,
      units: item.units,
      notes: `${item.notes} (Source: "${title}")`,
    })),
    ...extractedRawFormulas.map((eq, idx) => ({
      id: `${materialId}-fb-ext-${idx + 1}`,
      subject,
      chapter,
      title: `${chapter} — Extracted Equation #${idx + 1}`,
      formula: eq,
      variables: `Extracted directly from uploaded material "${title}"`,
      units: 'Standard SI / Analytical Units',
      notes: `Directly scanned from your uploaded ${sourceType.toUpperCase()} material.`,
    })),
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
    originalFileUrl,
    originalMimeType,
    rawText: cleanText,
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

const RAW_58_CHAPTERS: Omit<SyllabusChapterItem, 'weightage' | 'defaultCompleted'>[] = [
  // ================= PHYSICS (20 Official Chapters) =================
  {
    id: 'syl-phys-1',
    subject: 'Physics',
    subDiscipline: 'Mechanics',
    chapter: 'Units, Dimensions & Error Analysis',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Dimensional homogeneity ($[M^aL^bT^c]$), significant figures, Vernier calipers, screw gauge least count, propagation of fractional errors ($\\frac{\\Delta Z}{Z}$).',
  },
  {
    id: 'syl-phys-2',
    subject: 'Physics',
    subDiscipline: 'Mechanics',
    chapter: 'Kinematics (1D & 2D Projectile Motion)',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Relative velocity, projectile trajectory ($y = x\\tan\\theta - \\frac{gx^2}{2u^2\\cos^2\\theta}$), river-boat & rain-man problems, non-uniform acceleration ($a = v\\frac{dv}{dx}$).',
  },
  {
    id: 'syl-phys-3',
    subject: 'Physics',
    subDiscipline: 'Mechanics',
    chapter: 'Laws of Motion & Friction',
    classLevel: '11',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: 'Newton’s Laws, Free-body diagrams ($\\sum \\vec{F} = m\\vec{a}$), static & kinetic friction ($f_s \\le \\mu_s N$), banking of roads, pseudo forces, wedge-pulley constraints.',
  },
  {
    id: 'syl-phys-4',
    subject: 'Physics',
    subDiscipline: 'Mechanics',
    chapter: 'Work, Energy and Power',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Work-energy theorem ($W_{\\text{all}} = \\Delta K$), conservative force potential ($\\vec{F} = -\\nabla U$), vertical circular motion ($v_{\\text{min}} = \\sqrt{5gR}$).',
  },
  {
    id: 'syl-phys-5',
    subject: 'Physics',
    subDiscipline: 'Mechanics',
    chapter: 'Center of Mass, Impulse & Collisions',
    classLevel: '11',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Linear momentum conservation, coefficient of restitution ($e = \\frac{v_2 - v_1}{u_1 - u_2}$), oblique collisions, variable mass rocket propulsion.',
  },
  {
    id: 'syl-phys-6',
    subject: 'Physics',
    subDiscipline: 'Mechanics',
    chapter: 'Rotational Motion & Rigid Body Dynamics',
    classLevel: '11',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: 'Moment of inertia, parallel & perpendicular axis theorems ($I = I_{\\text{cm}} + Md^2$), torque ($\\vec{\\tau} = \\vec{r}\\times\\vec{F}$), angular momentum, pure rolling ($v = \\omega R$).',
  },
  {
    id: 'syl-phys-7',
    subject: 'Physics',
    subDiscipline: 'Mechanics',
    chapter: 'Gravitation & Satellite Dynamics',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Universal gravitation, variation of $g$, gravitational potential, escape velocity ($v_e = \\sqrt{2GM/R}$), Kepler’s laws ($T^2 \\propto a^3$).',
  },
  {
    id: 'syl-phys-8',
    subject: 'Physics',
    subDiscipline: 'Mechanics',
    chapter: 'Mechanical Properties of Solids & Fluids',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '2 Qs',
    unitSummary: 'Young’s & bulk modulus, Pascal’s law, buoyancy, Bernoulli’s theorem ($P + \\frac{1}{2}\\rho v^2 + \\rho gh = \\text{const}$), surface tension ($\\Delta P = 2T/R$), Stokes’ viscosity.',
  },
  {
    id: 'syl-phys-9',
    subject: 'Physics',
    subDiscipline: 'Thermal & Waves',
    chapter: 'Thermal Properties, Calorimetry & Heat Transfer',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Thermal expansion, calorimetry, Fourier heat conduction, Stefan-Boltzmann radiation ($E = \\sigma e T^4$), Wien’s displacement law ($\\lambda_m T = b$).',
  },
  {
    id: 'syl-phys-10',
    subject: 'Physics',
    subDiscipline: 'Thermal & Waves',
    chapter: 'Thermodynamics & Kinetic Theory of Gases',
    classLevel: '11',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: 'First law ($\\Delta Q = \\Delta U + W$), isothermal & adiabatic processes ($PV^\\gamma = \\text{const}$), Carnot efficiency, RMS speed ($v_{\\text{rms}} = \\sqrt{3RT/M}$), equipartition of energy.',
  },
  {
    id: 'syl-phys-11',
    subject: 'Physics',
    subDiscipline: 'Thermal & Waves',
    chapter: 'Simple Harmonic Motion (SHM) & Oscillations',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Differential equation $\\frac{d^2x}{dt^2} + \\omega^2 x = 0$, spring-block combinations, simple & compound pendulum, superposition of SHMs.',
  },
  {
    id: 'syl-phys-12',
    subject: 'Physics',
    subDiscipline: 'Thermal & Waves',
    chapter: 'Wave Motion, Standing Waves & Acoustics',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Travelling wave $y = A\\sin(\\omega t - kx)$, speed of sound, vibrating strings & organ pipes, beats, Doppler effect in sound.',
  },
  {
    id: 'syl-phys-13',
    subject: 'Physics',
    subDiscipline: 'Electrodynamics',
    chapter: 'Electrostatics & Gauss’s Law',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: 'Coulomb’s law, electric field & potential, Gauss’s law ($\\oint \\vec{E}\\cdot d\\vec{A} = q_{\\text{in}}/\\varepsilon_0$), electric dipole torque & potential energy ($U = -\\vec{p}\\cdot\\vec{E}$).',
  },
  {
    id: 'syl-phys-14',
    subject: 'Physics',
    subDiscipline: 'Electrodynamics',
    chapter: 'Capacitance & Dielectrics',
    classLevel: '12',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Parallel plate, spherical & cylindrical capacitors, dielectric insertion with battery connected vs disconnected, transient RC charging ($q = CV(1 - e^{-t/RC})$).',
  },
  {
    id: 'syl-phys-15',
    subject: 'Physics',
    subDiscipline: 'Electrodynamics',
    chapter: 'Current Electricity & Electrical Measuring Instruments',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '3 Qs',
    unitSummary: 'Drift velocity ($I = neAv_d$), Kirchhoff’s circuit laws, Wheatstone bridge, meter bridge, potentiometer, galvanometer to ammeter/voltmeter conversion.',
  },
  {
    id: 'syl-phys-16',
    subject: 'Physics',
    subDiscipline: 'Electrodynamics',
    chapter: 'Moving Charges, Magnetism & Matter',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: 'Biot-Savart law, Ampere’s circuital law, Lorentz force ($\\vec{F} = q(\\vec{E} + \\vec{v}\\times\\vec{B})$), cyclotron radius ($r = mv/qB$), torque on current loop.',
  },
  {
    id: 'syl-phys-17',
    subject: 'Physics',
    subDiscipline: 'Electrodynamics',
    chapter: 'Electromagnetic Induction (EMI) & Alternating Current (AC)',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: 'Faraday’s & Lenz’s laws ($\\mathcal{E} = -d\\Phi_B/dt$), motional EMF, self & mutual inductance, series LCR phasor impedance ($Z = \\sqrt{R^2 + (X_L - X_C)^2}$), resonance.',
  },
  {
    id: 'syl-phys-18',
    subject: 'Physics',
    subDiscipline: 'Optics & Modern',
    chapter: 'Electromagnetic Waves & Ray Optics',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: 'Displacement current, Poynting vector, total internal reflection, spherical mirrors, refraction at spherical surfaces, lens maker’s formula, prism minimum deviation.',
  },
  {
    id: 'syl-phys-19',
    subject: 'Physics',
    subDiscipline: 'Optics & Modern',
    chapter: 'Wave Optics (Interference, Diffraction & Polarization)',
    classLevel: '12',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Huygens’ principle, Young’s double slit experiment ($\beta = \\lambda D/d$), thin-film interference, single-slit diffraction, Brewster’s law & Malus’s law ($I = I_0\\cos^2\\theta$).',
  },
  {
    id: 'syl-phys-20',
    subject: 'Physics',
    subDiscipline: 'Optics & Modern',
    chapter: 'Modern Physics (Dual Nature, Atoms, Nuclei & Semiconductors)',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '3–4 Qs',
    unitSummary: 'Photoelectric equation ($K_{\\max} = h\\nu - \\phi_0$), de Broglie wavelength ($\\lambda = h/p$), Bohr hydrogen spectrum, nuclear binding energy, p-n junction, Zener diode & logic gates.',
  },

  // ================= CHEMISTRY (20 Official Chapters) =================
  {
    id: 'syl-chem-1',
    subject: 'Chemistry',
    subDiscipline: 'Physical',
    chapter: 'Some Basic Concepts of Chemistry & Mole Concept',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Stoichiometry, limiting reagent, molarity ($M$), molality ($m$), mole fraction, equivalent weight & redox titration calculations.',
  },
  {
    id: 'syl-chem-2',
    subject: 'Chemistry',
    subDiscipline: 'Physical',
    chapter: 'Atomic Structure & Quantum Mechanical Model',
    classLevel: '11',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2 Qs',
    unitSummary: 'Bohr’s atomic model, Rydberg formula, Heisenberg uncertainty ($\\Delta x\\cdot\\Delta p \\ge h/4\\pi$), quantum numbers ($n, l, m_l, m_s$), radial & angular nodes.',
  },
  {
    id: 'syl-chem-3',
    subject: 'Chemistry',
    subDiscipline: 'Physical',
    chapter: 'Chemical Thermodynamics & Thermochemistry',
    classLevel: '11',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: 'First, Second & Third Laws, enthalpy ($\\Delta H = \\Delta U + \\Delta n_g RT$), Hess’s law, Born-Haber cycle, Gibbs spontaneity ($\\Delta G = \\Delta H - T\\Delta S$).',
  },
  {
    id: 'syl-chem-4',
    subject: 'Chemistry',
    subDiscipline: 'Physical',
    chapter: 'Chemical & Ionic Equilibrium',
    classLevel: '11',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2 Qs',
    unitSummary: 'Law of mass action ($K_p = K_c(RT)^{\\Delta n_g}$), Le Chatelier’s principle, Ostwald dilution, pH of buffers (Henderson equation), salt hydrolysis, solubility product ($K_{sp}$).',
  },
  {
    id: 'syl-chem-5',
    subject: 'Chemistry',
    subDiscipline: 'Physical',
    chapter: 'Redox Reactions & Volumetric Analysis',
    classLevel: '11',
    weightageTier: 'Low',
    examScope: 'Main+Advanced',
    expectedQs: '1 Q',
    unitSummary: 'Oxidation number rules, disproportionation, balancing ion-electron equations, $n$-factor & law of chemical equivalence.',
  },
  {
    id: 'syl-chem-6',
    subject: 'Chemistry',
    subDiscipline: 'Physical',
    chapter: 'Solutions & Colligative Properties',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2 Qs',
    unitSummary: 'Raoult’s law, ideal & non-ideal azeotropes, van’t Hoff factor ($i$), osmotic pressure ($\\pi = iCRT$), elevation in boiling point & depression in freezing point.',
  },
  {
    id: 'syl-chem-7',
    subject: 'Chemistry',
    subDiscipline: 'Physical',
    chapter: 'Electrochemistry',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2 Qs',
    unitSummary: 'Galvanic cells, Nernst equation ($E = E^\\circ - \\frac{0.0591}{n}\\log_{10} Q$), Gibbs energy $\\Delta G^\\circ = -nFE^\\circ$, Kohlrausch’s law, Faraday’s laws of electrolysis.',
  },
  {
    id: 'syl-chem-8',
    subject: 'Chemistry',
    subDiscipline: 'Physical',
    chapter: 'Chemical Kinetics & Nuclear Chemistry',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2 Qs',
    unitSummary: 'Order & molecularity, integrated zero & first-order rate laws ($t_{1/2} = 0.693/k$), Arrhenius activation energy ($k = Ae^{-E_a/RT}$), collision theory.',
  },
  {
    id: 'syl-chem-9',
    subject: 'Chemistry',
    subDiscipline: 'Physical',
    chapter: 'Solid State & Surface Chemistry',
    classLevel: '12',
    weightageTier: 'Low',
    examScope: 'Advanced-Only',
    expectedQs: '1 Q (Adv)',
    unitSummary: 'Unit cell packing efficiency (SCC, BCC, FCC, HCP), Bragg’s law ($2d\\sin\\theta = n\\lambda$), Schottky & Frenkel defects, Freundlich & Langmuir adsorption isotherms.',
  },
  {
    id: 'syl-chem-10',
    subject: 'Chemistry',
    subDiscipline: 'Inorganic',
    chapter: 'Classification of Elements & Periodic Properties',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Slater’s effective nuclear charge ($Z_{\\text{eff}}$), atomic & ionic radii, ionization enthalpy exceptions, electron gain enthalpy, electronegativity trends.',
  },
  {
    id: 'syl-chem-11',
    subject: 'Chemistry',
    subDiscipline: 'Inorganic',
    chapter: 'Chemical Bonding & Molecular Structure (VSEPR & MOT)',
    classLevel: '11',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '3 Qs',
    unitSummary: 'Hybridisation, VSEPR geometries, Fajan’s polarization rules, dipole moment, Molecular Orbital Theory (MOT) bond order ($\\frac{N_b - N_a}{2}$), hydrogen bonding.',
  },
  {
    id: 'syl-chem-12',
    subject: 'Chemistry',
    subDiscipline: 'Inorganic',
    chapter: 'p-Block Elements (Groups 13 to 18)',
    classLevel: '12',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '2 Qs',
    unitSummary: 'Inert pair effect, diborane ($3c-2e$ banana bonds), allotropes of carbon & phosphorus, oxoacids of N, P, S & halogens, interhalogen & xenon fluorides.',
  },
  {
    id: 'syl-chem-13',
    subject: 'Chemistry',
    subDiscipline: 'Inorganic',
    chapter: 'd & f Block Elements (Transition & Inner-Transition)',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: 'Variable oxidation states, spin-only magnetic moment ($\\mu = \\sqrt{n(n+2)}\\text{ BM}$), preparation & oxidizing properties of $\\text{KMnO}_4$ & $\\text{K}_2\\text{Cr}_2\\text{O}_7$, Lanthanoid contraction.',
  },
  {
    id: 'syl-chem-14',
    subject: 'Chemistry',
    subDiscipline: 'Inorganic',
    chapter: 'Coordination Compounds',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '3 Qs',
    unitSummary: 'Werner’s theory, IUPAC naming, Valence Bond Theory, Crystal Field Splitting ($\\Delta_o$ & $\\Delta_t$), spectrochemical series, synergic metal carbonyl bonding, isomerism.',
  },
  {
    id: 'syl-chem-15',
    subject: 'Chemistry',
    subDiscipline: 'Inorganic',
    chapter: 'Qualitative Salt Analysis & Metallurgy',
    classLevel: '12',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Cation group reagents (Groups I–VI), brown ring test, flame test, borax bead test, Ellingham diagram & electrolytic refining (Advanced).',
  },
  {
    id: 'syl-chem-16',
    subject: 'Chemistry',
    subDiscipline: 'Organic',
    chapter: 'General Organic Chemistry (GOC) & Stereoisomerism',
    classLevel: '11',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '3 Qs',
    unitSummary: 'IUPAC nomenclature, inductive, resonance & hyperconjugation effects, aromaticity (Huckel’s $4n+2$ rule), acidity/basicity order, $R/S$ & $E/Z$ stereochemistry.',
  },
  {
    id: 'syl-chem-17',
    subject: 'Chemistry',
    subDiscipline: 'Organic',
    chapter: 'Hydrocarbons (Alkanes, Alkenes, Alkynes & Arenes)',
    classLevel: '11',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2 Qs',
    unitSummary: 'Free-radical halogenation, Markovnikov & Kharasch peroxide addition, ozonolysis, hydroboration-oxidation, Birch reduction, Friedel-Crafts alkylation/acylation.',
  },
  {
    id: 'syl-chem-18',
    subject: 'Chemistry',
    subDiscipline: 'Organic',
    chapter: 'Haloalkanes, Haloarenes, Alcohols, Phenols & Ethers',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: '$S_N1, S_N2, E1, E2$ reaction mechanisms & stereochemistry, Grignard reagent, Lucas test, Reimer-Tiemann, Kolbe’s reaction, Williamson ether synthesis.',
  },
  {
    id: 'syl-chem-19',
    subject: 'Chemistry',
    subDiscipline: 'Organic',
    chapter: 'Aldehydes, Ketones & Carboxylic Acids',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: 'Nucleophilic addition, Aldol & Cross-Aldol condensation, Cannizzaro reaction, Clemmensen & Wolff-Kishner reduction, Tollens’/Fehling’s & haloform tests, HVZ reaction.',
  },
  {
    id: 'syl-chem-20',
    subject: 'Chemistry',
    subDiscipline: 'Organic',
    chapter: 'Amines, Diazonium Salts, Biomolecules & Practical Organic Chemistry',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: 'Gabriel phthalimide, Hoffmann bromamide, Hinsberg test, diazonium coupling, carbohydrates (glucose/fructose anomers), amino acids, peptides, Lassaigne’s test.',
  },

  // ================= MATHEMATICS (18 Official Chapters) =================
  {
    id: 'syl-math-1',
    subject: 'Mathematics',
    subDiscipline: 'Algebra',
    chapter: 'Sets, Relations and Functions',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Reflexive, symmetric & transitive equivalence relations, domain & range, injective (one-one) & surjective (onto) bijective functions, functional equations.',
  },
  {
    id: 'syl-math-2',
    subject: 'Mathematics',
    subDiscipline: 'Algebra',
    chapter: 'Complex Numbers',
    classLevel: '11',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Argand plane geometry, modulus & principal argument, triangle inequality, Euler’s form ($re^{i\\theta}$), De Moivre’s theorem, cube & $n^{\\text{th}}$ roots of unity.',
  },
  {
    id: 'syl-math-3',
    subject: 'Mathematics',
    subDiscipline: 'Algebra',
    chapter: 'Quadratic Equations & Theory of Equations',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Vieta’s root relations ($\\alpha+\\beta = -b/a$), discriminant nature of roots, common roots condition, location of roots on real number line.',
  },
  {
    id: 'syl-math-4',
    subject: 'Mathematics',
    subDiscipline: 'Algebra',
    chapter: 'Matrices and Determinants',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: 'Symmetric, skew-symmetric & orthogonal matrices, adjoint properties ($|\\text{adj}(A)| = |A|^{n-1}$), matrix inverse, Cramer’s system of linear equations, Cayley-Hamilton.',
  },
  {
    id: 'syl-math-5',
    subject: 'Mathematics',
    subDiscipline: 'Algebra',
    chapter: 'Permutations and Combinations',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Fundamental counting principle, circular permutations, distribution of identical/distinct objects (beggar’s method), inclusion-exclusion & derangements.',
  },
  {
    id: 'syl-math-6',
    subject: 'Mathematics',
    subDiscipline: 'Algebra',
    chapter: 'Binomial Theorem & Its Simple Applications',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'General term $T_{r+1} = \\binom{n}{r}x^{n-r}y^r$, term independent of $x$, numerically greatest term, properties of binomial coefficients, remainder problems.',
  },
  {
    id: 'syl-math-7',
    subject: 'Mathematics',
    subDiscipline: 'Algebra',
    chapter: 'Sequences and Series (AP, GP, AGP & Telescoping)',
    classLevel: '11',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2 Qs',
    unitSummary: 'Arithmetic & Geometric progressions, Arithmetic-Geometric series, AM-GM-HM inequality ($\\text{AM} \\ge \\text{GM} \\ge \\text{HM}$), method of differences.',
  },
  {
    id: 'syl-math-8',
    subject: 'Mathematics',
    subDiscipline: 'Calculus',
    chapter: 'Trigonometric Functions & Inverse Trigonometric Functions',
    classLevel: '12',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Compound & multiple angle identities, conditional identities, principal value branches of $\\arcsin, \\arccos, \\arctan$, inverse trigonometric simplifications.',
  },
  {
    id: 'syl-math-9',
    subject: 'Mathematics',
    subDiscipline: 'Calculus',
    chapter: 'Limits, Continuity and Differentiability',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: 'Indeterminate forms ($0/0, 1^\\infty$), Taylor/Maclaurin series expansions, L’Hôpital’s rule, piecewise continuity, sharp corners & non-differentiable points.',
  },
  {
    id: 'syl-math-10',
    subject: 'Mathematics',
    subDiscipline: 'Calculus',
    chapter: 'Application of Derivatives (Tangents, Monotonicity & Maxima-Minima)',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2 Qs',
    unitSummary: 'Rate of change, Rolle’s & Lagrange’s Mean Value Theorems, strictly increasing/decreasing intervals, local & global extrema, concavity & inflection points.',
  },
  {
    id: 'syl-math-11',
    subject: 'Mathematics',
    subDiscipline: 'Calculus',
    chapter: 'Indefinite & Definite Integration',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: 'Integration by substitution, parts ($\\int u\\,dv = uv - \\int v\\,du$), partial fractions, King’s property ($\\int_a^b f(x)dx = \\int_a^b f(a+b-x)dx$), Leibniz rule, Wallis formula.',
  },
  {
    id: 'syl-math-12',
    subject: 'Mathematics',
    subDiscipline: 'Calculus',
    chapter: 'Area Under Curves (Application of Integrals)',
    classLevel: '12',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Area bounded by parabolas, ellipses, lines, and modulus inequalities ($\\int_a^b |f(x) - g(x)|\\,dx$), curve sketching & symmetry shortcuts.',
  },
  {
    id: 'syl-math-13',
    subject: 'Mathematics',
    subDiscipline: 'Calculus',
    chapter: 'Differential Equations',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2 Qs',
    unitSummary: 'Order & degree, variable separable, homogeneous ($y = vx$), first-order linear differential equations ($\\frac{dy}{dx} + P(x)y = Q(x)$, $\\text{I.F.} = e^{\\int P\\,dx}$), exact differentials.',
  },
  {
    id: 'syl-math-14',
    subject: 'Mathematics',
    subDiscipline: 'Coordinate & Vectors',
    chapter: 'Straight Lines & Pair of Straight Lines',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'Centroid, orthocentre, circumcentre, incentre, family of lines ($L_1 + \\lambda L_2 = 0$), foot of perpendicular, image of a point, angle bisectors.',
  },
  {
    id: 'syl-math-15',
    subject: 'Mathematics',
    subDiscipline: 'Coordinate & Vectors',
    chapter: 'Circles & System of Circles',
    classLevel: '11',
    weightageTier: 'Medium',
    examScope: 'Main+Advanced',
    expectedQs: '1–2 Qs',
    unitSummary: 'General equation $x^2 + y^2 + 2gx + 2fy + c = 0$, condition of tangency, chord of contact ($T = 0$), director circle, orthogonal circles ($2g_1g_2 + 2f_1f_2 = c_1 + c_2$).',
  },
  {
    id: 'syl-math-16',
    subject: 'Mathematics',
    subDiscipline: 'Coordinate & Vectors',
    chapter: 'Conic Sections (Parabola, Ellipse & Hyperbola)',
    classLevel: '11',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2–3 Qs',
    unitSummary: 'Standard equations ($y^2=4ax$, $\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1$, $\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=1$), eccentricity, focal chords, parametric tangents & normals, rectangular hyperbola.',
  },
  {
    id: 'syl-math-17',
    subject: 'Mathematics',
    subDiscipline: 'Coordinate & Vectors',
    chapter: 'Vector Algebra & Three-Dimensional (3D) Geometry',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '3–4 Qs',
    unitSummary: 'Scalar & vector products, scalar triple product $[\\vec{a}\\,\\vec{b}\\,\\vec{c}]$, vector triple product, direction cosines, skew lines shortest distance ($\\frac{|(\\vec{a}_2-\\vec{a}_1)\\cdot(\\vec{b}_1\\times\\vec{b}_2)|}{|\\vec{b}_1\\times\\vec{b}_2|}$), planes.',
  },
  {
    id: 'syl-math-18',
    subject: 'Mathematics',
    subDiscipline: 'Algebra',
    chapter: 'Statistics & Probability (Bayes’ Theorem & Distributions)',
    classLevel: '12',
    weightageTier: 'High',
    examScope: 'Main+Advanced',
    expectedQs: '2 Qs',
    unitSummary: 'Mean, variance & standard deviation ($\\sigma^2 = \\frac{\\sum x_i^2}{N} - \\bar{x}^2$), conditional probability, total probability, Bayes’ theorem, random variables.',
  },
];

export const JEE_SYLLABUS_DATA: SyllabusChapterItem[] = RAW_58_CHAPTERS.map((ch) => ({
  ...ch,
  weightage: ch.weightageTier,
  defaultCompleted: false,
}));

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
