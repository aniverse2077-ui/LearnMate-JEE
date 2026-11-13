import React, { useState, useMemo } from 'react';
import {
  X,
  Sliders,
  CheckCircle2,
  Play,
  Layers,
  Clock,
  Hash,
  Sparkles,
  Filter,
} from 'lucide-react';
import { CBTQuestion } from '../../utils/jeeEngine';
import {
  JEE_SYLLABUS_DATA,
  CBT_MOCK_QUESTIONS,
  JEE_ADVANCED_PAPER_QUESTIONS,
} from '../../data/jeeInitialContent';
import { MistakeNotebookEntry } from '../RevisePracticeProgressCBT';

export interface CustomTestConfig {
  title: string;
  examType: 'JEE Main' | 'JEE Advanced';
  questions: CBTQuestion[];
  durationMinutes: number;
}

interface CustomTestGeneratorModalProps {
  isOpen: boolean;
  mistakesNotebook?: MistakeNotebookEntry[];
  onClose: () => void;
  onLaunchCustomCBT: (
    questionsOrConfig: CBTQuestion[] | CustomTestConfig,
    durationMinutes?: number,
    paperTitle?: string
  ) => void;
}

export const CustomTestGeneratorModal: React.FC<CustomTestGeneratorModalProps> = ({
  isOpen,
  mistakesNotebook = [],
  onClose,
  onLaunchCustomCBT,
}) => {
  const [selectedSubjects, setSelectedSubjects] = useState<
    ('Physics' | 'Chemistry' | 'Mathematics')[]
  >(['Physics', 'Chemistry', 'Mathematics']);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<
    'All' | 'Easy' | 'Moderate' | 'Tough'
  >('All');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<
    'All' | 'MCQ' | 'Numerical' | 'Multi-Correct' | 'Previously Incorrect Only'
  >('All');
  const [questionCount, setQuestionCount] = useState<number>(30);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [subjectTab, setSubjectTab] = useState<'Physics' | 'Chemistry' | 'Mathematics'>('Physics');

  const availableChapters = useMemo(() => {
    return JEE_SYLLABUS_DATA.filter((ch) => ch.subject === subjectTab);
  }, [subjectTab]);

  if (!isOpen) return null;

  const toggleSubject = (subj: 'Physics' | 'Chemistry' | 'Mathematics') => {
    setSelectedSubjects((prev) =>
      prev.includes(subj)
        ? prev.length > 1
          ? prev.filter((s) => s !== subj)
          : prev
        : [...prev, subj]
    );
  };

  const toggleChapter = (chapterName: string) => {
    setSelectedChapters((prev) =>
      prev.includes(chapterName)
        ? prev.filter((c) => c !== chapterName)
        : [...prev, chapterName]
    );
  };

  const handleBuildAndLaunch = () => {
    let pool: CBTQuestion[] = [];

    if (questionTypeFilter === 'Previously Incorrect Only' && mistakesNotebook.length > 0) {
      pool = mistakesNotebook.map((m) => m.question);
    } else if (questionTypeFilter === 'Multi-Correct') {
      pool = [...JEE_ADVANCED_PAPER_QUESTIONS, ...CBT_MOCK_QUESTIONS];
    } else {
      pool = [...CBT_MOCK_QUESTIONS, ...JEE_ADVANCED_PAPER_QUESTIONS];
    }

    // Filter by selected subjects
    pool = pool.filter((q) => selectedSubjects.includes(q.subject));

    // Filter by selected chapters if any explicitly chosen
    if (selectedChapters.length > 0) {
      const chapterMatched = pool.filter((q) =>
        selectedChapters.some(
          (ch) =>
            ch.toLowerCase().includes(q.chapter.toLowerCase()) ||
            q.chapter.toLowerCase().includes(ch.split(' ')[0].toLowerCase())
        )
      );
      if (chapterMatched.length > 0) {
        pool = chapterMatched;
      }
    }

    // Filter by difficulty
    if (difficultyFilter !== 'All') {
      const targetBucket =
        difficultyFilter === 'Easy'
          ? 'Beginner'
          : difficultyFilter === 'Moderate'
          ? 'Must-Do'
          : 'Advanced Climb';
      const diffMatched = pool.filter((q) => q.difficultyBucket === targetBucket);
      if (diffMatched.length > 0) pool = diffMatched;
    }

    // Filter by question type
    if (questionTypeFilter === 'MCQ') {
      pool = pool.filter((q) => q.section === 'Section A' && q.advancedFormat !== 'multiple');
    } else if (questionTypeFilter === 'Numerical') {
      pool = pool.filter((q) => q.section === 'Section B' || q.advancedFormat === 'numerical');
    } else if (questionTypeFilter === 'Multi-Correct') {
      const multi = pool.filter((q) => q.advancedFormat === 'multiple');
      if (multi.length > 0) pool = multi;
    }

    if (pool.length === 0) {
      pool = CBT_MOCK_QUESTIONS.slice(0, questionCount);
    }

    // Build exact requested questionCount while preserving canonical question IDs for server-verified grading
    const usedIds = new Set<string>();
    const finalQuestions: CBTQuestion[] = [];
    for (let i = 0; i < questionCount; i++) {
      const tpl = pool[i % pool.length];
      const uniqueId = usedIds.has(tpl.id) ? `${tpl.id}__copy_${i + 1}` : tpl.id;
      usedIds.add(uniqueId);
      finalQuestions.push({
        ...tpl,
        id: uniqueId,
        number: i + 1,
      });
    }

    onLaunchCustomCBT(
      finalQuestions,
      durationMinutes,
      `Custom NTA Test (${finalQuestions.length} Qs • ${durationMinutes} Mins)`
    );
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="MARKS Custom Test Generator"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-900 dark:text-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold">
                Custom Test Builder
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select subjects, chapters, difficulty, and duration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 1. Subject Multi-Select */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
              1. Select Subjects ({selectedSubjects.length}/3 Active)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => {
                const active = selectedSubjects.includes(subj);
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => toggleSubject(subj)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      active
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-extrabold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold'
                    }`}
                  >
                    <span>{subj}</span>
                    {active && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Difficulty & Question Format Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                2. Difficulty Level
              </label>
              <div className="grid grid-cols-4 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {(['All', 'Easy', 'Moderate', 'Tough'] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficultyFilter(diff)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      difficultyFilter === diff
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                3. Question Type Filter
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    'All',
                    'MCQ',
                    'Numerical',
                    'Multi-Correct',
                    'Previously Incorrect Only',
                  ] as const
                ).map((qType) => (
                  <button
                    key={qType}
                    type="button"
                    onClick={() => setQuestionTypeFilter(qType)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      questionTypeFilter === qType
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {qType}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Question Count (10 to 75) & Duration (15 to 180 mins) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="flex items-center justify-between text-xs font-extrabold mb-2">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                  <Hash className="w-3.5 h-3.5 text-indigo-600" />
                  Total Questions
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  {questionCount} Questions ({questionCount * 4} Marks)
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={75}
                step={5}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1">
                <span>10 Qs (Mini Drill)</span>
                <span>30 Qs (Part Test)</span>
                <span>75 Qs (Full NTA Paper)</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-extrabold mb-2">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  Exam Duration
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  {durationMinutes} Minutes
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={180}
                step={15}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1">
                <span>15m (Sprint)</span>
                <span>90m (Half Mock)</span>
                <span>180m (3-Hr Full Mock)</span>
              </div>
            </div>
          </div>

          {/* 5. 58-Chapter Selector */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                4. Pick Specific Chapters ({selectedChapters.length === 0 ? 'All 58 Chapters Included' : `${selectedChapters.length} Selected`})
              </label>
              <div className="flex items-center gap-1.5">
                {(['Physics', 'Chemistry', 'Mathematics'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSubjectTab(tab)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      subjectTab === tab
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
                {selectedChapters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedChapters([])}
                    className="text-xs font-bold text-rose-600 hover:underline ml-2 cursor-pointer"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-52 overflow-y-auto p-2 rounded-xl border border-slate-200 dark:border-slate-800">
              {availableChapters.map((ch) => {
                const isPicked = selectedChapters.includes(ch.chapter);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChapter(ch.chapter)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer flex items-start justify-between gap-2 ${
                      isPicked
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60 font-bold text-indigo-950 dark:text-indigo-200'
                        : 'border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="line-clamp-1">{ch.chapter}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Class {ch.classLevel} • {ch.weightageTier} Weightage
                      </div>
                    </div>
                    {isPicked && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            NTA Marking: <span className="font-bold text-slate-800 dark:text-slate-200">+4 / -1</span> (Section A &amp; B) • Shift Percentile Predictor Enabled
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBuildAndLaunch}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Launch Custom CBT Test ({questionCount} Qs)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
