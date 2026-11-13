import React, { useState, useEffect } from 'react';
import {
  Plus,
  Bookmark,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  User,
  Upload,
  Copy,
  Printer,
} from 'lucide-react';
import {
  MindMapNodeItem,
  OFFICIAL_PAPERS_LIST,
  CBT_MOCK_QUESTIONS,
  JEE_ADVANCED_PAPER_QUESTIONS,
  NEET_UG_PAPER_QUESTIONS,
  BITSAT_PAPER_QUESTIONS,
  MaterialStudyBundle,
  StickyNoteData,
  FormulaCardEntry,
} from '../data/jeeInitialContent';
import {
  CBTQuestion,
  CBTQuestionResponse,
  CBTMockSummary,
  QuestionAttemptDetail,
  ErrorRootCauseTag,
  SM2FlashcardItem,
  ExamTrack,
  formatCountdownTimer,
  calculateNextSRSReview,
} from '../utils/jeeEngine';
import {
  saveCbtInProgressDraft,
  loadCbtInProgressDraft,
  clearCbtInProgressDraft,
  syncRevisionStateToFirestore,
  getUserScopedStorageKey,
  reportQuestionIssueOnServer,
  verifySinglePyqAnswerOnServer,
  gradeCbtAttemptOnServerApi,
  CbtInProgressDraft,
} from '../services/workspaceService';
import { MathRichText } from './MathRichText';
import { MaterialItem } from './HomeAndStudyViews';
import { SpacedRepetitionHub } from './revise/SpacedRepetitionHub';

export interface MistakeNotebookEntry {
  id: string;
  question: CBTQuestion;
  userAnswer: string;
  loggedAt: string;
  source: 'CBT Mock' | 'PYQ Bank' | 'Adaptive Drill';
  rootCauseTag?: ErrorRootCauseTag;
  recheckCount?: number;
  recheckPassed?: boolean;
  masteryDelta?: number;
  nextDueIso?: string;
  intervalDays?: number;
}

type HandwritingFontId = 'caveat' | 'kalam' | 'patrick' | 'indie';
type PaperBackgroundStyle = 'ruled' | 'grid' | 'plain';

const HANDWRITING_FONT_MAP: Record<
  HandwritingFontId,
  { label: string; cssClass: string; badge: string }
> = {
  caveat: {
    label: 'Caveat Neat Cursive',
    cssClass: 'font-hand-caveat',
    badge: 'Topper Cursive',
  },
  kalam: {
    label: 'Kalam Indian Notebook',
    cssClass: 'font-hand-kalam',
    badge: 'Kota Classroom',
  },
  patrick: {
    label: 'Patrick Hand Clean',
    cssClass: 'font-hand-patrick',
    badge: 'Ultra Legible',
  },
  indie: {
    label: 'Indie Flower Sketch',
    cssClass: 'font-hand-indie',
    badge: 'Quick Jottings',
  },
};

