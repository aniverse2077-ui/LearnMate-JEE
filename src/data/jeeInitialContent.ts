import { CBTQuestion, QuestionResponseState } from '../utils/jeeEngine';
import { Preset3DId } from '../components/ThreeSceneCanvas';

export interface NotePageData {
  pageNumber: number;
  heading: string;
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

export const D_AND_F_BLOCK_PAGES: NotePageData[] = [
  {
    pageNumber: 1,
    heading: 'Introduction to d & f Block Elements',
    sections: [
      {
        numberTitle: '1. Position in the Periodic Table',
        paragraphs: [
          'The d-block of the periodic table contains the elements of the groups 3–12 in which the d orbitals are progressively filled in each of the four long periods.',
        ],
        bullets: [
          '3d series (First transition series): Sc (Z=21) to Zn (Z=30).',
          '4d series (Second transition series): Y (Z=39) to Cd (Z=48).',
          '5d series (Third transition series): La (Z=57), Hf (Z=72) to Hg (Z=80).',
          'f-block elements (Inner transition): 4f (Lanthanoids) and 5f (Actinoids).',
        ],
      },
      {
        numberTitle: '2. Why Study d & f Block for JEE?',
        bullets: [
          'Direct questions on anomalous electronic configurations of Cr (3d⁵ 4s¹) and Cu (3d¹⁰ 4s¹).',
          'Spin-only magnetic moment formula: μ = √(n(n+2)) BM.',
          'Lanthanoid contraction and its effect on Zr/Hf atomic radii.',
        ],
      },
    ],
    aiTutorSummary: {
      english:
        'Page 1 introduces the position of d-block (Groups 3–12) and f-block (Lanthanoids & Actinoids) in the periodic table, highlighting the 3d, 4d, and 5d transition series.',
      hinglish:
        'Page 1 mein d-block (Groups 3–12) aur f-block (Lanthanoids & Actinoids) ki periodic table position di gayi hai. Cr aur Cu ki configuration JEE ke liye super important hai!',
    },
  },
  {
    pageNumber: 2,
    heading: 'Transition Elements (d–Block)',
    sections: [
      {
        numberTitle: '1. Definition',
        paragraphs: [
          'Elements in which the d–subshell of the atom or at least of one of its common oxidation states is partially filled are called transition elements.',
        ],
      },
      {
        numberTitle: '2. General Characteristics',
        bullets: [
          'Show variable oxidation states (e.g. Fe: +2, +3, Cr: +2 to +6).',
          'Form coloured ions/compounds due to d–d transitions.',
          'Exhibit paramagnetism due to unpaired d–electrons.',
          'Readily form complex (coordination) compounds.',
          'Show catalytic activity (e.g. Fe, Ni, Pt, V₂O₅).',
          'Have high melting and boiling points, and high densities.',
        ],
      },
      {
        numberTitle: '3. Electronic Configuration',
        formulas: [
          'General electronic configuration:   (n − 1)d¹⁻¹⁰ ns⁰⁻²',
          'Examples:   Sc: [Ar] 3d¹ 4s²,   Fe: [Ar] 3d⁶ 4s²,   Cu: [Ar] 3d¹⁰ 4s¹.',
        ],
      },
      {
        numberTitle: '4. Causes of Variable Oxidation States',
        bullets: [
          'Small energy difference between (n − 1)d and ns orbitals.',
          'Both (n − 1)d and ns electrons can participate in bonding.',
        ],
      },
    ],
    aiTutorSummary: {
      english:
        'Transition elements are d–block elements with a partially filled d–subshell. They show variable oxidation states, form coloured compounds, are often paramagnetic, and readily form complex compounds.',
      hinglish:
        'Transition elements woh d–block elements hain jinke atom ya common oxidation state mein d–subshell partially filled hota hai. Yeh variable oxidation states, coloured ions (d–d transition), aur paramagnetism dikhate hain.',
    },
  },
  {
    pageNumber: 3,
    heading: 'Group 12 Exception & Lanthanoid Contraction',
    sections: [
      {
        numberTitle: '1. Why Group 12 (Zn, Cd, Hg) Are Not Typical Transition Metals',
        paragraphs: [
          'Zinc (3d¹⁰ 4s²), Cadmium (4d¹⁰ 5s²), and Mercury (5d¹⁰ 6s²) have full d¹⁰ configurations in their ground state as well as in their common +2 oxidation states.',
        ],
        bullets: [
          'No d–d电子 transitions possible → compounds are generally white/colourless.',
          'Diamagnetic in nature due to zero unpaired electrons.',
        ],
      },
      {
        numberTitle: '2. Lanthanoid Contraction',
        bullets: [
          'Steady decrease in atomic and ionic radii from La³⁺ to Lu³⁺.',
          'Caused by poor shielding of one 4f electron by another in the same subshell.',
          'Consequence: Atomic radii of 4d and 5d elements become nearly identical (e.g., Zr ≈ 160 pm, Hf ≈ 159 pm).',
        ],
      },
    ],
    aiTutorSummary: {
      english:
        'Group 12 metals (Zn, Cd, Hg) have completely filled d¹⁰ orbitals and are not regarded as transition elements. Lanthanoid contraction arises from poor 4f shielding, making 4d and 5d radii nearly equal.',
      hinglish:
        'Zn, Cd, Hg mein d¹⁰ full hota hai isliye inhe transition metals nahi maana jaata. Poor 4f shielding ki wajah se Lanthanoid contraction hota hai jisse Zr aur Hf ka size almost barabar ho jaata hai.',
    },
  },
];

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
}

