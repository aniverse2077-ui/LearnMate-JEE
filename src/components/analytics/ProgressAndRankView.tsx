import React, { useState, useMemo } from 'react';
import {
  Award,
  BarChart3,
  CheckCircle2,
  Flame,
  Layers,
  Play,
  Sliders,
  Target,
  TrendingUp,
} from 'lucide-react';
import { predictNtaPercentileAndAir, ExamTrack } from '../../utils/jeeEngine';
import { JEE_SYLLABUS_DATA } from '../../data/jeeInitialContent';

interface ProgressAndRankViewProps {
  lastMockScore: number | null;
  materialsCount: number;
  mistakesCount: number;
  sm2CardsCount?: number;
  completedChapterIds?: string[];
  onStartCBTMock: (mode?: ExamTrack) => void;
  onOpenCustomTestGenerator?: () => void;
  onPracticeWeakTopic: (topic: string) => void;
}

export const ProgressAndRankView: React.FC<ProgressAndRankViewProps> = ({
  lastMockScore,
  materialsCount,
  mistakesCount,
  completedChapterIds = [],
  onStartCBTMock,
  onOpenCustomTestGenerator,
  onPracticeWeakTopic,
}) => {
  const [shiftDifficulty, setShiftDifficulty] = useState<'Easy' | 'Moderate' | 'Tough'>('Moderate');
  const [simulatedScore, setSimulatedScore] = useState<number>(lastMockScore ?? 185);
  const [heatmapSubject, setHeatmapSubject] = useState<
    'All' | 'Physics' | 'Chemistry' | 'Mathematics'
  >('All');

  const activeScore = lastMockScore !== null ? lastMockScore : simulatedScore;
  const prediction = useMemo(
    () =>
      predictNtaPercentileAndAir({
        score: activeScore,
        maxScore: 300,
        shiftDifficulty,
      }),
    [activeScore, shiftDifficulty]
  );

  const filteredSyllabus = useMemo(
    () =>
      JEE_SYLLABUS_DATA.filter(
        (ch) => heatmapSubject === 'All' || ch.subject === heatmapSubject
      ),
    [heatmapSubject]
  );

  return (
    <div className="w-full px-6 lg:px-10 xl:px-12 py-6 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Progress &amp; Rank Predictor
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          {onOpenCustomTestGenerator && (
            <button
              type="button"
              onClick={onOpenCustomTestGenerator}
              className="px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              Build Custom Test
            </button>
          )}
          <button
            type="button"
            onClick={() => onStartCBTMock('JEE Main')}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Take 75-Q CBT Mock
          </button>
        </div>
      </div>

      {/* Shift Percentile & AIR Predictor Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold">
              Shift Percentile &amp; AIR Predictor
            </span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {(['Easy', 'Moderate', 'Tough'] as const).map((shift) => (
                <button
                  key={shift}
                  type="button"
                  onClick={() => setShiftDifficulty(shift)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    shiftDifficulty === shift
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {shift} Shift
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900">
              <div className="text-[11px] font-bold text-slate-500">Predicted NTA Percentile</div>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {prediction.percentile}%ile
              </div>
              <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                {shiftDifficulty} Shift Normalization
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900">
              <div className="text-[11px] font-bold text-slate-500">Predicted AIR Band</div>
              <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                AIR {prediction.predictedAirMin.toLocaleString()} – {prediction.predictedAirMax.toLocaleString()}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                Out of 14.2 Lakh Candidates
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900">
              <div className="text-[11px] font-bold text-slate-500">Score Evaluated (/300)</div>
              <div className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">
                {activeScore} / 300
              </div>
              <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                {lastMockScore !== null ? 'From Latest CBT Attempt' : 'Interactive What-If Slider'}
              </div>
            </div>
          </div>

          {/* Interactive What-If Score Slider */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Simulate Target Score Out of 300 Marks:</span>
              <span className="text-indigo-600 font-extrabold">{activeScore} / 300 Marks</span>
            </div>
            <input
              type="range"
              min={0}
              max={300}
              step={5}
              value={activeScore}
              onChange={(e) => setSimulatedScore(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Projected Institute Tier: <span className="text-indigo-600 dark:text-indigo-400">{prediction.targetInstituteTier}</span>
            </div>
          </div>
        </div>

        {/* Right: Negative Marking Bleed & Telemetry */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Workspace &amp; Negative-Marking Bleed Telemetry
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Track uploaded study bundles, Mistake Book root causes, and syllabus coverage
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
              <span className="font-bold text-slate-600 dark:text-slate-300">Uploaded Study Bundles</span>
              <span className="font-extrabold text-indigo-600">{materialsCount}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
              <span className="font-bold text-slate-600 dark:text-slate-300">Mistake Book Questions Logged</span>
              <span className="font-extrabold text-rose-600">{mistakesCount} Qs (-{mistakesCount} Marks Bleed)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
              <span className="font-bold text-slate-600 dark:text-slate-300">Official NTA Syllabus Chapters</span>
              <span className="font-extrabold text-emerald-600">{JEE_SYLLABUS_DATA.length} Chapters (20P • 20C • 18M)</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onStartCBTMock('JEE Advanced')}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer"
          >
            Launch JEE Advanced Paper 1 (+4/-2 Partial &amp; Matrix-Match)
          </button>
        </div>
      </div>

      {/* 58-Chapter Official NTA Syllabus Mastery Heatmap */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              58-Chapter Official NTA JEE Main &amp; Advanced Mastery Heatmap
            </h2>
            <p className="text-xs text-slate-500">
              Click any chapter cell to launch a targeted Weak-Chapter Remediation Drill
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
              <button
                key={subj}
                type="button"
                onClick={() => setHeatmapSubject(subj)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  heatmapSubject === subj
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {subj}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {filteredSyllabus.map((ch) => {
            const isDone = completedChapterIds.includes(ch.id);
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onPracticeWeakTopic(ch.chapter)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isDone
                    ? 'border-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40'
                    : ch.weightageTier === 'High'
                    ? 'border-indigo-200/80 dark:border-indigo-900/70 bg-indigo-50/30 dark:bg-indigo-950/20 hover:border-indigo-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <span>{ch.subject} • Class {ch.classLevel}</span>
                    <span
                      className={
                        ch.weightageTier === 'High'
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-500'
                      }
                    >
                      {ch.weightageTier} ({ch.expectedQs})
                    </span>
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white mt-1 line-clamp-1">
                    {ch.chapter}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-500">{ch.examScope}</span>
                  <span className="text-indigo-600 dark:text-indigo-400">Drill →</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
