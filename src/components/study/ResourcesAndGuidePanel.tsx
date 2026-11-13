import React, { useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { MathRichText } from '../MathRichText';
import { apiFetchWithAuth } from '../../services/workspaceService';

interface ResourcesAndGuidePanelProps {
  onAddQuickSheetMaterial: (
    title: string,
    subject: 'Physics' | 'Chemistry' | 'Mathematics',
    contentSummary: string
  ) => void;
}

const SUBJECT_QUICK_SHEETS: Record<
  'Physics' | 'Chemistry' | 'Mathematics',
  { title: string; formulas: string[] }[]
> = {
  Physics: [
    {
      title: 'Mechanics – Laws of Motion & Work',
      formulas: [
        '$\\vec{F} = \\frac{d\\vec{p}}{dt} = m\\vec{a}$',
        '$f_s \\le \\mu_s N, \\quad f_k = \\mu_k N$',
        '$W = \\int \\vec{F}\\cdot d\\vec{r} = \\Delta K$',
      ],
    },
    {
      title: 'Electrostatics & RC Circuits',
      formulas: [
        '$F = \\frac{1}{4\\pi\\varepsilon_0}\\frac{q_1 q_2}{r^2}$',
        '$q(t) = C\\varepsilon\\left(1 - e^{-t/RC}\\right)$',
        '$V = IR, \\quad P = I^2 R$',
      ],
    },
    {
      title: 'Ray Optics & Modern Physics',
      formulas: [
        '$\\frac{1}{v} - \\frac{1}{u} = \\frac{1}{f}, \\quad m = \\frac{v}{u}$',
        '$E = hf = \\frac{hc}{\\lambda}$',
        '$N(t) = N_0 e^{-\\lambda t}$',
      ],
    },
  ],
  Chemistry: [
    {
      title: 'Electrochemistry & Chemical Kinetics',
      formulas: [
        '$E_{\\text{cell}} = E^\\circ_{\\text{cell}} - \\frac{0.0591}{n}\\log_{10} Q$',
        '$k = \\frac{2.303}{t}\\log\\frac{[A]_0}{[A]}$',
        '$k = A e^{-E_a / RT}$',
      ],
    },
    {
      title: 'Thermodynamics & Equilibrium',
      formulas: [
        '$\\Delta G = \\Delta H - T\\Delta S = -nFE_{\\text{cell}}$',
        '$K_p = K_c (RT)^{\\Delta n_g}$',
        '$\\text{pH} = \\text{p}K_a + \\log\\frac{[\\text{Salt}]}{[\\text{Acid}]}$',
      ],
    },
    {
      title: 'Coordination & d-f Block',
      formulas: [
        '$\\mu_{\\text{spin}} = \\sqrt{n(n+2)}\\text{ BM}$',
        '$\\Delta_o = \\frac{4}{9}\\Delta_t\\text{ (inversion: }\\Delta_t = \\frac{4}{9}\\Delta_o)$',
        'CFSE (Octahedral) $= (-0.4 n_{t_{2g}} + 0.6 n_{e_g})\\Delta_o$',
      ],
    },
  ],
  Mathematics: [
    {
      title: 'Definite Integrals & Calculus',
      formulas: [
        '$\\int_0^a f(x)\\,dx = \\int_0^a f(a - x)\\,dx$',
        '$\\frac{d}{dx}\\int_{g(x)}^{h(x)} f(t)\\,dt = f(h(x))h\'(x) - f(g(x))g\'(x)$',
        '$\\lim_{x\\to 0}\\frac{\\sin x}{x} = 1, \\quad \\lim_{x\\to 0}(1+x)^{1/x} = e$',
      ],
    },
    {
      title: 'Conic Sections (Parabola & Ellipse)',
      formulas: [
        '$y^2 = 4ax \\implies P(at^2, 2at),\\;\\text{L.R.} = 4a$',
        '$\\frac{x^2}{a^2} + \\frac{y^2}{b^2} = 1,\\; b^2 = a^2(1 - e^2)$',
        '$PF_1 + PF_2 = 2a$',
      ],
    },
    {
      title: 'Complex Numbers & Vectors 3D',
      formulas: [
        '$z = re^{i\\theta} = r(\\cos\\theta + i\\sin\\theta)$',
        '$\\vec{a}\\times(\\vec{b}\\times\\vec{c}) = (\\vec{a}\\cdot\\vec{c})\\vec{b} - (\\vec{a}\\cdot\\vec{b})\\vec{c}$',
        '$d = \\frac{|(\\vec{a}_2 - \\vec{a}_1)\\cdot(\\vec{b}_1\\times\\vec{b}_2)|}{|\\vec{b}_1\\times\\vec{b}_2|}$',
      ],
    },
  ],
};

export const ResourcesAndGuidePanel: React.FC<ResourcesAndGuidePanelProps> = ({
  onAddQuickSheetMaterial,
}) => {
  const [resourceSubTab, setResourceSubTab] = useState<
    'Official Portals' | 'Exam Guide' | 'Quick Sheets'
  >('Official Portals');
  const [examGuideTab, setExamGuideTab] = useState<
    'Pattern' | 'Marking' | 'Exam Rules' | 'Schedule'
  >('Pattern');
  const [quickSheetSubject, setQuickSheetSubject] = useState<
    'Physics' | 'Chemistry' | 'Mathematics'
  >('Physics');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{
    text: string;
    sources: { title: string; uri: string }[];
  } | null>(null);
  const [searchingWeb, setSearchingWeb] = useState(false);

  const handleGroundedSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchingWeb(true);
    try {
      const res = await apiFetchWithAuth<{ text?: string; sources?: { title: string; uri: string }[] }>(
        '/api/ai/search',
        { prompt: searchQuery }
      );
      if (!res.ok) {
        setSearchResult({
          text: `[${res.error.errorCode}] ${res.error.message}`,
          sources: [],
        });
      } else {
        setSearchResult({
          text: res.data.text || 'No grounded results returned.',
          sources: res.data.sources || [],
        });
      }
    } finally {
      setSearchingWeb(false);
    }
  };

  const activeSheets = SUBJECT_QUICK_SHEETS[quickSheetSubject];

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 py-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-wider uppercase text-[#4F46E5]">
            STUDY / RESOURCES
          </div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
            Resources
          </h1>
        </div>

        <form onSubmit={handleGroundedSearch} className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search live NTA JEE notices & cutoffs..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={searchingWeb}
            className="px-4 py-2 rounded-xl bg-[#4F46E5] text-white text-xs font-semibold cursor-pointer"
          >
            {searchingWeb ? 'Searching...' : 'Search NTA'}
          </button>
        </form>
      </div>

      {searchResult && (
        <div className="p-4 rounded-2xl bg-[#EEF2FF]/70 border border-indigo-200 space-y-2 text-xs">
          <div className="font-bold text-[#4F46E5]">
            Live Google Search Grounding Result:
          </div>
          <div className="text-slate-800 leading-relaxed">
            <MathRichText content={searchResult.text} />
          </div>
          {searchResult.sources.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {searchResult.sources.map((src, i) => (
                <a
                  key={i}
                  href={src.uri}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-md bg-white border border-indigo-200 text-[#4F46E5] font-medium inline-flex items-center gap-1 hover:underline"
                >
                  <span>{src.title}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto">
        {(['Official Portals', 'Exam Guide', 'Quick Sheets'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setResourceSubTab(t)}
            className={`px-4 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              resourceSubTab === t
                ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 space-y-4">
          <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
            Official Study Portals (4)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                title: 'SATHEE (IIT Kanpur)',
                badge: 'Free Portal',
                desc: 'Free JEE video lectures, practice tests & mentorship by Ministry of Education.',
                domain: 'sathee.prutor.ai',
                url: 'https://sathee.prutor.ai',
              },
              {
                title: 'National Test Abhyas',
                badge: 'NTA Mock App',
                desc: 'Official NTA mock test practice platform for JEE Main & NEET.',
                domain: 'nta.ac.in',
                url: 'https://www.nta.ac.in',
              },
              {
                title: 'JEE Main Official Portal',
                badge: 'Exam Bulletin',
                desc: 'Information bulletin, syllabus PDF, public notices & exam schedule.',
                domain: 'jeemain.nta.nic.in',
                url: 'https://jeemain.nta.nic.in',
              },
              {
                title: 'NCERT e-Textbooks',
                badge: 'Textbooks',
                desc: 'Official Class 11 & 12 Physics, Chemistry and Mathematics NCERT books.',
                domain: 'ncert.nic.in',
                url: 'https://ncert.nic.in/textbook.php',
              },
            ].map((portal) => (
              <div
                key={portal.title}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between space-y-4 shadow-2xs"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                      {portal.title}
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5] text-[10px] font-bold whitespace-nowrap">
                      {portal.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {portal.desc}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-400">{portal.domain}</span>
                  <a
                    href={portal.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 space-y-5">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                Exam Guide
              </h2>
              <div className="flex items-center gap-1 text-xs">
                {(['Pattern', 'Marking', 'Exam Rules', 'Schedule'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setExamGuideTab(tab)}
                    className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                      examGuideTab === tab
                        ? 'bg-[#EEF2FF] text-[#4F46E5]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {examGuideTab === 'Pattern' && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {[
                  { k: 'Mode', v: 'Computer Based Test (CBT)' },
                  { k: 'Duration', v: '3 hours (180 minutes)' },
                  { k: 'Subjects', v: 'Physics, Chemistry, Mathematics' },
                  {
                    k: 'Total Questions',
                    v: '75 compulsory questions (25 per subject: 20 MCQ + 5 Numerical)',
                  },
                  { k: 'Total Marks', v: '300 marks' },
                ].map((row) => (
                  <div key={row.k} className="py-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500">{row.k}</span>
                    <span className="font-bold text-slate-900 dark:text-white text-right">
                      {row.v}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {examGuideTab === 'Marking' && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="py-2.5 flex justify-between gap-2">
                  <span className="text-slate-500">Section A (20 MCQs per subject)</span>
                  <span className="font-bold text-emerald-600">+4 Correct / −1 Wrong</span>
                </div>
                <div className="py-2.5 flex justify-between gap-2">
                  <span className="text-slate-500">
                    Section B (5 Compulsory Numericals per subject)
                  </span>
                  <span className="font-bold text-rose-600">
                    +4 Correct / −1 Negative (NTA 2027 Rule)
                  </span>
                </div>
                <div className="py-2.5 flex justify-between gap-2">
                  <span className="text-slate-500">JEE Advanced Multi-Choice</span>
                  <span className="font-bold text-amber-700">
                    +4 All / +1 Partial per Option / −2 Wrong
                  </span>
                </div>
                <div className="py-2.5 flex justify-between gap-2">
                  <span className="text-slate-500">JEE Advanced Numericals</span>
                  <span className="font-bold text-indigo-600">+4 Correct / 0 Negative</span>
                </div>
              </div>
            )}

            {examGuideTab === 'Exam Rules' && (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Candidates must bring their NTA Admit Card, valid photo ID, and transparent
                ballpoint pen. Electronic devices, calculators, and log tables are strictly
                prohibited inside the CBT examination hall.
              </p>
            )}

            {examGuideTab === 'Schedule' && (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Session 1: January 2027 (Morning Shift 09:00–12:00 IST, Afternoon Shift
                15:00–18:00 IST). Session 2: April 2027.
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                Quick Formula Sheets ({quickSheetSubject})
              </h2>
              <div className="flex items-center gap-1 text-xs">
                {(['Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setQuickSheetSubject(subj)}
                    className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                      quickSheetSubject === subj
                        ? 'bg-[#EEF2FF] text-[#4F46E5]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {subj}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {activeSheets.map((sheet) => (
                <div
                  key={sheet.title}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <h3 className="font-display font-bold text-xs text-slate-900 dark:text-white">
                      {sheet.title}
                    </h3>
                    <div className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-200">
                      {sheet.formulas.map((f, i) => (
                        <div key={i}>
                          <MathRichText content={f} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onAddQuickSheetMaterial(
                        sheet.title,
                        quickSheetSubject,
                        `**${sheet.title}**: ${sheet.formulas.join(' | ')}`
                      )
                    }
                    className="w-full py-1.5 rounded-lg bg-[#EEF2FF] text-[#4F46E5] font-semibold text-[11px] hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    + Add to My Materials
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