export const D_AND_F_MIND_MAP_NODES: MindMapNodeItem[] = [
  {
    id: 'transition-metals',
    title: 'Transition metals',
    subtitle: 'Partially filled d subshell in atom or ion.',
    colorClass: 'bg-[#EEF2FF] dark:bg-indigo-950/60',
    borderClass: 'border-indigo-400 dark:border-indigo-500',
    pageRef: 'Page 3',
    definition: 'Elements with a partially filled d subshell in atom or ion.',
    example: 'Fe: [Ar] 3d⁶ 4s² (d subshell partially filled).',
    commonTrap: 'Including Group 12 (Zn, Cd, Hg) as transition metals, though they are usually d¹⁰.',
  },
  {
    id: 'group-12',
    title: 'Group 12',
    subtitle: 'Zn, Cd, Hg usually d¹⁰ in atoms and common ions.',
    colorClass: 'bg-[#ECFDF5] dark:bg-emerald-950/50',
    borderClass: 'border-emerald-400 dark:border-emerald-500',
    pageRef: 'Page 3',
    definition: 'Group 12 elements have completely filled (n−1)d¹⁰ orbitals in both ground state and +2 ions.',
    example: 'Zn²⁺: [Ar] 3d¹⁰ (0 unpaired electrons, diamagnetic).',
    commonTrap: 'Assuming Zn²⁺ forms coloured complexes via d–d transitions (it has no empty d-orbital slot).',
  },
  {
    id: 'lanthanoid-contraction',
    title: 'Lanthanoid contraction',
    subtitle: 'Poor 4f shielding causes decreasing ionic radius.',
    colorClass: 'bg-[#FFFBEB] dark:bg-amber-950/50',
    borderClass: 'border-amber-400 dark:border-amber-500',
    pageRef: 'Page 4',
    definition: 'Gradual decrease in atomic and trivalent ionic radii across the 4f series from Ce to Lu.',
    example: 'Ionic radius drops from La³⁺ (106 pm) to Lu³⁺ (85 pm); Zr (160 pm) ≈ Hf (159 pm).',
    commonTrap: 'Confusing the shielding order: 4f shielding is much poorer than 5d or 3d shielding.',
  },
  {
    id: 'oxidation-states',
    title: 'Oxidation states',
    subtitle: 'Variable states arise from comparable ns and (n−1)d energies.',
    colorClass: 'bg-[#ECFDF5] dark:bg-emerald-950/50',
    borderClass: 'border-emerald-400 dark:border-emerald-500',
    pageRef: 'Page 2',
    definition: 'Transition metals exhibit multiple oxidation states because both ns and (n−1)d electrons bond.',
    example: 'Mn shows oxidation states from +2 to +7 (in KMnO₄).',
    commonTrap: 'Forgetting that Sc only shows +3 (stable [Ar] configuration) and Cu+ disproportionates in water.',
  },
];