// ============================================================================
// 1. REVISE WORKSPACE VIEW (Zero-State Clean + Multi-Level Mind Map + Handwritten Studio)
// ============================================================================
interface ReviseViewProps {
  materials: MaterialItem[];
  selectedMaterial: MaterialItem | null;
  materialBundles: Record<string, MaterialStudyBundle>;
  mistakesNotebook: MistakeNotebookEntry[];
  sm2Cards?: SM2FlashcardItem[];
  onUpdateSM2Card?: (card: SM2FlashcardItem) => void;
  onAddSM2Card?: (card: Omit<SM2FlashcardItem, 'id'>) => void;
  onTagMistakeRootCause?: (id: string, cause: ErrorRootCauseTag) => void;
  onVerifyMistakeRecheck?: (mistakeId: string, passed: boolean) => void;
  onSelectMaterial: (mat: MaterialItem) => void;
  onOpenAddMaterial: (tab: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive') => void;
  onAddFlashcard: (node: MindMapNodeItem) => void;
  onPracticeQuestion?: (q: CBTQuestion) => void;
  showToast: (msg: string) => void;
}

export const ReviseWorkspaceView: React.FC<ReviseViewProps> = ({
  materials,
  selectedMaterial,
  materialBundles,
  mistakesNotebook,
  sm2Cards = [],
  onUpdateSM2Card,
  onAddSM2Card,
  onTagMistakeRootCause,
  onVerifyMistakeRecheck,
  onSelectMaterial,
  onOpenAddMaterial,
  onAddFlashcard,
  onPracticeQuestion,
  showToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    | 'Mind Map'
    | 'Handwritten Notes'
    | 'Flashcards'
    | 'Sticky Notes'
    | 'Summary Sheet'
    | 'Formula Book'
    | 'Mistake DNA'
  >('Mind Map');

  const activeMaterial = selectedMaterial || materials[0] || null;
  const activeBundle = activeMaterial ? materialBundles[activeMaterial.id] : null;
  const mindMapNodes = activeBundle?.mindMapNodes || [];

  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [selectedSubNodeId, setSelectedSubNodeId] = useState<string | null>(null);
  const [mindMapZoom, setMindMapZoom] = useState<number>(100);

  // Handwriting converter state in Revise
  const [handFont, setHandFont] = useState<HandwritingFontId>('kalam');
  const [paperStyle, setPaperStyle] = useState<PaperBackgroundStyle>('ruled');
  const [inkColor, setInkColor] = useState<'#1E293B' | '#1D4ED8' | '#047857'>('#1D4ED8');
  const [handSourceType, setHandSourceType] = useState<
    'chapter_notes' | 'sticky_notes' | 'summary_sheet' | 'custom_text'
  >('chapter_notes');
  const [customHandText, setCustomHandText] = useState<string>('');
  const [useHandFontOnCards, setUseHandFontOnCards] = useState<boolean>(true);

  // Flashcard 3D flip & SRS state
  const [cardIndex, setCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [srsStats, setSrsStats] = useState<{ intervalDays: number; easeFactor: number }>({
    intervalDays: 1,
    easeFactor: 2.5,
  });

  // Custom Sticky Notes added by student
  const [customStickyNotes, setCustomStickyNotes] = useState<StickyNoteData[]>([]);
  const [newStickyTitle, setNewStickyTitle] = useState('');
  const [newStickyBody, setNewStickyBody] = useState('');

  // Dynamic Formula Book state (All Uploaded Materials + Custom Student Formulas)
  const [customFormulas, setCustomFormulas] = useState<FormulaCardEntry[]>(() => {
    try {
      const raw = localStorage.getItem(getUserScopedStorageKey('custom_formulas'));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showAddFormulaForm, setShowAddFormulaForm] = useState(false);
  const [newFormulaTitle, setNewFormulaTitle] = useState('');
  const [newFormulaLatex, setNewFormulaLatex] = useState('');
  const [newFormulaVariables, setNewFormulaVariables] = useState('');
  const [newFormulaUnits, setNewFormulaUnits] = useState('');
  const [newFormulaNotes, setNewFormulaNotes] = useState('');
  const [formulaChapterFilter, setFormulaChapterFilter] = useState<string>('All');

  useEffect(() => {
    if (mindMapNodes.length > 0) {
      setSelectedNodeId(mindMapNodes[0].id);
      setSelectedSubNodeId(mindMapNodes[0].subNodes?.[0]?.id || null);
    } else {
      setSelectedNodeId('');
      setSelectedSubNodeId(null);
    }
    setCardIndex(0);
    setIsCardFlipped(false);
  }, [activeMaterial?.id, mindMapNodes.length]);

  const selectedNode =
    mindMapNodes.find((n) => n.id === selectedNodeId) || mindMapNodes[0] || null;
  const activeFlashcard = mindMapNodes[cardIndex % Math.max(1, mindMapNodes.length)] || null;

  const handleRateFlashcard = (rating: 'Again' | 'Hard' | 'Good' | 'Easy') => {
    const next = calculateNextSRSReview(rating, srsStats.intervalDays, srsStats.easeFactor);
    setSrsStats({ intervalDays: next.nextIntervalDays, easeFactor: next.nextEaseFactor });
    setIsCardFlipped(false);
    if (mindMapNodes.length > 0) {
      setCardIndex((prev) => (prev + 1) % mindMapNodes.length);
    }
    showToast(`Card scheduled in ${next.label} (Ease ${next.nextEaseFactor.toFixed(2)})`);
  };

  const handleAddCustomSticky = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStickyTitle.trim() || !newStickyBody.trim()) return;
    setCustomStickyNotes((prev) => [
      {
        id: `sticky-custom-${Date.now()}`,
        title: newStickyTitle.trim(),
        body: newStickyBody.trim(),
        subject: activeMaterial?.subject || 'Physics',
        color: 'amber',
      },
      ...prev,
    ]);
    setNewStickyTitle('');
    setNewStickyBody('');
    showToast('Converted & pinned new Sticky Note!');
  };

  const handleAddCustomFormula = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormulaTitle.trim() || !newFormulaLatex.trim()) return;
    const formattedFormula = newFormulaLatex.includes('$')
      ? newFormulaLatex.trim()
      : `$$${newFormulaLatex.trim()}$$`;
    const entry: FormulaCardEntry = {
      id: `custom-fc-${Date.now()}`,
      subject: activeMaterial?.subject || 'Physics',
      chapter: activeMaterial?.chapter || 'Custom JEE Formulas',
      title: newFormulaTitle.trim(),
      formula: formattedFormula,
      variables: newFormulaVariables.trim() || 'Standard SI variables and physical constants',
      units: newFormulaUnits.trim() || 'SI Units',
      notes:
        newFormulaNotes.trim() ||
        '**Custom Student Equation:** Apply with consistent SI units and sign conventions.',
    };
    const next = [entry, ...customFormulas];
    setCustomFormulas(next);
    try {
      localStorage.setItem(getUserScopedStorageKey('custom_formulas'), JSON.stringify(next));
    } catch {
      // ignore storage quota
    }
    void syncRevisionStateToFirestore('custom_formulas', next);
    setNewFormulaTitle('');
    setNewFormulaLatex('');
    setNewFormulaVariables('');
    setNewFormulaUnits('');
    setNewFormulaNotes('');
    setShowAddFormulaForm(false);
    showToast(`Added "${entry.title}" to your Chapter Formula Book & synced to Cloud!`);
  };

  const allExtractedFormulas: FormulaCardEntry[] = [
    ...customFormulas,
    ...Object.values(materialBundles).flatMap((b) => b.formulas || []),
  ];

  const availableFormulaChapters = Array.from(
    new Set(allExtractedFormulas.map((f) => f.chapter))
  );

  return (
    <div className="w-full px-6 lg:px-10 xl:px-12 py-6 space-y-6">
      {/* Header & Material Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Revise
            </h1>
            {activeMaterial && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                {activeMaterial.subject} • {activeMaterial.chapter}
              </span>
            )}
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            [
              'Mind Map',
              'Handwritten Notes',
              'Flashcards',
              'Sticky Notes',
              'Summary Sheet',
              'Formula Book',
              'Mistake DNA',
            ] as const
          ).map((tab) => {
            const active = activeSubTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveSubTab(tab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab}
                {tab === 'Mistake DNA' && mistakesNotebook.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
                    {mistakesNotebook.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Uploaded Material Switcher Bar */}
      {materials.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mr-1">
              Active Material:
            </span>
            {materials.map((mat) => {
              const isSelected = activeMaterial?.id === mat.id;
              return (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() => onSelectMaterial(mat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {mat.title} ({mat.subject})
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onOpenAddMaterial('photo')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 text-indigo-700 text-xs font-extrabold hover:bg-indigo-100 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Handwritten Photo / PDF
          </button>
        </div>
      )}

      {/* CLEAN ZERO-STATE WHEN NO MATERIALS ARE UPLOADED */}
      {materials.length === 0 && activeSubTab !== 'Mistake DNA' ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-10 text-center max-w-3xl mx-auto my-6 space-y-5 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 flex items-center justify-center mx-auto">
            <Layers className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-extrabold uppercase tracking-wider">
              100% Clean Zero-State Workspace
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Upload Your Study Material to Generate Mind Maps, Handwritten Notes &amp; Flashcards
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
              Your revision workspace starts completely clean with zero preloaded chapters. Upload any PDF, handwritten notebook photo, or up-to-12-hour YouTube lecture to automatically build multi-level concept mind maps, complete chapter formula books, handwritten revision sheets, sticky notes, and 3D flashcards.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenAddMaterial('pdf')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Upload PDF or Handwritten Notes
            </button>
            <button
              type="button"
              onClick={() => onOpenAddMaterial('youtube')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-extrabold hover:bg-slate-50 cursor-pointer"
            >
              Extract 12-Hour YouTube Marathon
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ================================================================= */}
          {/* SUB-TAB 1: MULTI-LEVEL VISUAL MIND MAP WITH KATEX                 */}
          {/* ================================================================= */}
          {activeSubTab === 'Mind Map' && activeMaterial && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 8 Cols: Multi-Level Hierarchical Mind Map Canvas */}
              <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col">
                <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      Multi-Level Concept Hierarchy: {activeMaterial.chapter}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-extrabold">
                      {mindMapNodes.length} Primary Branches •{' '}
                      {mindMapNodes.reduce((acc, n) => acc + (n.subNodes?.length || 0), 0)} Sub-Nodes
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMindMapZoom((z) => Math.max(80, z - 10))}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      −
                    </button>
                    <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 px-1.5">
                      {mindMapZoom}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setMindMapZoom((z) => Math.min(125, z + 10))}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => setMindMapZoom(100)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Hierarchical Tree Canvas */}
                <div
                  className="p-6 overflow-x-auto bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:18px_18px]"
                  style={{
                    transform: `scale(${mindMapZoom / 100})`,
                    transformOrigin: 'top center',
                  }}
                >
                  {/* Level 0: Central Root Hub */}
                  <div className="flex flex-col items-center">
                    <div className="px-6 py-3.5 rounded-2xl bg-indigo-950 text-white shadow-lg border-2 border-indigo-400 text-center max-w-md">
                      <div className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-300">
                        CENTRAL CHAPTER HUB ({activeMaterial.subject})
                      </div>
                      <div className="text-base font-extrabold mt-0.5">{activeMaterial.chapter}</div>
                    </div>

                    <div className="w-0.5 h-6 bg-indigo-300" />

                    {/* Level 1: Primary Concept Nodes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
                      {mindMapNodes.map((node, idx) => {
                        const isSelected = selectedNode?.id === node.id;
                        return (
                          <div
                            key={node.id}
                            onClick={() => {
                              setSelectedNodeId(node.id);
                              setSelectedSubNodeId(node.subNodes?.[0]?.id || null);
                            }}
                            className={`rounded-2xl border-2 p-4 transition-all cursor-pointer flex flex-col justify-between ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/40 shadow-md'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/70 text-indigo-800 dark:text-indigo-200 text-[10px] font-extrabold">
                                  Branch {idx + 1} • {node.pageRef}
                                </span>
                                {node.badgeType && (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                      node.badgeType === 'High Weightage'
                                        ? 'bg-amber-100 text-amber-800'
                                        : node.badgeType === 'Exception Trap'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {node.badgeType}
                                  </span>
                                )}
                              </div>

                              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                                {node.title}
                              </h3>

                              <div className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                                <MathRichText content={node.definition} />
                              </div>

                              {node.formulaLatex && (
                                <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-xs">
                                  <MathRichText content={node.formulaLatex} />
                                </div>
                              )}
                            </div>

                            {/* Level 2: Secondary Sub-Nodes */}
                            {node.subNodes && node.subNodes.length > 0 && (
                              <div className="mt-3.5 pt-3 border-t border-slate-200/70 dark:border-slate-800 space-y-2">
                                <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                  Sub-Branches &amp; Micro-Formulas:
                                </div>
                                <div className="space-y-1.5">
                                  {node.subNodes.map((sub) => {
                                    const subActive = selectedSubNodeId === sub.id && isSelected;
                                    return (
                                      <div
                                        key={sub.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedNodeId(node.id);
                                          setSelectedSubNodeId(sub.id);
                                        }}
                                        className={`p-2.5 rounded-xl border text-xs transition-all ${
                                          subActive
                                            ? 'border-indigo-500 bg-white dark:bg-slate-800 shadow-2xs'
                                            : 'border-slate-200/80 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-white'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-extrabold text-slate-800 dark:text-slate-100">
                                            ↳ {sub.label}
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                                          <MathRichText content={sub.microNote} />
                                        </div>
                                        {sub.formulaLatex && (
                                          <div className="mt-1 text-[11px] font-semibold text-indigo-900 dark:text-indigo-200">
                                            <MathRichText content={sub.formulaLatex} />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 4 Cols: Selected Node Deep-Dive & Flashcard Action */}
              <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4 sticky top-20">
                {selectedNode ? (
                  <>
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                          SELECTED NODE INSPECTOR ({selectedNode.pageRef})
                        </span>
                        <h2 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                          {selectedNode.title}
                        </h2>
                      </div>
                      {selectedNode.badgeType && (
                        <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold">
                          {selectedNode.badgeType}
                        </span>
                      )}
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 space-y-1">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          Core Law &amp; Definition
                        </div>
                        <div className="text-slate-800 dark:text-slate-100 leading-relaxed">
                          <MathRichText content={selectedNode.definition} />
                        </div>
                      </div>

                      {selectedNode.formulaLatex && (
                        <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800 space-y-1">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                            Core Mathematical Expression
                          </div>
                          <div className="text-slate-900 dark:text-white">
                            <MathRichText content={selectedNode.formulaLatex} />
                          </div>
                        </div>
                      )}

                      <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800 space-y-1">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                          JEE Application &amp; Example
                        </div>
                        <div className="text-slate-800 dark:text-slate-200 leading-relaxed">
                          <MathRichText content={selectedNode.example} />
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800 space-y-1">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          Common JEE Exam Trap
                        </div>
                        <div className="text-slate-800 dark:text-slate-200 leading-relaxed">
                          <MathRichText content={selectedNode.commonTrap} />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => onAddFlashcard(selectedNode)}
                        className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Node to Spaced-Repetition Flashcards
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSubTab('Handwritten Notes')}
                        className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                      >
                        Convert Chapter to Handwritten Notebook →
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SUB-TAB 2: HANDWRITTEN NOTES STUDIO (4-FONT + 3 PAPER STYLES)     */}
          {/* ================================================================= */}
          {activeSubTab === 'Handwritten Notes' && activeMaterial && (
            <div className="space-y-5">
              {/* Top Controls Bar */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                      Handwritten Notebook
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenAddMaterial('photo')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-extrabold hover:bg-indigo-100 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      OCR Scan Handwritten Photo / PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.print();
                        showToast('Opened print/PDF export for your Handwritten Notebook!');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold cursor-pointer"
                    >
                      Export Handwritten PDF
                    </button>
                  </div>
                </div>

                {/* Font Switcher, Paper Background & Source Selector */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {/* 4-Font Switcher */}
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                      1. Choose Handwriting Font Style
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(HANDWRITING_FONT_MAP) as HandwritingFontId[]).map((fontKey) => {
                        const item = HANDWRITING_FONT_MAP[fontKey];
                        const active = handFont === fontKey;
                        return (
                          <button
                            key={fontKey}
                            type="button"
                            onClick={() => setHandFont(fontKey)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              active
                                ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 shadow-2xs'
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className={`text-base font-bold ${item.cssClass}`}>
                              {item.label.split(' ')[0]}
                            </div>
                            <div className="text-[10px] text-slate-500 font-semibold">
                              {item.badge}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Paper Style & Ink Color */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                        2. Notebook Paper Texture
                      </label>
                      <div className="flex items-center gap-2">
                        {(
                          [
                            { id: 'ruled', label: 'Ruled Notebook' },
                            { id: 'grid', label: 'Math Grid' },
                            { id: 'plain', label: 'Plain Ivory' },
                          ] as const
                        ).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPaperStyle(p.id)}
                            className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                              paperStyle === p.id
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                        Ballpoint / Gel Ink Color
                      </label>
                      <div className="flex items-center gap-2">
                        {[
                          { color: '#1D4ED8', name: 'Royal Gel Blue' },
                          { color: '#1E293B', name: 'Carbon Black' },
                          { color: '#047857', name: 'Emerald Pen' },
                        ].map((ink) => (
                          <button
                            key={ink.color}
                            type="button"
                            onClick={() => setInkColor(ink.color as typeof inkColor)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                              inkColor === ink.color
                                ? 'border-slate-900 bg-slate-100 dark:bg-slate-800'
                                : 'border-slate-200'
                            }`}
                          >
                            <span
                              className="w-3 h-3 rounded-full inline-block"
                              style={{ backgroundColor: ink.color }}
                            />
                            {ink.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Source Material to Convert */}
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                      3. Source Content to Render in Handwriting
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: 'chapter_notes', label: 'Chapter Notes' },
                          { id: 'sticky_notes', label: 'Sticky Notes' },
                          { id: 'summary_sheet', label: 'Quick Revision Sheet' },
                          { id: 'custom_text', label: 'Custom Note Converter' },
                        ] as const
                      ).map((src) => (
                        <button
                          key={src.id}
                          type="button"
                          onClick={() => setHandSourceType(src.id)}
                          className={`p-2.5 rounded-xl border text-xs font-bold text-left cursor-pointer ${
                            handSourceType === src.id
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {src.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {handSourceType === 'custom_text' && (
                  <div className="pt-2">
                    <textarea
                      rows={3}
                      value={customHandText}
                      onChange={(e) => setCustomHandText(e.target.value)}
                      placeholder="Paste or type any JEE derivation, formula ($E = mc^2$), or summary here to instantly render it in realistic notebook handwriting..."
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium"
                    />
                  </div>
                )}
              </div>

              {/* Realistic Handwritten Notebook Page Sheet */}
              <div
                className={`rounded-3xl border-2 border-amber-200/90 shadow-lg p-8 lg:p-12 min-h-[540px] relative transition-all ${
                  paperStyle === 'ruled'
                    ? 'paper-ruled'
                    : paperStyle === 'grid'
                    ? 'paper-grid'
                    : 'paper-plain'
                } ${HANDWRITING_FONT_MAP[handFont].cssClass}`}
                style={{ color: inkColor }}
              >
                {/* Notebook Red Margin Line */}
                <div className="hidden sm:block absolute top-0 bottom-0 left-14 w-0.5 bg-rose-400/50 pointer-events-none" />

                <div className="sm:pl-10 space-y-6">
                  {/* Top Notebook Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-amber-300/80 pb-3">
                    <div>
                      <div className="text-xs font-sans font-extrabold uppercase tracking-wider text-slate-500">
                        {activeMaterial.subject} • Handwritten Topper Notebook ({HANDWRITING_FONT_MAP[handFont].label})
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-bold mt-0.5">
                        {activeMaterial.chapter} —{' '}
                        {handSourceType === 'chapter_notes'
                          ? 'Complete Lecture Notes'
                          : handSourceType === 'sticky_notes'
                          ? 'High-Yield Sticky Callouts'
                          : handSourceType === 'summary_sheet'
                          ? '1-Page Exam Revision Sheet'
                          : 'Custom Handwritten Sheet'}
                      </h3>
                    </div>
                    <div className="px-3 py-1 rounded-xl border border-amber-400/80 bg-amber-50/90 text-xs font-sans font-bold text-amber-900">
                      Page 1 • Equations &amp; Derivations Verified
                    </div>
                  </div>

                  {/* Rendered Content by Source Type */}
                  {handSourceType === 'chapter_notes' && activeBundle && (
                    <div className="space-y-6 text-lg sm:text-xl leading-relaxed">
                      {activeBundle.pages.map((pg) => (
                        <div key={pg.pageNumber} className="space-y-3">
                          <div className="inline-block px-3 py-0.5 rounded-lg bg-yellow-200/70 text-slate-900 font-bold text-base">
                            § Page {pg.pageNumber}: {pg.heading}
                          </div>
                          {pg.sections.map((sec, sIdx) => (
                            <div key={sIdx} className="space-y-2">
                              <div className="font-bold text-indigo-900">{sec.numberTitle}</div>
                              {sec.paragraphs?.map((par, pIdx) => (
                                <div key={pIdx}>
                                  <MathRichText content={par} />
                                </div>
                              ))}
                              {sec.formulas?.map((form, fIdx) => (
                                <div
                                  key={fIdx}
                                  className="p-3.5 rounded-2xl bg-white/80 border border-amber-300/90 shadow-2xs"
                                >
                                  <MathRichText content={form} />
                                </div>
                              ))}
                              {sec.bullets && sec.bullets.length > 0 && (
                                <ul className="list-disc pl-6 space-y-1.5">
                                  {sec.bullets.map((bText, bIdx) => (
                                    <li key={bIdx}>
                                      <MathRichText content={bText} inline />
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {handSourceType === 'sticky_notes' && activeBundle && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-lg leading-relaxed">
                      {[...customStickyNotes, ...activeBundle.stickyNotes].map((st) => (
                        <div
                          key={st.id}
                          className="p-5 rounded-2xl bg-yellow-100/90 border-2 border-yellow-300 shadow-sm space-y-2"
                        >
                          <div className="text-xs font-sans font-extrabold uppercase tracking-wider text-amber-800">
                            {st.subject}
                          </div>
                          <div className="text-xl font-bold text-slate-900">{st.title}</div>
                          <div className="text-slate-800">
                            <MathRichText content={st.body} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {handSourceType === 'summary_sheet' && activeBundle && (
                    <div className="space-y-5 text-lg sm:text-xl leading-relaxed">
                      <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-300">
                        <div className="text-xs font-sans font-extrabold uppercase text-emerald-800 mb-1">
                          Executive Chapter Summary
                        </div>
                        <MathRichText content={activeMaterial.contentSummary} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeBundle.formulas.map((fc) => (
                          <div
                            key={fc.id}
                            className="p-4 rounded-2xl bg-white/85 border border-indigo-200 space-y-1.5"
                          >
                            <div className="font-bold text-indigo-950">{fc.title}</div>
                            <MathRichText content={fc.formula} />
                            <div className="text-base text-slate-700">
                              <MathRichText content={fc.notes} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {handSourceType === 'custom_text' && (
                    <div className="text-xl leading-relaxed">
                      <MathRichText
                        content={
                          customHandText.trim() ||
                          `**Type above to convert any note!** Example: For a projectile launched at angle $\\theta$, maximum height is $$H = \\frac{u^2 \\sin^2\\theta}{2g}$$ and horizontal range is $$R = \\frac{u^2 \\sin(2\\theta)}{g}$$. *Remember that range is identical for complementary angles $\\theta$ and $90^\\circ - \\theta$.*`
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SUB-TAB 3: 3D FLIP FLASHCARDS WITH KATEX & SRS                    */}
          {/* ================================================================= */}
          {activeSubTab === 'Flashcards' && activeMaterial && activeFlashcard && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Card {(cardIndex % mindMapNodes.length) + 1} of {mindMapNodes.length} •{' '}
                  <span className="text-indigo-600 font-extrabold">
                    Current SRS Interval: {srsStats.intervalDays}d (Ease{' '}
                    {srsStats.easeFactor.toFixed(2)})
                  </span>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useHandFontOnCards}
                    onChange={(e) => setUseHandFontOnCards(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  Render Flashcard in Handwriting Font ({HANDWRITING_FONT_MAP[handFont].label})
                </label>
              </div>

              <div
                onClick={() => setIsCardFlipped((f) => !f)}
                className={`rounded-3xl border-2 p-8 sm:p-10 min-h-[320px] flex flex-col justify-between transition-all cursor-pointer shadow-md ${
                  isCardFlipped
                    ? 'bg-indigo-950 text-white border-indigo-500'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                } ${useHandFontOnCards ? HANDWRITING_FONT_MAP[handFont].cssClass : ''}`}
              >
                <div className="flex items-center justify-between text-xs font-sans font-extrabold uppercase tracking-wider opacity-75">
                  <span>
                    {isCardFlipped
                      ? 'BACK: FORMULA, APPLICATION & EXAM TRAP'
                      : `FRONT: CONCEPT PROMPT (${activeFlashcard.pageRef})`}
                  </span>
                  <span>Click Card to Flip ↻</span>
                </div>

                {!isCardFlipped ? (
                  <div className="my-auto py-6 text-center space-y-4">
                    <h3 className="text-2xl sm:text-3xl font-extrabold">
                      {activeFlashcard.title}
                    </h3>
                    <p className="text-sm font-sans text-slate-500 dark:text-slate-400">
                      State the core law, mathematical formula, and JEE exception trap for this concept.
                    </p>
                  </div>
                ) : (
                  <div className="my-auto py-4 space-y-4 text-base sm:text-lg">
                    <div>
                      <span className="text-xs font-sans font-extrabold uppercase text-indigo-300 block mb-1">
                        Core Definition &amp; Law:
                      </span>
                      <MathRichText content={activeFlashcard.definition} />
                    </div>
                    {activeFlashcard.formulaLatex && (
                      <div className="p-3 rounded-xl bg-white/10 border border-white/15">
                        <MathRichText content={activeFlashcard.formulaLatex} />
                      </div>
                    )}
                    <div className="text-amber-300 text-sm sm:text-base">
                      <strong className="font-sans uppercase text-xs tracking-wider mr-1">
                        JEE Trap:
                      </strong>
                      <MathRichText content={activeFlashcard.commonTrap} inline />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs font-sans font-bold opacity-75 pt-3 border-t border-slate-200/20">
                  <span>{activeMaterial.chapter}</span>
                  <span>SM-2 Spaced Repetition Active</span>
                </div>
              </div>

              {/* 4 SRS Rating Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(
                  [
                    { label: 'Again', sub: '< 10 mins', style: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100' },
                    { label: 'Hard', sub: '2 days', style: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100' },
                    { label: 'Good', sub: '4 days', style: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' },
                    { label: 'Easy', sub: '7 days', style: 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100' },
                  ] as const
                ).map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => handleRateFlashcard(btn.label)}
                    className={`py-3 px-4 rounded-2xl border font-extrabold text-xs transition-all cursor-pointer flex flex-col items-center gap-0.5 ${btn.style}`}
                  >
                    <span>{btn.label}</span>
                    <span className="text-[10px] opacity-75">{btn.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SUB-TAB 4: STICKY NOTES (KATEX + HANDWRITING TOGGLE)              */}
          {/* ================================================================= */}
          {activeSubTab === 'Sticky Notes' && activeMaterial && activeBundle && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddCustomSticky}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center gap-3 shadow-2xs"
              >
                <input
                  type="text"
                  value={newStickyTitle}
                  onChange={(e) => setNewStickyTitle(e.target.value)}
                  placeholder="Sticky title (e.g., Adiabatic Work Sign Convention)..."
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold flex-1 min-w-[200px]"
                />
                <input
                  type="text"
                  value={newStickyBody}
                  onChange={(e) => setNewStickyBody(e.target.value)}
                  placeholder="Sticky note with formula ($W = -nC_V\Delta T$)..."
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex-2 min-w-[260px]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer"
                >
                  + Pin Sticky Note
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[...customStickyNotes, ...activeBundle.stickyNotes].map((note, idx) => {
                  const bgColors = [
                    'bg-yellow-50/90 border-yellow-300',
                    'bg-indigo-50/80 border-indigo-200',
                    'bg-emerald-50/80 border-emerald-200',
                  ];
                  return (
                    <div
                      key={note.id}
                      className={`p-5 rounded-2xl border-2 shadow-xs space-y-2.5 ${
                        bgColors[idx % bgColors.length]
                      } ${useHandFontOnCards ? HANDWRITING_FONT_MAP[handFont].cssClass : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-white/80 text-[10px] font-sans font-extrabold uppercase tracking-wider text-slate-700">
                          {note.subject}
                        </span>
                        <Bookmark className="w-4 h-4 text-slate-500" />
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900">{note.title}</h3>
                      <div className="text-sm sm:text-base text-slate-800 leading-relaxed">
                        <MathRichText content={note.body} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SUB-TAB 5: SUMMARY SHEET                                          */}
          {/* ================================================================= */}
          {activeSubTab === 'Summary Sheet' && activeMaterial && activeBundle && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 lg:p-8 shadow-2xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">
                    ONE-PAGE HIGH-YIELD REVISION SHEET
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {activeMaterial.chapter} ({activeMaterial.subject})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHandSourceType('summary_sheet');
                    setActiveSubTab('Handwritten Notes');
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-extrabold hover:bg-indigo-100 cursor-pointer"
                >
                  View in Topper Handwriting Font →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeBundle.pages.map((pg) => (
                  <div
                    key={pg.pageNumber}
                    className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-3"
                  >
                    <div className="text-xs font-extrabold uppercase tracking-wider text-indigo-600">
                      Section {pg.pageNumber} • {pg.heading}
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                      <MathRichText content={pg.aiTutorSummary.english} />
                    </div>
                    {pg.sections.map((sec, sIdx) => (
                      <ul
                        key={sIdx}
                        className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4"
                      >
                        {sec.bullets?.map((bText, bIdx) => (
                          <li key={bIdx}>
                            <MathRichText content={bText} inline />
                          </li>
                        ))}
                      </ul>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SUB-TAB 6: DYNAMIC FORMULA BOOK (ALL UPLOADED CHAPTERS & EQUATIONS) */}
          {/* ================================================================= */}
          {activeSubTab === 'Formula Book' && (
            <div className="space-y-6">
              {/* Formula Book Top Action & Chapter Filter Bar */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                      Formula Book ({allExtractedFormulas.length})
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowAddFormulaForm((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{showAddFormulaForm ? 'Close Form' : '+ Add Custom Formula'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.print();
                        showToast('Opened Print / Save as PDF for your Chapter Formula Book!');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-slate-200 text-xs font-extrabold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Export Formula Sheet PDF</span>
                    </button>
                  </div>
                </div>

                {/* Chapter Filter Pills */}
                {availableFormulaChapters.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mr-1">
                      Filter by Chapter:
                    </span>
                    {['All', ...availableFormulaChapters].map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setFormulaChapterFilter(ch)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer ${
                          formulaChapterFilter === ch
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                )}

                {/* Add Custom Formula Form */}
                {showAddFormulaForm && (
                  <form
                    onSubmit={handleAddCustomFormula}
                    className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-slate-800/80 border border-indigo-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs"
                  >
                    <div>
                      <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                        Formula Title / Law Name
                      </label>
                      <input
                        type="text"
                        required
                        value={newFormulaTitle}
                        onChange={(e) => setNewFormulaTitle(e.target.value)}
                        placeholder="e.g., Parallel Axis Theorem / Nernst Equation"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                        Mathematical Equation
                      </label>
                      <input
                        type="text"
                        required
                        value={newFormulaLatex}
                        onChange={(e) => setNewFormulaLatex(e.target.value)}
                        placeholder="e.g., I = I_{cm} + M d^2"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                        Variable Definitions
                      </label>
                      <input
                        type="text"
                        value={newFormulaVariables}
                        onChange={(e) => setNewFormulaVariables(e.target.value)}
                        placeholder="e.g., I_cm = COM inertia, M = total mass, d = perpendicular distance"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                        SI Units &amp; Dimensions
                      </label>
                      <input
                        type="text"
                        value={newFormulaUnits}
                        onChange={(e) => setNewFormulaUnits(e.target.value)}
                        placeholder="e.g., kg·m² · [M¹ L² T⁰]"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
                      <input
                        type="text"
                        value={newFormulaNotes}
                        onChange={(e) => setNewFormulaNotes(e.target.value)}
                        placeholder="Important condition or exam trap (e.g., Axes must be strictly parallel)..."
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900"
                      />
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold cursor-pointer"
                      >
                        Save Formula to Chapter
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Grouped Formulas by Chapter */}
              {(formulaChapterFilter === 'All'
                ? availableFormulaChapters
                : [formulaChapterFilter]
              ).map((chapterName) => {
                const chapterFormulas = allExtractedFormulas.filter(
                  (f) => f.chapter === chapterName
                );
                if (chapterFormulas.length === 0) return null;
                return (
                  <div key={chapterName} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                        <span>{chapterName}</span>
                        <span className="text-xs font-bold text-slate-400">
                          ({chapterFormulas.length} formulas)
                        </span>
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {chapterFormulas.map((fc) => (
                        <div
                          key={fc.id}
                          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold">
                                {fc.subject} • {fc.chapter}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(fc.formula);
                                  showToast(`Copied "${fc.title}" formula to clipboard!`);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-bold text-slate-600 cursor-pointer"
                                title="Copy Equation"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </button>
                            </div>

                            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                              {fc.title}
                            </h4>

                            <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-slate-800 border border-indigo-200/80 dark:border-slate-700">
                              <MathRichText content={fc.formula} />
                            </div>

                            {(fc.variables || fc.units) && (
                              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 text-[11px] space-y-1">
                                {fc.variables && (
                                  <div className="text-slate-700 dark:text-slate-300">
                                    <strong className="text-slate-900 dark:text-white">Variables: </strong>
                                    <MathRichText content={fc.variables} inline />
                                  </div>
                                )}
                                {fc.units && (
                                  <div className="text-indigo-700 dark:text-indigo-300 font-semibold">
                                    <strong>SI Units / Dimensions: </strong>
                                    <MathRichText content={fc.units} inline />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <MathRichText content={fc.notes} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 7: MISTAKE DNA & SUPERMEMO SM-2 NEURONZ QUEUE             */}
      {/* ================================================================= */}
      {activeSubTab === 'Mistake DNA' && (
        <SpacedRepetitionHub
          sm2Cards={sm2Cards}
          mistakes={mistakesNotebook}
          onUpdateSM2Card={(updated) => {
            if (onUpdateSM2Card) onUpdateSM2Card(updated);
          }}
          onAddSM2Card={(newCard) => {
            if (onAddSM2Card) onAddSM2Card(newCard);
          }}
          onTagMistakeRootCause={(id, cause) => {
            if (onTagMistakeRootCause) onTagMistakeRootCause(id, cause);
          }}
          onVerifyMistakeRecheck={onVerifyMistakeRecheck}
          onPracticeMistake={onPracticeQuestion}
          showToast={showToast}
        />
      )}
    </div>
  );
};

// ============================================================================
// 2. PRACTICE DASHBOARD VIEW (Marks-Style Buckets + Custom Test Builder + Mistakes)
// ============================================================================
interface PracticeViewProps {
  onStartCBTMock: (examMode?: ExamTrack) => void;
  onOpenInstantPractice: (paperTitle: string, customQuestions?: CBTQuestion[]) => void;
  onOpenCustomTestModal?: () => void;
  mistakesNotebook?: MistakeNotebookEntry[];
  onRecordMistake?: (question: CBTQuestion, userAnswer: string) => void;
}

export const PracticeDashboardView: React.FC<PracticeViewProps> = ({
  onStartCBTMock,
  onOpenInstantPractice,
  onOpenCustomTestModal,
  mistakesNotebook = [],
  onRecordMistake,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'Official Papers' | 'PYQs' | 'Custom Set' | 'Analysis'
  >('Official Papers');
  const [paperFilter, setPaperFilter] = useState<
    'All' | 'JEE Main' | 'JEE Advanced' | 'NEET UG' | 'BITSAT' | '2025' | '2024'
  >('All');
  const [savedDraft, setSavedDraft] = useState<CbtInProgressDraft | null>(() =>
    loadCbtInProgressDraft()
  );

  useEffect(() => {
    setSavedDraft(loadCbtInProgressDraft());
  }, []);

  // PYQ Bank Filters (Including MathonGo Marks-style Buckets)
  const [pyqSubjectFilter, setPyqSubjectFilter] = useState<
    'All' | 'Physics' | 'Chemistry' | 'Mathematics'
  >('All');
  const [pyqBucketFilter, setPyqBucketFilter] = useState<
    'All' | 'Beginner' | 'Must-Do' | 'Advanced Climb'
  >('All');
  const [selectedPyqOptions, setSelectedPyqOptions] = useState<Record<string, number>>({});
  const [revealedPyqSolutions, setRevealedPyqSolutions] = useState<Record<string, boolean>>({});
  const [verifiedPyqSolutions, setVerifiedPyqSolutions] = useState<
    Record<
      string,
      { isCorrect: boolean; correctIndex: number; explanation: string; keyVersion?: string }
    >
  >({});
  const [verifyingPyqId, setVerifyingPyqId] = useState<string | null>(null);
  const [reportingQId, setReportingQId] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [reportFeedback, setReportFeedback] = useState<Record<string, string>>({});

  // Custom Test Builder State
  const [customSubjects, setCustomSubjects] = useState<
    Array<'Physics' | 'Chemistry' | 'Mathematics'>
  >(['Physics', 'Chemistry', 'Mathematics']);
  const [customBucket, setCustomBucket] = useState<
    'All' | 'Beginner' | 'Must-Do' | 'Advanced Climb'
  >('Must-Do');
  const [customCount, setCustomCount] = useState<number>(10);

  const filteredPapers = OFFICIAL_PAPERS_LIST.filter((p) => {
    const isAdv = p.paper.includes('Advanced');
    const isNeet = p.paper.includes('NEET UG');
    const isBitsat = p.paper.includes('BITSAT');
    if (paperFilter === 'All') return true;
    if (paperFilter === 'JEE Main') return !isAdv && !isNeet && !isBitsat;
    if (paperFilter === 'JEE Advanced') return isAdv;
    if (paperFilter === 'NEET UG') return isNeet;
    if (paperFilter === 'BITSAT') return isBitsat;
    return String(p.year) === paperFilter;
  });

  const combinedPyqPool = [
    ...CBT_MOCK_QUESTIONS.slice(0, 30),
    ...JEE_ADVANCED_PAPER_QUESTIONS,
    ...NEET_UG_PAPER_QUESTIONS,
    ...BITSAT_PAPER_QUESTIONS,
  ];
  const filteredPyqs = combinedPyqPool.filter((q) => {
    const subjMatch = pyqSubjectFilter === 'All' || q.subject === pyqSubjectFilter;
    const bucketMatch =
      pyqBucketFilter === 'All' || (q.difficultyBucket || 'Must-Do') === pyqBucketFilter;
    return subjMatch && bucketMatch;
  });

  const handleToggleCustomSubject = (subj: 'Physics' | 'Chemistry' | 'Mathematics') => {
    setCustomSubjects((prev) =>
      prev.includes(subj)
        ? prev.length > 1
          ? prev.filter((s) => s !== subj)
          : prev
        : [...prev, subj]
    );
  };

  const handleLaunchCustomSet = () => {
    const pool = combinedPyqPool.filter((q) => {
      const subjOk = customSubjects.includes(q.subject);
      const bucketOk =
        customBucket === 'All' || (q.difficultyBucket || 'Must-Do') === customBucket;
      return subjOk && bucketOk;
    });
    const finalQuestions = (pool.length > 0 ? pool : CBT_MOCK_QUESTIONS).slice(0, customCount);
    onOpenInstantPractice(
      `Custom ${customBucket} Drill (${customSubjects.join(' + ')})`,
      finalQuestions
    );
  };

  return (
    <div className="w-full px-6 lg:px-10 xl:px-12 py-6 space-y-6">
      {/* Sub-Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3.5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Practice &amp; Mock Tests
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          {(['Official Papers', 'PYQs', 'Custom Set', 'Analysis'] as const).map((tab) => {
            const active = activeSubTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveSubTab(tab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Crash-Recovery Auto-Saved CBT Mock Banner */}
      {savedDraft && (
        <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-950/40 p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-extrabold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                  Crash-Recovery Auto-Save Ready
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-950 text-[10px] font-extrabold">
                  {savedDraft.examMode} • Q{savedDraft.currentQNumber}
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                Interrupted session saved with{' '}
                <strong>{formatCountdownTimer(savedDraft.secondsRemaining)}</strong> remaining (Auto-saved at{' '}
                {new Date(savedDraft.savedAt).toLocaleTimeString()}).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStartCBTMock(savedDraft.examMode)}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold cursor-pointer shadow-2xs"
            >
              Resume Interrupted Mock →
            </button>
            <button
              type="button"
              onClick={() => {
                void clearCbtInProgressDraft();
                setSavedDraft(null);
              }}
              className="px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Hero Banner with Multi-Exam CBT Launchers */}
      <div className="bg-gradient-to-r from-[#243B82] via-[#2E4696] to-[#3B5BDB] rounded-3xl p-6 lg:p-7 text-white shadow-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <h2 className="text-xl lg:text-2xl font-extrabold tracking-tight">
            Multi-Exam Proctored CBT Simulator
          </h2>
          <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed">
            JEE Main (+4/-1), JEE Advanced (+4/-2 Partial), NEET UG (+4/-1), and BITSAT Speed CBT (+3/-1) with 15s auto-save and fullscreen proctoring.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onOpenCustomTestModal && (
            <button
              type="button"
              onClick={onOpenCustomTestModal}
              className="px-4 py-2.5 rounded-2xl bg-emerald-400 text-slate-950 hover:bg-emerald-300 text-xs font-extrabold shadow-sm transition-all cursor-pointer"
            >
              Custom Test →
            </button>
          )}
          <button
            type="button"
            onClick={() => onStartCBTMock('JEE Main')}
            className="px-4 py-2.5 rounded-2xl bg-white text-[#1E3272] hover:bg-indigo-50 text-xs font-extrabold shadow-sm transition-all cursor-pointer"
          >
            JEE Main CBT →
          </button>
          <button
            type="button"
            onClick={() => onStartCBTMock('JEE Advanced')}
            className="px-4 py-2.5 rounded-2xl bg-amber-400 text-slate-950 hover:bg-amber-300 text-xs font-extrabold shadow-sm transition-all cursor-pointer"
          >
            JEE Advanced CBT →
          </button>
          <button
            type="button"
            onClick={() => onStartCBTMock('NEET UG')}
            className="px-4 py-2.5 rounded-2xl bg-teal-300 text-slate-950 hover:bg-teal-200 text-xs font-extrabold shadow-sm transition-all cursor-pointer"
          >
            NEET UG CBT →
          </button>
          <button
            type="button"
            onClick={() => onStartCBTMock('BITSAT')}
            className="px-4 py-2.5 rounded-2xl bg-rose-300 text-slate-950 hover:bg-rose-200 text-xs font-extrabold shadow-sm transition-all cursor-pointer"
          >
            BITSAT CBT →
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: OFFICIAL PAPERS */}
      {activeSubTab === 'Official Papers' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                ['All', 'JEE Main', 'JEE Advanced', 'NEET UG', 'BITSAT', '2025', '2024'] as const
              ).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setPaperFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    paperFilter === f
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <span className="text-xs font-bold text-slate-500">
              Showing {filteredPapers.length} Official Past Shift Papers
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredPapers.map((paperItem) => {
              const isAdv = paperItem.paper.includes('Advanced');
              const isNeet = paperItem.paper.includes('NEET UG');
              const isBitsat = paperItem.paper.includes('BITSAT');
              const paperTrack: ExamTrack = isAdv
                ? 'JEE Advanced'
                : isNeet
                ? 'NEET UG'
                : isBitsat
                ? 'BITSAT'
                : 'JEE Main';
              return (
                <div
                  key={paperItem.id}
                  className="p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          isAdv
                            ? 'bg-amber-100 text-amber-900'
                            : isNeet
                            ? 'bg-teal-100 text-teal-900'
                            : isBitsat
                            ? 'bg-rose-100 text-rose-900'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {paperTrack}
                      </span>
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {paperItem.paper}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-3">
                      <span>Year: {paperItem.year}</span>
                      <span>•</span>
                      <span>Session: {paperItem.session}</span>
                      <span>•</span>
                      <span>Shift: {paperItem.shift}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenInstantPractice(paperItem.paper)}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-xs font-extrabold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      Practice (Instant Solver)
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartCBTMock(paperTrack)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-2xs cursor-pointer"
                    >
                      CBT Mode →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: PYQs WITH MATHONGO MARKS-STYLE DIFFICULTY BUCKETS */}
      {activeSubTab === 'PYQs' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-extrabold text-slate-500 mr-1">Subject:</span>
              {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setPyqSubjectFilter(subj)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    pyqSubjectFilter === subj
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {subj}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-extrabold text-slate-500 mr-1">
                Marks-Style Bucket:
              </span>
              {(['All', 'Beginner', 'Must-Do', 'Advanced Climb'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setPyqBucketFilter(b)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                    pyqBucketFilter === b
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {filteredPyqs.slice(0, 15).map((q, idx) => {
              const chosen = selectedPyqOptions[q.id];
              const verified = verifiedPyqSolutions[q.id];
              const isRevealed = Boolean(revealedPyqSolutions[q.id] && verified);
              const isCorrect = verified ? verified.isCorrect : false;
              const resolvedCorrectIndex = verified ? verified.correctIndex : -1;
              return (
                <div
                  key={q.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-extrabold">
                        PYQ #{idx + 1} • {q.subject} ({q.chapter})
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          q.difficultyBucket === 'Advanced Climb'
                            ? 'bg-rose-100 text-rose-800'
                            : q.difficultyBucket === 'Beginner'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {q.difficultyBucket || 'Must-Do'} Bucket
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono font-bold">
                        {q.provenanceType || 'RECONSTRUCTED_WITH_SOURCE'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">
                        {q.section === 'Section B'
                          ? q.examType === 'JEE Advanced'
                            ? '+4 / 0 (Numerical)'
                            : '+4 / -1 (Numerical)'
                          : '+4 / -1'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setReportingQId((cur) => (cur === q.id ? null : q.id));
                          setReportText('');
                        }}
                        className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 underline cursor-pointer"
                      >
                        Report Issue
                      </button>
                    </div>
                  </div>

                  {reportingQId === q.id && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2 text-xs">
                      <input
                        type="text"
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value)}
                        placeholder="Describe answer key discrepancy, LaTeX typo, or provenance issue..."
                        className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white dark:bg-slate-900"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!reportText.trim()) return;
                          const r = await reportQuestionIssueOnServer({
                            questionId: q.id,
                            issueType: 'wrong_answer_key',
                            details: reportText.trim(),
                          });
                          setReportFeedback((prev) => ({
                            ...prev,
                            [q.id]: r.ok
                              ? 'Reported to editorial review queue.'
                              : `[${r.error.errorCode}] ${r.error.message}`,
                          }));
                          setReportingQId(null);
                          setReportText('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold cursor-pointer"
                      >
                        Submit
                      </button>
                    </div>
                  )}

                  {reportFeedback[q.id] && (
                    <div className="text-[11px] font-semibold text-indigo-700">
                      {reportFeedback[q.id]}
                    </div>
                  )}

                  <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed">
                    <MathRichText content={q.stem} />
                  </div>

                  {q.options.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {q.options.map((opt, optIdx) => {
                        const selected = chosen === optIdx;
                        let cls =
                          'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800';
                        if (isRevealed) {
                          if (optIdx === resolvedCorrectIndex) {
                            cls = 'border-emerald-500 bg-emerald-50/80 text-emerald-950';
                          } else if (selected) {
                            cls = 'border-rose-400 bg-rose-50/80 text-rose-950';
                          }
                        } else if (selected) {
                          cls = 'border-indigo-600 bg-indigo-50/60 text-indigo-950';
                        }
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            disabled={verifyingPyqId === q.id}
                            onClick={async () => {
                              setSelectedPyqOptions((prev) => ({ ...prev, [q.id]: optIdx }));
                              setVerifyingPyqId(q.id);
                              try {
                                const srv = await verifySinglePyqAnswerOnServer({
                                  questionId: q.id,
                                  selectedOption: optIdx,
                                });
                                if (srv.ok) {
                                  setVerifiedPyqSolutions((prev) => ({
                                    ...prev,
                                    [q.id]: {
                                      isCorrect: srv.data.isCorrect,
                                      correctIndex: srv.data.correctIndex,
                                      explanation: srv.data.explanation,
                                      keyVersion: srv.data.keyVersion,
                                    },
                                  }));
                                  setRevealedPyqSolutions((prev) => ({ ...prev, [q.id]: true }));
                                  if (!srv.data.isCorrect && onRecordMistake) {
                                    onRecordMistake(q, opt);
                                  }
                                } else {
                                  setReportFeedback((prev) => ({
                                    ...prev,
                                    [q.id]: srv.error.message || 'Server answer verification failed.',
                                  }));
                                }
                              } finally {
                                setVerifyingPyqId(null);
                              }
                            }}
                            className={`p-3 rounded-xl border text-left text-xs sm:text-sm font-medium flex items-center justify-between cursor-pointer ${cls}`}
                          >
                            <span className="flex items-center gap-2">
                              <strong>({String.fromCharCode(65 + optIdx)})</strong>
                              <MathRichText content={opt} inline />
                            </span>
                            {isRevealed && optIdx === resolvedCorrectIndex && (
                              <span className="text-[11px] font-extrabold text-emerald-700">
                                ✓ Correct
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {verifyingPyqId === q.id && (
                    <div className="text-xs font-bold text-indigo-600">
                      Verifying answer against server key...
                    </div>
                  )}

                  {isRevealed && verified && (
                    <div
                      className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                        isCorrect
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                          : 'bg-amber-50/70 border-amber-200 text-amber-950'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 font-extrabold">
                        <span>
                          {isCorrect
                            ? 'Correct! Server-Verified Step-by-Step Derivation:'
                            : 'Added to My Mistakes Notebook — Server-Verified Derivation:'}
                        </span>
                        {verified.keyVersion && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/80 text-slate-600">
                            {verified.keyVersion}
                          </span>
                        )}
                      </div>
                      <MathRichText content={verified.explanation || q.explanation} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CUSTOM TEST BUILDER */}
      {activeSubTab === 'Custom Set' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-3xl mx-auto shadow-2xs space-y-6">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">
              CUSTOM JEE PRACTICE BUILDER
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              Create a Targeted Subject &amp; Difficulty Bucket Drill
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-2">
                1. Select Subjects to Include
              </label>
              <div className="flex flex-wrap gap-2.5">
                {(['Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => {
                  const active = customSubjects.includes(subj);
                  return (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => handleToggleCustomSubject(subj)}
                      className={`px-4 py-2.5 rounded-xl border text-xs font-extrabold cursor-pointer ${
                        active
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      {active ? '✓ ' : ''}
                      {subj}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-2">
                2. Select Marks-Style Difficulty Bucket
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(['All', 'Beginner', 'Must-Do', 'Advanced Climb'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setCustomBucket(b)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold cursor-pointer ${
                      customBucket === b
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-2">
                3. Number of Questions
              </label>
              <div className="flex gap-2.5">
                {[5, 10, 15, 25].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setCustomCount(cnt)}
                    className={`px-4 py-2 rounded-xl border text-xs font-extrabold cursor-pointer ${
                      customCount === cnt
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    {cnt} Questions
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLaunchCustomSet}
            className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs cursor-pointer"
          >
            Generate &amp; Start Custom Practice Set ({customCount} Qs) →
          </button>
        </div>
      )}

      {/* SUB-TAB 4: ANALYSIS & MY MISTAKES NOTEBOOK */}
      {activeSubTab === 'Analysis' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              My Mistakes Notebook &amp; Accuracy Breakdown
            </h2>
            <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-extrabold">
              {mistakesNotebook.length} Recorded Mistakes
            </span>
          </div>

          {mistakesNotebook.length === 0 ? (
            <p className="text-xs text-slate-500">
              No mistakes recorded yet. Attempt any PYQ or CBT Mock to populate your personal error log.
            </p>
          ) : (
            <div className="space-y-3">
              {mistakesNotebook.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <div className="text-xs font-extrabold text-indigo-600">
                    {m.question.subject} • {m.question.chapter}
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    <MathRichText content={m.question.stem} />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <MathRichText content={m.question.explanation} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 3. PROGRESS DASHBOARD VIEW
// ============================================================================
interface ProgressViewProps {
  onStartCBTMock: (examMode?: 'JEE Main' | 'JEE Advanced') => void;
  onPracticeWeakTopic: (topic: string) => void;
  lastMockScore: number | null;
  materialsCount?: number;
  mistakesCount?: number;
}

export const ProgressDashboardView: React.FC<ProgressViewProps> = ({
  onStartCBTMock,
  onPracticeWeakTopic,
  lastMockScore,
  materialsCount = 0,
  mistakesCount = 0,
}) => {
  return (
    <div className="w-full px-6 lg:px-10 xl:px-12 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            JEE Readiness &amp; Analytics Dashboard
          </h1>
          <p className="text-xs text-slate-500">
            Real-time tracking of uploaded study materials, CBT mock scores, and weak-chapter drills
          </p>
        </div>

        <button
          type="button"
          onClick={() => onStartCBTMock('JEE Main')}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs cursor-pointer"
        >
          Attempt Full 75-Q CBT Mock →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
          <div className="text-xs font-bold text-slate-500">Latest CBT Mock Score</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {lastMockScore !== null ? `${lastMockScore} / 300` : 'Not Attempted'}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            {lastMockScore !== null ? 'Est. 98.4+ Percentile Trajectory' : 'Take your first 75-Q CBT'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
          <div className="text-xs font-bold text-slate-500">Uploaded Study Materials</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {materialsCount}
          </div>
          <div className="text-[11px] text-indigo-600 font-semibold mt-1">
            100% User-Owned Library
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
          <div className="text-xs font-bold text-slate-500">Logged Mistake DNA Items</div>
          <div className="text-2xl font-extrabold text-rose-600 mt-1">{mistakesCount}</div>
          <div className="text-[11px] text-slate-500 font-semibold mt-1">
            Auto-captured from PYQs &amp; CBT
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
          <div className="text-xs font-bold text-slate-500">Target Exam Countdown</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            69 Days
          </div>
          <div className="text-[11px] text-amber-600 font-semibold mt-1">
            High-Weightage Revision Window
          </div>
        </div>
      </div>

      {/* Weak-Topic Remediation Drills */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-4">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
          Recommended High-Weightage JEE Remediation Drills
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              topic: 'Rotational Dynamics & Moment of Inertia',
              subject: 'Physics',
              note: 'Focus on Parallel Axis Theorem & Pure Rolling energy conservation.',
            },
            {
              topic: 'Electrochemistry & Nernst Equation',
              subject: 'Chemistry',
              note: 'Focus on cell EMF at non-standard concentrations and Faraday laws.',
            },
            {
              topic: 'Definite Integration & King’s Property',
              subject: 'Mathematics',
              note: 'Focus on $\\int_a^b f(x)dx = \\int_a^b f(a+b-x)dx$ and Leibniz rule.',
            },
          ].map((item) => (
            <div
              key={item.topic}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-indigo-600">
                  {item.subject}
                </span>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {item.topic}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <MathRichText content={item.note} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => onPracticeWeakTopic(item.topic)}
                className="w-full py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-extrabold cursor-pointer"
              >
                Start Adaptive Drill →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. FULL-SCREEN NTA CBT MOCK EXAM VIEW (75-Q JEE MAIN & JEE ADVANCED PAPER 1/2)
// ============================================================================
interface CBTMockExamProps {
  candidateName: string;
  initialExamMode?: ExamTrack;
  customQuestions?: CBTQuestion[];
  customDurationMinutes?: number;
  customPaperTitle?: string;
  onSubmitMock: (
    summary: CBTMockSummary,
    focusEvents: number,
    questions?: CBTQuestion[],
    responses?: Record<string, CBTQuestionResponse>
  ) => void;
  onExitMock: () => void;
  onRecordMistake?: (question: CBTQuestion, userAnswer: string) => void;
}

export const CBTMockExamView: React.FC<CBTMockExamProps> = ({
  candidateName,
  initialExamMode = 'JEE Main',
  customQuestions,
  customDurationMinutes,
  customPaperTitle,
  onSubmitMock,
  onExitMock,
  onRecordMistake,
}) => {
  const existingDraft = loadCbtInProgressDraft();
  const [examMode, setExamMode] = useState<ExamTrack>(
    existingDraft?.examMode || initialExamMode
  );

  const getQuestionsForMode = (mode: ExamTrack): CBTQuestion[] => {
    if (customQuestions && customQuestions.length > 0) return customQuestions;
    if (mode === 'JEE Advanced') return JEE_ADVANCED_PAPER_QUESTIONS;
    if (mode === 'NEET UG') return NEET_UG_PAPER_QUESTIONS;
    if (mode === 'BITSAT') return BITSAT_PAPER_QUESTIONS;
    return CBT_MOCK_QUESTIONS;
  };

  const questionsList = getQuestionsForMode(examMode);

  const [activeSubject, setActiveSubject] = useState<'Physics' | 'Chemistry' | 'Mathematics'>(
    questionsList[0]?.subject || 'Physics'
  );
  const [activeSection, setActiveSection] = useState<'Section A' | 'Section B'>('Section A');
  const [currentQNumber, setCurrentQNumber] = useState<number>(
    existingDraft && existingDraft.examMode === examMode
      ? existingDraft.currentQNumber
      : questionsList[0]?.number || 1
  );
  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    existingDraft && existingDraft.examMode === examMode && existingDraft.secondsRemaining > 0
      ? existingDraft.secondsRemaining
      : (customDurationMinutes || (examMode === 'NEET UG' ? 200 : 180)) * 60
  );
  const [focusEvents, setFocusEvents] = useState<number>(
    existingDraft?.focusSwitchCount || 0
  );
  const [proctorWarningLog, setProctorWarningLog] = useState<
    { timestamp: string; reason: string }[]
  >(existingDraft?.focusEvents || []);
  const [isFullscreenLocked, setIsFullscreenLocked] = useState<boolean>(false);
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string>(
    existingDraft?.savedAt
      ? new Date(existingDraft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : 'Just now'
  );
  const [examLanguage, setExamLanguage] = useState<'English' | 'Hindi'>('English');
  const [showInstructionsModal, setShowInstructionsModal] = useState<boolean>(false);
  const [submittedSummary, setSubmittedSummary] = useState<CBTMockSummary | null>(null);
  const [submittingCbt, setSubmittingCbt] = useState<boolean>(false);
  const [submitCbtError, setSubmitCbtError] = useState<string | null>(null);
  const [serverSolutions, setServerSolutions] = useState<
    Record<
      string,
      {
        correctIndex: number;
        correctIndices?: number[];
        numericalAnswer?: number;
        explanation: string;
      }
    >
  >({});

  const buildInitialResponses = (list: CBTQuestion[]) => {
    const init: Record<string, CBTQuestionResponse> = {};
    list.forEach((q, idx) => {
      init[q.id] = {
        status: idx === 0 ? 'not_answered' : 'not_visited',
        selectedOption: null,
        selectedOptions: [],
        numericalValue: '',
        timeSpentSec: 0,
      };
    });
    return init;
  };

  const [responses, setResponses] = useState<Record<string, CBTQuestionResponse>>(() => {
    if (
      existingDraft &&
      existingDraft.examMode === examMode &&
      existingDraft.responses &&
      Object.keys(existingDraft.responses).length > 0
    ) {
      return existingDraft.responses;
    }
    return buildInitialResponses(questionsList);
  });

  // Reset responses when switching exam mode
  const handleSwitchExamMode = (mode: ExamTrack) => {
    const nextList = getQuestionsForMode(mode);
    setExamMode(mode);
    setActiveSubject(nextList[0]?.subject || 'Physics');
    setActiveSection('Section A');
    setCurrentQNumber(1);
    setSecondsRemaining((mode === 'NEET UG' ? 200 : 180) * 60);
    setResponses(buildInitialResponses(nextList));
  };

  const currentQuestion =
    questionsList.find((q) => q.number === currentQNumber) || questionsList[0];

  // 1-second exam timer + per-question time-spent tracker
  useEffect(() => {
    if (submittedSummary) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      if (currentQuestion) {
        setResponses((prev) => {
          const cur = prev[currentQuestion.id];
          if (!cur) return prev;
          return {
            ...prev,
            [currentQuestion.id]: {
              ...cur,
              timeSpentSec: (cur.timeSpentSec || 0) + 1,
            },
          };
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [currentQuestion?.id, submittedSummary]);

  // 15-Second Crash-Recovery Auto-Save Loop (plus manual save helper)
  useEffect(() => {
    if (submittedSummary) return;
    const performAutoSave = () => {
      const nowIso = new Date().toISOString();
      void saveCbtInProgressDraft({
        examMode,
        secondsRemaining,
        currentQNumber,
        responses,
        focusSwitchCount: focusEvents,
        focusEvents: proctorWarningLog,
        savedAt: nowIso,
      });
      setLastAutoSavedTime(
        new Date(nowIso).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };

    const interval = setInterval(performAutoSave, 15000);
    return () => clearInterval(interval);
  }, [
    examMode,
    secondsRemaining,
    currentQNumber,
    responses,
    focusEvents,
    proctorWarningLog,
    submittedSummary,
  ]);

  // Fullscreen lock & Tab-Switch / Blur 3-Strike Proctoring Detector
  useEffect(() => {
    const recordFocusStrike = (reason: string) => {
      setFocusEvents((f) => f + 1);
      setProctorWarningLog((prev) => [
        { timestamp: new Date().toLocaleTimeString(), reason },
        ...prev.slice(0, 9),
      ]);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        recordFocusStrike('Tab switched or window minimized');
      }
    };
    const handleWindowBlur = () => {
      recordFocusStrike('Exam window lost active focus');
    };
    const handleFullscreenChange = () => {
      const activeFs = Boolean(document.fullscreenElement);
      setIsFullscreenLocked(activeFs);
      if (!activeFs) {
        recordFocusStrike('Exited full-screen lock during CBT session');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreenLock = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreenLocked(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreenLocked(false);
      }
    } catch {
      // Browser or iframe policy blocked fullscreen request
      setIsFullscreenLocked((v) => !v);
    }
  };

  const currentResponse: CBTQuestionResponse = responses[currentQuestion.id] || {
    status: 'not_answered',
    selectedOption: null,
    selectedOptions: [],
    numericalValue: '',
    timeSpentSec: 0,
  };

  const subjectQuestions = questionsList.filter((q) => {
    if (q.subject !== activeSubject) return false;
    if (examMode === 'JEE Main') {
      return (q.section || 'Section A') === activeSection;
    }
    return true;
  });

  const handleJumpToQuestion = (qNum: number) => {
    const targetQ = questionsList.find((q) => q.number === qNum);
    if (!targetQ) return;
    setActiveSubject(targetQ.subject);
    if (examMode === 'JEE Main' && targetQ.section) {
      setActiveSection(targetQ.section);
    }
    setCurrentQNumber(qNum);
    setResponses((prev) => {
      const existing = prev[targetQ.id];
      if (!existing || existing.status === 'not_visited') {
        return {
          ...prev,
          [targetQ.id]: {
            ...(existing || {
              selectedOption: null,
              selectedOptions: [],
              numericalValue: '',
              timeSpentSec: 0,
            }),
            status: 'not_answered',
          },
        };
      }
      return prev;
    });
  };

  const handleSelectSingleOption = (optIdx: number) => {
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...currentResponse,
        selectedOption: optIdx,
      },
    }));
  };

  const handleToggleMultipleOption = (optIdx: number) => {
    const currentMulti = currentResponse.selectedOptions || [];
    const nextMulti = currentMulti.includes(optIdx)
      ? currentMulti.filter((i: number) => i !== optIdx)
      : [...currentMulti, optIdx].sort((a, b) => a - b);
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...currentResponse,
        selectedOptions: nextMulti,
      },
    }));
  };

  const handleNumericalKeyPress = (key: string) => {
    const curVal = currentResponse.numericalValue || '';
    let nextVal = curVal;
    if (key === 'CLEAR') nextVal = '';
    else if (key === 'BACKSPACE') nextVal = curVal.slice(0, -1);
    else if (curVal.length < 10) nextVal = curVal + key;

    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...currentResponse,
        numericalValue: nextVal,
      },
    }));
  };

  const isNumericalQ =
    currentQuestion.section === 'Section B' || currentQuestion.advancedFormat === 'numerical';
  const isMultipleQ = currentQuestion.advancedFormat === 'multiple';

  const hasAnswerValue = () => {
    if (isNumericalQ) {
      return Boolean(currentResponse.numericalValue && currentResponse.numericalValue.trim() !== '');
    }
    if (isMultipleQ) {
      return Boolean(currentResponse.selectedOptions && currentResponse.selectedOptions.length > 0);
    }
    return currentResponse.selectedOption !== null;
  };

  const advanceToNextQuestion = () => {
    const nextNum = currentQNumber < questionsList.length ? currentQNumber + 1 : 1;
    handleJumpToQuestion(nextNum);
  };

  const handleSaveAndNext = () => {
    const answered = hasAnswerValue();
    const nextResponses: Record<string, CBTQuestionResponse> = {
      ...responses,
      [currentQuestion.id]: {
        ...currentResponse,
        status: answered ? 'answered' : 'not_answered',
      },
    };
    setResponses(nextResponses);
    const nowIso = new Date().toISOString();
    void saveCbtInProgressDraft({
      examMode,
      secondsRemaining,
      currentQNumber,
      responses: nextResponses,
      focusSwitchCount: focusEvents,
      focusEvents: proctorWarningLog,
      savedAt: nowIso,
    });
    setLastAutoSavedTime(
      new Date(nowIso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
    advanceToNextQuestion();
  };

  const handleMarkForReviewAndNext = () => {
    const answered = hasAnswerValue();
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...currentResponse,
        status: answered ? 'answered_marked' : 'marked',
      },
    }));
    advanceToNextQuestion();
  };

  const handleClearResponse = () => {
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...currentResponse,
        status: 'not_answered',
        selectedOption: null,
        selectedOptions: [],
        numericalValue: '',
      },
    }));
  };

  const handleTriggerSubmit = async () => {
    setSubmittingCbt(true);
    setSubmitCbtError(null);
    try {
      const graded = await gradeCbtAttemptOnServerApi({
        attemptType: customQuestions && customQuestions.length > 0 ? 'custom_drill' : 'official_mock',
        questionIds:
          !customQuestions || customQuestions.length === 0
            ? questionsList.map((q) => q.id)
            : undefined,
        questions:
          customQuestions && customQuestions.length > 0 ? questionsList : undefined,
        responses,
        examMode,
      });

      if (!graded.ok) {
        setSubmitCbtError(
          graded.error.message || 'Server CBT grading unavailable. Your draft remains saved; please retry.'
        );
        return;
      }

      void clearCbtInProgressDraft();
      const summary = graded.data.summary as CBTMockSummary;
      setServerSolutions(graded.data.questionSolutions || {});
      setSubmittedSummary(summary);
      if (onRecordMistake && summary.questionDetails) {
        summary.questionDetails.forEach((detail: QuestionAttemptDetail) => {
          if (detail.isAttempted && !detail.isCorrect) {
            const qObj = questionsList.find((q) => q.id === detail.questionId);
            if (qObj) {
              const sol = graded.data.questionSolutions?.[qObj.id];
              onRecordMistake(
                sol
                  ? {
                      ...qObj,
                      correctIndex: sol.correctIndex,
                      correctIndices: sol.correctIndices,
                      numericalAnswer: sol.numericalAnswer,
                      explanation: sol.explanation,
                    }
                  : qObj,
                detail.userAnswerLabel || 'Incorrect CBT Response'
              );
            }
          }
        });
      }
    } finally {
      setSubmittingCbt(false);
    }
  };

  const livePaletteCounts = questionsList.reduce(
    (acc, q) => {
      const st = responses[q.id]?.status || 'not_visited';
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    },
    {
      not_visited: 0,
      not_answered: 0,
      answered: 0,
      marked: 0,
      answered_marked: 0,
    }
  );

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 flex flex-col">
      {/* Top Official Multi-Exam Proctored CBT Bar */}
      <header className="bg-[#243B82] text-white px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-2.5 py-1 rounded bg-white/15 text-[11px] font-extrabold uppercase tracking-wider">
            PROCTORED CBT CONSOLE
          </span>
          <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl flex-wrap">
            {(['JEE Main', 'JEE Advanced', 'NEET UG', 'BITSAT'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleSwitchExamMode(m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer ${
                  examMode === m ? 'bg-white text-[#243B82]' : 'text-indigo-100 hover:bg-white/10'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
          <div
            title="Auto-saves your responses and timer every 15 seconds"
            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-300/30 text-emerald-200 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            <span>Auto-Saved ({lastAutoSavedTime})</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-300" />
            <span>Time Left:</span>
            <span className="font-mono text-sm font-extrabold text-amber-300">
              {formatCountdownTimer(secondsRemaining)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleFullscreenLock}
            className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold cursor-pointer transition-all ${
              isFullscreenLocked
                ? 'bg-emerald-500/25 border-emerald-300/40 text-emerald-100'
                : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
            }`}
          >
            {isFullscreenLocked ? '🔒 Fullscreen Locked' : '⛶ Lock Fullscreen'}
          </button>

          <div
            className={`px-3 py-1.5 rounded-xl border ${
              focusEvents >= 3
                ? 'bg-rose-600/90 border-rose-300 text-white'
                : focusEvents > 0
                ? 'bg-amber-500/30 border-amber-300/50 text-amber-200'
                : 'bg-white/10 border-white/15'
            }`}
          >
            Proctor Warnings: <span className="font-extrabold">{focusEvents} / 3</span>
          </div>

          <select
            value={examLanguage}
            onChange={(e) => setExamLanguage(e.target.value as 'English' | 'Hindi')}
            className="px-2.5 py-1.5 rounded-xl bg-white/15 text-white text-xs font-bold border border-white/20 cursor-pointer"
          >
            <option value="English" className="text-slate-900">
              English
            </option>
            <option value="Hindi" className="text-slate-900">
              हिन्दी (Hindi)
            </option>
          </select>

          <button
            type="button"
            onClick={() => setShowInstructionsModal(true)}
            className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-extrabold cursor-pointer"
          >
            Instructions
          </button>

          <button
            type="button"
            onClick={onExitMock}
            className="px-3 py-1.5 rounded-xl bg-rose-500/80 hover:bg-rose-600 text-white text-xs font-extrabold cursor-pointer"
          >
            Save &amp; Exit
          </button>
        </div>
      </header>

      {/* 3-Strike Proctoring Warning Banner */}
      {focusEvents > 0 && (
        <div
          className={`px-6 py-2 text-xs font-extrabold flex flex-wrap items-center justify-between gap-2 ${
            focusEvents >= 3
              ? 'bg-rose-600 text-white'
              : 'bg-amber-100 text-amber-950 border-b border-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Proctoring Alert (Strike {Math.min(3, focusEvents)} of 3):{' '}
              {proctorWarningLog[0]?.reason || 'Tab switch or window blur detected'}. Stay in
              full-screen mode to maintain official exam integrity.
            </span>
          </div>
          {!isFullscreenLocked && (
            <button
              type="button"
              onClick={handleToggleFullscreenLock}
              className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-extrabold cursor-pointer"
            >
              Re-enter Fullscreen
            </button>
          )}
        </div>
      )}

      {/* Main 12-Col Split Workspace */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 9 Cols: Subject Tabs, Section Tabs & Question Canvas */}
        <div className="lg:col-span-9 flex flex-col gap-4">
          {/* Subject & Section Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2">
              {(['Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => {
                const active = activeSubject === subj;
                const firstQ = questionsList.find((q) => q.subject === subj);
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => {
                      setActiveSubject(subj);
                      setActiveSection('Section A');
                      if (firstQ) handleJumpToQuestion(firstQ.number);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer ${
                      active
                        ? 'bg-[#243B82] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {subj} ({questionsList.filter((q) => q.subject === subj).length} Qs)
                  </button>
                );
              })}
            </div>

            {examMode === 'JEE Main' && (
              <div className="flex items-center gap-2">
                {(['Section A', 'Section B'] as const).map((sec) => {
                  const active = activeSection === sec;
                  const firstSecQ = questionsList.find(
                    (q) => q.subject === activeSubject && (q.section || 'Section A') === sec
                  );
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setActiveSection(sec);
                        if (firstSecQ) handleJumpToQuestion(firstSecQ.number);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {sec === 'Section A'
                        ? 'Section A (20 MCQs • +4 / -1)'
                        : 'Section B (5 Compulsory Numericals • +4 / -1)'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Question Stem & Options Card */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-base font-extrabold text-slate-900">
                    Question {currentQuestion.number} of {questionsList.length}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-extrabold">
                    {currentQuestion.subject} • {currentQuestion.chapter}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold uppercase">
                    {currentQuestion.advancedFormat ||
                      (currentQuestion.section === 'Section B' ? 'NUMERICAL' : 'SINGLE MCQ')}
                  </span>
                  {customPaperTitle && (
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-extrabold">
                      {customPaperTitle}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs font-extrabold">
                  <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                    +
                    {examMode === 'JEE Advanced' &&
                    (currentQuestion.advancedFormat === 'single' ||
                      currentQuestion.advancedFormat === 'matrix' ||
                      currentQuestion.advancedFormat === 'paragraph')
                      ? 3
                      : 4}{' '}
                    Correct
                  </span>
                  <span className="text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg">
                    {isNumericalQ && examMode !== 'JEE Advanced'
                      ? '-1 Negative'
                      : isNumericalQ
                      ? '0 Negative (JEE Adv Numerical)'
                      : isMultipleQ
                      ? '-2 Negative'
                      : '-1 Negative'}
                  </span>
                  {isMultipleQ && (
                    <span className="text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                      +3 / +2 / +1 Partial Marks
                    </span>
                  )}
                </div>
              </div>

              {/* JEE Advanced Paragraph / Comprehension Context Box */}
              {currentQuestion.paragraphContext && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs sm:text-sm text-slate-800 space-y-1.5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                    JEE Advanced Paragraph / Comprehension Stem
                  </div>
                  <MathRichText content={currentQuestion.paragraphContext} />
                </div>
              )}

              {/* JEE Advanced Matrix-Match List-I / List-II Table */}
              {currentQuestion.matrixListI && currentQuestion.matrixListII && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl bg-indigo-50/40 border border-indigo-200/80 text-xs">
                  <div>
                    <div className="font-extrabold uppercase tracking-wider text-indigo-800 mb-2">
                      List-I
                    </div>
                    <div className="space-y-1.5">
                      {currentQuestion.matrixListI.map((item, i) => (
                        <div key={i} className="p-2 rounded-lg bg-white border border-slate-200">
                          <MathRichText content={item} inline />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-extrabold uppercase tracking-wider text-indigo-800 mb-2">
                      List-II
                    </div>
                    <div className="space-y-1.5">
                      {currentQuestion.matrixListII.map((item, i) => (
                        <div key={i} className="p-2 rounded-lg bg-white border border-slate-200">
                          <MathRichText content={item} inline />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Rendered Question Stem */}
              <div className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
                <MathRichText
                  content={
                    examLanguage === 'Hindi' && currentQuestion.stemHindi
                      ? currentQuestion.stemHindi
                      : currentQuestion.stem
                  }
                />
              </div>

              {/* Options or Section B Numerical Keypad */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {!isNumericalQ && (
                  <div className="lg:col-span-12 space-y-3">
                    {isMultipleQ && (
                      <div className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg inline-block">
                        JEE Advanced One-or-More-Than-One Correct: Select all correct options (+4 full, +1 partial per correct option)
                      </div>
                    )}
                    {currentQuestion.options.map((opt, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isChecked = isMultipleQ
                        ? (currentResponse.selectedOptions || []).includes(idx)
                        : currentResponse.selectedOption === idx;

                      return (
                        <div
                          key={letter}
                          role={isMultipleQ ? 'checkbox' : 'radio'}
                          aria-checked={isChecked}
                          tabIndex={0}
                          onClick={() =>
                            isMultipleQ
                              ? handleToggleMultipleOption(idx)
                              : handleSelectSingleOption(idx)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              if (isMultipleQ) handleToggleMultipleOption(idx);
                              else handleSelectSingleOption(idx);
                            }
                          }}
                          className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer max-w-2xl ${
                            isChecked
                              ? 'border-indigo-600 bg-indigo-50/60'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 ${
                              isMultipleQ ? 'rounded-md' : 'rounded-full'
                            } border flex items-center justify-center ${
                              isChecked
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-400'
                            }`}
                          >
                            {isChecked && <span className="text-xs font-bold">✓</span>}
                          </span>
                          <span className="text-sm font-extrabold text-slate-800">
                            ({letter})
                          </span>
                          <div className="text-sm sm:text-base font-medium text-slate-900">
                            <MathRichText content={opt} inline />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {isNumericalQ && (
                  <div className="lg:col-span-6 bg-slate-50 rounded-2xl border border-slate-200 p-5 max-w-sm">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 mb-2">
                      Numerical Value Response (
                      {examMode === 'JEE Advanced' ? '0 Negative Marking' : '+4 / -1 NTA Marking'})
                    </div>
                    <input
                      type="text"
                      readOnly
                      value={currentResponse.numericalValue || ''}
                      placeholder="Enter numerical value..."
                      className="w-full px-3.5 py-2.5 rounded-xl border-2 border-indigo-300 bg-white font-mono text-base font-extrabold text-slate-900 mb-3"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '-'].map(
                        (digit) => (
                          <button
                            key={digit}
                            type="button"
                            onClick={() => handleNumericalKeyPress(digit)}
                            className="py-2.5 rounded-lg bg-white border border-slate-200 hover:bg-indigo-50 font-mono text-sm font-extrabold text-slate-800 cursor-pointer"
                          >
                            {digit}
                          </button>
                        )
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => handleNumericalKeyPress('BACKSPACE')}
                        className="py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold cursor-pointer"
                      >
                        Backspace
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNumericalKeyPress('CLEAR')}
                        className="py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-extrabold cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right 3 Cols: Candidate Info & 5-State NTA Palette */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3.5 shadow-2xs">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-900">
                {candidateName || 'Candidate'}
              </div>
              <div className="text-xs text-slate-500">
                {examMode} • {questionsList.length} Questions
              </div>
            </div>
          </div>

          {/* 5-State Legend */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 text-xs font-medium text-slate-700 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-slate-200 border border-slate-300 inline-block" />
                Not Visited
              </span>
              <span className="font-extrabold">{livePaletteCounts.not_visited}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#DC2626] inline-block" />
                Not Answered
              </span>
              <span className="font-extrabold">{livePaletteCounts.not_answered}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#16A34A] inline-block" />
                Answered
              </span>
              <span className="font-extrabold">{livePaletteCounts.answered}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#7C3AED] inline-block" />
                Marked for Review
              </span>
              <span className="font-extrabold">{livePaletteCounts.marked}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#7C3AED] text-white text-[9px] inline-flex items-center justify-center">
                  ✓
                </span>
                Answered &amp; Marked
              </span>
              <span className="font-extrabold">{livePaletteCounts.answered_marked}</span>
            </div>
          </div>

          {/* Question Palette Grid */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs max-h-[380px] overflow-y-auto">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-3">
              {activeSubject} • {examMode === 'JEE Main' ? activeSection : 'Paper 1'} Palette
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {subjectQuestions.map((q) => {
                const st = responses[q.id]?.status || 'not_visited';
                const isCurrent = currentQNumber === q.number;

                let btnStyle = 'bg-slate-200 text-slate-800 border-slate-300';
                if (st === 'answered') {
                  btnStyle = 'bg-[#16A34A] text-white border-[#15803D]';
                } else if (st === 'not_answered') {
                  btnStyle = 'bg-[#DC2626] text-white border-[#B91C1C]';
                } else if (st === 'marked' || st === 'answered_marked') {
                  btnStyle = 'bg-[#7C3AED] text-white border-[#6D28D9]';
                }

                if (isCurrent) {
                  btnStyle =
                    'bg-[#EEF2FF] text-[#1D3587] border-2 border-[#3B5BDB] ring-2 ring-indigo-500/20';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleJumpToQuestion(q.number)}
                    className={`relative h-9 rounded-lg font-extrabold text-xs border transition-all flex items-center justify-center cursor-pointer ${btnStyle}`}
                  >
                    {q.number}
                    {st === 'answered_marked' && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white text-[8px] flex items-center justify-center">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleMarkForReviewAndNext}
            className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-extrabold text-slate-800 cursor-pointer"
          >
            Mark for Review &amp; Next
          </button>
          <button
            type="button"
            onClick={handleClearResponse}
            className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-extrabold text-slate-800 cursor-pointer"
          >
            Clear Response
          </button>
        </div>

        <div className="flex items-center gap-3">
          {submitCbtError && (
            <span className="text-xs font-bold text-rose-600">{submitCbtError}</span>
          )}
          <button
            type="button"
            onClick={handleSaveAndNext}
            className="px-6 py-2.5 rounded-xl bg-[#2B3A99] hover:bg-[#1E2A78] text-white text-xs font-extrabold cursor-pointer"
          >
            Save &amp; Next
          </button>
          <button
            type="button"
            disabled={submittingCbt}
            onClick={handleTriggerSubmit}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-extrabold cursor-pointer"
          >
            {submittingCbt ? 'Grading on Server...' : 'Submit Exam'}
          </button>
        </div>
      </footer>

      {/* Instructions Modal */}
      {showInstructionsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900">
              {examMode} Official Marking &amp; Evaluation Rules
            </h3>
            <ul className="space-y-2 text-xs text-slate-600 list-disc pl-5 leading-relaxed">
              <li>
                <strong>JEE Main Section A (MCQs):</strong> +4 for correct, -1 negative marking.
              </li>
              <li>
                <strong>JEE Main Section B (5 Compulsory Numericals per subject):</strong> +4 for correct, <strong>-1 negative marking</strong> per official NTA JEE Main 2027 Paper 1 rules.
              </li>
              <li>
                <strong>JEE Advanced Multiple-Choice:</strong> +4 if all correct options chosen, +1 partial mark per correct option if no wrong option is chosen, -2 if any wrong option is chosen.
              </li>
              <li>
                Questions Marked for Review WITH a saved answer are evaluated for marks per NTA rules.
              </li>
            </ul>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowInstructionsModal(false)}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-extrabold cursor-pointer"
              >
                Resume Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Submit Question-by-Question Time-Spent & Marks Accuracy Report Modal */}
      {submittedSummary && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-[#243B82] text-white flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-200">
                  {examMode} QUESTION-BY-QUESTION TIME &amp; ACCURACY REPORT
                </span>
                <h3 className="text-2xl font-extrabold">
                  Score: {submittedSummary.totalScore} / {submittedSummary.maxScore}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-300/30">
                  Correct: {submittedSummary.correctCount}
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-300/30">
                  Incorrect: {submittedSummary.incorrectCount}
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20">
                  Accuracy: {submittedSummary.accuracyPct}%
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {questionsList.map((q) => {
                const detail = submittedSummary.questionDetails?.find(
                  (d) => d.questionId === q.id
                );
                const isPartial =
                  detail && detail.isAttempted && !detail.isCorrect && detail.marksAwarded > 0;
                return (
                  <div
                    key={q.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-indigo-700">
                        Q{q.number} • {q.subject} ({q.chapter}) • Time Spent:{' '}
                        {detail?.timeSpentSec || 0}s
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                          detail?.isCorrect
                            ? 'bg-emerald-100 text-emerald-800'
                            : isPartial
                            ? 'bg-amber-100 text-amber-800'
                            : detail?.isAttempted
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {detail && detail.isAttempted
                          ? `${detail.marksAwarded >= 0 ? `+${detail.marksAwarded}` : detail.marksAwarded} (${
                              detail.isCorrect ? 'CORRECT' : isPartial ? 'PARTIAL' : 'INCORRECT'
                            })`
                          : '0 Unattempted'}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-slate-900">
                      <MathRichText content={q.stem} />
                    </div>

                    <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80">
                      <strong className="text-slate-900 block mb-1">
                        Server-Verified Step-by-Step Solution:
                      </strong>
                      <MathRichText
                        content={serverSolutions[q.id]?.explanation || q.explanation}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Incorrect questions have been automatically logged to your Mistakes Notebook.
              </span>
              <button
                type="button"
                onClick={() => onSubmitMock(submittedSummary, focusEvents, questionsList, responses)}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer"
              >
                Finish &amp; Go to Progress Dashboard →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
