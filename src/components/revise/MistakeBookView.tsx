import React, { useState } from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Play,
  Sparkles,
  Tag,
  Zap,
} from 'lucide-react';
import { CBTQuestion, ErrorRootCauseTag } from '../../utils/jeeEngine';
import { MathRichText } from '../MathRichText';
import { MistakeNotebookEntry } from '../RevisePracticeProgressCBT';

const ROOT_CAUSE_TAGS: {
  id: ErrorRootCauseTag;
  label: string;
  colorClass: string;
  remedyHint: string;
}[] = [
  {
    id: 'Conceptual Gap',
    label: 'Conceptual Gap',
    colorClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    remedyHint: 'Re-read Section 1 (First Principles & Derivations) and test with Socratic Hints.',
  },
  {
    id: 'Formula Forgotten',
    label: 'Formula Forgotten',
    colorClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    remedyHint: 'Scheduled into Daily NeuronZ SM-2 Active Recall Queue for 1d → 6d → 15d review.',
  },
  {
    id: 'Calculation/Silly Error',
    label: 'Calculation/Silly Error',
    colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    remedyHint: 'Simplify symbolically before substituting decimals in Section B numericals.',
  },
  {
    id: 'Misread Question',
    label: 'Misread Question',
    colorClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    remedyHint: 'Underline "NOT", "incorrect", and non-SI units ($\\text{cm, mM, }^\\circ\\text{C}$) in the stem.',
  },
  {
    id: 'Time Pressure',
    label: 'Time Pressure',
    colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    remedyHint: 'Use Round-1 / Round-2 NTA CBT strategy and dimensional elimination.',
  },
];

interface MistakeBookViewProps {
  mistakesNotebook?: MistakeNotebookEntry[];
  mistakes?: MistakeNotebookEntry[];
  onTagMistakeRootCause?: (mistakeId: string, rootCause: ErrorRootCauseTag) => void;
  onTagRootCause?: (mistakeId: string, rootCause: ErrorRootCauseTag) => void;
  onPracticeQuestion?: (question: CBTQuestion) => void;
  onPracticeMistake?: (question: CBTQuestion) => void;
  onConvertMistakeToSM2Card?: (entry: MistakeNotebookEntry, rootCause: ErrorRootCauseTag) => void;
}

export const MistakeBookView: React.FC<MistakeBookViewProps> = ({
  mistakesNotebook,
  mistakes,
  onTagMistakeRootCause,
  onTagRootCause,
  onPracticeQuestion,
  onPracticeMistake,
  onConvertMistakeToSM2Card,
}) => {
  const allMistakes = mistakesNotebook || mistakes || [];
  const handleTagCause = onTagMistakeRootCause || onTagRootCause || (() => {});
  const handlePracticeQ = onPracticeQuestion || onPracticeMistake || (() => {});

  const [filterRootCause, setFilterRootCause] = useState<'All' | ErrorRootCauseTag>('All');
  const [filterSubject, setFilterSubject] = useState<
    'All' | 'Physics' | 'Chemistry' | 'Mathematics'
  >('All');

  const filtered = allMistakes.filter((m) => {
    const matchesSubj = filterSubject === 'All' || m.question.subject === filterSubject;
    const matchesCause =
      filterRootCause === 'All' || (m.rootCauseTag || 'Conceptual Gap') === filterRootCause;
    return matchesSubj && matchesCause;
  });

  const untaggedCount = allMistakes.filter((m) => !m.rootCauseTag).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Mistake Book ({allMistakes.length})
            </h3>
            {untaggedCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-extrabold">
                {untaggedCount} Untagged
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tag error root causes to schedule targeted spaced-repetition review.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
            <button
              key={subj}
              type="button"
              onClick={() => setFilterSubject(subj)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                filterSubject === subj
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {subj}
            </button>
          ))}
        </div>
      </div>

      {/* Root Cause Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterRootCause('All')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
            filterRootCause === 'All'
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
          }`}
        >
          All Root Causes ({allMistakes.length})
        </button>
        {ROOT_CAUSE_TAGS.map((tag) => {
          const count = allMistakes.filter((m) => m.rootCauseTag === tag.id).length;
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => setFilterRootCause(tag.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                filterRootCause === tag.id
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
              }`}
            >
              {tag.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Mistake Entries */}
      {filtered.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <div className="text-sm font-extrabold text-slate-900 dark:text-white">
            No mistakes logged in this filter yet
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Attempt questions in the 75-Q NTA CBT Mock or Official PYQ Bank. Any incorrect or skipped question will automatically appear here for Root-Cause tagging and SM-2 scheduling.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((entry) => {
            const activeCause = entry.rootCauseTag;
            const causeMeta = ROOT_CAUSE_TAGS.find((t) => t.id === activeCause);
            return (
              <div
                key={entry.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold">
                      {entry.question.subject} • {entry.question.chapter}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                      {entry.source} • Logged {entry.loggedAt}
                    </span>
                    {activeCause ? (
                      <span
                        className={`px-2.5 py-0.5 rounded-md border text-[11px] font-extrabold ${
                          causeMeta?.colorClass || ''
                        }`}
                      >
                        Root Cause: {activeCause}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-extrabold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Tag Root Cause Required
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePracticeQ(entry.question)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Re-Attempt Question
                  </button>
                </div>

                {/* Question Stem */}
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                  <MathRichText content={entry.question.stem} />
                </div>

                {/* User vs Correct Answer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900">
                    <span className="font-extrabold text-rose-700 dark:text-rose-300 block mb-0.5">
                      Your Response:
                    </span>
                    <MathRichText content={entry.userAnswer || 'Skipped / Unattempted'} />
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900">
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-300 block mb-0.5">
                      Correct Answer &amp; Derivation:
                    </span>
                    <MathRichText content={entry.question.explanation} />
                  </div>
                </div>

                {/* Root Cause Tag Selector + Auto SM-2 Trigger */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-extrabold text-slate-500 flex items-center gap-1 mr-1">
                      <Tag className="w-3.5 h-3.5 text-indigo-600" />
                      Tag Error Root Cause:
                    </span>
                    {ROOT_CAUSE_TAGS.map((tag) => {
                      const selected = activeCause === tag.id;
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            handleTagCause(entry.id, tag.id);
                            if (onConvertMistakeToSM2Card) {
                              onConvertMistakeToSM2Card(entry, tag.id);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                            selected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                          }`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>

                  {causeMeta && (
                    <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <Brain className="w-3.5 h-3.5 shrink-0" />
                      <span>{causeMeta.remedyHint}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
