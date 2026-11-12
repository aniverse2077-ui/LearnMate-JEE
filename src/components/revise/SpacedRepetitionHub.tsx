import React, { useState } from 'react';
import {
  Brain,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  calculateSM2Schedule,
  CBTQuestion,
  ErrorRootCauseTag,
  SM2FlashcardItem,
} from '../../utils/jeeEngine';
import { MathRichText } from '../MathRichText';
import { MistakeNotebookEntry } from '../RevisePracticeProgressCBT';
import { MistakeBookView } from './MistakeBookView';

export type { SM2FlashcardItem };

interface SpacedRepetitionHubProps {
  sm2Cards?: SM2FlashcardItem[];
  cards?: SM2FlashcardItem[];
  mistakes?: MistakeNotebookEntry[];
  mistakesNotebook?: MistakeNotebookEntry[];
  onUpdateSM2Card?: (updatedCard: SM2FlashcardItem) => void;
  onUpdateCardSchedule?: (updatedCard: SM2FlashcardItem) => void;
  onAddSM2Card?: (card: Omit<SM2FlashcardItem, 'id'>) => void;
  onAddCustomSM2Card?: (card: Omit<SM2FlashcardItem, 'id'>) => void;
  onTagMistakeRootCause?: (mistakeId: string, rootCause: ErrorRootCauseTag) => void;
  onPracticeMistake?: (question: CBTQuestion) => void;
  onPracticeQuestion?: (question: CBTQuestion) => void;
  showToast?: (msg: string) => void;
}

