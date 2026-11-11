import React, { useState, useRef } from 'react';
import {
  CheckCircle2,
  Plus,
  Play,
  FileText,
  Video,
  Upload,
  Image as ImageIcon,
  Youtube,
  Type as TypeIcon,
  Flame,
  Zap,
  Award,
  Mic,
  Camera,
  Send,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Edit3,
  Maximize2,
  Sparkles,
  Volume2,
  Download,
  Bookmark,
  ExternalLink,
  Search,
  Calendar,
  Box,
  Layers,
  Headphones,
  BookOpen,
  Compass,
  FolderOpen,
} from 'lucide-react';
import {
  D_AND_F_BLOCK_PAGES,
  DIAGRAM_SVG_PRESETS,
} from '../data/jeeInitialContent';
import { ThreeSceneCanvas, Preset3DId } from './ThreeSceneCanvas';

export interface MaterialItem {
  id: string;
  title: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
  sourceRef?: string;
  pageCount: number;
  currentPage: number;
  progressPct: number;
  contentSummary: string;
  addedLabel?: string;
}

export interface StudyTaskItem {
  id: string;
  title: string;
  durationMin: number;
  completed: boolean;
  dueDate: string;
}

export interface CreationItem {
  id: string;
  type: 'diagram' | '3d' | 'visual' | 'video';
  title: string;
  prompt: string;
  subject: string;
  preset?: string;
  assetData: string;
  resolutionOrRatio?: string;
}

interface HomeDashboardProps {
  userName: string;
  materials: MaterialItem[];
  tasks: StudyTaskItem[];
  streakDays: number;
  xp: number;
  level: number;
  onToggleTask: (taskId: string) => void;
  onAddTask: (title: string, durationMin: number) => void;
  onSyncWorkspaceTasks: () => void;
  onOpenStudyWorkbench: (material?: MaterialItem) => void;
  onOpenRevise: () => void;
  onOpenPractice: () => void;
  onOpenProgress: () => void;
  onOpenAddMaterial: (tab: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive') => void;
  onOpenStudyTools: () => void;
}

export const HomeDashboardView: React.FC<HomeDashboardProps> = ({
  userName,
  materials,
  tasks,
  streakDays,
  xp,
  level,
  onToggleTask,
  onAddTask,
  onSyncWorkspaceTasks,
  onOpenStudyWorkbench,
  onOpenRevise,
  onOpenPractice,
  onOpenProgress,
  onOpenAddMaterial,
  onOpenStudyTools,
}) => {
  const [workspaceMode, setWorkspaceMode] = useState<'daily' | 'subjects'>('daily');
  const [examTarget, setExamTarget] = useState('JEE Main 2027');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showNewTaskInput, setShowNewTaskInput] = useState(false);

