import React, { useState } from 'react';
import { X, Database, BookOpen, CheckCircle2 } from 'lucide-react';
import { EXPANDED_NTA_58_CHAPTERS } from '../data/expandedNta58Chapters';
import { CBT_MOCK_QUESTIONS, JEE_ADVANCED_PAPER_QUESTIONS } from '../data/jeeInitialContent';

const CORE_PYQ_COUNT = CBT_MOCK_QUESTIONS.length + JEE_ADVANCED_PAPER_QUESTIONS.length;

export interface AdminQuestionBankModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminQuestionBankModal: React.FC<AdminQuestionBankModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [subjectFilter, setSubjectFilter] = useState<'All' | 'Physics' | 'Chemistry' | 'Mathematics'>('All');

  if (!isOpen) return null;

  const filteredChapters =
    subjectFilter === 'All'
      ? EXPANDED_NTA_58_CHAPTERS
      : EXPANDED_NTA_58_CHAPTERS.filter((c) => c.subject === subjectFilter);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="NTA 58-Chapter & PYQ Bank Inspector"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-slate-900 dark:text-white">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-extrabold">
                Official NTA 58-Chapter Syllabus &amp; PYQ Pack Inspector
              </h2>
              <p className="text-xs text-slate-500">
                {EXPANDED_NTA_58_CHAPTERS.length} Verified NTA Chapters • {CORE_PYQ_COUNT} Core PYQs + Lazy JSON Shift Packs
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

        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-extrabold">
            {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSubjectFilter(sub)}
                className={`px-3 py-1.5 rounded-xl cursor-pointer ${
                  subjectFilter === sub
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
          <span className="text-xs font-bold text-emerald-600 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Showing {filteredChapters.length} chapters
          </span>
        </div>

        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {filteredChapters.map((ch) => (
            <div
              key={ch.id}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  {ch.chapterName}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-extrabold text-[10px]">
                  {ch.subject} • {ch.ntaWeightagePct}%
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Formulas: {ch.keyFormulasLatex.join(' | ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
