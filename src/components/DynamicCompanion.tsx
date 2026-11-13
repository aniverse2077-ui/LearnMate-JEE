import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Coins,
  Camera,
  Zap,
  Send,
  X,
  CheckCircle2,
  ChevronRight,
  Globe,
} from 'lucide-react';
import { EXPANDED_NTA_58_CHAPTERS, MicroShardTask } from '../data/expandedNta58Chapters';
import { getAuthenticatedRequestHeaders } from '../services/workspaceService';

export interface DynamicCompanionProps {
  activeChapterName?: string;
  onEarnXp?: (xp: number, reason?: string) => void;
}

export const DynamicCompanion: React.FC<DynamicCompanionProps> = ({
  activeChapterName = 'Rotational Motion',
  onEarnXp,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [modeTab, setModeTab] = useState<'socratic' | 'shardz' | 'ocr'>('socratic');
  const [language, setLanguage] = useState<'English' | 'Hinglish' | 'Hindi'>('Hinglish');
  const [clueCoins, setClueCoins] = useState<number>(3);
  const [socraticMode, setSocraticMode] = useState<boolean>(true);
  const [questionInput, setQuestionInput] = useState<string>('');
  const [aiReply, setAiReply] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [completedShards, setCompletedShards] = useState<Record<string, boolean>>({});
  const [ocrPreviewDataUrl, setOcrPreviewDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const matchedChapter =
    EXPANDED_NTA_58_CHAPTERS.find((c) =>
      c.chapterName.toLowerCase().includes(activeChapterName.toLowerCase())
    ) || EXPANDED_NTA_58_CHAPTERS[5];

  const shards: MicroShardTask[] = matchedChapter.microShards;

  const handleAskSocratic = async (hintLevel?: 1 | 2 | 3) => {
    const promptText =
      questionInput.trim() ||
      `Give me a step-by-step ${hintLevel ? `Hint #${hintLevel}` : 'concept breakdown'} on ${matchedChapter.chapterName}.`;
    if (hintLevel && clueCoins <= 0) return;
    if (hintLevel) {
      setClueCoins((c) => Math.max(0, c - 1));
    }
    setLoading(true);
    try {
      const headers = await getAuthenticatedRequestHeaders();
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: promptText,
          chapter: matchedChapter.chapterName,
          subject: matchedChapter.subject,
          language,
          socraticMode,
          hintLevel: hintLevel || (socraticMode ? 1 : undefined),
          imageBase64: ocrPreviewDataUrl || undefined,
          imageMimeType: ocrPreviewDataUrl ? 'image/png' : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiReply(
          data?.message ||
            'AI Mentor is temporarily unavailable. Check your server configuration and try again.'
        );
      } else {
        setAiReply(data.answer || 'Completed analysis.');
        onEarnXp?.(15, 'Socratic AI Doubt Solved (+15 XP)');
      }
    } catch (err: any) {
      setAiReply(err?.message || 'Unable to reach AI Tutor endpoint.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setOcrPreviewDataUrl(reader.result);
        setModeTab('ocr');
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      {/* Floating Companion Trigger Pill */}
      <div className="fixed bottom-12 right-5 z-40">
        {!isOpen ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-lg border border-indigo-400/40 cursor-pointer transition-all"
            title="Open Socratic AI Study Companion & 15-Min ShardZ"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Companion • {clueCoins} Clue Coins</span>
          </button>
        ) : (
          <div className="w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-white">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="text-xs font-extrabold">Dynamic JEE Study Companion</div>
                  <div className="text-[10px] text-slate-300 truncate max-w-[200px]">
                    {matchedChapter.subject} • {matchedChapter.chapterName}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-extrabold border border-amber-400/30">
                  <Coins className="w-3 h-3" />
                  {clueCoins}/3 Hints
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Close Dynamic Companion"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Language Selector & Mode Tabs */}
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
                {(
                  [
                    { id: 'socratic', label: '3-Hint Tutor' },
                    { id: 'shardz', label: '15m ShardZ' },
                    { id: 'ocr', label: 'Camera OCR' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setModeTab(t.id)}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                      modeTab === t.id
                        ? 'bg-indigo-600 text-white font-extrabold'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="inline-flex items-center gap-1 text-[10px] font-extrabold">
                <Globe className="w-3 h-3 text-indigo-600" />
                <select
                  aria-label="Select AI Tutor Language"
                  value={language}
                  onChange={(e) =>
                    setLanguage(e.target.value as 'English' | 'Hinglish' | 'Hindi')
                  }
                  className="bg-transparent text-slate-700 dark:text-slate-200 font-extrabold focus:outline-none cursor-pointer"
                >
                  <option value="English">English</option>
                  <option value="Hinglish">Hinglish</option>
                  <option value="Hindi">Hindi</option>
                </select>
              </div>
            </div>

            {/* Body */}
            <div className="p-3.5 max-h-80 overflow-y-auto space-y-3 text-xs">
              {modeTab === 'socratic' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between bg-indigo-50/70 dark:bg-indigo-950/40 px-3 py-2 rounded-xl border border-indigo-100 dark:border-indigo-900">
                    <span className="font-bold text-indigo-950 dark:text-indigo-200 text-[11px]">
                      Socratic 3-Hint Mode (Guide Before Full Answer)
                    </span>
                    <input
                      type="checkbox"
                      checked={socraticMode}
                      onChange={(e) => setSocraticMode(e.target.checked)}
                      className="accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  <textarea
                    rows={2}
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder={`Ask a JEE doubt on ${matchedChapter.chapterName} in ${language}...`}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs focus:outline-none focus:border-indigo-500"
                  />

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={loading || clueCoins < 1}
                      onClick={() => handleAskSocratic(1)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-extrabold text-[11px] cursor-pointer disabled:opacity-50"
                    >
                      Use Coin: Hint 1
                    </button>
                    <button
                      type="button"
                      disabled={loading || clueCoins < 1}
                      onClick={() => handleAskSocratic(2)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-extrabold text-[11px] cursor-pointer disabled:opacity-50"
                    >
                      Hint 2 (Formula)
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleAskSocratic(undefined)}
                      className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3 h-3" />
                      Ask
                    </button>
                  </div>

                  {aiReply && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] leading-relaxed whitespace-pre-wrap">
                      {aiReply}
                    </div>
                  )}
                </div>
              )}

              {modeTab === 'shardz' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-500">
                    15-Minute Active-Recall Micro-Shards for {matchedChapter.chapterName}:
                  </div>
                  {shards.map((shard) => {
                    const done = !!completedShards[shard.id];
                    return (
                      <div
                        key={shard.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                            {shard.title}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                            {shard.durationMinutes} min
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          {shard.activeRecallPrompt}
                        </p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                            Clue: {matchedChapter.keyFormulasLatex[0] || matchedChapter.unitName}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCompletedShards((prev) => ({ ...prev, [shard.id]: !done }));
                              if (!done) onEarnXp?.(20, `Completed 15m Shard: ${shard.title}`);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer ${
                              done
                                ? 'bg-emerald-600 text-white'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                          >
                            {done ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> Done
                              </>
                            ) : (
                              <>
                                Complete <ChevronRight className="w-3 h-3" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {modeTab === 'ocr' && (
                <div className="space-y-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-3 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/30 hover:bg-indigo-50 text-indigo-700 dark:text-indigo-300 font-extrabold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Upload Question Screenshot / Handwritten Doubt</span>
                  </button>
                  {ocrPreviewDataUrl && (
                    <div className="space-y-2">
                      <img
                        src={ocrPreviewDataUrl}
                        alt="Uploaded Doubt OCR Preview"
                        className="max-h-32 rounded-lg border border-slate-200 mx-auto object-contain"
                      />
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleAskSocratic(undefined)}
                        className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold cursor-pointer"
                      >
                        {loading ? 'Scanning Equation...' : `Solve Uploaded Image in ${language}`}
                      </button>
                    </div>
                  )}
                  {aiReply && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] whitespace-pre-wrap">
                      {aiReply}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