export const SpacedRepetitionHub: React.FC<SpacedRepetitionHubProps> = ({
  sm2Cards,
  cards,
  mistakes,
  mistakesNotebook,
  onUpdateSM2Card,
  onUpdateCardSchedule,
  onAddSM2Card,
  onAddCustomSM2Card,
  onTagMistakeRootCause,
  onPracticeMistake,
  onPracticeQuestion,
  showToast,
}) => {
  const [subMode, setSubMode] = useState<'neuronz_queue' | 'mistake_book'>('neuronz_queue');
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [reviewedTodayCount, setReviewedTodayCount] = useState<number>(0);

  const dueCards = sm2Cards || cards || [];
  const allMistakes = mistakes || mistakesNotebook || [];
  const activeCard = dueCards[activeIndex % Math.max(1, dueCards.length)] || null;

  const handleUpdateCard = onUpdateSM2Card || onUpdateCardSchedule;
  const handleAddCard = onAddSM2Card || onAddCustomSM2Card;
  const handlePractice = onPracticeMistake || onPracticeQuestion;

  const handleRateCard = (quality: 1 | 3 | 4 | 5) => {
    if (!activeCard) return;
    const nextSchedule = calculateSM2Schedule(
      {
        intervalDays: activeCard.intervalDays ?? 1,
        repetitionCount: activeCard.repetitionCount ?? 0,
        easeFactor: activeCard.easeFactor ?? 2.5,
      },
      quality
    );
    const updated: SM2FlashcardItem = {
      ...activeCard,
      intervalDays: nextSchedule.intervalDays,
      repetitionCount: nextSchedule.repetitionCount,
      easeFactor: nextSchedule.easeFactor,
      nextReviewIso: nextSchedule.nextReviewIso,
    };
    if (handleUpdateCard) handleUpdateCard(updated);
    if (showToast) {
      showToast(
        `SM-2 Scheduled: Next review in ${nextSchedule.intervalDays} day(s) (EF ${nextSchedule.easeFactor})`
      );
    }
    setIsFlipped(false);
    setReviewedTodayCount((c) => c + 1);
    setActiveIndex((idx) => (idx + 1) % Math.max(1, dueCards.length));
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubMode('neuronz_queue')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer transition-all ${
              subMode === 'neuronz_queue'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Brain className="w-4 h-4" />
            Active Recall Queue ({dueCards.length})
          </button>
          <button
            type="button"
            onClick={() => setSubMode('mistake_book')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer transition-all ${
              subMode === 'mistake_book'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Zap className="w-4 h-4" />
            Mistake Book ({allMistakes.length})
          </button>
        </div>

        <div className="text-xs font-bold text-slate-500 flex items-center gap-3">
          <span>
            Reviewed Today: <strong className="text-indigo-600">{reviewedTodayCount}</strong>
          </span>
          <span>
            SM-2 Spaced Repetition
          </span>
        </div>
      </div>

      {subMode === 'mistake_book' ? (
        <MistakeBookView
          mistakes={allMistakes}
          onTagRootCause={(id, cause) => {
            if (onTagMistakeRootCause) onTagMistakeRootCause(id, cause);
          }}
          onPracticeMistake={handlePractice}
          onConvertMistakeToSM2Card={(entry, rootCause) => {
            if (handleAddCard) {
              handleAddCard({
                subject: entry.question.subject,
                chapter: entry.question.chapter,
                frontPrompt: `**[Mistake Remediation • ${rootCause}]** ${entry.question.stem}`,
                backAnswer: `${entry.question.explanation}\n\n*Root Cause Logged: ${rootCause}*`,
                intervalDays: 1,
                repetitionCount: 0,
                easeFactor: 2.5,
                nextReviewIso: new Date().toISOString(),
                rootCauseTag: rootCause,
              });
            }
            if (showToast) {
              showToast(`Converted "${entry.question.chapter}" mistake to NeuronZ SM-2 Queue!`);
            }
          }}
        />
      ) : activeCard ? (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold">
                {activeCard.subject} • {activeCard.chapter}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                SM-2 Interval: {activeCard.intervalDays}d • Repetitions: {activeCard.repetitionCount} • EF: {activeCard.easeFactor}
              </span>
            </div>
            <span className="text-slate-400 font-bold">
              Card {(activeIndex % dueCards.length) + 1} of {dueCards.length}
            </span>
          </div>

          {/* Flashcard Box */}
          <div
            onClick={() => setIsFlipped((f) => !f)}
            className="min-h-60 p-8 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800/80 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 flex flex-col justify-between cursor-pointer transition-all hover:border-indigo-400"
          >
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {isFlipped
                ? 'Back — Formula, Derivation & Exam Trap'
                : 'Front — Active Recall Prompt (Click to Flip)'}
            </div>

            <div className="my-4 text-base font-semibold text-slate-900 dark:text-white leading-relaxed">
              {isFlipped ? (
                <MathRichText content={activeCard.backAnswer} />
              ) : (
                <MathRichText content={activeCard.frontPrompt} />
              )}
            </div>

            <div className="text-xs font-bold text-slate-400 flex items-center justify-between">
              <span>Click card to {isFlipped ? 'view prompt' : 'reveal solution'}</span>
              <span>Next Due: {new Date(activeCard.nextReviewIso).toLocaleDateString()}</span>
            </div>
          </div>

          {/* SM-2 Rating Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => handleRateCard(1)}
              className="p-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-extrabold cursor-pointer text-center"
            >
              <div>Again (Reset)</div>
              <div className="text-[10px] font-semibold opacity-80 mt-0.5">1 Day • EF -0.20</div>
            </button>
            <button
              type="button"
              onClick={() => handleRateCard(3)}
              className="p-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-700 dark:text-amber-300 text-xs font-extrabold cursor-pointer text-center"
            >
              <div>Hard</div>
              <div className="text-[10px] font-semibold opacity-80 mt-0.5">SM-2 Quality 3</div>
            </button>
            <button
              type="button"
              onClick={() => handleRateCard(4)}
              className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold cursor-pointer text-center"
            >
              <div>Good</div>
              <div className="text-[10px] font-semibold opacity-80 mt-0.5">SM-2 Quality 4</div>
            </button>
            <button
              type="button"
              onClick={() => handleRateCard(5)}
              className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold cursor-pointer text-center"
            >
              <div>Easy</div>
              <div className="text-[10px] font-semibold opacity-80 mt-0.5">SM-2 Quality 5 • EF +0.10</div>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <Sparkles className="w-8 h-8 text-indigo-600 mx-auto" />
          <div className="text-sm font-extrabold text-slate-900 dark:text-white">
            Your NeuronZ SM-2 Active Recall Queue is empty
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Upload study materials, add Mind Map nodes to flashcards, or tag a mistake in the Mistake Book to automatically populate your SuperMemo SM-2 queue.
          </p>
        </div>
      )}
    </div>
  );
};