export const DIAGRAM_SVG_PRESETS: Record<Preset3DId, string> = {
  Incline: `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrow-black" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="none" stroke="#111827" stroke-width="1.8" stroke-linejoin="round"/>
      </marker>
    </defs>
    <rect width="680" height="420" fill="#FFFFFF" />
    <!-- Inclined Triangle Wedge -->
    <polygon points="100,335 550,335 550,150" fill="#E5E7EB" fill-opacity="0.65" stroke="#111827" stroke-width="3.2" stroke-linejoin="round"/>
    <!-- Angle Arc theta -->
    <path d="M 185,335 A 85,85 0 0,0 178,303" fill="#DBEAFE" fill-opacity="0.6" stroke="#111827" stroke-width="2.4"/>
    <text x="195" y="324" font-family="Georgia, serif" font-style="italic" font-size="30" fill="#111827">θ</text>
    <!-- Rotated Block on Incline (slope angle = -22.34 deg around (340, 236)) -->
    <g transform="translate(340, 236) rotate(-22.34)">
      <rect x="-60" y="-64" width="120" height="64" fill="#D1D5DB" stroke="#111827" stroke-width="3"/>
      <!-- Normal Force Vector N (perpendicular to incline) -->
      <line x1="0" y1="-64" x2="0" y2="-168" stroke="#111827" stroke-width="3.2" marker-end="url(#arrow-black)"/>
      <text x="-12" y="-182" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="31" fill="#111827">N</text>
    </g>
    <!-- Gravity Vector mg (straight down from center of mass) -->
    <line x1="328" y1="206" x2="328" y2="314" stroke="#111827" stroke-width="3.2" marker-end="url(#arrow-black)"/>
    <text x="306" y="346" font-family="Georgia, serif" font-style="italic" font-size="31" fill="#111827">mg</text>
  </svg>`,
  'Convex Lens': `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrow-opt" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="#1E293B"/>
      </marker>
    </defs>
    <rect width="680" height="420" fill="#FFFFFF"/>
    <line x1="50" y1="210" x2="630" y2="210" stroke="#64748B" stroke-width="2" stroke-dasharray="6,4"/>
    <path d="M 340,80 Q 385,210 340,340 Q 295,210 340,80 Z" fill="#DBEAFE" fill-opacity="0.65" stroke="#1E40AF" stroke-width="3"/>
    <line x1="160" y1="210" x2="160" y2="120" stroke="#059669" stroke-width="3.5" marker-end="url(#arrow-opt)"/>
    <line x1="160" y1="120" x2="340" y2="120" stroke="#4F46E5" stroke-width="2.5"/>
    <line x1="340" y1="120" x2="540" y2="290" stroke="#4F46E5" stroke-width="2.5" marker-end="url(#arrow-opt)"/>
    <line x1="160" y1="120" x2="540" y2="290" stroke="#D97706" stroke-width="2.5" marker-end="url(#arrow-opt)"/>
    <line x1="510" y1="210" x2="510" y2="276" stroke="#DC2626" stroke-width="3.5" marker-end="url(#arrow-opt)"/>
    <circle cx="240" cy="210" r="4" fill="#1E293B"/><text x="232" y="232" font-family="Georgia, serif" font-style="italic" font-size="18">F₁</text>
    <circle cx="440" cy="210" r="4" fill="#1E293B"/><text x="432" y="232" font-family="Georgia, serif" font-style="italic" font-size="18">F₂</text>
    <text x="142" y="108" font-family="Georgia, serif" font-size="17" fill="#059669">Object</text>
    <text x="490" y="308" font-family="Georgia, serif" font-size="17" fill="#DC2626">Real Image</text>
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
    <text x="572" y="210" font-family="Georgia, serif" font-style="italic" font-size="24" fill="#4F46E5">C (q = CV)</text>
    <text x="315" y="365" font-family="Georgia, serif" font-style="italic" font-size="22" fill="#059669">ε, τ = RC</text>
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
    <text x="322" y="217" font-family="Plus Jakarta Sans, sans-serif" font-weight="bold" font-size="18" fill="#FFFFFF">Fe³⁺</text>
    <circle cx="340" cy="80" r="20" fill="#10B981"/><text x="327" y="85" font-size="13" fill="#FFF" font-weight="bold">CN⁻</text>
    <circle cx="340" cy="340" r="20" fill="#10B981"/><text x="327" y="345" font-size="13" fill="#FFF" font-weight="bold">CN⁻</text>
    <circle cx="485" cy="175" r="20" fill="#10B981"/><text x="472" y="180" font-size="13" fill="#FFF" font-weight="bold">CN⁻</text>
    <circle cx="195" cy="245" r="20" fill="#10B981"/><text x="182" y="250" font-size="13" fill="#FFF" font-weight="bold">CN⁻</text>
    <circle cx="450" cy="255" r="20" fill="#10B981"/><text x="437" y="260" font-size="13" fill="#FFF" font-weight="bold">CN⁻</text>
    <circle cx="230" cy="165" r="20" fill="#10B981"/><text x="217" y="170" font-size="13" fill="#FFF" font-weight="bold">CN⁻</text>
    <text x="235" y="392" font-family="Georgia, serif" font-size="19" fill="#0F172A">Octahedral d²sp³ Hybridisation · [Fe(CN)₆]³⁻</text>
  </svg>`,
  Parabola: `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="680" height="420" fill="#FFFFFF"/>
    <line x1="80" y1="210" x2="600" y2="210" stroke="#475569" stroke-width="2"/>
    <line x1="260" y1="40" x2="260" y2="380" stroke="#475569" stroke-width="2"/>
    <line x1="170" y1="40" x2="170" y2="380" stroke="#EF4444" stroke-width="2.5" stroke-dasharray="6,4"/>
    <path d="M 520,50 Q 0,210 520,370" fill="none" stroke="#4F46E5" stroke-width="3.5"/>
    <circle cx="350" cy="210" r="6" fill="#059669"/>
    <text x="342" y="236" font-family="Georgia, serif" font-style="italic" font-size="19" fill="#059669">S(a, 0)</text>
    <text x="115" y="65" font-family="Georgia, serif" font-style="italic" font-size="17" fill="#EF4444">x = −a</text>
    <text x="455" y="105" font-family="Georgia, serif" font-style="italic" font-size="22" fill="#4F46E5">y² = 4ax</text>
  </svg>`,
  Ellipse: `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="680" height="420" fill="#FFFFFF"/>
    <line x1="60" y1="210" x2="620" y2="210" stroke="#475569" stroke-width="2"/>
    <line x1="340" y1="40" x2="340" y2="380" stroke="#475569" stroke-width="2"/>
    <ellipse cx="340" cy="210" rx="200" ry="115" fill="#EEF2FF" fill-opacity="0.5" stroke="#4F46E5" stroke-width="3.5"/>
    <circle cx="220" cy="210" r="5" fill="#DC2626"/><text x="202" y="235" font-family="Georgia, serif" font-style="italic" font-size="18">F₁(−ae, 0)</text>
    <circle cx="460" cy="210" r="5" fill="#DC2626"/><text x="442" y="235" font-family="Georgia, serif" font-style="italic" font-size="18">F₂(ae, 0)</text>
    <text x="465" y="95" font-family="Georgia, serif" font-style="italic" font-size="21" fill="#4F46E5">x²/a² + y²/b² = 1</text>
  </svg>`,
};

