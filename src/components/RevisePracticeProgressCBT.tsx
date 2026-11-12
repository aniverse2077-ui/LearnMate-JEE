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
} from 'lucide-react';
import {
  MindMapNodeItem,
  OFFICIAL_PAPERS_LIST,
  CBT_MOCK_QUESTIONS,
  JEE_ADVANCED_PAPER_QUESTIONS,
  MaterialStudyBundle,
  StickyNoteData,
} from '../data/jeeInitialContent';
import {
  CBTQuestion,
  CBTQuestionResponse,
  CBTMockSummary,
  QuestionAttemptDetail,
  calculateCBTMockSummary,
  formatCountdownTimer,
  calculateNextSRSReview,
} from '../utils/jeeEngine';
import { MathRichText } from './MathRichText';
import { MaterialItem } from './HomeAndStudyViews';

export interface MistakeNotebookEntry {
  id: string;
  question: CBTQuestion;
  userAnswer: string;
  loggedAt: string;
  source: 'CBT Mock' | 'PYQ Bank' | 'Adaptive Drill';
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

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6 space-y-6">
      {/* Header & Material Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Revise &amp; Active Recall Studio
            </h1>
            {activeMaterial && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                {activeMaterial.subject} • {activeMaterial.chapter}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Multi-level KaTeX mind maps, 4-font handwritten notebook converter, 3D flashcards &amp; mistake DNA
          </p>
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
              Your revision workspace starts completely clean with zero preloaded chapters. Upload any PDF, handwritten notebook photo, or up-to-12-hour YouTube lecture to automatically build multi-level KaTeX mind maps, handwritten revision sheets, sticky notes, and 3D flashcards.
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
                            KaTeX Mathematical Expression
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
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">
                      HANDWRITTEN NOTEBOOK CONVERTER &amp; OCR STUDIO
                    </span>
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                      Convert Notes, Sticky Notes &amp; Quick Sheets into Topper Handwriting
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
                      Page 1 • JEE KaTeX Verified
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
                  placeholder="Sticky note with KaTeX ($W = -nC_V\Delta T$)..."
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
          {/* SUB-TAB 6: FORMULA BOOK (KATEX)                                   */}
          {/* ================================================================= */}
          {activeSubTab === 'Formula Book' && activeMaterial && activeBundle && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {activeBundle.formulas.map((fc) => (
                <div
                  key={fc.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold">
                      {fc.subject} • {fc.chapter}
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {fc.title}
                  </h3>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                    <MathRichText content={fc.formula} />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <MathRichText content={fc.notes} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 7: MISTAKE DNA (AUTO-LOGGED MISTAKES NOTEBOOK)            */}
      {/* ================================================================= */}
      {activeSubTab === 'Mistake DNA' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600">
                AUTO-LOGGED MISTAKE DNA NOTEBOOK
              </span>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Questions You Answered Incorrectly Across CBT Mocks &amp; PYQ Drills
              </h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-extrabold">
              {mistakesNotebook.length} Logged Mistakes
            </span>
          </div>

          {mistakesNotebook.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                Zero Logged Mistakes Yet!
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Whenever you get a question wrong in an NTA CBT Mock Test, Chapter Quiz, or PYQ Bank, it is automatically captured here with its step-by-step KaTeX derivation.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {mistakesNotebook.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 rounded-2xl border border-rose-200/80 bg-rose-50/30 dark:bg-rose-950/20 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-rose-700">
                      {entry.source} • {entry.question.subject} ({entry.question.chapter})
                    </span>
                    <span className="text-[11px] text-slate-500">{entry.loggedAt}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    <MathRichText content={entry.question.stem} />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <span className="text-rose-700 font-semibold">
                      Your Answer: <MathRichText content={entry.userAnswer} inline />
                    </span>
                    <span className="text-emerald-700 font-bold">
                      Correct Key:{' '}
                      <MathRichText
                        content={
                          entry.question.section === 'Section B' ||
                          entry.question.advancedFormat === 'numerical'
                            ? String(entry.question.numericalAnswer)
                            : entry.question.options[entry.question.correctIndex] || ''
                        }
                        inline
                      />
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white block mb-1">
                      Step-by-Step KaTeX Solution:
                    </strong>
                    <MathRichText content={entry.question.explanation} />
                  </div>
                  {onPracticeQuestion && (
                    <button
                      type="button"
                      onClick={() => onPracticeQuestion(entry.question)}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer"
                    >
                      Retry Question Now →
                    </button>
                  )}
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
// 2. PRACTICE DASHBOARD VIEW (Marks-Style Buckets + Custom Test Builder + Mistakes)
// ============================================================================
interface PracticeViewProps {
  onStartCBTMock: (examMode?: 'JEE Main' | 'JEE Advanced') => void;
  onOpenInstantPractice: (paperTitle: string, customQuestions?: CBTQuestion[]) => void;
  mistakesNotebook?: MistakeNotebookEntry[];
  onRecordMistake?: (question: CBTQuestion, userAnswer: string) => void;
}

export const PracticeDashboardView: React.FC<PracticeViewProps> = ({
  onStartCBTMock,
  onOpenInstantPractice,
  mistakesNotebook = [],
  onRecordMistake,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'Official Papers' | 'PYQs' | 'Custom Set' | 'Analysis'
  >('Official Papers');
  const [paperFilter, setPaperFilter] = useState<
    'All' | 'JEE Main' | 'JEE Advanced' | '2026' | '2025' | '2024'
  >('All');

  // PYQ Bank Filters (Including MathonGo Marks-style Buckets)
  const [pyqSubjectFilter, setPyqSubjectFilter] = useState<
    'All' | 'Physics' | 'Chemistry' | 'Mathematics'
  >('All');
  const [pyqBucketFilter, setPyqBucketFilter] = useState<
    'All' | 'Beginner' | 'Must-Do' | 'Advanced Climb'
  >('All');
  const [selectedPyqOptions, setSelectedPyqOptions] = useState<Record<string, number>>({});
  const [revealedPyqSolutions, setRevealedPyqSolutions] = useState<Record<string, boolean>>({});

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
    if (paperFilter === 'All') return true;
    if (paperFilter === 'JEE Main') return !isAdv;
    if (paperFilter === 'JEE Advanced') return isAdv;
    return String(p.year) === paperFilter;
  });

  const combinedPyqPool = [...CBT_MOCK_QUESTIONS.slice(0, 30), ...JEE_ADVANCED_PAPER_QUESTIONS];
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
    <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6 space-y-6">
      {/* Sub-Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3.5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Practice &amp; Official NTA CBT Hub
          </h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
            75-Q JEE Main &amp; JEE Advanced Paper 1/2
          </span>
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

      {/* Hero Banner with Dual Exam Launchers (75-Q JEE Main + JEE Advanced Paper 1/2) */}
      <div className="bg-gradient-to-r from-[#243B82] via-[#2E4696] to-[#3B5BDB] rounded-3xl p-6 lg:p-8 text-white shadow-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-[11px] font-extrabold uppercase tracking-wider">
            2025/2026 NTA &amp; JAB OFFICIAL MARKING ENGINE
          </span>
          <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
            Full 75-Question JEE Main CBT &amp; Multi-Format JEE Advanced CBT
          </h2>
          <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed">
            Experience the exact NTA 5-state palette: 25 Physics, 25 Chemistry &amp; 25 Mathematics questions (Section B numericals with <strong>0 negative marking</strong>), or JEE Advanced Paper 1 &amp; 2 with partial marking (+4 / -2, +1 per correct option).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onStartCBTMock('JEE Main')}
            className="px-5 py-3 rounded-2xl bg-white text-[#1E3272] hover:bg-indigo-50 text-xs font-extrabold shadow-sm transition-all cursor-pointer"
          >
            Launch 75-Q JEE Main CBT →
          </button>
          <button
            type="button"
            onClick={() => onStartCBTMock('JEE Advanced')}
            className="px-5 py-3 rounded-2xl bg-amber-400 text-slate-950 hover:bg-amber-300 text-xs font-extrabold shadow-sm transition-all cursor-pointer"
          >
            Launch JEE Advanced Paper 1 CBT →
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: OFFICIAL PAPERS */}
      {activeSubTab === 'Official Papers' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['All', 'JEE Main', 'JEE Advanced', '2026', '2025', '2024'] as const).map((f) => (
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
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {isAdv ? 'JEE Advanced' : 'JEE Main'}
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
                      onClick={() => onStartCBTMock(isAdv ? 'JEE Advanced' : 'JEE Main')}
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
              const isRevealed = !!revealedPyqSolutions[q.id];
              const isCorrect = chosen === q.correctIndex;
              return (
                <div
                  key={q.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
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
                    </div>
                    <span className="text-xs font-bold text-slate-500">
                      {q.section === 'Section B' ? '+4 / 0 (Numerical)' : '+4 / -1'}
                    </span>
                  </div>

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
                          if (optIdx === q.correctIndex) {
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
                            onClick={() => {
                              setSelectedPyqOptions((prev) => ({ ...prev, [q.id]: optIdx }));
                              setRevealedPyqSolutions((prev) => ({ ...prev, [q.id]: true }));
                              if (optIdx !== q.correctIndex && onRecordMistake) {
                                onRecordMistake(q, opt);
                              }
                            }}
                            className={`p-3 rounded-xl border text-left text-xs sm:text-sm font-medium flex items-center justify-between cursor-pointer ${cls}`}
                          >
                            <span className="flex items-center gap-2">
                              <strong>({String.fromCharCode(65 + optIdx)})</strong>
                              <MathRichText content={opt} inline />
                            </span>
                            {isRevealed && optIdx === q.correctIndex && (
                              <span className="text-[11px] font-extrabold text-emerald-700">
                                ✓ Correct
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {isRevealed && (
                    <div
                      className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                        isCorrect
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                          : 'bg-amber-50/70 border-amber-200 text-amber-950'
                      }`}
                    >
                      <div className="font-extrabold">
                        {isCorrect
                          ? 'Correct! Verified KaTeX Derivation:'
                          : 'Added to My Mistakes Notebook — Verified KaTeX Solution:'}
                      </div>
                      <MathRichText content={q.explanation} />
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
    <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6 space-y-6">
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
  initialExamMode?: 'JEE Main' | 'JEE Advanced';
  onSubmitMock: (summary: CBTMockSummary, focusEvents: number) => void;
  onExitMock: () => void;
  onRecordMistake?: (question: CBTQuestion, userAnswer: string) => void;
}

export const CBTMockExamView: React.FC<CBTMockExamProps> = ({
  candidateName,
  initialExamMode = 'JEE Main',
  onSubmitMock,
  onExitMock,
  onRecordMistake,
}) => {
  const [examMode, setExamMode] = useState<'JEE Main' | 'JEE Advanced'>(initialExamMode);
  const questionsList =
    examMode === 'JEE Advanced' ? JEE_ADVANCED_PAPER_QUESTIONS : CBT_MOCK_QUESTIONS;

  const [activeSubject, setActiveSubject] = useState<'Physics' | 'Chemistry' | 'Mathematics'>(
    'Physics'
  );
  const [activeSection, setActiveSection] = useState<'Section A' | 'Section B'>('Section A');
  const [currentQNumber, setCurrentQNumber] = useState<number>(1);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3 * 3600);
  const [focusEvents, setFocusEvents] = useState<number>(0);
  const [examLanguage, setExamLanguage] = useState<'English' | 'Hindi'>('English');
  const [showInstructionsModal, setShowInstructionsModal] = useState<boolean>(false);
  const [submittedSummary, setSubmittedSummary] = useState<CBTMockSummary | null>(null);

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

  const [responses, setResponses] = useState<Record<string, CBTQuestionResponse>>(() =>
    buildInitialResponses(questionsList)
  );

  // Reset responses when switching exam mode
  const handleSwitchExamMode = (mode: 'JEE Main' | 'JEE Advanced') => {
    const nextList = mode === 'JEE Advanced' ? JEE_ADVANCED_PAPER_QUESTIONS : CBT_MOCK_QUESTIONS;
    setExamMode(mode);
    setActiveSubject('Physics');
    setActiveSection('Section A');
    setCurrentQNumber(1);
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

  // Tab blur focus-event detector
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setFocusEvents((f) => f + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

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
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...currentResponse,
        status: answered ? 'answered' : 'not_answered',
      },
    }));
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

  const handleTriggerSubmit = () => {
    const summary = calculateCBTMockSummary(questionsList, responses);
    setSubmittedSummary(summary);
    if (onRecordMistake && summary.questionDetails) {
      summary.questionDetails.forEach((detail: QuestionAttemptDetail) => {
        if (detail.isAttempted && !detail.isCorrect) {
          const qObj = questionsList.find((q) => q.id === detail.questionId);
          if (qObj) {
            onRecordMistake(qObj, detail.userAnswerLabel || 'Incorrect CBT Response');
          }
        }
      });
    }
  };

  const summaryLive = calculateCBTMockSummary(questionsList, responses);

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 flex flex-col">
      {/* Top Official NTA CBT Bar */}
      <header className="bg-[#243B82] text-white px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded bg-white/15 text-[11px] font-extrabold uppercase tracking-wider">
            NTA / JAB OFFICIAL CBT CONSOLE
          </span>
          <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl">
            {(['JEE Main', 'JEE Advanced'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleSwitchExamMode(m)}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer ${
                  examMode === m ? 'bg-white text-[#243B82]' : 'text-indigo-100 hover:bg-white/10'
                }`}
              >
                {m === 'JEE Main' ? 'JEE Main (75 Qs)' : 'JEE Advanced Paper 1'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
          <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-300" />
            <span>Time Left:</span>
            <span className="font-mono text-sm font-extrabold text-amber-300">
              {formatCountdownTimer(secondsRemaining)}
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15">
            Focus Events: <span className="font-extrabold text-amber-300">{focusEvents}</span>
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
            Exit CBT
          </button>
        </div>
      </header>

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
                        : 'Section B (5 Numericals • +4 / 0 No Neg)'}
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
                </div>

                <div className="flex items-center gap-3 text-xs font-extrabold">
                  <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                    +{examMode === 'JEE Advanced' && (currentQuestion.advancedFormat === 'single' || currentQuestion.advancedFormat === 'matrix') ? 3 : 4} Correct
                  </span>
                  <span className="text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg">
                    {isNumericalQ
                      ? '0 Negative (2025/26 NTA Rule)'
                      : isMultipleQ
                      ? '-2 Negative'
                      : '-1 Negative'}
                  </span>
                  {isMultipleQ && (
                    <span className="text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                      +1 Partial Marks / Option
                    </span>
                  )}
                </div>
              </div>

              {/* KaTeX Rendered Question Stem */}
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
                          onClick={() =>
                            isMultipleQ
                              ? handleToggleMultipleOption(idx)
                              : handleSelectSingleOption(idx)
                          }
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
                      Numerical Value Response (No Negative Marking)
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
              <span className="font-extrabold">{summaryLive.paletteCounts.not_visited}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#DC2626] inline-block" />
                Not Answered
              </span>
              <span className="font-extrabold">{summaryLive.paletteCounts.not_answered}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#16A34A] inline-block" />
                Answered
              </span>
              <span className="font-extrabold">{summaryLive.paletteCounts.answered}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#7C3AED] inline-block" />
                Marked for Review
              </span>
              <span className="font-extrabold">{summaryLive.paletteCounts.marked}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#7C3AED] text-white text-[9px] inline-flex items-center justify-center">
                  ✓
                </span>
                Answered &amp; Marked
              </span>
              <span className="font-extrabold">{summaryLive.paletteCounts.answered_marked}</span>
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
          <button
            type="button"
            onClick={handleSaveAndNext}
            className="px-6 py-2.5 rounded-xl bg-[#2B3A99] hover:bg-[#1E2A78] text-white text-xs font-extrabold cursor-pointer"
          >
            Save &amp; Next
          </button>
          <button
            type="button"
            onClick={handleTriggerSubmit}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
          >
            Submit Exam
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
                <strong>JEE Main Section B (5 Compulsory Numericals per subject):</strong> +4 for correct, <strong>0 negative marking</strong> per 2025/2026 NTA official rules.
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
                        Verified KaTeX Step-by-Step Solution:
                      </strong>
                      <MathRichText content={q.explanation} />
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
                onClick={() => onSubmitMock(submittedSummary, focusEvents)}
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
