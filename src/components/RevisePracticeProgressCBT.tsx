import React, { useEffect, useState } from 'react';
import {
  Eye,
  FileText,
  Download,
  Maximize2,
  Play,
  Plus,
  CheckCircle2,
  Flame,
  Clock,
  Zap,
  Award,
  Printer,
  Share2,
  Info,
  User as UserIcon,
  Volume2,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import {
  D_AND_F_MIND_MAP_NODES,
  MindMapNodeItem,
  OFFICIAL_PAPERS_LIST,
  CHAPTER_ANALYSIS_DEFAULT,
  CBT_MOCK_QUESTIONS,
  INITIAL_CBT_RESPONSES,
} from '../data/jeeInitialContent';
import {
  CBTQuestion,
  QuestionResponseState,
  applyQuestionAction,
  calculateCBTMockScore,
  CBTMockSummary,
} from '../utils/jeeEngine';

// ============================================================================
// 1. Revise View (Exact Match for Screen 5: d___f_Block_Revision_Mind_Map-4)
// ============================================================================
interface ReviseViewProps {
  customCards: { id: string; title: string; definition: string; trap: string }[];
  onAddFlashcard: (node: MindMapNodeItem) => Promise<void>;
  onExportToSlides: (chapterTitle: string, nodes: MindMapNodeItem[]) => void;
  onExportToKeep: (chapterTitle: string, nodes: MindMapNodeItem[]) => void;
}

export const ReviseWorkspaceView: React.FC<ReviseViewProps> = ({
  customCards,
  onAddFlashcard,
  onExportToSlides,
  onExportToKeep,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    | 'Flashcards'
    | 'Sticky Notes'
    | 'Mind Map'
    | 'Summary Sheet'
    | 'Handwritten Notes'
    | 'Mistake DNA'
    | 'Formula Book'
  >('Mind Map');
  const [selectedChapter, setSelectedChapter] = useState('d & f Block');
  const [selectedNode, setSelectedNode] = useState<MindMapNodeItem>(D_AND_F_MIND_MAP_NODES[0]);
  const [zoomPct, setZoomPct] = useState(100);
  const [reviewingAudio, setReviewingAudio] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);

  const handleReview2MinAudio = async () => {
    setReviewingAudio(true);
    try {
      const summaryScript = D_AND_F_MIND_MAP_NODES.map(
        (n) => `${n.title}: ${n.definition} Common trap: ${n.commonTrap}`
      ).join('. ');
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: summaryScript }),
      });
      const data = await res.json();
      if (data.audioBase64) {
        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
        const ctx = new AudioContext({ sampleRate: 24000 });
        const buf = ctx.createBuffer(1, float32.length, 24000);
        buf.getChannelData(0).set(float32);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.onended = () => setReviewingAudio(false);
        src.start();
      } else {
        setReviewingAudio(false);
      }
    } catch {
      setReviewingAudio(false);
    }
  };

  const handleDownloadTxt = () => {
    const content = D_AND_F_MIND_MAP_NODES.map(
      (n) =>
        `## ${n.title} (${n.pageRef})\nDefinition: ${n.definition}\nExample: ${n.example}\nCommon Trap: ${n.commonTrap}\n`
    ).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedChapter.replace(/\s+/g, '_')}_Revision_Notes.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Header matching Screen 5 + Google Slides / Keep Export */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-wider uppercase text-[#4F46E5]">
            REVISE
          </div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
            Revise
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('Summary Sheet')}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-[#4F46E5]" />
            <span>Preview Notes</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadTxt}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>TXT</span>
          </button>
          <button
            type="button"
            onClick={() => onExportToSlides(selectedChapter, D_AND_F_MIND_MAP_NODES)}
            className="px-3.5 py-2 rounded-xl bg-indigo-50 text-[#4F46E5] border border-indigo-200 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-indigo-100 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Export to Slides</span>
          </button>
          <button
            type="button"
            onClick={() => onExportToKeep(selectedChapter, D_AND_F_MIND_MAP_NODES)}
            className="px-3.5 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-amber-100 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Save to Keep</span>
          </button>
        </div>
      </div>

      {/* 7 Sub-Tabs matching Screen 5 */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto">
        {(
          [
            'Flashcards',
            'Sticky Notes',
            'Mind Map',
            'Summary Sheet',
            'Handwritten Notes',
            'Mistake DNA',
            'Formula Book',
          ] as const
        ).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveSubTab(tab)}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeSubTab === tab
                ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeSubTab === 'Mind Map' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Mind Map Canvas (8 Cols) matching Screen 5 */}
          <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5 shadow-2xs">
            {/* Canvas Top Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <select
                aria-label="Mind Map Chapter"
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-[#EEF2FF] text-[#4F46E5] font-bold text-xs border border-indigo-200 focus:outline-none cursor-pointer"
              >
                <option value="d & f Block">d &amp; f Block</option>
                <option value="Electrochemistry">Electrochemistry</option>
                <option value="Laws of Motion">Laws of Motion</option>
              </select>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setZoomPct(100)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  Fit
                </button>
                <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setZoomPct((z) => Math.max(75, z - 15))}
                    className="px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer"
                  >
                    −
                  </button>
                  <span className="px-3 py-1.5 border-x border-slate-200 font-mono tabular-nums">
                    {zoomPct}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomPct((z) => Math.min(130, z + 15))}
                    className="px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  disabled={reviewingAudio}
                  onClick={handleReview2MinAudio}
                  className="px-3.5 py-1.5 rounded-lg bg-[#EEF2FF] text-[#4F46E5] font-semibold inline-flex items-center gap-1.5 hover:bg-indigo-100 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{reviewingAudio ? 'Playing Review...' : 'Review 2 min'}</span>
                </button>
              </div>
            </div>

            {/* Interactive Mind Map Node Graph matching Screen 5 */}
            <div
              className="relative min-h-[430px] flex flex-col justify-between py-6 px-2 sm:px-6 transition-transform"
              style={{ transform: `scale(${zoomPct / 100})` }}
            >
              {/* SVG Curved Connector Lines Behind Nodes */}
              <svg
                viewBox="0 0 800 400"
                className="hidden md:block absolute inset-0 w-full h-full pointer-events-none"
              >
                <path
                  d="M 270,105 C 345,105 350,185 350,195"
                  fill="none"
                  stroke="#A5B4FC"
                  strokeWidth="2.5"
                />
                <path
                  d="M 530,105 C 455,105 450,185 450,195"
                  fill="none"
                  stroke="#A5B4FC"
                  strokeWidth="2.5"
                />
                <path
                  d="M 270,305 C 345,305 350,220 350,205"
                  fill="none"
                  stroke="#A5B4FC"
                  strokeWidth="2.5"
                />
                <path
                  d="M 530,305 C 455,305 450,220 450,205"
                  fill="none"
                  stroke="#A5B4FC"
                  strokeWidth="2.5"
                />
              </svg>

              {/* Top Row Nodes: Transition metals & Group 12 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-24 z-10">
                {D_AND_F_MIND_MAP_NODES.slice(0, 2).map((node) => {
                  const isSelected = selectedNode.id === node.id;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedNode(node)}
                      className={`text-left p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                        node.colorClass
                      } ${
                        isSelected
                          ? `${node.borderClass} shadow-md ring-2 ring-indigo-500/20`
                          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <h3 className="font-display font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                        {node.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                        {node.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Center Hub Pill: d & f Block */}
              <div className="my-6 flex justify-center z-10">
                <div className="px-8 py-4 rounded-full bg-[#EEF2FF] dark:bg-indigo-950 border-2 border-[#4F46E5] shadow-md">
                  <span className="font-display font-extrabold text-xl text-slate-900 dark:text-white">
                    {selectedChapter}
                  </span>
                </div>
              </div>

              {/* Bottom Row Nodes: Lanthanoid contraction & Oxidation states */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-24 z-10">
                {D_AND_F_MIND_MAP_NODES.slice(2, 4).map((node) => {
                  const isSelected = selectedNode.id === node.id;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedNode(node)}
                      className={`text-left p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                        node.colorClass
                      } ${
                        isSelected
                          ? `${node.borderClass} shadow-md ring-2 ring-indigo-500/20`
                          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <h3 className="font-display font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                        {node.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                        {node.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Node Inspector Card (4 Cols) matching Screen 5 */}
          <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-extrabold text-xl text-slate-900 dark:text-white">
                {selectedNode.title}
              </h2>
              <span className="px-3 py-1 rounded-lg bg-[#EEF2FF] text-[#4F46E5] text-xs font-bold">
                {selectedNode.pageRef}
              </span>
            </div>

            <div className="space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-xs font-bold">
                Definition
              </span>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                {selectedNode.definition}
              </div>
            </div>

            <div className="space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5] text-xs font-bold">
                Example
              </span>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-mono">
                {selectedNode.example}
              </div>
            </div>

            <div className="space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs font-bold">
                Common Trap
              </span>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                {selectedNode.commonTrap}
              </div>
            </div>

            {addedFeedback && (
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold text-center">
                {addedFeedback}
              </div>
            )}

            <button
              type="button"
              onClick={async () => {
                await onAddFlashcard(selectedNode);
                setAddedFeedback(`Added "${selectedNode.title}" to Flashcards!`);
                setTimeout(() => setAddedFeedback(null), 2500);
              }}
              className="w-full py-3 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Cards</span>
            </button>
          </div>
        </div>
      )}

      {activeSubTab !== 'Mind Map' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            ...D_AND_F_MIND_MAP_NODES.map((n) => ({
              id: n.id,
              title: n.title,
              definition: n.definition,
              trap: n.commonTrap,
            })),
            ...customCards,
          ].map((card, i) => (
            <div
              key={`${card.id}-${i}`}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5] text-[11px] font-bold">
                  {activeSubTab}
                </span>
                <span className="text-xs text-slate-400">d &amp; f Block</span>
              </div>
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                {card.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {card.definition}
              </p>
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 text-xs text-amber-900 dark:text-amber-200">
                <strong>JEE Trap:</strong> {card.trap}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. Practice View (Exact Match for Screen 7: LearnMate_JEE_Practice_Dashboard-2)
// ============================================================================
interface PracticeViewProps {
  onStartCBTMock: () => void;
}

export const PracticeDashboardView: React.FC<PracticeViewProps> = ({ onStartCBTMock }) => {
  const [examLevel, setExamLevel] = useState<'Main' | 'Advanced'>('Main');
  const [subTab, setSubTab] = useState<'PYQs' | 'Mock Tests' | 'Custom Set' | 'Analysis'>('PYQs');
  const [yearFilter, setYearFilter] = useState('2024');
  const [sessionFilter, setSessionFilter] = useState('All Sessions');
  const [shiftFilter, setShiftFilter] = useState('All Shifts');
  const [chapterFilter, setChapterFilter] = useState('All Chapters');

  // My Notes Set Builder state
  const [builderMaterial, setBuilderMaterial] = useState('d & f Block – Handwritten Notes');
  const [builderTopic, setBuilderTopic] = useState('All Topics');
  const [builderCount, setBuilderCount] = useState<5 | 10 | 15 | 20>(10);
  const [builderDiff, setBuilderDiff] = useState<'Mixed' | 'Easy' | 'Moderate' | 'Hard'>('Mixed');
  const [builderType, setBuilderType] = useState<'Single Choice' | 'Numerical'>('Single Choice');
  const [customQuizOutput, setCustomQuizOutput] = useState<string | null>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);

  const filteredPapers = OFFICIAL_PAPERS_LIST.filter((p) => {
    if (sessionFilter !== 'All Sessions' && p.session !== sessionFilter) return false;
    if (shiftFilter !== 'All Shifts' && p.shift !== shiftFilter) return false;
    return true;
  });

  const handleGenerateCustomPractice = async () => {
    setGeneratingQuiz(true);
    setCustomQuizOutput(null);
    try {
      const res = await fetch('/api/ai/think', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generate ${builderCount} JEE ${examLevel} (${builderDiff}, ${builderType}) practice questions with answers and brief step-by-step solutions from "${builderMaterial}" (${builderTopic}).`,
          language: 'English',
          mode: 'Notes + JEE',
        }),
      });
      const data = await res.json();
      setCustomQuizOutput(data.text || 'Generated custom practice set.');
    } finally {
      setGeneratingQuiz(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Header matching Screen 7 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-wider uppercase text-[#4F46E5]">
            PRACTICE
          </div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
            Practice
          </h1>
        </div>

        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
          {(['Main', 'Advanced'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setExamLevel(lvl)}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                examLevel === lvl
                  ? 'bg-[#EEF2FF] text-[#4F46E5] shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-Tabs matching Screen 7 */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
        {(['PYQs', 'Mock Tests', 'Custom Set', 'Analysis'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            className={`px-4 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              subTab === t
                ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 2-Column Split matching Screen 7 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. JEE Main CBT (Full Mock) Banner Card */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
            <div className="space-y-1">
              <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                JEE {examLevel} CBT (Full Mock)
              </h2>
              <p className="text-xs text-slate-500">
                75 Questions • 300 Marks • 180 min • +4 / −1 Marking
              </p>
            </div>
            <button
              type="button"
              onClick={onStartCBTMock}
              className="px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Mock</span>
            </button>
          </div>

          {/* 2. Official Papers (JEE Main) Card */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
              Official Papers (JEE {examLevel})
            </h2>

            {/* 4 Filter Dropdowns */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Year</label>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Session</label>
                <select
                  value={sessionFilter}
                  onChange={(e) => setSessionFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="All Sessions">All Sessions</option>
                  <option value="Session 1">Session 1</option>
                  <option value="Session 2">Session 2</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Shift</label>
                <select
                  value={shiftFilter}
                  onChange={(e) => setShiftFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="All Shifts">All Shifts</option>
                  <option value="Shift 1">Shift 1</option>
                  <option value="Shift 2">Shift 2</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Chapter</label>
                <select
                  value={chapterFilter}
                  onChange={(e) => setChapterFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="All Chapters">All Chapters</option>
                  <option value="d & f Block">d &amp; f Block</option>
                  <option value="Laws of Motion">Laws of Motion</option>
                </select>
              </div>
            </div>

            {/* Papers Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500">
                    <th className="py-3 font-semibold">Paper</th>
                    <th className="py-3 font-semibold">Shift</th>
                    <th className="py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPapers.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3.5 font-semibold text-slate-900 dark:text-white">
                        {row.paper}
                      </td>
                      <td className="py-3.5 text-slate-500">{row.shift}</td>
                      <td className="py-3.5 text-right space-x-2">
                        <button
                          type="button"
                          onClick={onStartCBTMock}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                        >
                          Practice
                        </button>
                        <button
                          type="button"
                          onClick={onStartCBTMock}
                          className="px-3 py-1.5 rounded-lg bg-[#EEF2FF] text-[#4F46E5] font-semibold hover:bg-indigo-100 cursor-pointer"
                        >
                          CBT Mode
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {customQuizOutput && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 p-5 space-y-2">
              <h3 className="font-display font-bold text-sm text-[#4F46E5]">
                AI-Generated Custom Practice Set ({builderMaterial})
              </h3>
              <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                {customQuizOutput}
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Columns matching Screen 7 */}
        <div className="lg:col-span-5 space-y-5">
          {/* My Notes Set Builder Card */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
              My Notes Set Builder
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Material</label>
                <select
                  value={builderMaterial}
                  onChange={(e) => setBuilderMaterial(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="d & f Block – Handwritten Notes">
                    d &amp; f Block – Handwritten Notes
                  </option>
                  <option value="Electrochemistry – Video Notes">
                    Electrochemistry – Video Notes
                  </option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Topic</label>
                <select
                  value={builderTopic}
                  onChange={(e) => setBuilderTopic(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="All Topics">All Topics</option>
                  <option value="Magnetic Moment">Magnetic Moment</option>
                  <option value="Lanthanoid Contraction">Lanthanoid Contraction</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1.5">Questions</label>
                <div className="flex gap-1.5">
                  {([5, 10, 15, 20] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setBuilderCount(cnt)}
                      className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                        builderCount === cnt
                          ? 'bg-[#EEF2FF] text-[#4F46E5]'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1.5">Difficulty</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['Mixed', 'Easy', 'Moderate', 'Hard'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setBuilderDiff(d)}
                      className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                        builderDiff === d
                          ? 'bg-[#EEF2FF] text-[#4F46E5]'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1.5">Type</label>
                <div className="flex gap-1.5">
                  {(['Single Choice', 'Numerical'] as const).map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => setBuilderType(tp)}
                      className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                        builderType === tp
                          ? 'bg-[#EEF2FF] text-[#4F46E5]'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {tp}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={generatingQuiz}
                onClick={handleGenerateCustomPractice}
                className="flex-1 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                {generatingQuiz ? 'Building Set...' : 'Start Practice'}
              </button>
              <button
                type="button"
                onClick={onStartCBTMock}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Start as CBT
              </button>
            </div>
          </div>

          {/* Practice Progress Card */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-2xs">
            <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
              Practice Progress
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] text-slate-500">PYQs Solved</div>
                <div className="font-display font-extrabold text-xl text-slate-900 dark:text-white tabular-nums mt-0.5">
                  142
                </div>
              </div>
              <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] text-slate-500">Accuracy</div>
                <div className="font-display font-extrabold text-xl text-emerald-600 tabular-nums mt-0.5">
                  76%
                </div>
              </div>
              <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] text-slate-500">Avg Time / Q</div>
                <div className="font-display font-extrabold text-xl text-slate-900 dark:text-white tabular-nums mt-0.5">
                  1.8m
                </div>
              </div>
            </div>
          </div>

          {/* Weak Topics Card */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-2xs">
            <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
              Weak Topics
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {[
                { name: 'Electrochemistry – Nernst Eq.', pct: '52%', color: 'text-amber-600' },
                { name: 'd & f Block – Magnetic Moment', pct: '58%', color: 'text-amber-600' },
                { name: 'Rotational Motion – MOI', pct: '61%', color: 'text-amber-600' },
              ].map((wt) => (
                <div key={wt.name} className="py-2.5 flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{wt.name}</span>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={`font-bold tabular-nums ${wt.color}`}>{wt.pct}</span>
                    <button
                      type="button"
                      onClick={onStartCBTMock}
                      className="px-2.5 py-1 rounded-lg bg-[#EEF2FF] text-[#4F46E5] font-semibold hover:bg-indigo-100 cursor-pointer"
                    >
                      Practice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. Progress View (Exact Match for Screen 6: LearnMate_JEE_Progress_Dashboard-1)
// ============================================================================
interface ProgressViewProps {
  latestMockSummary: CBTMockSummary | null;
  onOpenRevise: () => void;
  onOpenPractice: () => void;
}

export const ProgressDashboardView: React.FC<ProgressViewProps> = ({
  latestMockSummary,
  onOpenRevise,
  onOpenPractice,
}) => {
  const [subTab, setSubTab] = useState<'Overview' | 'Mock Analysis' | 'Mastery' | 'Rewards'>(
    'Overview'
  );
  const [materialFilter, setMaterialFilter] = useState('All Materials');
  const [selectedMockName, setSelectedMockName] = useState('JEE Main Mock 5');
  const [chapterSubjectTab, setChapterSubjectTab] = useState<
    'Physics' | 'Chemistry' | 'Mathematics'
  >('Physics');
  const [solutionModalText, setSolutionModalText] = useState<string | null>(null);

  const handleDownloadReport = () => {
    const reportText = `LearnMate JEE Progress Report\nMock: ${selectedMockName}\nScore: ${
      latestMockSummary ? `${latestMockSummary.totalScore} / ${latestMockSummary.maxScore}` : '236 / 300'
    }\nPhysics Mastery: 72%\nChemistry Mastery: 68%\nMathematics Mastery: 78%\n`;
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'LearnMate_JEE_Progress_Report.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Header matching Screen 6 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-wider uppercase text-[#4F46E5]">
            PROGRESS
          </div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
            Progress
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500">Material:</span>
            <select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="font-bold text-slate-900 dark:text-white bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="All Materials">All Materials</option>
              <option value="d & f Block – Handwritten Notes">
                d &amp; f Block – Handwritten Notes
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadReport}
            className="px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Report</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs matching Screen 6 */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
        {(['Overview', 'Mock Analysis', 'Mastery', 'Rewards'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSubTab(tab)}
            className={`px-4 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              subTab === tab
                ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main 12-Col Grid matching Screen 6 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns */}
        <div className="lg:col-span-8 space-y-5">
          {/* 3 Subject Mastery Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                subject: 'Physics',
                pct: 72,
                chapters: '14 / 20 Chapters',
                pyqs: '82 PYQs Solved',
                barColor: 'bg-[#4F46E5]',
              },
              {
                subject: 'Chemistry',
                pct: 68,
                chapters: '12 / 18 Chapters',
                pyqs: '64 PYQs Solved',
                barColor: 'bg-emerald-500',
              },
              {
                subject: 'Mathematics',
                pct: 78,
                chapters: '16 / 20 Chapters',
                pyqs: '95 PYQs Solved',
                barColor: 'bg-amber-500',
              },
            ].map((card) => (
              <div
                key={card.subject}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-sm text-slate-900 dark:text-white">
                    {card.subject}
                  </span>
                  <span className="font-display font-extrabold text-xl text-slate-900 dark:text-white tabular-nums">
                    {card.pct}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${card.barColor}`}
                    style={{ width: `${card.pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{card.chapters}</span>
                  <span>{card.pyqs}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Mock Analysis Card */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  Mock Analysis
                </h2>
                <select
                  value={selectedMockName}
                  onChange={(e) => setSelectedMockName(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800"
                >
                  <option value="JEE Main Mock 5">JEE Main Mock 5</option>
                  <option value="JEE Main Mock 4">JEE Main Mock 4</option>
                  <option value="JEE Main Mock 3">JEE Main Mock 3</option>
                </select>
              </div>
              <span className="text-xs text-slate-400">12 May 2024 • 300 Marks</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {[
                {
                  label: 'Score',
                  val: latestMockSummary
                    ? `${latestMockSummary.totalScore} / ${latestMockSummary.maxScore}`
                    : '236 / 300',
                  color: 'text-slate-900 dark:text-white',
                },
                {
                  label: 'Accuracy',
                  val: latestMockSummary ? `${latestMockSummary.accuracyPct}%` : '86.1%',
                  color: 'text-emerald-600',
                },
                { label: 'Time', val: '232 min', color: 'text-slate-900 dark:text-white' },
                {
                  label: 'Correct',
                  val: latestMockSummary ? String(latestMockSummary.correctCount) : '258',
                  color: 'text-emerald-600',
                },
                {
                  label: 'Incorrect',
                  val: latestMockSummary ? String(latestMockSummary.incorrectCount) : '42',
                  color: 'text-red-600',
                },
                {
                  label: 'Skipped',
                  val: latestMockSummary ? String(latestMockSummary.unansweredCount) : '0',
                  color: 'text-slate-600',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
                >
                  <div className="text-[11px] text-slate-500">{stat.label}</div>
                  <div className={`font-display font-extrabold text-sm sm:text-base tabular-nums mt-0.5 ${stat.color}`}>
                    {stat.val}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chapter Analysis Table matching Screen 6 */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                Chapter Analysis
              </h2>
              <div className="flex items-center gap-1 text-xs">
                {(['Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setChapterSubjectTab(subj)}
                    className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                      chapterSubjectTab === subj
                        ? 'bg-[#EEF2FF] text-[#4F46E5]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {subj}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500">
                    <th className="py-3 font-semibold">Chapter</th>
                    <th className="py-3 font-semibold">Marks</th>
                    <th className="py-3 font-semibold">Time</th>
                    <th className="py-3 font-semibold">Accuracy</th>
                    <th className="py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {CHAPTER_ANALYSIS_DEFAULT.map((row) => (
                    <tr key={row.chapter}>
                      <td className="py-3.5 font-semibold text-slate-900 dark:text-white">
                        {row.chapter}
                      </td>
                      <td className="py-3.5 font-bold tabular-nums">{row.marks}</td>
                      <td className="py-3.5 text-slate-500 tabular-nums">{row.time}</td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold tabular-nums ${
                              row.accuracy >= 80 ? 'text-emerald-600' : 'text-amber-600'
                            }`}
                          >
                            {row.accuracy}%
                          </span>
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                row.accuracy >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${row.accuracy}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSolutionModalText(
                              `${row.chapter}: Scored ${row.marks} in ${row.time} (${row.accuracy}% accuracy). Key concepts tested: Free-body resolution, conservation laws, and standard JEE traps.`
                            )
                          }
                          className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                        >
                          View Solutions
                        </button>
                        <button
                          type="button"
                          onClick={onOpenRevise}
                          className="px-3 py-1 rounded-lg bg-[#EEF2FF] text-[#4F46E5] font-semibold hover:bg-indigo-100 cursor-pointer"
                        >
                          Revise
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {solutionModalText && (
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-slate-800 flex items-center justify-between">
                <span>{solutionModalText}</span>
                <button
                  type="button"
                  onClick={() => setSolutionModalText(null)}
                  className="font-bold text-[#4F46E5] ml-4 cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right 4 Columns matching Screen 6 */}
        <div className="lg:col-span-4 space-y-5">
          {/* 2x2 Gamification Grid */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 grid grid-cols-2 gap-3 shadow-2xs">
            <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 fill-current" />
              </div>
              <div>
                <div className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  14-day Streak
                </div>
                <div className="text-[11px] text-slate-400">Best: 21 days</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  Focus Sessions
                </div>
                <div className="text-[11px] text-slate-400">23 • 9.5 hrs</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div>
                <div className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  XP 420
                </div>
                <div className="text-[11px] text-slate-400">+80 XP to Level 6</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  Level 5
                </div>
                <div className="text-[11px] text-slate-400">Scholar</div>
              </div>
            </div>
          </div>

          {/* Challenges Card */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
              Challenges
            </h2>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Finish 15 PYQs today
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                    +50 XP
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-[#4F46E5] rounded-full w-[60%]" />
                  </div>
                  <span className="text-slate-500 font-medium tabular-nums">9 / 15</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Score 80%+ in 1 Chapter Test
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                    Done
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-full" />
                  </div>
                  <span className="text-slate-500 font-medium tabular-nums">1 / 1</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Complete 3 Focus Sessions
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-[#4F46E5] font-bold">
                    +40 XP
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-[#4F46E5] rounded-full w-[66%]" />
                  </div>
                  <span className="text-slate-500 font-medium tabular-nums">2 / 3</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. JEE Main • Practice Mock (Exact Match for Screen 1: JEE_Main_CBT_Practice_Mock-10)
// ============================================================================
interface CBTMockExamViewProps {
  candidateName: string;
  onSubmitMock: (summary: CBTMockSummary, focusEvents: number) => Promise<void>;
  onExitMock: () => void;
}

export const CBTMockExamView: React.FC<CBTMockExamViewProps> = ({
  candidateName,
  onSubmitMock,
  onExitMock,
}) => {
  // Default to Q12 in Mathematics matching Screen 1 (`Q12. If f(x) = x^2 - 4x + 5...`)
  const [activeQuestionNumber, setActiveQuestionNumber] = useState<number>(12);
  const [activeSubject, setActiveSubject] = useState<'Physics' | 'Chemistry' | 'Mathematics'>(
    'Mathematics'
  );
  const [activeSection, setActiveSection] = useState<'Section A' | 'Section B'>('Section A');
  const [examLang, setExamLang] = useState('English');
  const [responses, setResponses] =
    useState<Record<string, QuestionResponseState>>(INITIAL_CBT_RESPONSES);
  const [draftOption, setDraftOption] = useState<number | null>(null);
  const [focusEvents, setFocusEvents] = useState<number>(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(2 * 3600 + 42 * 60 + 17); // 02:42:17 from Screen 1
  const [showInstructions, setShowInstructions] = useState(false);

  const currentQuestion: CBTQuestion =
    CBT_MOCK_QUESTIONS.find((q) => q.number === activeQuestionNumber) || CBT_MOCK_QUESTIONS[11];

  useEffect(() => {
    const existing = responses[currentQuestion.id];
    setDraftOption(existing ? existing.selectedOption : null);
  }, [activeQuestionNumber, currentQuestion.id, responses]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Track window blur / visibilitychange for NTA anti-cheat `Focus events: 0`
  useEffect(() => {
    const onVisChange = () => {
      if (document.hidden) {
        setFocusEvents((c) => c + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, []);

  const formatTimer = (totalSec: number) => {
    const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSec % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const advanceToNextQuestion = (updatedMap: Record<string, QuestionResponseState>) => {
    const nextNum = activeQuestionNumber < 20 ? activeQuestionNumber + 1 : 1;
    const nextQ = CBT_MOCK_QUESTIONS.find((q) => q.number === nextNum);
    if (nextQ) {
      const nextCurrState = updatedMap[nextQ.id] || {
        status: 'not_visited',
        selectedOption: null,
        timeSpentSec: 0,
      };
      updatedMap[nextQ.id] = applyQuestionAction(nextCurrState, 'visit');
    }
    setResponses({ ...updatedMap });
    setActiveQuestionNumber(nextNum);
  };

  const handleSaveAndNext = () => {
    const curr = responses[currentQuestion.id] || {
      status: 'not_visited',
      selectedOption: null,
      timeSpentSec: 0,
    };
    const updated = {
      ...responses,
      [currentQuestion.id]: applyQuestionAction(curr, 'save_and_next', draftOption),
    };
    advanceToNextQuestion(updated);
  };

  const handleMarkForReviewAndNext = () => {
    const curr = responses[currentQuestion.id] || {
      status: 'not_visited',
      selectedOption: null,
      timeSpentSec: 0,
    };
    const updated = {
      ...responses,
      [currentQuestion.id]: applyQuestionAction(curr, 'mark_for_review_and_next', draftOption),
    };
    advanceToNextQuestion(updated);
  };

  const handleClearResponse = () => {
    setDraftOption(null);
    const curr = responses[currentQuestion.id] || {
      status: 'not_visited',
      selectedOption: null,
      timeSpentSec: 0,
    };
    setResponses({
      ...responses,
      [currentQuestion.id]: applyQuestionAction(curr, 'clear_response'),
    });
  };

  const handleFinalSubmit = async () => {
    const summary = calculateCBTMockScore(CBT_MOCK_QUESTIONS, responses);
    await onSubmitMock(summary, focusEvents);
  };

  const liveSummary = calculateCBTMockScore(CBT_MOCK_QUESTIONS, responses);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      {/* Top NTA Royal Blue Header Bar matching Screen 1 */}
      <header className="w-full bg-gradient-to-r from-[#1E3A8A] via-[#1D4ED8] to-[#1E40AF] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExitMock}
            title="Exit Mock to Workspace"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-display font-extrabold text-lg sm:text-xl tracking-tight">
            JEE Main • Practice Mock
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="px-3.5 py-1.5 rounded-lg bg-white/15 border border-white/20 font-semibold tabular-nums">
            Focus events: {focusEvents}
          </span>

          <div className="flex items-center gap-2 px-3 py-1.5 font-semibold">
            <Clock className="w-4 h-4 text-blue-200" />
            <span>Time Left</span>
            <span className="font-mono font-extrabold text-sm sm:text-base tabular-nums">
              {formatTimer(secondsRemaining)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowInstructions((v) => !v)}
            className="px-3.5 py-1.5 rounded-lg border border-white/35 hover:bg-white/10 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Instructions</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.().catch(() => {});
              } else {
                document.exitFullscreen?.().catch(() => {});
              }
            }}
            className="px-3.5 py-1.5 rounded-lg border border-white/35 hover:bg-white/10 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Full screen</span>
          </button>
        </div>
      </header>

      {showInstructions && (
        <div className="bg-indigo-950 text-indigo-100 px-6 py-3 text-xs flex items-center justify-between">
          <span>
            NTA Marking Scheme: +4 for Correct Response, −1 for Incorrect Response, 0 for Not
            Answered / Marked for Review without saving.
          </span>
          <button
            type="button"
            onClick={() => setShowInstructions(false)}
            className="underline font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split Exam Body matching Screen 1 */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Question Area (9 Cols) */}
        <div className="lg:col-span-9 flex flex-col justify-between gap-4">
          <div className="rounded-xl bg-white border border-slate-200 p-5 flex-1 flex flex-col space-y-5 shadow-2xs">
            {/* Subject Tabs: Physics | Chemistry | Mathematics */}
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-200">
              {(['Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setActiveSubject(subj)}
                  className={`px-5 py-2 rounded-lg text-xs sm:text-sm font-bold border transition-colors cursor-pointer ${
                    activeSubject === subj
                      ? 'bg-[#DBEAFE] text-[#1D4ED8] border-[#93C5FD]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {subj}
                </button>
              ))}
            </div>

            {/* Section Tabs + Language Dropdown */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                {(['Section A', 'Section B'] as const).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setActiveSection(sec)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      activeSection === sec
                        ? 'bg-[#DBEAFE] text-slate-900 border-[#93C5FD]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {sec}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-slate-600">Language:</span>
                <select
                  aria-label="Exam Language"
                  value={examLang}
                  onChange={(e) => setExamLang(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                </select>
              </div>
            </div>

            {/* Question Stem & Options matching Screen 1 (Q12: f(x) = x² − 4x + 5) */}
            <div className="py-4 px-2 space-y-6 flex-1">
              <div className="flex items-baseline gap-3 text-base sm:text-lg font-medium text-slate-900">
                <span className="font-display font-extrabold text-[#1D4ED8] text-lg sm:text-xl">
                  Q{currentQuestion.number}.
                </span>
                <span className="leading-relaxed">{currentQuestion.stem}</span>
              </div>

              <div className="space-y-4 pl-2">
                {currentQuestion.options.map((optText, idx) => {
                  const letter = ['A', 'B', 'C', 'D'][idx];
                  const selected = draftOption === idx;
                  return (
                    <label
                      key={idx}
                      onClick={() => setDraftOption(idx)}
                      className={`flex items-center gap-3.5 p-2.5 rounded-xl cursor-pointer transition-colors ${
                        selected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${currentQuestion.id}`}
                        checked={selected}
                        onChange={() => setDraftOption(idx)}
                        className="w-4 h-4 text-[#1D4ED8] focus:ring-[#1D4ED8]"
                      />
                      <span className="font-bold text-sm sm:text-base text-slate-900">
                        ({letter})
                      </span>
                      <span className="text-sm sm:text-base text-slate-800">{optText}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom NTA Action Bar matching Screen 1 */}
          <div className="rounded-xl bg-white border border-slate-200 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleMarkForReviewAndNext}
                className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-bold text-slate-800 inline-flex items-center gap-2 cursor-pointer"
              >
                <span className="w-3.5 h-3.5 rounded-xs border-2 border-[#4F46E5]" />
                <span>Mark for Review &amp; Next</span>
              </button>

              <button
                type="button"
                onClick={handleClearResponse}
                className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-bold text-slate-800 cursor-pointer"
              >
                Clear Response
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveAndNext}
                className="px-6 py-2.5 rounded-lg bg-[#2522C9] hover:bg-[#1E1B9E] text-white text-xs sm:text-sm font-bold shadow-sm cursor-pointer"
              >
                Save &amp; Next
              </button>

              <button
                type="button"
                onClick={handleFinalSubmit}
                className="px-6 py-2.5 rounded-lg bg-[#DBEAFE] hover:bg-[#BFDBFE] text-[#1D4ED8] border border-[#93C5FD] text-xs sm:text-sm font-bold cursor-pointer"
              >
                Submit
              </button>
            </div>
          </div>
        </div>

        {/* Right Candidate & Question Palette Sidebar (3 Cols) matching Screen 1 */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {/* Candidate Card */}
          <div className="rounded-xl bg-white border border-slate-200 p-3.5 flex items-center gap-3 shadow-2xs">
            <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
              <UserIcon className="w-7 h-7" />
            </div>
            <div>
              <div className="font-display font-bold text-sm text-slate-900">
                {candidateName || 'Candidate'}
              </div>
              <div className="text-xs text-slate-500">Practice Mock</div>
            </div>
          </div>

          {/* 5-Status Legend Box */}
          <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-2.5 text-xs shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-sm bg-slate-200 border border-slate-300 inline-block" />
                <span className="text-slate-700 font-medium">Not Visited</span>
              </div>
              <span className="font-bold tabular-nums">
                {liveSummary.paletteCounts.not_visited}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-sm bg-[#DC2626] inline-block" />
                <span className="text-slate-700 font-medium">Not Answered</span>
              </div>
              <span className="font-bold tabular-nums">
                {liveSummary.paletteCounts.not_answered}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-sm bg-[#2E8B57] inline-block" />
                <span className="text-slate-700 font-medium">Answered</span>
              </div>
              <span className="font-bold tabular-nums">{liveSummary.paletteCounts.answered}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-sm bg-[#7C3AED] inline-block" />
                <span className="text-slate-700 font-medium">Marked for Review</span>
              </div>
              <span className="font-bold tabular-nums">{liveSummary.paletteCounts.marked}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-sm bg-[#7C3AED] text-white flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
                <span className="text-slate-700 font-medium">Answered &amp; Marked for Review</span>
              </div>
              <span className="font-bold tabular-nums">
                {liveSummary.paletteCounts.answered_marked}
              </span>
            </div>
          </div>

          {/* Section A (Q1 - Q20) Question Palette Grid matching Screen 1 */}
          <div className="rounded-xl bg-white border border-slate-200 p-4 flex-1 space-y-3 shadow-2xs">
            <h3 className="font-display font-bold text-sm text-slate-900">
              Section A (Q1 – Q20)
            </h3>

            <div className="grid grid-cols-5 gap-2">
              {CBT_MOCK_QUESTIONS.map((q) => {
                const st = responses[q.id]?.status || 'not_visited';
                const isCurrent = q.number === activeQuestionNumber;

                let btnClass = 'bg-slate-200 text-slate-800';
                if (st === 'answered') btnClass = 'bg-[#2E8B57] text-white';
                if (st === 'not_answered') btnClass = 'bg-[#DC2626] text-white';
                if (st === 'marked' || st === 'answered_marked')
                  btnClass = 'bg-[#7C3AED] text-white';
                if (isCurrent) {
                  btnClass = 'bg-[#DBEAFE] text-[#1D4ED8] ring-2 ring-[#2522C9]';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setActiveQuestionNumber(q.number)}
                    className={`relative h-9 rounded-md font-bold text-xs flex items-center justify-center transition-all cursor-pointer tabular-nums ${btnClass}`}
                  >
                    <span>{q.number}</span>
                    {st === 'answered_marked' && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white text-[9px] flex items-center justify-center">
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
    </div>
  );
};