export const CBT_MOCK_QUESTIONS: CBTQuestion[] = [
  {
    id: 'q1',
    number: 1,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Sets, Relations and Functions',
    stem: 'Let R be a relation on set A = {1, 2, 3, 4} defined by xRy if and only if x divides y. Then R is:',
    options: [
      'Reflexive and transitive but not symmetric',
      'Symmetric and transitive',
      'An equivalence relation',
      'Neither reflexive nor transitive',
    ],
    correctIndex: 0,
    explanation: 'Every number divides itself (reflexive), if x|y and y|z then x|z (transitive), but 2|4 while 4 does not divide 2 (not symmetric).',
  },
  {
    id: 'q2',
    number: 2,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Complex Numbers',
    stem: 'If z = (1 + i) / (1 − i), then the value of z⁴ is equal to:',
    options: ['i', '−i', '1', '−1'],
    correctIndex: 2,
    explanation: '(1 + i)/(1 − i) = i, and i⁴ = 1.',
  },
  {
    id: 'q3',
    number: 3,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Matrices and Determinants',
    stem: 'If A is a 3 × 3 non-singular matrix such that |A| = 5, then |adj(A)| is:',
    options: ['5', '25', '125', '1/5'],
    correctIndex: 1,
    explanation: 'For an n × n matrix, |adj(A)| = |A|^(n−1) = 5^(3−1) = 25.',
  },
  {
    id: 'q4',
    number: 4,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Limits and Continuity',
    stem: 'Evaluate lim (x → 0) [sin(5x) / x]:',
    options: ['0', '1', '5', '1/5'],
    correctIndex: 2,
    explanation: 'lim (x→0) 5 · [sin(5x)/(5x)] = 5 × 1 = 5.',
  },
  {
    id: 'q5',
    number: 5,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Permutations and Combinations',
    stem: 'The number of ways in which 5 boys and 3 girls can sit in a row so that no two girls are together is:',
    options: ['5! × ⁶P₃', '8! − 3!', '5! × 3!', '⁶C₃ × 5!'],
    correctIndex: 0,
    explanation: 'Arrange 5 boys in 5! ways creating 6 gaps; choose and arrange 3 girls in ⁶P₃ ways.',
  },
  {
    id: 'q6',
    number: 6,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Binomial Theorem',
    stem: 'The sum of the binomial coefficients in the expansion of (1 + x)¹⁰ is:',
    options: ['512', '1024', '2048', '100'],
    correctIndex: 1,
    explanation: 'Putting x = 1 gives 2¹⁰ = 1024.',
  },
  {
    id: 'q7',
    number: 7,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Sequences and Series',
    stem: 'If the sum of first n terms of an A.P. is 3n² + 5n, then its common difference is:',
    options: ['3', '5', '6', '8'],
    correctIndex: 2,
    explanation: 'For Sn = An² + Bn, the common difference d = 2A = 6.',
  },
  {
    id: 'q8',
    number: 8,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Conic Sections',
    stem: 'The length of the latus rectum of the parabola y² = 16x is:',
    options: ['4', '8', '16', '32'],
    correctIndex: 2,
    explanation: 'For y² = 4ax, length of latus rectum = 4a = 16.',
  },
  {
    id: 'q9',
    number: 9,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Three Dimensional Geometry',
    stem: 'The distance of the point (3, 4, 5) from the x-axis is:',
    options: ['3', '4', '5', '√41'],
    correctIndex: 3,
    explanation: 'Distance from x-axis is √(y² + z²) = √(16 + 25) = √41.',
  },
  {
    id: 'q10',
    number: 10,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Vector Algebra',
    stem: 'If |a| = 3, |b| = 4 and |a + b| = 5, then |a − b| is equal to:',
    options: ['3', '4', '5', '7'],
    correctIndex: 2,
    explanation: '|a + b|² + |a − b|² = 2(|a|² + |b|²) ⇒ 25 + |a − b|² = 2(9 + 16) = 50 ⇒ |a − b| = 5.',
  },
  {
    id: 'q11',
    number: 11,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Differential Calculus',
    stem: 'The slope of the tangent to the curve y = x³ − 3x + 2 at the point whose x-coordinate is 2 is:',
    options: ['6', '9', '12', '4'],
    correctIndex: 1,
    explanation: 'dy/dx = 3x² − 3. At x = 2, dy/dx = 3(4) − 3 = 9.',
  },
  {
    id: 'q12',
    number: 12,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Quadratic Equations & Maxima-Minima',
    stem: 'If f(x) = x² − 4x + 5, then the minimum value of f(x) is:',
    options: ['0', '1', '2', '4'],
    correctIndex: 1,
    explanation: 'Completing the square: f(x) = (x − 2)² + 1. Since (x − 2)² ≥ 0 for all real x, the minimum value is 1 at x = 2.',
  },
  {
    id: 'q13',
    number: 13,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Definite Integration',
    stem: 'The value of ∫ (from −π/2 to π/2) sin⁵(x) dx is:',
    options: ['0', '1', '2/5', 'π/2'],
    correctIndex: 0,
    explanation: 'sin⁵(x) is an odd function, so its integral over the symmetric interval [−π/2, π/2] is 0.',
  },
  {
    id: 'q14',
    number: 14,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Differential Equations',
    stem: 'The integrating factor of the differential equation dy/dx + (y / x) = x² is:',
    options: ['x', '1/x', 'e^x', 'ln(x)'],
    correctIndex: 0,
    explanation: 'I.F. = e^(∫(1/x)dx) = e^(ln x) = x.',
  },
  {
    id: 'q15',
    number: 15,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Probability',
    stem: 'If P(A) = 0.6, P(B) = 0.4 and P(A ∩ B) = 0.24, then P(A | B) is equal to:',
    options: ['0.4', '0.6', '0.24', '0.5'],
    correctIndex: 1,
    explanation: 'P(A | B) = P(A ∩ B) / P(B) = 0.24 / 0.40 = 0.6.',
  },
  {
    id: 'q16',
    number: 16,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Laws of Motion',
    stem: 'A block of mass 2 kg rests on a smooth inclined plane of angle 30°. The normal reaction N exerted by the incline is (take g = 10 m/s²):',
    options: ['10 N', '10√3 N', '20 N', '5 N'],
    correctIndex: 1,
    explanation: 'N = mg cos(30°) = 2 × 10 × (√3 / 2) = 10√3 N.',
  },
  {
    id: 'q17',
    number: 17,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Work, Energy and Power',
    stem: 'A particle moves from x = 0 to x = 4 m under a variable force F = (3x² + 2) N. The work done is:',
    options: ['64 J', '72 J', '50 J', '48 J'],
    correctIndex: 1,
    explanation: 'W = ∫₀⁴ (3x² + 2) dx = [x³ + 2x]₀⁴ = 64 + 8 = 72 J.',
  },
  {
    id: 'q18',
    number: 18,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Current Electricity',
    stem: 'Three resistors of 6 Ω each are connected in parallel. Their equivalent resistance is:',
    options: ['18 Ω', '2 Ω', '3 Ω', '1.5 Ω'],
    correctIndex: 1,
    explanation: 'R_eq = 6 / 3 = 2 Ω.',
  },
  {
    id: 'q19',
    number: 19,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'd & f Block',
    stem: 'Which of the following ions has the maximum spin-only magnetic moment?',
    options: ['Sc³⁺', 'Ti³⁺', 'Mn²⁺', 'Zn²⁺'],
    correctIndex: 2,
    explanation: 'Mn²⁺ (3d⁵) has 5 unpaired electrons, giving μ = √(5 × 7) = √35 ≈ 5.92 BM.',
  },
  {
    id: 'q20',
    number: 20,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Chemical Bonding',
    stem: 'According to VSEPR theory, the geometry and hybridisation of SF₆ molecule are:',
    options: [
      'Octahedral, sp³d²',
      'Tetrahedral, sp³',
      'Trigonal bipyramidal, sp³d',
      'Square planar, dsp²',
    ],
    correctIndex: 0,
    explanation: 'SF₆ has 6 bond pairs and 0 lone pairs around central S atom → sp³d² hybridisation, octahedral geometry.',
  },
];