  // Ask a Doubt state
  const [doubtLang, setDoubtLang] = useState<'English' | 'Hinglish'>('English');
  const [doubtInput, setDoubtInput] = useState('');
  const [doubtResponse, setDoubtResponse] = useState<string | null>(null);
  const [doubtLoading, setDoubtLoading] = useState(false);
  const [recordingMic, setRecordingMic] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleAskDoubt = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!doubtInput.trim()) return;
    setDoubtLoading(true);
    setDoubtResponse(null);
    try {
      const res = await fetch('/api/ai/think', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: doubtInput,
          language: doubtLang,
          mode: 'Notes + JEE',
          chapterContext:
            'JEE Main & Advanced Physics, Chemistry (d & f Block, Electrochemistry), and Mathematics.',
        }),
      });
      const data = await res.json();
      setDoubtResponse(
        data.text || 'Could not generate response. Please try asking your JEE doubt again.'
      );
    } catch (err: any) {
      setDoubtResponse(err?.message || 'Error contacting AI Tutor.');
    } finally {
      setDoubtLoading(false);
    }
  };

  const handleToggleMic = async () => {
    if (recordingMic && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecordingMic(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = String(reader.result || '').split(',')[1] || '';
          if (!base64) return;
          setDoubtLoading(true);
          try {
            const res = await fetch('/api/ai/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: base64, mimeType: 'audio/webm' }),
            });
            const data = await res.json();
            if (data.text) {
              setDoubtInput(data.text);
            }
          } finally {
            setDoubtLoading(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingMic(true);
    } catch {
      setDoubtResponse('Microphone permission is required for voice doubt transcription.');
    }
  };

  const handleDoubtPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDoubtLoading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = String(reader.result || '').split(',')[1] || '';
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaBase64: base64,
            mimeType: file.type || 'image/jpeg',
            sourceType: 'photo',
            prompt: `Solve this JEE problem step-by-step in ${doubtLang} and highlight any common exam traps.`,
          }),
        });
        const data = await res.json();
        setDoubtResponse(data.text || 'Analyzed photo successfully.');
        setDoubtLoading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setDoubtLoading(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Greeting & Mode Switcher matching Screens 3, 9, 11 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {workspaceMode === 'daily' ? (
            <>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight">
                Good morning, {userName}
              </h1>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs">
                <span>Target:</span>
                <select
                  aria-label="Target Exam"
                  value={examTarget}
                  onChange={(e) => setExamTarget(e.target.value)}
                  className="font-bold text-slate-900 dark:text-white bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="JEE Main 2027">JEE Main 2027</option>
                  <option value="JEE Advanced 2027">JEE Advanced 2027</option>
                </select>
              </div>
            </>
          ) : (
            <div>
              <div className="text-xs font-semibold text-[#4F46E5]">Home</div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
                JEE Study Workspace
              </h1>
            </div>
          )}
        </div>

        <div className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setWorkspaceMode('daily')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              workspaceMode === 'daily'
                ? 'bg-white dark:bg-slate-900 text-[#4F46E5] shadow-2xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Daily Dashboard
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceMode('subjects')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              workspaceMode === 'subjects'
                ? 'bg-white dark:bg-slate-900 text-[#4F46E5] shadow-2xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            JEE Study Workspace
          </button>
        </div>
      </div>

      {workspaceMode === 'subjects' ? (
        /* Screen 3 & 11: JEE Study Workspace Subject Cards + Shortcuts + Recent Material */
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { subject: 'Physics', pct: 42, color: 'text-blue-600 bg-blue-50', symbol: '⚗' },
              { subject: 'Chemistry', pct: 57, color: 'text-emerald-600 bg-emerald-50', symbol: '🧪' },
              { subject: 'Mathematics', pct: 49, color: 'text-amber-600 bg-amber-50', symbol: '∑' },
            ].map((card) => (
              <div
                key={card.subject}
                onClick={() => onOpenStudyWorkbench()}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-[#4F46E5] transition-all cursor-pointer space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${card.color}`}
                    >
                      {card.symbol}
                    </div>
                    <span className="font-display font-bold text-base text-slate-900 dark:text-white">
                      {card.subject}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-[#4F46E5] rounded-full"
                      style={{ width: `${card.pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
                    {card.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">
              Shortcuts
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={onOpenStudyTools}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 hover:border-[#4F46E5] transition-colors text-left cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  Study Tools
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAddMaterial('youtube')}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 hover:border-[#4F46E5] transition-colors text-left cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  Add Material
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOpenStudyWorkbench()}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 hover:border-[#4F46E5] transition-colors text-left cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  JEE Syllabus
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">
              Recent Material
            </h2>
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                    <th className="py-3.5 px-5 font-semibold">Material</th>
                    <th className="py-3.5 px-5 font-semibold text-right">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[
                    { name: 'Thermodynamics.pdf', badge: 'PDF', badgeColor: 'bg-red-100 text-red-700', added: 'Today' },
                    { name: 'Definite Integration - Part 1', badge: 'YT', badgeColor: 'bg-red-100 text-red-700', added: 'Yesterday' },
                    { name: 'Organic Reactions Notes.jpg', badge: 'IMG', badgeColor: 'bg-emerald-100 text-emerald-700', added: '3 Jan' },
                    ...materials.map((m) => ({
                      name: m.title,
                      badge: m.sourceType.toUpperCase(),
                      badgeColor: 'bg-indigo-100 text-indigo-700',
                      added: m.addedLabel || 'Today',
                    })),
                  ].map((row, idx) => (
                    <tr
                      key={idx}
                      onClick={() => onOpenStudyWorkbench()}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    >
                      <td className="py-3.5 px-5 flex items-center gap-3 font-medium text-slate-900 dark:text-white">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.badgeColor}`}>
                          {row.badge}
                        </span>
                        <span>{row.name}</span>
                      </td>
                      <td className="py-3.5 px-5 text-right text-xs text-slate-500">{row.added}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Screen 9: Main 2-Column Daily Study Dashboard */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7-Column Stack */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. My Tasks Card */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  My Tasks ({tasks.length})
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onSyncWorkspaceTasks}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#4F46E5] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#4F46E5]" />
                    <span>Sync Calendar & Tasks</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewTaskInput((v) => !v)}
                    className="text-xs font-bold text-[#4F46E5] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Task</span>
                  </button>
                </div>
              </div>

              {showNewTaskInput && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="e.g., Solve 15 Conic Section PYQs"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newTaskTitle.trim()) {
                        onAddTask(newTaskTitle.trim(), 25);
                        setNewTaskTitle('');
                        setShowNewTaskInput(false);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#4F46E5] text-white text-xs font-semibold cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              )}

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => onToggleTask(task.id)}
                        className="w-4 h-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                      />
                      <span
                        className={`text-sm font-medium ${
                          task.completed
                            ? 'line-through text-slate-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {task.title}
                      </span>
                    </label>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium tabular-nums">
                        {task.durationMin} min
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          task.title.toLowerCase().includes('pyq')
                            ? onOpenPractice()
                            : onOpenStudyWorkbench()
                        }
                        className="px-3 py-1 rounded-lg bg-[#EEF2FF] text-[#4F46E5] font-semibold text-xs hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        Start
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Continue With Card */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <div>
                <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  Continue with: d &amp; f Block – Handwritten Notes
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Chemistry • Page 2 of 13</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenStudyWorkbench(materials[0])}
                  className="px-4 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume Study</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenRevise}
                  className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Quick Revise
                </button>
                <button
                  type="button"
                  onClick={onOpenPractice}
                  className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Practice 10 Qs
                </button>
              </div>
            </div>

            {/* 3. My Materials Card */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  My Materials
                </h2>
                <button
                  type="button"
                  onClick={() => onOpenStudyWorkbench()}
                  className="text-xs font-semibold text-[#4F46E5] hover:underline cursor-pointer"
                >
                  View All
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {materials.map((mat) => (
                  <div
                    key={mat.id}
                    className="py-3 first:pt-0 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">
                        {mat.sourceType === 'youtube' ? (
                          <Video className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {mat.title}
                        </div>
                        <div className="text-xs text-slate-500">
                          {mat.subject} •{' '}
                          {mat.sourceType === 'youtube' ? '42 min' : `${mat.pageCount} pages`}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenStudyWorkbench(mat)}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('pdf')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                  <span>Upload PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('photo')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                  <span>Photo Notes</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('youtube')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                  <span>YouTube Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('text')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                  <span>Paste Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('drive')}
                  className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/50 text-xs font-semibold text-[#4F46E5] hover:bg-indigo-100 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Google Drive</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right 5-Column Stack */}
          <div className="lg:col-span-5 space-y-5">
            {/* Gamification Bar & Daily Challenge */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold border-b border-slate-100 dark:border-slate-800 pb-3.5">
                <div className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                  <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>{streakDays}-day Streak</span>
                </div>
                <span className="text-slate-200">|</span>
                <div className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>XP {xp}</span>
                </div>
                <span className="text-slate-200">|</span>
                <div className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                  <Award className="w-4 h-4 text-[#4F46E5]" />
                  <span>Level {level}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">Daily Challenge</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                    +50 XP
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Finish 15 PYQs today</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-[#4F46E5] rounded-full w-[60%]" />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 tabular-nums">9 / 15</span>
                </div>
              </div>
            </div>

            {/* Ask a Doubt Card with English | Hinglish + Mic Transcription + Photo OCR + Gemini 4 Carbon */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  Ask a Doubt
                </h2>
                <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
                  {(['English', 'Hinglish'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setDoubtLang(lang)}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        doubtLang === lang
                          ? 'bg-[#EEF2FF] text-[#4F46E5]'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAskDoubt}>
                <input
                  type="text"
                  value={doubtInput}
                  onChange={(e) => setDoubtInput(e.target.value)}
                  placeholder="Ask any JEE concept or question..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                />
                <div className="flex items-center justify-between gap-2 mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleMic}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                        recordingMic
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{recordingMic ? 'Stop Mic' : 'Mic'}</span>
                    </button>
                    <label className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleDoubtPhotoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={doubtLoading}
                    className="px-4 py-1.5 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{doubtLoading ? 'Thinking...' : 'Ask'}</span>
                  </button>
                </div>
              </form>

              {doubtResponse && (
                <div className="p-3.5 rounded-xl bg-[#EEF2FF]/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                  {doubtResponse}
                </div>
              )}
            </div>

            {/* Due Today Card */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex items-center justify-between shadow-2xs">
              <div>
                <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  Due Today (1)
                </h2>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
                  12 flashcards due
                </div>
                <div className="text-xs text-slate-500">d &amp; f Block • 5 min</div>
              </div>
              <button
                type="button"
                onClick={onOpenRevise}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Review Now
              </button>
            </div>

            {/* Last Mock Card */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex items-center justify-between shadow-2xs">
              <div>
                <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  Last Mock
                </h2>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
                  JEE Main Mock 3
                </div>
                <div className="text-xs text-slate-500">Score: 176 / 300 • Accuracy: 78%</div>
              </div>
              <button
                type="button"
                onClick={onOpenProgress}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                View Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Study View Container: Study Workbench (Screen 10), Create Studio (Screens 2 & 4), Resources Hub (Screen 8)
// ============================================================================
interface StudyViewProps {
  initialSubTab?: 'Syllabus' | 'Chapter Notes' | 'My Materials' | 'AI Tutor' | 'Create' | 'Resources';
  materials: MaterialItem[];
  creations: CreationItem[];
  onSaveCreation: (creation: Omit<CreationItem, 'id'>) => Promise<void>;
  onAddQuickSheetMaterial: (title: string, subject: 'Physics' | 'Chemistry' | 'Mathematics', summary: string) => Promise<void>;
  onOpenVoiceTutor: () => void;
  onStartPracticeQuiz: () => void;
}

export const StudyWorkspaceView: React.FC<StudyViewProps> = ({
  initialSubTab = 'Chapter Notes',
  materials,
  creations,
  onSaveCreation,
  onAddQuickSheetMaterial,
  onOpenVoiceTutor,
  onStartPracticeQuiz,
}) => {
  const [subTab, setSubTab] = useState<
    'Syllabus' | 'Chapter Notes' | 'My Materials' | 'AI Tutor' | 'Create' | 'Resources'
  >(initialSubTab);
  const [syllabusExam, setSyllabusExam] = useState<'Main' | 'Advanced'>('Main');
  const [notesDensity, setNotesDensity] = useState<'Full' | 'Quick'>('Full');

  // Study Workbench state (Screen 10)
  const [pageIdx, setPageIdx] = useState(1); // Default Page 2 of 13 matching Screen 10
  const [zoomLevel, setZoomLevel] = useState(100);
  const [annotateMode, setAnnotateMode] = useState(false);
  const [userAnnotations, setUserAnnotations] = useState<Record<number, string>>({});
  const [tutorScope, setTutorScope] = useState<'Notes + JEE' | 'Only My Notes' | 'Teach It Back'>(
    'Notes + JEE'
  );
  const [tutorLang, setTutorLang] = useState<'English' | 'Hinglish'>('English');
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [tutorReply, setTutorReply] = useState<string | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);

  // Create Studio state (Screens 2 & 4)
  const [createTab, setCreateTab] = useState<
    'Diagram Maker' | 'Visual' | 'Animated Lesson' | 'Saved Library'
  >('Diagram Maker');
  const [selectedMaterialTitle, setSelectedMaterialTitle] = useState('JEE Main 2027 Paper 1');
  const [sourcePageLabel, setSourcePageLabel] = useState('Page 8');
  const [diagramPrompt, setDiagramPrompt] = useState(
    'Free-body diagram of a block on an inclined plane, show only gravity (down) and normal (perpendicular to incline).'
  );
  const [diagramCategory, setDiagramCategory] = useState('Auto-detect');
  const [subjectFilter, setSubjectFilter] = useState<'All' | 'Physics' | 'Chemistry' | 'Maths'>(
    'All'
  );
  const [activePreset, setActivePreset] = useState<Preset3DId>('Incline');
  const [renderMode, setRenderMode] = useState<'2D SVG' | '3D Interactive'>('2D SVG');
  const [diagramZoom, setDiagramZoom] = useState(100);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Visual (1K/2K/4K Gemini 3 Pro Image + Nano Banana 2.1 Edit) state
  const [visualEngine, setVisualEngine] = useState<'pro' | 'nano'>('pro');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [visualLoading, setVisualLoading] = useState(false);
  const [visualError, setVisualError] = useState<string | null>(null);
  const [editBase64, setEditBase64] = useState<string | null>(null);

  // Animated Lesson (Omni Flash 16:9 / 9:16 video) state
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoPhotoBase64, setVideoPhotoBase64] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Resources Hub state (Screen 8)
  const [resourceSubTab, setResourceSubTab] = useState<
    'Official Portals' | 'Exam Guide' | 'Quick Sheets'
  >('Official Portals');
  const [examGuideTab, setExamGuideTab] = useState<
    'Pattern' | 'Marking' | 'Exam Rules' | 'Schedule'
  >('Pattern');
  const [quickSheetSubject, setQuickSheetSubject] = useState<
    'Physics' | 'Chemistry' | 'Mathematics'
  >('Physics');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{
    text: string;
    sources: { title: string; uri: string }[];
  } | null>(null);
  const [searchingWeb, setSearchingWeb] = useState(false);

  const currentPageData = D_AND_F_BLOCK_PAGES[pageIdx] || D_AND_F_BLOCK_PAGES[1];

  const handleTutorExplain = async (style: 'Simpler' | 'Deeper' | 'Custom') => {
    setTutorLoading(true);
    const promptText =
      style === 'Simpler'
        ? `Explain Page ${currentPageData.pageNumber} (${currentPageData.heading}) in simpler intuitive terms with an everyday analogy for JEE.`
        : style === 'Deeper'
        ? `Provide a rigorous JEE Advanced level explanation of ${currentPageData.heading}, including orbital energy splitting, exceptions, and numerical traps.`
        : tutorQuestion;

    try {
      const res = await fetch('/api/ai/think', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          language: tutorLang,
          mode: tutorScope,
          chapterContext: JSON.stringify(currentPageData),
        }),
      });
      const data = await res.json();
      setTutorReply(data.text || 'Explanation ready.');
      if (style === 'Custom') setTutorQuestion('');
    } catch {
      setTutorReply('Could not reach AI Tutor.');
    } finally {
      setTutorLoading(false);
    }
  };

  const handlePlayTTS = async () => {
    setTtsPlaying(true);
    try {
      const textToSpeak = tutorReply || currentPageData.aiTutorSummary[tutorLang === 'Hinglish' ? 'hinglish' : 'english'];
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak }),
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
        src.onended = () => setTtsPlaying(false);
        src.start();
      } else {
        setTtsPlaying(false);
      }
    } catch {
      setTtsPlaying(false);
    }
  };

  const handleExportSvg = () => {
    const svgContent = DIAGRAM_SVG_PRESETS[activePreset];
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LearnMate_${activePreset.replace(/\s+/g, '_')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveDiagramOr3D = async () => {
    await onSaveCreation({
      type: renderMode === '3D Interactive' ? '3d' : 'diagram',
      title: `${activePreset} (${renderMode})`,
      prompt: diagramPrompt,
      subject: subjectFilter === 'All' ? 'Physics' : subjectFilter,
      preset: activePreset,
      assetData: DIAGRAM_SVG_PRESETS[activePreset],
      resolutionOrRatio: renderMode,
    });
    setSaveBanner(`Saved "${activePreset}" to your Saved Library!`);
    setTimeout(() => setSaveBanner(null), 3000);
  };

  const handleGenerateVisual = async () => {
    setVisualLoading(true);
    setVisualError(null);
    try {
      const endpoint = visualEngine === 'pro' ? '/api/ai/image-pro' : '/api/ai/image-edit';
      const body =
        visualEngine === 'pro'
          ? { prompt: diagramPrompt, imageSize }
          : { prompt: diagramPrompt, imageBase64: editBase64, mimeType: 'image/png' };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error || 'Could not generate concept visual.');
      }
      setGeneratedImageUrl(data.imageUrl);
      await onSaveCreation({
        type: 'visual',
        title: `${activePreset} Visual (${visualEngine === 'pro' ? imageSize : 'Nano Banana 2.1'})`,
        prompt: diagramPrompt,
        subject: subjectFilter,
        preset: activePreset,
        assetData: data.imageUrl,
        resolutionOrRatio: visualEngine === 'pro' ? imageSize : 'Edited',
      });
    } catch (err: any) {
      setVisualError(err?.message || 'Visual generation failed.');
    } finally {
      setVisualLoading(false);
    }
  };

  const handleGenerateAnimatedVideo = async () => {
    setVideoLoading(true);
    setVideoError(null);
    try {
      const res = await fetch('/api/ai/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Educational JEE physics/chemistry animated explanation: ${diagramPrompt}`,
          aspectRatio: videoAspectRatio,
          imageBase64: videoPhotoBase64,
          mimeType: 'image/png',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.videoUrl) {
        throw new Error(data.error || 'Could not generate Omni Flash video.');
      }
      setGeneratedVideoUrl(data.videoUrl);
      await onSaveCreation({
        type: 'video',
        title: `${activePreset} Animated Lesson (${videoAspectRatio})`,
        prompt: diagramPrompt,
        subject: subjectFilter,
        preset: activePreset,
        assetData: data.videoUrl,
        resolutionOrRatio: videoAspectRatio,
      });
    } catch (err: any) {
      setVideoError(err?.message || 'Video generation failed.');
    } finally {
      setVideoLoading(false);
    }
  };

  const handleGroundedSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchingWeb(true);
    try {
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      setSearchResult({
        text: data.text || 'No grounded results returned.',
        sources: data.sources || [],
      });
    } finally {
      setSearchingWeb(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col">
      {/* Secondary Sub-Navigation Bar matching Screen 10 */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('Syllabus')}
            className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
              subTab === 'Syllabus' ? 'text-[#4F46E5] bg-[#EEF2FF]' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Syllabus
          </button>
          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px]">
            {(['Main', 'Advanced'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSyllabusExam(m)}
                className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                  syllabusExam === m ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'text-slate-500'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <span className="text-slate-200 dark:text-slate-700">|</span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('Chapter Notes')}
            className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
              subTab === 'Chapter Notes'
                ? 'text-[#4F46E5] bg-[#EEF2FF]'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Chapter Notes
          </button>
          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px]">
            {(['Full', 'Quick'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setNotesDensity(d);
                  setSubTab('Chapter Notes');
                }}
                className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                  notesDensity === d ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'text-slate-500'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {(['My Materials', 'AI Tutor', 'Create', 'Resources'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSubTab(tab)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              subTab === tab
                ? 'bg-[#EEF2FF] text-[#4F46E5]'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content Area by Sub-Tab */}
      {(subTab === 'Chapter Notes' || subTab === 'AI Tutor' || subTab === 'Syllabus' || subTab === 'My Materials') && (
        /* Screen 10: LearnMate JEE Study Workbench */
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-4 flex-1 flex flex-col gap-4">
          {/* Breadcrumb & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-sm text-slate-500">Study</span>
              <span className="text-slate-300">/</span>
              <h1 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                d &amp; f Block
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Synced
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onStartPracticeQuiz}
                className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Chapter Quiz
              </button>
              <button
                type="button"
                onClick={onStartPracticeQuiz}
                className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Adaptive Drill
              </button>
              <button
                type="button"
                onClick={onOpenVoiceTutor}
                className="px-3.5 py-1.5 rounded-xl bg-[#EEF2FF] text-[#4F46E5] border border-indigo-200 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-indigo-100 cursor-pointer"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Voice Tutor</span>
              </button>
            </div>
          </div>

          {/* Split-Screen Workbench */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
            {/* Left Document Viewer (7 Cols) */}
            <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-hidden shadow-2xs">
              {/* Viewer Top Toolbar */}
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
                      aria-label="Previous page"
                      className="p-1.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 py-1 font-semibold border-x border-slate-200 dark:border-slate-700 tabular-nums">
                      {currentPageData.pageNumber} / 13
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPageIdx((p) => Math.min(D_AND_F_BLOCK_PAGES.length - 1, p + 1))
                      }
                      aria-label="Next page"
                      className="p-1.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(75, z - 15))}
                      aria-label="Zoom out notes"
                      className="px-2 py-1 hover:bg-slate-50 cursor-pointer"
                    >
                      −
                    </button>
                    <span className="px-2.5 py-1 border-x border-slate-200 dark:border-slate-700 font-mono tabular-nums">
                      {zoomLevel}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(145, z + 15))}
                      aria-label="Zoom in notes"
                      className="px-2 py-1 hover:bg-slate-50 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-lg bg-[#EEF2FF] text-[#4F46E5] font-semibold inline-flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    PDF View
                  </span>
                  <button
                    type="button"
                    onClick={() => setAnnotateMode((v) => !v)}
                    className={`px-3 py-1 rounded-lg border font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                      annotateMode
                        ? 'border-[#4F46E5] bg-indigo-50 text-[#4F46E5]'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Annotate</span>
                  </button>
                </div>
              </div>

              {/* Document Sheet Content matching Screen 10 */}
              <div
                className="p-6 sm:p-8 space-y-5 flex-1 overflow-y-auto"
                style={{ fontSize: `${zoomLevel}%` }}
              >
                <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white">
                  {currentPageData.heading}
                </h2>

                {currentPageData.sections.map((sec, idx) => (
                  <div key={idx} className="space-y-2">
                    <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                      {sec.numberTitle}
                    </h3>
                    {sec.paragraphs?.map((p, pIdx) => (
                      <p
                        key={pIdx}
                        className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                      >
                        {p}
                      </p>
                    ))}
                    {sec.bullets && (
                      <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        {sec.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {sec.formulas && (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 space-y-1 font-mono text-xs text-slate-800 dark:text-slate-200">
                        {sec.formulas.map((f, fIdx) => (
                          <div key={fIdx}>{f}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {annotateMode && (
                  <div className="pt-3 border-t border-dashed border-indigo-200">
                    <label className="block text-xs font-bold text-[#4F46E5] mb-1">
                      Your Margin Annotation (Page {currentPageData.pageNumber})
                    </label>
                    <textarea
                      rows={2}
                      value={userAnnotations[currentPageData.pageNumber] || ''}
                      onChange={(e) =>
                        setUserAnnotations((prev) => ({
                          ...prev,
                          [currentPageData.pageNumber]: e.target.value,
                        }))
                      }
                      placeholder="Write a personal note or mnemonic for this page..."
                      className="w-full p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/30 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Bottom Page Progress Bar */}
              <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 text-xs text-slate-500">
                <span>Page Progress</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-[#4F46E5] rounded-full transition-all"
                    style={{ width: `${Math.round(((pageIdx + 1) / 13) * 100)}%` }}
                  />
                </div>
                <span className="font-semibold tabular-nums">
                  {currentPageData.pageNumber} / 13 pages
                </span>
              </div>
            </div>

            {/* Right AI Tutor Panel (5 Cols) matching Screen 10 */}
            <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between space-y-4 shadow-2xs">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                    AI Tutor
                  </h2>
                  <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px] font-semibold">
                    {(['English', 'Hinglish'] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setTutorLang(l)}
                        className={`px-2 py-0.5 rounded cursor-pointer ${
                          tutorLang === l ? 'bg-white text-[#4F46E5] shadow-2xs' : 'text-slate-500'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode Tabs + Topics + Create Dropdown */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-1">
                    {(['Notes + JEE', 'Only My Notes', 'Teach It Back'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTutorScope(m)}
                        className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                          tutorScope === m
                            ? 'bg-[#EEF2FF] text-[#4F46E5]'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCreateDropdown((v) => !v)}
                      className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-[#EEF2FF]/60 text-[#4F46E5] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create ▾</span>
                    </button>

                    {showCreateDropdown && (
                      <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 z-20 text-xs">
                        {(
                          [
                            { label: 'Diagram', tab: 'Diagram Maker' },
                            { label: 'Visual', tab: 'Visual' },
                            { label: 'Animated Lesson', tab: 'Animated Lesson' },
                          ] as const
                        ).map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              setShowCreateDropdown(false);
                              setCreateTab(item.tab);
                              setSubTab('Create');
                            }}
                            className="w-full px-3.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" />
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Page Explanation Card */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/40 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5] text-xs font-bold">
                      Page {currentPageData.pageNumber}
                    </span>
                    <button
                      type="button"
                      onClick={handlePlayTTS}
                      disabled={ttsPlaying}
                      className="text-xs font-semibold text-[#4F46E5] inline-flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{ttsPlaying ? 'Speaking...' : 'Read Aloud'}</span>
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {tutorReply ||
                      currentPageData.aiTutorSummary[
                        tutorLang === 'Hinglish' ? 'hinglish' : 'english'
                      ]}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={tutorLoading}
                      onClick={() => handleTutorExplain('Simpler')}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      Explain Simpler
                    </button>
                    <button
                      type="button"
                      disabled={tutorLoading}
                      onClick={() => handleTutorExplain('Deeper')}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      Explain Deeper
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Ask a Question Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (tutorQuestion.trim()) handleTutorExplain('Custom');
                }}
                className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800"
              >
                <input
                  type="text"
                  value={tutorQuestion}
                  onChange={(e) => setTutorQuestion(e.target.value)}
                  placeholder="Ask a Question..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-[#4F46E5]"
                />
                <button
                  type="submit"
                  disabled={tutorLoading}
                  aria-label="Send question to AI Tutor"
                  className="p-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {subTab === 'Create' && (
        /* Screens 2 & 4: Create Studio (Diagram Maker, 3D Three.js, Visual 1K/2K/4K, Animated Lesson) */
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
          <div className="space-y-2">
            <div className="text-xs text-slate-500">
              Study / <span className="text-[#4F46E5] font-semibold">Create</span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
              Create
            </h1>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Source: {selectedMaterialTitle}
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                {sourcePageLabel}
              </span>
            </div>
          </div>

          {/* 4 Sub-Tabs matching Screen 2 & 4 */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto">
            {(
              [
                'Diagram Maker',
                'Visual',
                'Animated Lesson',
                'Saved Library',
              ] as const
            ).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCreateTab(tab)}
                className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  createTab === tab
                    ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]'
                    : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {saveBanner && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
              {saveBanner}
            </div>
          )}

          {createTab === 'Saved Library' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {creations.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5] text-[11px] font-bold uppercase">
                      {item.type}
                    </span>
                    <span className="text-xs text-slate-400">{item.resolutionOrRatio}</span>
                  </div>
                  <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2">{item.prompt}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Prompt & Presets Column (3 Cols) matching Screens 2 & 4 */}
              <div className="lg:col-span-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Material
                  </label>
                  <select
                    value={selectedMaterialTitle}
                    onChange={(e) => setSelectedMaterialTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium bg-white dark:bg-slate-800"
                  >
                    <option value="JEE Main 2027 Paper 1">JEE Main 2027 Paper 1</option>
                    <option value="d & f Block – Handwritten Notes">
                      d &amp; f Block – Handwritten Notes
                    </option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.title}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Source Page
                  </label>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EEF2FF] text-[#4F46E5] text-xs font-semibold">
                    <span>{sourcePageLabel}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSourcePageLabel((p) => (p === 'Page 8' ? 'Page 4' : 'Page 8'))
                      }
                      className="hover:text-indigo-900 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Prompt
                  </label>
                  <textarea
                    rows={3}
                    value={diagramPrompt}
                    onChange={(e) => setDiagramPrompt(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Category
                  </label>
                  <select
                    value={diagramCategory}
                    onChange={(e) => setDiagramCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800"
                  >
                    <option value="Auto-detect">Auto-detect</option>
                    <option value="Free-Body Diagram">Free-Body Diagram</option>
                    <option value="Ray Optics">Ray Optics</option>
                    <option value="Circuit Schematic">Circuit Schematic</option>
                    <option value="VSEPR 3D Geometry">VSEPR 3D Geometry</option>
                    <option value="Conic Section">Conic Section</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (createTab === 'Visual') {
                      handleGenerateVisual();
                    } else if (createTab === 'Animated Lesson') {
                      handleGenerateAnimatedVideo();
                    } else {
                      const lower = diagramPrompt.toLowerCase();
                      if (lower.includes('lens') || lower.includes('optic')) {
                        setActivePreset('Convex Lens');
                      } else if (lower.includes('circuit') || lower.includes('rc')) {
                        setActivePreset('RC Circuit');
                      } else if (lower.includes('vsepr') || lower.includes('octahedral')) {
                        setActivePreset('VSEPR');
                      } else if (lower.includes('parabola')) {
                        setActivePreset('Parabola');
                      } else if (lower.includes('ellipse')) {
                        setActivePreset('Ellipse');
                      } else {
                        setActivePreset('Incline');
                      }
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate</span>
                </button>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                    Subject
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['All', 'Physics', 'Chemistry', 'Maths'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSubjectFilter(s)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                          subjectFilter === s
                            ? 'bg-[#EEF2FF] text-[#4F46E5] border border-indigo-300'
                            : 'border border-slate-200 text-slate-600'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                    Quick Presets
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        'Incline',
                        'Convex Lens',
                        'RC Circuit',
                        'VSEPR',
                        'Parabola',
                        'Ellipse',
                      ] as Preset3DId[]
                    ).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setActivePreset(preset);
                          setDiagramPrompt(
                            preset === 'Incline'
                              ? 'Free-body diagram of a block on an inclined plane, show only gravity (down) and normal (perpendicular to incline).'
                              : `JEE ${preset} diagram with labeled vectors and parameters.`
                          );
                        }}
                        className={`px-2 py-2 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                          activePreset === preset
                            ? 'bg-[#EEF2FF] text-[#4F46E5] border-indigo-300'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Center Canvas Area (6 Cols) */}
              <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-4 shadow-2xs">
                {createTab === 'Diagram Maker' && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
                          {(['2D SVG', '3D Interactive'] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setRenderMode(m)}
                              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                                renderMode === m
                                  ? 'bg-white dark:bg-slate-900 text-[#4F46E5] shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>

                        <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => setDiagramZoom((z) => Math.max(60, z - 20))}
                            className="px-2.5 py-1 hover:bg-slate-50 cursor-pointer"
                          >
                            −
                          </button>
                          <span className="px-2.5 py-1 border-x border-slate-200 font-mono tabular-nums">
                            {diagramZoom}%
                          </span>
                          <button
                            type="button"
                            onClick={() => setDiagramZoom((z) => Math.min(150, z + 20))}
                            className="px-2.5 py-1 hover:bg-slate-50 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleExportSvg}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export SVG</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveDiagramOr3D}
                          className="px-3.5 py-1.5 rounded-lg bg-[#4F46E5] text-white font-semibold inline-flex items-center gap-1.5 hover:bg-[#4338CA] cursor-pointer"
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                      </div>
                    </div>

                    {renderMode === '2D SVG' ? (
                      <div className="w-full h-[420px] rounded-xl border border-slate-100 bg-white flex items-center justify-center overflow-hidden p-4">
                        <div
                          className="w-full h-full flex items-center justify-center transition-transform"
                          style={{ transform: `scale(${diagramZoom / 100})` }}
                          dangerouslySetInnerHTML={{
                            __html: DIAGRAM_SVG_PRESETS[activePreset],
                          }}
                        />
                      </div>
                    ) : (
                      <ThreeSceneCanvas preset={activePreset} />
                    )}

                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        onClick={() => setCreateTab('Animated Lesson')}
                        className="text-xs font-bold text-[#4F46E5] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Animate</span>
                      </button>
                    </div>
                  </>
                )}

                {createTab === 'Visual' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setVisualEngine('pro')}
                          className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                            visualEngine === 'pro'
                              ? 'bg-[#EEF2FF] text-[#4F46E5]'
                              : 'text-slate-600'
                          }`}
                        >
                          Gemini 3 Pro Image (1K / 2K / 4K)
                        </button>
                        <button
                          type="button"
                          onClick={() => setVisualEngine('nano')}
                          className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                            visualEngine === 'nano'
                              ? 'bg-[#EEF2FF] text-[#4F46E5]'
                              : 'text-slate-600'
                          }`}
                        >
                          Nano Banana 2.1 (Image Edit)
                        </button>
                      </div>

                      {visualEngine === 'pro' && (
                        <div className="flex items-center gap-1">
                          {(['1K', '2K', '4K'] as const).map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => setImageSize(sz)}
                              className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                                imageSize === sz
                                  ? 'bg-[#4F46E5] text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {visualEngine === 'nano' && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <span>Optional base image to edit with Nano Banana 2.1:</span>
                        <label className="px-3 py-1 rounded-lg bg-white border border-slate-200 font-semibold cursor-pointer">
                          Upload Reference Image
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              const r = new FileReader();
                              r.onloadend = () =>
                                setEditBase64(String(r.result || '').split(',')[1] || null);
                              r.readAsDataURL(f);
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}

                    <div className="h-[360px] rounded-xl border border-slate-100 bg-slate-50 flex flex-col items-center justify-center p-4 overflow-hidden">
                      {visualLoading ? (
                        <p className="text-xs font-semibold text-[#4F46E5] animate-pulse">
                          Generating {visualEngine === 'pro' ? `${imageSize} Pro Visual` : 'Nano Banana 2.1 Visual'}...
                        </p>
                      ) : generatedImageUrl ? (
                        <img
                          src={generatedImageUrl}
                          alt="Generated JEE Visual"
                          className="max-h-full max-w-full object-contain rounded-lg"
                        />
                      ) : (
                        <div className="text-center space-y-2 max-w-sm">
                          <ImageIcon className="w-8 h-8 text-[#4F46E5] mx-auto" />
                          <p className="text-xs text-slate-600">
                            Click <strong>Generate</strong> on the left panel to synthesize a
                            high-resolution {imageSize} JEE concept diagram or edit an existing
                            figure.
                          </p>
                        </div>
                      )}
                    </div>
                    {visualError && <p className="text-xs text-red-600">{visualError}</p>}
                  </div>
                )}

                {createTab === 'Animated Lesson' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 text-xs">
                      <span className="font-bold text-slate-800">
                        Omni Flash Video Generator (gemini-omni-1.2-flash)
                      </span>
                      <div className="flex items-center gap-1.5">
                        {(['16:9', '9:16'] as const).map((ratio) => (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() => setVideoAspectRatio(ratio)}
                            className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                              videoAspectRatio === ratio
                                ? 'bg-[#4F46E5] text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {ratio === '16:9' ? '16:9 Landscape' : '9:16 Portrait'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <span>Animate a static diagram photo (optional):</span>
                      <label className="px-3 py-1 rounded-lg bg-white border border-slate-200 font-semibold cursor-pointer">
                        Upload Photo to Animate
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const r = new FileReader();
                            r.onloadend = () =>
                              setVideoPhotoBase64(String(r.result || '').split(',')[1] || null);
                            r.readAsDataURL(f);
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="h-[340px] rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center p-4">
                      {videoLoading ? (
                        <p className="text-xs font-semibold text-[#4F46E5] animate-pulse">
                          Generating {videoAspectRatio} Animated Lesson with Gemini Omni 1.2 Flash...
                        </p>
                      ) : generatedVideoUrl ? (
                        <video
                          controls
                          src={generatedVideoUrl}
                          className="max-h-full max-w-full rounded-lg"
                        />
                      ) : (
                        <div className="text-center space-y-2 max-w-sm">
                          <Video className="w-8 h-8 text-[#4F46E5] mx-auto" />
                          <p className="text-xs text-slate-600">
                            Click <strong>Generate</strong> on the left panel to render a{' '}
                            {videoAspectRatio} animated physics or chemistry video lesson.
                          </p>
                        </div>
                      )}
                    </div>
                    {videoError && <p className="text-xs text-red-600">{videoError}</p>}
                  </div>
                )}
              </div>

              {/* Right Cited Source Column (3 Cols) matching Screen 2 */}
              <div className="lg:col-span-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
                <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  Cited Source
                </h2>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  <div className="p-3 flex items-center gap-2.5 font-medium text-slate-800 dark:text-slate-200">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{selectedMaterialTitle}</span>
                  </div>
                  <div className="p-3 flex items-center gap-2.5 font-medium text-slate-800 dark:text-slate-200">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{sourcePageLabel}</span>
                  </div>
                  <div className="p-3 flex items-center gap-2.5 font-medium text-slate-800 dark:text-slate-200">
                    <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Newton&apos;s Laws – {activePreset}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCreateTab('Animated Lesson')}
                  className="w-full py-2.5 px-4 rounded-xl border border-indigo-300 text-[#4F46E5] font-semibold text-xs flex items-center justify-center gap-2 hover:bg-[#EEF2FF] transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Open Animated Lesson</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'Resources' && (
        /* Screen 8: LearnMate JEE Resources Hub */
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold tracking-wider uppercase text-[#4F46E5]">
                STUDY / RESOURCES
              </div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
                Resources
              </h1>
            </div>

            {/* Live Google Search Grounding Bar (gemini-3.8-flash) */}
            <form onSubmit={handleGroundedSearch} className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search live NTA JEE notices & cutoffs..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={searchingWeb}
                className="px-4 py-2 rounded-xl bg-[#4F46E5] text-white text-xs font-semibold cursor-pointer"
              >
                {searchingWeb ? 'Searching...' : 'Search NTA'}
              </button>
            </form>
          </div>

          {searchResult && (
            <div className="p-4 rounded-2xl bg-[#EEF2FF]/70 border border-indigo-200 space-y-2 text-xs">
              <div className="font-bold text-[#4F46E5]">
                Live Google Search Grounding Result (Gemini 3.8 Flash):
              </div>
              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                {searchResult.text}
              </p>
              {searchResult.sources.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {searchResult.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-md bg-white border border-indigo-200 text-[#4F46E5] font-medium inline-flex items-center gap-1 hover:underline"
                    >
                      <span>{src.title}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-Tabs matching Screen 8 */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
            {(['Official Portals', 'Exam Guide', 'Quick Sheets'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setResourceSubTab(t)}
                className={`px-4 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  resourceSubTab === t
                    ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]'
                    : 'text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* 2-Column Split matching Screen 8 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 6 Cols: Official Study Portals (4) */}
            <div className="lg:col-span-6 space-y-4">
              <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                Official Study Portals (4)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    title: 'SATHEE (IIT Kanpur)',
                    badge: 'Free Portal',
                    desc: 'Free JEE video lectures, practice tests & mentorship by Ministry of Education.',
                    domain: 'sathee.prutor.ai',
                    url: 'https://sathee.prutor.ai',
                  },
                  {
                    title: 'National Test Abhyas',
                    badge: 'NTA Mock App',
                    desc: 'Official NTA mock test practice platform for JEE Main & NEET.',
                    domain: 'nta.ac.in',
                    url: 'https://www.nta.ac.in',
                  },
                  {
                    title: 'JEE Main Official Portal',
                    badge: 'Exam Bulletin',
                    desc: 'Information bulletin, syllabus PDF, public notices & exam schedule.',
                    domain: 'jeemain.nta.nic.in',
                    url: 'https://jeemain.nta.nic.in',
                  },
                  {
                    title: 'NCERT e-Textbooks',
                    badge: 'Textbooks',
                    desc: 'Official Class 11 & 12 Physics, Chemistry and Mathematics NCERT books.',
                    domain: 'ncert.nic.in',
                    url: 'https://ncert.nic.in/textbook.php',
                  },
                ].map((portal) => (
                  <div
                    key={portal.title}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between space-y-4 shadow-2xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                          {portal.title}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5] text-[10px] font-bold whitespace-nowrap">
                          {portal.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {portal.desc}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] text-slate-400">{portal.domain}</span>
                      <a
                        href={portal.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right 6 Cols: Exam Guide & Quick Sheets matching Screen 8 */}
            <div className="lg:col-span-6 space-y-5">
              {/* Exam Guide Card */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                    Exam Guide
                  </h2>
                  <div className="flex items-center gap-1 text-xs">
                    {(['Pattern', 'Marking', 'Exam Rules', 'Schedule'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setExamGuideTab(tab)}
                        className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                          examGuideTab === tab
                            ? 'bg-[#EEF2FF] text-[#4F46E5]'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {examGuideTab === 'Pattern' && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {[
                      { k: 'Mode', v: 'Computer Based Test (CBT)' },
                      { k: 'Duration', v: '3 hours (180 minutes)' },
                      { k: 'Subjects', v: 'Physics, Chemistry, Mathematics' },
                      { k: 'Total Questions', v: '75 questions (25 per subject)' },
                      { k: 'Total Marks', v: '300 marks' },
                    ].map((row) => (
                      <div key={row.k} className="py-2.5 flex items-center justify-between">
                        <span className="text-slate-500">{row.k}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{row.v}</span>
                      </div>
                    ))}
                  </div>
                )}
                {examGuideTab === 'Marking' && (
                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Correct Answer</span>
                      <span className="font-bold text-emerald-600">+4 Marks</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Incorrect Answer (MCQ & Numerical)</span>
                      <span className="font-bold text-red-600">−1 Mark</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Unanswered / Marked for Review</span>
                      <span className="font-bold text-slate-700">0 Marks</span>
                    </div>
                  </div>
                )}
                {examGuideTab === 'Exam Rules' && (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Candidates must bring their NTA Admit Card, valid photo ID, and transparent
                    ballpoint pen. Electronic devices, calculators, and log tables are strictly
                    prohibited inside the CBT examination hall.
                  </p>
                )}
                {examGuideTab === 'Schedule' && (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Session 1: January 2027 (Morning Shift 09:00–12:00 IST, Afternoon Shift
                    15:00–18:00 IST). Session 2: April 2027.
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-slate-400">Source: NTA Information Bulletin</span>
                  <a
                    href="https://jeemain.nta.nic.in"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View Bulletin
                  </a>
                </div>
              </div>

              {/* Quick Sheets Card */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                    Quick Sheets
                  </h2>
                  <div className="flex items-center gap-1 text-xs">
                    {(['Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => setQuickSheetSubject(subj)}
                        className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                          quickSheetSubject === subj
                            ? 'bg-[#EEF2FF] text-[#4F46E5]'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {subj}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      title: 'Mechanics – Laws of Motion',
                      formulas: ['F = dp/dt = ma', 'f_s ≤ μ_s N , f_k = μ_k N', 'W = ∫ F · dr = ΔK'],
                    },
                    {
                      title: 'Electrostatics & Current',
                      formulas: [
                        'F = (1/4πε₀) q₁q₂/r²',
                        'E = −dV/dr , C = Q/V',
                        'V = IR , P = VI = I²R',
                      ],
                    },
                    {
                      title: 'Optics & Modern Physics',
                      formulas: ['1/v − 1/u = 1/f', 'E = hf = hc/λ', 'N(t) = N₀ e^(−λt)'],
                    },
                  ].map((sheet) => (
                    <div
                      key={sheet.title}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <h3 className="font-display font-bold text-xs text-slate-900 dark:text-white">
                          {sheet.title}
                        </h3>
                        <div className="space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {sheet.formulas.map((f, i) => (
                            <div key={i}>{f}</div>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onAddQuickSheetMaterial(
                            sheet.title,
                            quickSheetSubject,
                            sheet.formulas.join(' | ')
                          )
                        }
                        className="w-full py-1.5 rounded-lg bg-[#EEF2FF] text-[#4F46E5] font-semibold text-[11px] hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        + Add to Materials
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
