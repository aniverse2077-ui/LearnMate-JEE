import {
  CBT_MOCK_QUESTIONS,
  JEE_ADVANCED_PAPER_QUESTIONS,
  NEET_UG_PAPER_QUESTIONS,
  BITSAT_PAPER_QUESTIONS,
} from '../../data/jeeInitialContent';
import { CBTQuestion } from '../../utils/jeeEngine';

export const AUTHORITATIVE_KEY_VERSION = 'v2027.1';

export interface AuthoritativeKeyEntry {
  id: string;
  number: number;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  section?: 'Section A' | 'Section B';
  chapter: string;
  stem: string;
  options: string[];
  examType?: CBTQuestion['examType'];
  examVersion?: string;
  advancedFormat?: CBTQuestion['advancedFormat'];
  correctIndex: number;
  correctIndices?: number[];
  numericalAnswer?: number;
  numericalTolerance?: number;
  explanation: string;
}

const CURATED_PACK_KEYS: AuthoritativeKeyEntry[] = [
  {
    id: 'pack-jm-phy-1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Rotational Motion & Rigid Body Dynamics',
    stem: 'A solid cylinder of mass $M = 4\\text{ kg}$ and radius $R = 0.5\\text{ m}$ rolls without slipping down an inclined plane of inclination $\\theta = 30^\\circ$. The magnitude of static friction force acting on the cylinder is ($g = 10\\text{ m/s}^2$):',
    options: [
      '$\\frac{20}{3}\\text{ N}$',
      '$\\frac{10}{3}\\text{ N}$',
      '$10\\text{ N}$',
      '$\\frac{40}{3}\\text{ N}$',
    ],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 0,
    explanation:
      'For pure rolling down an incline, $f_s = \\frac{mg\\sin\\theta}{1 + \\frac{MR^2}{I_{\\text{cm}}}}$. For a solid cylinder, $I_{\\text{cm}} = \\frac{1}{2}MR^2$, so $f_s = \\frac{1}{3}mg\\sin 30^\\circ = \\frac{1}{3}(4)(10)(0.5) = \\frac{20}{3}\\text{ N}$.',
  },
  {
    id: 'pack-jm-phy-2',
    number: 2,
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Electrostatics, Gauss’s Law, Potential & Capacitors',
    stem: 'A $6\\text{ }\\mu\\text{F}$ capacitor charged to $20\\text{ V}$ is connected in parallel with an uncharged $4\\text{ }\\mu\\text{F}$ capacitor. The loss in electrostatic potential energy during charge redistribution (in $\\mu\\text{J}$) is:',
    options: ['480', '240', '720', '120'],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    advancedFormat: 'numerical',
    correctIndex: 0,
    numericalAnswer: 480,
    numericalTolerance: 0,
    explanation:
      'Energy loss $\\Delta U = \\frac{1}{2}\\frac{C_1 C_2}{C_1 + C_2}(V_1 - V_2)^2 = \\frac{1}{2}\\frac{6 \\times 4}{6 + 4}(20)^2 = 1.2 \\times 400 = 480\\text{ }\\mu\\text{J}$.',
  },
  {
    id: 'pack-jm-chem-1',
    number: 3,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Werner’s Theory, IUPAC, VBT, Crystal Field Theory (CFT) & Isomerism',
    stem: 'The spin-only magnetic moment (in BM) of the octahedral complex ion $[\\text{Fe}(\\text{CN})_6]^{3-}$ is:',
    options: [
      '$1.73\\text{ BM}$',
      '$5.92\\text{ BM}$',
      '$0.00\\text{ BM}$',
      '$4.90\\text{ BM}$',
    ],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 0,
    explanation:
      'In $[\\text{Fe}(\\text{CN})_6]^{3-}$, $\\text{Fe}^{3+}$ is a $3d^5$ ion. Since $\\text{CN}^-$ is a strong-field ligand, it forms a low-spin $t_{2g}^5 e_g^0$ configuration with $n = 1$ unpaired electron. Thus $\\mu = \\sqrt{1(1+2)} = \\sqrt{3} \\approx 1.73\\text{ BM}$.',
  },
  {
    id: 'pack-jm-math-1',
    number: 4,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Indefinite & Definite Integration, King’s Property, Leibniz Rule & Area Under Curves',
    stem: 'The value of the definite integral $I = \\int_{0}^{\\pi/2} \\frac{\\sin^{2025}x}{\\sin^{2025}x + \\cos^{2025}x}\\,dx$ is:',
    options: ['$\\frac{\\pi}{4}$', '$\\frac{\\pi}{2}$', '$\\pi$', '$0$'],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 0,
    explanation:
      "Applying King's property $\\int_0^a f(x)\\,dx = \\int_0^a f(a-x)\\,dx$, we get $2I = \\int_0^{\\pi/2} 1\\,dx = \\frac{\\pi}{2} \\implies I = \\frac{\\pi}{4}$.",
  },
  {
    id: 'pack-ja-phy-1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Rotational Motion & Rigid Body Dynamics',
    stem: '[MULTI-CORRECT: +4 / -2 with Partial Marking] A uniform thin rod of mass $M$ and length $L$ rests on a smooth horizontal tabletop. A horizontal impulse $J$ is applied perpendicular to the rod at a distance $x = \\frac{L}{6}$ from its center $O$. Which of the following statements is/are correct immediately after the impulse?',
    options: [
      'The center of mass velocity is $v_{\\text{cm}} = \\frac{J}{M}$',
      'The angular velocity about the center of mass is $\\omega = \\frac{2J}{ML}$',
      'The instantaneous axis of rotation lies at distance $\\frac{L}{2}$ from center $O$ on the opposite side',
      'The kinetic energy imparted to the rod is $\\frac{2J^2}{3M}$',
    ],
    examType: 'JEE Advanced',
    examVersion: 'jee-advanced-2024-paper1',
    advancedFormat: 'multiple',
    correctIndex: 0,
    correctIndices: [0, 1, 2, 3],
    explanation:
      'By linear impulse-momentum, $v_{\\text{cm}} = J/M$. By angular impulse about $O$, $J(L/6) = (\\frac{1}{12}ML^2)\\omega \\implies \\omega = \\frac{2J}{ML}$. Distance to instantaneous center $r_{\\text{IC}} = v_{\\text{cm}}/\\omega = L/2$. Kinetic energy $K = \\frac{1}{2}Mv_{\\text{cm}}^2 + \\frac{1}{2}I\\omega^2 = \\frac{J^2}{2M} + \\frac{J^2}{6M} = \\frac{2J^2}{3M}$.',
  },
  {
    id: 'pack-ja-chem-1',
    number: 2,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Werner’s Theory, IUPAC, VBT, Crystal Field Theory (CFT) & Isomerism',
    stem: '[MATRIX MATCH] Match each coordination species in List-I with its correct hybridization and magnetic nature in List-II:',
    options: [
      'P-1, Q-2, R-3, S-4',
      'P-2, Q-1, R-3, S-4',
      'P-1, Q-2, R-4, S-3',
      'P-3, Q-4, R-1, S-2',
    ],
    examType: 'JEE Advanced',
    examVersion: 'jee-advanced-2024-paper1',
    advancedFormat: 'matrix',
    correctIndex: 0,
    explanation:
      '$[\\text{Ni}(\\text{CN})_4]^{2-}$ is square planar ($dsp^2$, diamagnetic); $[\\text{NiCl}_4]^{2-}$ is tetrahedral ($sp^3$, 2 unpaired electrons); $[\\text{Co}(\\text{NH}_3)_6]^{3+}$ is inner-orbital octahedral ($d^2sp^3$, diamagnetic); $[\\text{CoF}_6]^{3-}$ is outer-orbital octahedral ($sp^3d^2$, 4 unpaired electrons).',
  },
  {
    id: 'pack-ja-math-1',
    number: 3,
    subject: 'Mathematics',
    section: 'Section B',
    chapter: 'Matrices, Determinants, Adjoint Properties & Cramer’s Linear Systems',
    stem: 'Based on the passage above, the value of $\\det(B^{-1})$ is:',
    options: ['$\\frac{1}{16}$', '$16$', '$\\frac{1}{8}$', '$\\frac{1}{64}$'],
    examType: 'JEE Advanced',
    examVersion: 'jee-advanced-2024-paper1',
    advancedFormat: 'paragraph',
    correctIndex: 0,
    explanation:
      'For an $n \\times n$ matrix $A$, $\\det(\\text{adj}(\\text{adj}(A))) = (\\det A)^{(n-1)^2}$. With $n = 3$ and $\\det A = 2$, $\\det(B) = 2^{(3-1)^2} = 2^4 = 16$. Therefore $\\det(B^{-1}) = \\frac{1}{16}$.',
  },
];

