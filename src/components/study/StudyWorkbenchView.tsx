import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Coins,
  Flame,
  Lightbulb,
  Play,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  StudyWorkspaceView,
  MaterialItem,
  CreationItem,
} from '../HomeAndStudyViews';
import { MaterialStudyBundle, NotePageData } from '../../data/jeeInitialContent';
import { CBTQuestion, generateChapterShardZ } from '../../utils/jeeEngine';
import { MathRichText } from '../MathRichText';
import { apiFetchWithAuth, StructuredUpstreamError } from '../../services/workspaceService';

export interface StudyWorkbenchViewProps {
  initialSubTab:
    | 'Syllabus'
    | 'Chapter Notes'
    | 'My Materials'
    | 'AI Tutor'
    | 'Create'
    | 'Resources';
  selectedMaterial: MaterialItem | null;
  activeBundle: MaterialStudyBundle | null;
  materials: MaterialItem[];
  creations: CreationItem[];
  onSelectMaterial: (mat: MaterialItem) => void;
  onDeleteMaterial: (matId: string) => void;
  onUpdateMaterialPage: (
    materialId: string,
    pageNumber: number,
    updatedPage: NotePageData
  ) => void;
  onOpenAddMaterial: (tab: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive') => void;
  onSaveCreation: (creation: Omit<CreationItem, 'id'>) => Promise<void>;
  onAddQuickSheetMaterial: (
    title: string,
    subject: 'Physics' | 'Chemistry' | 'Mathematics',
    summary: string
  ) => Promise<void>;
  onOpenVoiceTutor: () => void;
  onLaunchInstantPractice: (
    mode: 'chapter-quiz' | 'adaptive-drill' | 'paper-solver',
    title: string,
    chapterName: string,
    customQuestions?: CBTQuestion[]
  ) => void;
  onEarnXp?: (xp: number, reason?: string) => void;
}

export const StudyWorkbenchView: React.FC<StudyWorkbenchViewProps> = (props) => {
  const activeChapter = props.selectedMaterial?.chapter || 'Rotational Motion & Rigid Body Dynamics';
  const activeSubject = props.selectedMaterial?.subject || 'Physics';

  // 15-Minute ShardZ Micro-Tasks state
  const shards = useMemo(
    () => generateChapterShardZ(activeChapter, activeSubject),
    [activeChapter, activeSubject]
  );
  const [activeShardIdx, setActiveShardIdx] = useState<number | null>(null);
  const [shardAnswers, setShardAnswers] = useState<Record<string, number>>({});
  const [completedShardIds, setCompletedShardIds] = useState<string[]>([]);

  // Socratic "Clue Coins" 3-Step Progressive Hint state
  const [socraticOpen, setSocraticOpen] = useState<boolean>(false);
  const [socraticPrompt, setSocraticPrompt] = useState<string>('');
  const [clueCoins, setClueCoins] = useState<number>(6);
  const [hintStep, setHintStep] = useState<1 | 2 | 3 | 'full'>(1);
  const [tutorDifficulty, setTutorDifficulty] = useState<'board' | 'jee_main' | 'jee_advanced'>('jee_main');
  const [tutorContextMode, setTutorContextMode] = useState<'strict_material' | 'open_jee'>('strict_material');
  const [socraticOutput, setSocraticOutput] = useState<string>('');
  const [socraticCitations, setSocraticCitations] = useState<{ pageNumber: number; excerpt: string }[]>([]);
  const [socraticLoading, setSocraticLoading] = useState<boolean>(false);
  const [upstreamError, setUpstreamError] = useState<StructuredUpstreamError | null>(null);

  const activeShard = activeShardIdx !== null ? shards[activeShardIdx] : null;

  const handleRequestSocraticHint = async (
    targetStep: 1 | 2 | 3 | 'full',
    actionKind: 'socratic' | 'unit_check' = 'socratic'
  ) => {
    const queryText =
      actionKind === 'unit_check'
        ? `Perform a dimensional consistency and SI units check on formulas/problem: ${socraticPrompt.trim() || activeChapter}.`
        : socraticPrompt.trim() ||
          `Help me derive and solve a JEE problem on ${activeChapter} (${activeSubject}).`;
    setHintStep(targetStep);
    setSocraticLoading(true);
    setUpstreamError(null);

    if (targetStep !== 'full' && clueCoins > 0) {
      setClueCoins((c) => Math.max(0, c - 1));
    }

    const res = await apiFetchWithAuth<{
      text: string;
      citations?: { pageNumber: number; excerpt: string }[];
    }>('/api/ai/tutor', {
      prompt: queryText,
      materialId: props.selectedMaterial?.id,
      context: props.selectedMaterial?.contentSummary || activeChapter,
      contextMode: tutorContextMode,
      difficulty: tutorDifficulty,
      socraticHintStep: targetStep,
      teacherPersona: 'hinglish_faculty',
    });

    setSocraticLoading(false);
    if (!res.ok) {
      setUpstreamError(res.error);
      return;
    }
    setSocraticOutput(res.data.text || '');
    setSocraticCitations(Array.isArray(res.data.citations) ? res.data.citations : []);
  };

  return (
    <div className="space-y-4">
      {/* Top 15-Minute ShardZ Micro-Tasks + Socratic Clue Coins Bar */}
      <div className="w-full px-6 lg:px-10 xl:px-12 pt-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[11px] font-extrabold">
                15-Min Micro-Tasks
              </span>
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                {activeChapter} ({completedShardIds.length}/{shards.length})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-extrabold inline-flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                {clueCoins} Clue Coins
              </span>
              <button
                type="button"
                onClick={() => setSocraticOpen((o) => !o)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                  socraticOpen
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                3-Step Hints
              </button>
            </div>
          </div>

          {/* 3 ShardZ Pills */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {shards.map((shard, idx) => {
              const isDone = completedShardIds.includes(shard.id);
              const isOpen = activeShardIdx === idx;
              return (
                <button
                  key={shard.id}
                  type="button"
                  onClick={() => setActiveShardIdx(isOpen ? null : idx)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isOpen
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60'
                      : isDone
                      ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {shard.title}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      15 Min Sprint • 3-Question Mastery Check
                    </div>
                  </div>
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Play className="w-4 h-4 text-indigo-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Expanded ShardZ 3-Question Mastery Check */}
          {activeShard && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                    {activeShard.title} ({activeShard.durationMinutes} Mins)
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {activeShard.focusConcept}
                  </p>
                </div>
                <div className="text-xs">
                  <MathRichText content={activeShard.formulaHook} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {activeShard.masteryQuestions.map((mq, qIdx) => {
                  const chosen = shardAnswers[mq.id];
                  const isAnswered = chosen !== undefined;
                  const isRight = chosen === mq.correctIndex;
                  return (
                    <div
                      key={mq.id}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                    >
                      <div className="font-bold text-slate-900 dark:text-white">
                        Q{qIdx + 1}. <MathRichText content={mq.prompt} />
                      </div>
                      <div className="space-y-1">
                        {mq.options.map((opt, oIdx) => (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() =>
                              setShardAnswers((prev) => ({ ...prev, [mq.id]: oIdx }))
                            }
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                              isAnswered && oIdx === mq.correctIndex
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 font-bold'
                                : isAnswered && chosen === oIdx && !isRight
                                ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200'
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <MathRichText content={opt} />
                          </button>
                        ))}
                      </div>
                      {isAnswered && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <MathRichText content={mq.explanation} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!completedShardIds.includes(activeShard.id)) {
                      setCompletedShardIds((prev) => [...prev, activeShard.id]);
                      setClueCoins((c) => c + 2);
                      if (props.onEarnXp) props.onEarnXp(30);
                    }
                    setActiveShardIdx(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
                >
                  Complete ShardZ (+30 XP &amp; +2 Clue Coins)
                </button>
              </div>
            </div>
          )}

          {/* Socratic 3-Step Progressive Hints Drawer */}
          {socraticOpen && (
            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  Socratic Progressive Hint Coach (Hint 1 → Hint 2 → Hint 3 → Full Derivation)
                </div>
                <div className="flex items-center gap-1.5">
                  {([1, 2, 3, 'full'] as const).map((st) => (
                    <button
                      key={String(st)}
                      type="button"
                      onClick={() => handleRequestSocraticHint(st)}
                      disabled={socraticLoading}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer ${
                        hintStep === st
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                      }`}
                    >
                      {st === 1
                        ? 'Hint 1: Law Cue'
                        : st === 2
                        ? 'Hint 2: Equation Setup'
                        : st === 3
                        ? 'Hint 3: Key Step'
                        : 'Reveal Full Solution'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-slate-600 dark:text-slate-300">Depth:</span>
                  {(
                    [
                      { id: 'board', label: 'Board' },
                      { id: 'jee_main', label: 'JEE Main' },
                      { id: 'jee_advanced', label: 'JEE Advanced' },
                    ] as const
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setTutorDifficulty(d.id)}
                      className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                        tutorDifficulty === d.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setTutorContextMode((m) =>
                        m === 'strict_material' ? 'open_jee' : 'strict_material'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold cursor-pointer"
                  >
                    Mode: {tutorContextMode === 'strict_material' ? 'Strict Material' : 'Open JEE'}
                  </button>
                  <button
                    type="button"
                    disabled={socraticLoading}
                    onClick={() => handleRequestSocraticHint('full', 'unit_check')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold cursor-pointer"
                  >
                    Unit Check
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={socraticPrompt}
                  onChange={(e) => setSocraticPrompt(e.target.value)}
                  placeholder={`Paste any JEE doubt on ${activeChapter} to unlock progressive Socratic hints...`}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                />
                <button
                  type="button"
                  onClick={() => handleRequestSocraticHint(1)}
                  disabled={socraticLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer"
                >
                  {socraticLoading ? 'Thinking...' : 'Get Hint 1'}
                </button>
              </div>

              {/* Honest Diagnostic Banner on Upstream 429/503 Error */}
              {upstreamError && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-extrabold">[{upstreamError.errorCode}]</span>{' '}
                      {upstreamError.message}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRequestSocraticHint(hintStep)}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-extrabold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                </div>
              )}

              {socraticOutput && !upstreamError && (
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs leading-relaxed space-y-2.5">
                  <MathRichText content={socraticOutput} />
                  {socraticCitations.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase">
                        Grounded Citations:
                      </span>
                      {socraticCitations.map((c, ci) => (
                        <span
                          key={ci}
                          title={c.excerpt}
                          className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold"
                        >
                          Page {c.pageNumber}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Study Workspace View */}
      <StudyWorkspaceView {...props} />
    </div>
  );
};
