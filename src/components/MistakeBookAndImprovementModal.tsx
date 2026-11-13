import React from 'react';
import { X, AlertTriangle, CheckCircle2, Target, RefreshCw } from 'lucide-react';
import { MistakeNotebookEntry } from './RevisePracticeProgressCBT';
import { CBTQuestion, ErrorRootCauseTag } from '../utils/jeeEngine';
import { MathRichText } from './MathRichText';

export interface MistakeBookAndImprovementModalProps {
  isOpen: boolean;
  mistakes: MistakeNotebookEntry[];
  onClose: () => void;
  onTagRootCause: (mistakeId: string, tag: ErrorRootCauseTag) => void;
  onVerifyMistakeRecheck?: (mistakeId: string, passed: boolean) => void;
  onPracticeMistake: (question: CBTQuestion) => void;
}

const ROOT_CAUSE_TAGS: ErrorRootCauseTag[] = [
  'Conceptual Gap',
  'Formula Forgotten',
  'Calculation/Silly Error',
  'Misread Question',
  'Time Pressure',
];

export const MistakeBookAndImprovementModal: React.FC<
  MistakeBookAndImprovementModalProps
> = ({ isOpen, mistakes, onClose, onTagRootCause, onVerifyMistakeRecheck, onPracticeMistake }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mistake DNA Notebook & Improvement Plan"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden text-slate-900 dark:text-white">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <div>
              <h2 className="text-base font-extrabold">
                Mistake DNA Notebook &amp; Learning Loop Recheck
              </h2>
              <p className="text-xs text-slate-500">
                {mistakes.length} logged errors · Diagnose → Reteach → Recheck → Verify Mastery Delta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-3 text-xs">
          {mistakes.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <div className="font-extrabold text-sm">Zero Unresolved Mistakes Logged</div>
              <div className="text-slate-500 mt-1">
                Incorrect questions from CBT Mock Tests or PYQ Bank are automatically captured here.
              </div>
            </div>
          ) : (
            mistakes.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-extrabold text-[10px]">
                      {m.question.subject} • {m.question.chapter} ({m.source})
                    </span>
                    {typeof m.masteryDelta === 'number' && m.masteryDelta !== 0 && (
                      <span
                        className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] ${
                          m.masteryDelta > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        Mastery {m.masteryDelta > 0 ? `+${m.masteryDelta}%` : `${m.masteryDelta}%`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onVerifyMistakeRecheck && (
                      <>
                        <button
                          type="button"
                          onClick={() => onVerifyMistakeRecheck(m.id, true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Pass Recheck (+8%)
                        </button>
                        <button
                          type="button"
                          onClick={() => onVerifyMistakeRecheck(m.id, false)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-extrabold text-[10px] cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Retry 1d
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onPracticeMistake(m.question);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] cursor-pointer"
                    >
                      <Target className="w-3 h-3" />
                      Re-Attempt
                    </button>
                  </div>
                </div>
                <div className="font-bold text-slate-800 dark:text-slate-100">
                  <MathRichText content={m.question.stem} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-500">Root Cause Tag:</span>
                  {ROOT_CAUSE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onTagRootCause(m.id, tag)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border cursor-pointer ${
                        m.rootCauseTag === tag
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