export const AUTHORITATIVE_ANSWER_KEY_MAP = new Map<string, AuthoritativeKeyEntry>();

for (const q of [
  ...CBT_MOCK_QUESTIONS,
  ...JEE_ADVANCED_PAPER_QUESTIONS,
  ...NEET_UG_PAPER_QUESTIONS,
  ...BITSAT_PAPER_QUESTIONS,
]) {
  AUTHORITATIVE_ANSWER_KEY_MAP.set(q.id, {
    id: q.id,
    number: q.number,
    subject: q.subject,
    section: q.section,
    chapter: q.chapter,
    stem: q.stem,
    options: q.options,
    examType: q.examType,
    examVersion: q.examVersion,
    advancedFormat: q.advancedFormat,
    correctIndex: q.correctIndex,
    correctIndices: q.correctIndices,
    numericalAnswer: q.numericalAnswer,
    explanation: q.explanation,
  });
}

for (const entry of CURATED_PACK_KEYS) {
  AUTHORITATIVE_ANSWER_KEY_MAP.set(entry.id, entry);
}

export function resolveServerAnswerKey(questionId: string): AuthoritativeKeyEntry | null {
  return AUTHORITATIVE_ANSWER_KEY_MAP.get(questionId) || null;
}

export type StrippedPublicQuestion<T extends Record<string, any>> = Omit<
  T,
  'correctIndex' | 'correctIndices' | 'numericalAnswer' | 'numericalTolerance' | 'explanation'
> & {
  keyStripped: true;
  keyVersion: string;
};

export function stripQuestionAnswerKeys<T extends Record<string, any>>(
  q: T
): StrippedPublicQuestion<T> {
  const {
    correctIndex: _ci,
    correctIndices: _cis,
    numericalAnswer: _na,
    numericalTolerance: _nt,
    explanation: _exp,
    ...rest
  } = q;
  return {
    ...(rest as Omit<
      T,
      'correctIndex' | 'correctIndices' | 'numericalAnswer' | 'numericalTolerance' | 'explanation'
    >),
    keyStripped: true,
    keyVersion: AUTHORITATIVE_KEY_VERSION,
  };
}