// Matches the exact Question Palette statuses in Screen 1 (JEE_Main_CBT_Practice_Mock-10):
// Answered: 8 (1, 2, 4, 7, 8, 11, 18, 19)
// Not Answered: 3 (3, 10, 16)
// Marked for Review: 2 (9, 12 or 9 + active)
// Answered & Marked for Review: 1 (15)
// Not Visited: 7 (5, 6, 13, 14, 17, 20, etc.)
export const INITIAL_CBT_RESPONSES: Record<string, QuestionResponseState> = {
  q1: { status: 'answered', selectedOption: 0, timeSpentSec: 65 },
  q2: { status: 'answered', selectedOption: 2, timeSpentSec: 50 },
  q3: { status: 'not_answered', selectedOption: null, timeSpentSec: 40 },
  q4: { status: 'answered', selectedOption: 2, timeSpentSec: 55 },
  q5: { status: 'not_visited', selectedOption: null, timeSpentSec: 0 },
  q6: { status: 'not_visited', selectedOption: null, timeSpentSec: 0 },
  q7: { status: 'answered', selectedOption: 2, timeSpentSec: 70 },
  q8: { status: 'answered', selectedOption: 2, timeSpentSec: 45 },
  q9: { status: 'marked', selectedOption: null, timeSpentSec: 60 },
  q10: { status: 'not_answered', selectedOption: null, timeSpentSec: 30 },
  q11: { status: 'answered', selectedOption: 1, timeSpentSec: 75 },
  q12: { status: 'marked', selectedOption: null, timeSpentSec: 25 },
  q13: { status: 'not_visited', selectedOption: null, timeSpentSec: 0 },
  q14: { status: 'not_visited', selectedOption: null, timeSpentSec: 0 },
  q15: { status: 'answered_marked', selectedOption: 1, timeSpentSec: 80 },
  q16: { status: 'not_answered', selectedOption: null, timeSpentSec: 35 },
  q17: { status: 'not_visited', selectedOption: null, timeSpentSec: 0 },
  q18: { status: 'answered', selectedOption: 1, timeSpentSec: 60 },
  q19: { status: 'answered', selectedOption: 2, timeSpentSec: 50 },
  q20: { status: 'not_visited', selectedOption: null, timeSpentSec: 0 },
};

export const OFFICIAL_PAPERS_LIST = [
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
    id: 'jee-2024-s1-sh2',
    paper: 'JEE Main 2024 Session 1 Shift 2',
    year: '2024',
    session: 'Session 1',
    shift: 'Shift 2',
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
];
