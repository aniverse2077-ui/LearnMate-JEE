import React, { useState, useRef, useEffect } from 'react';
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
  Edit3,
  Sparkles,
  Volume2,
  Download,
  Bookmark,
  ExternalLink,
  Search,
  Calendar,
  Layers,
  Headphones,
  FolderOpen,
  Trash2,
  Filter,
  PenTool,
  Highlighter,
  Eraser,
  StickyNote,
  Save,
  Eye,
} from 'lucide-react';
import {
  DIAGRAM_SVG_PRESETS,
  JEE_SYLLABUS_DATA,
  MaterialStudyBundle,
  NotePageData,
} from '../data/jeeInitialContent';
import { ThreeSceneCanvas, Preset3DId } from './ThreeSceneCanvas';
import { MathRichText } from './MathRichText';
import {
  CBTQuestion,
  CanvasVectorStroke,
  DiagramVectorOverlayItem,
  parseOrGenerateMarathonTimestampChunks,
} from '../utils/jeeEngine';
import {
  apiFetchWithAuth,
  loadCanvasAnnotationsForMaterial,
  saveCanvasAnnotationsForMaterial,
} from '../services/workspaceService';
import {
  sanitizeSvgMarkup,
} from '../utils/svgSanitizer';
import { synthesizeTopicAccurateSvg } from '../utils/opticsAndGeometrySolver';
import { CreateStudioPanel, CreateStudioTabId } from './study/CreateStudioPanel';
import { ResourcesAndGuidePanel } from './study/ResourcesAndGuidePanel';


export interface MaterialItem {
  id: string;
  title: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
  sourceRef?: string;
  originalFileUrl?: string;
  originalMimeType?: string;
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

interface TutorChatTurn {
  id: string;
  role: 'user' | 'tutor';
  text: string;
  contextMode: 'strict_material' | 'open_jee';
  citations?: { pageNumber: number; excerpt: string }[];
  embeddedVisual?: {
    type: '2D Diagram' | '3D Scene' | 'Concept Image' | 'Animated Video';
    preset?: Preset3DId;
    svgHtml?: string;
    imageUrl?: string;
    videoUrl?: string;
    promptUsed: string;
  };
}

interface HomeDashboardProps {
  userName: string;
  targetExam: 'JEE Main 2027' | 'JEE Advanced 2027' | 'NEET UG 2027' | 'BITSAT 2027' | 'JEE Main 2028';
  onChangeTargetExam: (
    exam: 'JEE Main 2027' | 'JEE Advanced 2027' | 'NEET UG 2027' | 'BITSAT 2027' | 'JEE Main 2028'
  ) => void;
  materials: MaterialItem[];
  tasks: StudyTaskItem[];
  streakDays: number;
  xp: number;
  level: number;
  lastMockScore: number | null;
  onToggleTask: (taskId: string) => void;
  onAddTask: (title: string, durationMin: number) => void;
  onDeleteTask?: (taskId: string) => void;
  onSyncWorkspaceTasks: () => void;
  onOpenStudyWorkbench: (material?: MaterialItem) => void;
  onOpenMyMaterials: () => void;
  onOpenSyllabus: () => void;
  onOpenRevise: () => void;
  onOpenPractice: () => void;
  onOpenProgress: () => void;
  onOpenAddMaterial: (tab: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive') => void;
  onOpenStudyTools: () => void;
}

export const HomeDashboardView: React.FC<HomeDashboardProps> = ({
  userName,
  targetExam,
  onChangeTargetExam,
  materials,
  tasks,
  streakDays,
  xp,
  level,
  lastMockScore,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onSyncWorkspaceTasks,
  onOpenStudyWorkbench,
  onOpenMyMaterials,
  onOpenSyllabus,
  onOpenRevise,
  onOpenPractice,
  onOpenProgress,
  onOpenAddMaterial,
  onOpenStudyTools,
}) => {
  const [workspaceMode, setWorkspaceMode] = useState<'daily' | 'subjects'>('daily');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState(30);
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
      const res = await apiFetchWithAuth<{ text: string }>('/api/ai/think', {
        prompt: doubtInput,
        language: doubtLang,
        contextMode: 'open_jee',
        context:
          materials.length > 0
            ? `Uploaded materials: ${materials.map((m) => m.title).join(', ')}`
            : 'JEE Main & Advanced Physics, Chemistry, and Mathematics.',
      });
      if (!res.ok) {
        setDoubtResponse(`[${res.error.errorCode}] ${res.error.message}`);
      } else {
        setDoubtResponse(
          res.data.text || 'Could not generate response. Please try asking your JEE doubt again.'
        );
      }
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
            const res = await apiFetchWithAuth<{ transcript?: string; text?: string }>(
              '/api/ai/transcribe',
              { audioBase64: base64, mimeType: 'audio/webm' }
            );
            if (res.ok && (res.data.transcript || res.data.text)) {
              setDoubtInput(res.data.transcript || res.data.text || '');
            } else if (!res.ok) {
              setDoubtResponse(`[${res.error.errorCode}] ${res.error.message}`);
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
        const res = await apiFetchWithAuth<{ text?: string }>('/api/ai/analyze', {
          mediaBase64: base64,
          mimeType: file.type || 'image/jpeg',
          sourceType: 'photo',
          prompt: `Solve this JEE problem or handwritten note step-by-step in ${doubtLang} using mathematical notation ($...$ and $$...$$), **bold** key laws, and *italic* exam traps.`,
        });
        if (!res.ok) {
          setDoubtResponse(`[${res.error.errorCode}] ${res.error.message}`);
        } else {
          setDoubtResponse(res.data.text || 'Analyzed photo successfully.');
        }
        setDoubtLoading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setDoubtLoading(false);
    }
  };

  const physCount = materials.filter((m) => m.subject === 'Physics').length;
  const chemCount = materials.filter((m) => m.subject === 'Chemistry').length;
  const mathCount = materials.filter((m) => m.subject === 'Mathematics').length;

  return (
    <div className="w-full px-6 lg:px-10 xl:px-12 py-6 space-y-6">
      {/* Top Greeting & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {workspaceMode === 'daily' ? (
            <>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight">
                Welcome, {userName}
              </h1>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs">
                <span>Target:</span>
                <select
                  aria-label="Target Exam"
                  value={targetExam}
                  onChange={(e) =>
                    onChangeTargetExam(
                      e.target.value as
                        | 'JEE Main 2027'
                        | 'JEE Advanced 2027'
                        | 'NEET UG 2027'
                        | 'BITSAT 2027'
                        | 'JEE Main 2028'
                    )
                  }
                  className="font-bold text-slate-900 dark:text-white bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="JEE Main 2027">JEE Main 2027</option>
                  <option value="JEE Advanced 2027">JEE Advanced 2027</option>
                  <option value="NEET UG 2027">NEET UG 2027</option>
                  <option value="BITSAT 2027">BITSAT 2027</option>
                  <option value="JEE Main 2028">JEE Main 2028</option>
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
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                subject: 'Physics',
                count: physCount,
                pct: Math.min(100, physCount * 25),
                color: 'text-blue-600 bg-blue-50',
                symbol: '⚗',
              },
              {
                subject: 'Chemistry',
                count: chemCount,
                pct: Math.min(100, chemCount * 25),
                color: 'text-emerald-600 bg-emerald-50',
                symbol: '🧪',
              },
              {
                subject: 'Mathematics',
                count: mathCount,
                pct: Math.min(100, mathCount * 25),
                color: 'text-amber-600 bg-amber-50',
                symbol: '∑',
              },
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
                    <div>
                      <span className="font-display font-bold text-base text-slate-900 dark:text-white block">
                        {card.subject}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {card.count} uploaded {card.count === 1 ? 'material' : 'materials'}
                      </span>
                    </div>
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
                  Desmos Graph &amp; Study Tools
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAddMaterial('pdf')}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 hover:border-[#4F46E5] transition-colors text-left cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  Upload Material (PDF / OCR / 12h YT)
                </span>
              </button>
              <button
                type="button"
                onClick={onOpenSyllabus}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 hover:border-[#4F46E5] transition-colors text-left cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  JEE Syllabus Tracker
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                Your Uploaded Material ({materials.length})
              </h2>
              {materials.length > 0 && (
                <button
                  type="button"
                  onClick={onOpenMyMaterials}
                  className="text-xs font-semibold text-[#4F46E5] hover:underline cursor-pointer"
                >
                  Manage All Materials →
                </button>
              )}
            </div>
            {materials.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-3">
                <Upload className="w-8 h-8 text-[#4F46E5] mx-auto" />
                <div className="font-display font-bold text-base text-slate-900 dark:text-white">
                  No materials uploaded yet — your workspace is 100% clean
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Upload a chapter PDF, a photo of your handwritten notes, or an up-to-12-hour
                  YouTube lecture to auto-generate full detailed notes, formula sheets, flashcards, and mind maps.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('pdf')}
                  className="px-4 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold cursor-pointer"
                >
                  + Upload Your First Material
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                      <th className="py-3.5 px-5 font-semibold">Material</th>
                      <th className="py-3.5 px-5 font-semibold">Subject</th>
                      <th className="py-3.5 px-5 font-semibold text-right">Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {materials.map((m) => (
                      <tr
                        key={m.id}
                        onClick={() => onOpenStudyWorkbench(m)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                      >
                        <td className="py-3.5 px-5 flex items-center gap-3 font-medium text-slate-900 dark:text-white">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 uppercase">
                            {m.sourceType}
                          </span>
                          <span>{m.title}</span>
                        </td>
                        <td className="py-3.5 px-5 text-xs text-slate-600 dark:text-slate-300">
                          {m.subject}
                        </td>
                        <td className="py-3.5 px-5 text-right text-xs text-slate-500">
                          {m.addedLabel || 'Just now'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Main 2-Column Daily Study Dashboard (Clean Zero-State until Student Adds Tasks/Materials) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7-Column Stack */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. My Tasks Card (Clean Zero-State by Default) */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  My Study Tasks ({tasks.length})
                </h2>
                <div className="flex items-center gap-3">
                  {tasks.length > 0 && (
                    <button
                      type="button"
                      onClick={onSyncWorkspaceTasks}
                      className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#4F46E5] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 text-[#4F46E5]" />
                      <span>Sync Calendar &amp; Tasks</span>
                    </button>
                  )}
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
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="e.g., Solve 20 Rotational Motion PYQs"
                    className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  />
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={newTaskDuration}
                    onChange={(e) => setNewTaskDuration(Number(e.target.value))}
                    className="w-20 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-center"
                    title="Duration (minutes)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newTaskTitle.trim()) {
                        onAddTask(newTaskTitle.trim(), newTaskDuration || 25);
                        setNewTaskTitle('');
                        setShowNewTaskInput(false);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#4F46E5] text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Task
                  </button>
                </div>
              )}

              {tasks.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Your study task list is empty
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Add your own daily JEE chapter targets or PYQ goals above.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowNewTaskInput(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#EEF2FF] text-[#4F46E5] text-xs font-semibold cursor-pointer"
                  >
                    + Create First Study Task
                  </button>
                </div>
              ) : (
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
                        {onDeleteTask && (
                          <button
                            type="button"
                            onClick={() => onDeleteTask(task.id)}
                            aria-label="Delete task"
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Continue Study / Clean Zero-State Upload Card */}
            {materials.length > 0 ? (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
                <div>
                  <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                    Continue with: {materials[0].title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {materials[0].subject} • {materials[0].chapter}
                  </p>
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
                    Quick Revise &amp; Handwritten View
                  </button>
                  <button
                    type="button"
                    onClick={onOpenPractice}
                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Practice PYQs
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5] text-[10px] font-bold uppercase">
                      Clean Zero-State Workspace
                    </span>
                    <h2 className="font-display font-bold text-base text-slate-900 dark:text-white mt-1.5">
                      Upload Your First JEE Study Material
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Upload any PDF chapter, handwritten note photo, or up-to-12-hour YouTube
                      lecture to unlock full detailed notes, handwritten font conversion, formula book, mind maps, and
                      flashcards.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenAddMaterial('pdf')}
                    className="px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>+ Upload PDF / Handwritten Notes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAddMaterial('youtube')}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Youtube className="w-3.5 h-3.5 text-rose-600" />
                    <span>Extract 12h YouTube Lecture</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenPractice}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    Solve Official PYQs &amp; 75-Q CBT
                  </button>
                </div>
              </div>
            )}

            {/* 3. My Materials Card */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  My Materials ({materials.length})
                </h2>
                {materials.length > 0 && (
                  <button
                    type="button"
                    onClick={onOpenMyMaterials}
                    className="text-xs font-semibold text-[#4F46E5] hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                )}
              </div>

              {materials.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  No preloaded materials. Use the buttons below to upload your own study files:
                </p>
              ) : (
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
                            {mat.subject} • {mat.chapter}
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
              )}

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
                  <span>Handwritten Photo (OCR)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('youtube')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                  <span>YouTube (Up to 12h)</span>
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
                  <span className="font-bold text-slate-900 dark:text-white">
                    Official PYQ &amp; Mock Practice
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                    +50 XP
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Solve official JEE Main &amp; Advanced PYQs or take a 75-question NTA CBT Mock.
                </p>
                <button
                  type="button"
                  onClick={onOpenPractice}
                  className="w-full py-2 rounded-xl bg-[#EEF2FF] text-[#4F46E5] font-semibold text-xs hover:bg-indigo-100 cursor-pointer"
                >
                  Open PYQ Bank &amp; CBT Mocks →
                </button>
              </div>
            </div>

            {/* Ask a Doubt Card */}
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
                  placeholder="Ask any JEE concept, derivation, or numerical..."
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
                      <span>Photo OCR</span>
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
                <div className="p-3.5 rounded-xl bg-[#EEF2FF]/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-h-64 overflow-y-auto">
                  <MathRichText content={doubtResponse} />
                </div>
              )}
            </div>

            {/* Last Mock Card */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex items-center justify-between shadow-2xs">
              <div>
                <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  CBT Mock Status
                </h2>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
                  {lastMockScore !== null
                    ? `Last Score: ${lastMockScore} / 300`
                    : 'No CBT Mock Attempted Yet'}
                </div>
                <div className="text-xs text-slate-500">
                  Full 75-Q JEE Main &amp; JEE Advanced Paper 1/2 Ready
                </div>
              </div>
              <button
                type="button"
                onClick={lastMockScore !== null ? onOpenProgress : onOpenPractice}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                {lastMockScore !== null ? 'View Analysis' : 'Start Mock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Study View Container: Study Workbench, Handwritten View, Full Annotation Editor, AI Tutor Create Visual, Create Studio, Resources
// ============================================================================
interface StudyViewProps {
  initialSubTab?: 'Syllabus' | 'Chapter Notes' | 'My Materials' | 'AI Tutor' | 'Create' | 'Resources';
  selectedMaterial?: MaterialItem | null;
  activeBundle?: MaterialStudyBundle | null;
  materials: MaterialItem[];
  creations: CreationItem[];
  onSelectMaterial: (mat: MaterialItem) => void;
  onDeleteMaterial: (matId: string) => void;
  onUpdateMaterialPage?: (materialId: string, pageNumber: number, updatedPage: NotePageData) => void;
  onOpenAddMaterial: (tab: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive') => void;
  onSaveCreation: (creation: Omit<CreationItem, 'id'>) => Promise<void>;
  onAddQuickSheetMaterial: (
    title: string,
    subject: 'Physics' | 'Chemistry' | 'Mathematics',
    summary: string
  ) => Promise<void>;
  onOpenVoiceTutor: () => void;
  onLaunchInstantPractice: (
    mode: 'chapter-quiz' | 'adaptive-drill',
    title: string,
    chapterName: string,
    customQuestions?: CBTQuestion[]
  ) => void;
}

export const StudyWorkspaceView: React.FC<StudyViewProps> = ({
  initialSubTab = 'Chapter Notes',
  selectedMaterial,
  activeBundle,
  materials,
  creations,
  onSelectMaterial,
  onDeleteMaterial,
  onUpdateMaterialPage,
  onOpenAddMaterial,
  onSaveCreation,
  onAddQuickSheetMaterial,
  onOpenVoiceTutor,
  onLaunchInstantPractice,
}) => {
  const [subTab, setSubTab] = useState<
    'Syllabus' | 'Chapter Notes' | 'My Materials' | 'AI Tutor' | 'Create' | 'Resources'
  >(initialSubTab);
  const [createTab, setCreateTab] = useState<CreateStudioTabId>('Diagram Maker');
  const [syllabusExam, setSyllabusExam] = useState<'Main' | 'Advanced'>('Main');
  const [notesDensity, setNotesDensity] = useState<'Full' | 'Quick' | 'Original' | 'Split'>('Full');
  const [showAnnotateChoiceModal, setShowAnnotateChoiceModal] = useState(false);
  const [annotateTarget, setAnnotateTarget] = useState<'original' | 'notes'>('notes');

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  // 3-in-1 Syllabus Hub state
  const [syllabusSubject, setSyllabusSubject] = useState<'Physics' | 'Chemistry' | 'Mathematics'>(
    'Physics'
  );
  const [syllabusFilter, setSyllabusFilter] = useState<
    'All' | 'High Weightage' | 'Completed' | 'Pending'
  >('All');
  const [completedChapters, setCompletedChapters] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    JEE_SYLLABUS_DATA.forEach((item) => {
      map[item.id] = item.defaultCompleted;
    });
    return map;
  });
  const [showAiPlannerDrawer, setShowAiPlannerDrawer] = useState(false);

  // My Materials sub-tab search & filter state
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  const [materialSubjFilter, setMaterialSubjFilter] = useState<
    'All' | 'Physics' | 'Chemistry' | 'Mathematics'
  >('All');

  // Study Workbench state
  const [pageIdx, setPageIdx] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Handwritten Notebook View Converter inside Study Workbench
  const [handwrittenView, setHandwrittenView] = useState(false);
  const [handwritingFont, setHandwritingFont] = useState<
    'font-hand-caveat' | 'font-hand-kalam' | 'font-hand-patrick' | 'font-hand-indie'
  >('font-hand-caveat');
  const [paperStyle, setPaperStyle] = useState<'paper-ruled' | 'paper-grid' | 'paper-plain'>(
    'paper-ruled'
  );

  // Dual-Mode PDF & Extracted Notes Full Annotation Editor state (Persisted Across Sessions)
  const [annotateMode, setAnnotateMode] = useState(false);
  const [annotationTool, setAnnotationTool] = useState<
    'pen' | 'highlighter' | 'eraser' | 'callout' | 'edit-text'
  >('pen');
  const [penColor, setPenColor] = useState('#4F46E5');
  const [callouts, setCallouts] = useState<{ id: string; text: string; color: string }[]>([]);
  const [newCalloutText, setNewCalloutText] = useState('');
  const [editingPageText, setEditingPageText] = useState('');
  const [editingFormulasText, setEditingFormulasText] = useState('');
  const [savedStrokes, setSavedStrokes] = useState<CanvasVectorStroke[]>([]);
  const activeStrokePointsRef = useRef<{ x: number; y: number }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [youtubeSeekSeconds, setYoutubeSeekSeconds] = useState<number>(0);

  // AI Tutor 2-Way Context Toggle & Chat Thread with One-Click "Create Visual"
  const [tutorContextMode, setTutorContextMode] = useState<'strict_material' | 'open_jee'>(
    'strict_material'
  );
  const [tutorDifficulty, setTutorDifficulty] = useState<'board' | 'jee_main' | 'jee_advanced'>(
    'jee_main'
  );
  const [tutorLang, setTutorLang] = useState<'English' | 'Hinglish'>('English');
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorChat, setTutorChat] = useState<TutorChatTurn[]>([]);
  const [visualPickerTurnId, setVisualPickerTurnId] = useState<string | null>(null);
  const [generatingInlineVisual, setGeneratingInlineVisual] = useState<string | null>(null);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);

  const pagesList: NotePageData[] = activeBundle?.pages || [];
  const currentPageData: NotePageData | null =
    pagesList[pageIdx] || pagesList[0] || null;

  useEffect(() => {
    setPageIdx(0);
    setYoutubeSeekSeconds(0);
    if (selectedMaterial?.id) {
      const loaded = loadCanvasAnnotationsForMaterial(selectedMaterial.id);
      setSavedStrokes(Array.isArray(loaded) ? loaded : []);
    } else {
      setSavedStrokes([]);
    }
  }, [selectedMaterial?.id]);

  // Replay persisted freehand strokes onto the annotation canvas whenever page, mode, or strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const activePageNum = currentPageData?.pageNumber || pageIdx + 1;
    const pageStrokes = savedStrokes.filter(
      (s) => s.pageNumber === activePageNum && s.target === annotateTarget
    );

    for (const stroke of pageStrokes) {
      if (!stroke.points || stroke.points.length === 0) continue;
      ctx.save();
      if (stroke.tool === 'eraser') {
        for (const pt of stroke.points) {
          ctx.clearRect(pt.x - 12, pt.y - 12, 24, 24);
        }
      } else {
        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.tool === 'highlighter' ? 14 : 2.5;
        ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.3 : 1.0;
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [savedStrokes, currentPageData?.pageNumber, pageIdx, annotateTarget, annotateMode, notesDensity]);

  useEffect(() => {
    if (currentPageData) {
      const joinedParagraphs = currentPageData.sections
        .flatMap((s) => s.paragraphs || [])
        .join('\n\n');
      const joinedFormulas = currentPageData.sections
        .flatMap((s) => s.formulas || [])
        .join('\n');
      setEditingPageText(joinedParagraphs);
      setEditingFormulasText(joinedFormulas);
    }
  }, [currentPageData?.pageNumber, selectedMaterial?.id]);

  // Canvas drawing handlers for PDF/Notes Annotation Overlay (Persisted Across Sessions)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!annotateMode || (annotationTool !== 'pen' && annotationTool !== 'highlighter' && annotationTool !== 'eraser'))
      return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    const pt = {
      x: Number(((e.clientX - rect.left) * scaleX).toFixed(1)),
      y: Number(((e.clientY - rect.top) * scaleY).toFixed(1)),
    };
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawingRef.current = true;
    activeStrokePointsRef.current = [pt];
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !annotateMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    const pt = {
      x: Number(((e.clientX - rect.left) * scaleX).toFixed(1)),
      y: Number(((e.clientY - rect.top) * scaleY).toFixed(1)),
    };
    activeStrokePointsRef.current.push(pt);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (annotationTool === 'eraser') {
      ctx.clearRect(pt.x - 12, pt.y - 12, 24, 24);
      return;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineWidth = annotationTool === 'highlighter' ? 14 : 2.5;
    ctx.globalAlpha = annotationTool === 'highlighter' ? 0.3 : 1.0;
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const pts = activeStrokePointsRef.current;
    if (pts.length > 0 && selectedMaterial?.id && (annotationTool === 'pen' || annotationTool === 'highlighter' || annotationTool === 'eraser')) {
      const newStroke: CanvasVectorStroke = {
        id: `stroke-${Date.now()}`,
        tool: annotationTool,
        color: penColor,
        pageNumber: currentPageData?.pageNumber || pageIdx + 1,
        target: annotateTarget,
        points: pts,
      };
      const updated = [...savedStrokes, newStroke];
      setSavedStrokes(updated);
      void saveCanvasAnnotationsForMaterial(selectedMaterial.id, updated);
    }
    activeStrokePointsRef.current = [];
  };

  const handleUndoLastStroke = () => {
    if (!selectedMaterial?.id || savedStrokes.length === 0) return;
    const activePageNum = currentPageData?.pageNumber || pageIdx + 1;
    const reversedIdx = [...savedStrokes]
      .reverse()
      .findIndex((s) => s.pageNumber === activePageNum && s.target === annotateTarget);
    if (reversedIdx === -1) return;
    const removeIdx = savedStrokes.length - 1 - reversedIdx;
    const updated = savedStrokes.filter((_, idx) => idx !== removeIdx);
    setSavedStrokes(updated);
    void saveCanvasAnnotationsForMaterial(selectedMaterial.id, updated);
  };

  const clearAnnotationCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (selectedMaterial?.id) {
      const activePageNum = currentPageData?.pageNumber || pageIdx + 1;
      const remaining = savedStrokes.filter(
        (s) => !(s.pageNumber === activePageNum && s.target === annotateTarget)
      );
      setSavedStrokes(remaining);
      void saveCanvasAnnotationsForMaterial(selectedMaterial.id, remaining);
    }
    setCallouts([]);
  };

  const handleSaveEditedPageNotes = () => {
    if (!selectedMaterial || !currentPageData || !onUpdateMaterialPage) return;
    const updatedPage: NotePageData = {
      ...currentPageData,
      sections: [
        {
          numberTitle: `${currentPageData.pageNumber}.1 Annotated & Edited Notes`,
          paragraphs: editingPageText
            .split('\n\n')
            .map((p) => p.trim())
            .filter(Boolean),
          formulas: editingFormulasText
            .split('\n')
            .map((f) => f.trim())
            .filter(Boolean),
        },
      ],
    };
    onUpdateMaterialPage(selectedMaterial.id, currentPageData.pageNumber, updatedPage);
  };

  const handleTutorExplain = async (style: 'Simpler' | 'Deeper' | 'UnitCheck' | 'Custom') => {
    if (!currentPageData && tutorContextMode === 'strict_material' && style !== 'Custom') return;
    setTutorLoading(true);
    const promptText =
      style === 'Simpler'
        ? `Explain Page ${currentPageData?.pageNumber || 1} (${currentPageData?.heading || selectedMaterial?.title || 'this concept'}) in simpler intuitive terms with an everyday analogy and formula.`
        : style === 'Deeper'
        ? `Provide a rigorous JEE Advanced level derivation of ${currentPageData?.heading || selectedMaterial?.title || 'this concept'}, highlighting **fundamental laws** in bold, *exceptions/traps* in italics, and mathematical equations.`
        : style === 'UnitCheck'
        ? `Verify dimensional consistency and SI units for the formulas on Page ${currentPageData?.pageNumber || 1} (${currentPageData?.heading || selectedMaterial?.title || 'this topic'}): ${currentPageData?.sections?.flatMap((sec) => sec.formulas || []).join('; ') || selectedMaterial?.contentSummary?.slice(0, 300) || ''}`
        : tutorQuestion.trim();

    if (!promptText) {
      setTutorLoading(false);
      return;
    }

    const userTurn: TutorChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: promptText,
      contextMode: tutorContextMode,
    };
    setTutorChat((prev) => [...prev, userTurn]);
    if (style === 'Custom') setTutorQuestion('');

    try {
      const res = await apiFetchWithAuth<{
        text?: string;
        citations?: { pageNumber: number; excerpt: string }[];
      }>('/api/ai/tutor', {
        prompt: promptText,
        materialId: selectedMaterial?.id,
        language: tutorLang,
        contextMode: tutorContextMode,
        difficulty: tutorDifficulty,
        context: currentPageData
          ? JSON.stringify(currentPageData)
          : selectedMaterial?.contentSummary || '',
      });
      const replyText = res.ok
        ? res.data.text || 'Tutor did not return an explanation. Please try again.'
        : `[${res.error.errorCode}] ${res.error.message}`;

      setTutorChat((prev) => [
        ...prev,
        {
          id: `t-${Date.now()}`,
          role: 'tutor',
          text: replyText,
          contextMode: tutorContextMode,
          citations: res.ok && Array.isArray(res.data.citations) ? res.data.citations : undefined,
        },
      ]);
    } catch {
      setTutorChat((prev) => [
        ...prev,
        {
          id: `t-${Date.now()}`,
          role: 'tutor',
          text: 'Could not reach AI Tutor. Please try again.',
          contextMode: tutorContextMode,
        },
      ]);
    } finally {
      setTutorLoading(false);
    }
  };

  // One-Click "Create Visual" from any AI Tutor reply
  const handleCreateVisualFromTutorReply = async (
    turn: TutorChatTurn,
    targetType: '2D Diagram' | '3D Scene' | 'Concept Image' | 'Animated Video'
  ) => {
    setVisualPickerTurnId(null);
    setGeneratingInlineVisual(turn.id);

    const autoPrompt = `Visual representation for JEE concept: ${
      selectedMaterial?.chapter || 'Physics/Chemistry'
    } — ${turn.text.replace(/[*$#]/g, '').slice(0, 160)}`;

    const lower = `${selectedMaterial?.chapter || ''} ${turn.text}`.toLowerCase();
    let inferredPreset: Preset3DId = 'Incline';
    if (lower.includes('lens') || lower.includes('optic')) inferredPreset = 'Convex Lens';
    else if (lower.includes('circuit') || lower.includes('rc') || lower.includes('current'))
      inferredPreset = 'RC Circuit';
    else if (lower.includes('orbital') || lower.includes('vsepr') || lower.includes('bond'))
      inferredPreset = 'VSEPR';
    else if (lower.includes('parabola') || lower.includes('projectile'))
      inferredPreset = 'Parabola';
    else if (lower.includes('ellipse') || lower.includes('gravitation'))
      inferredPreset = 'Ellipse';

    try {
      if (targetType === '2D Diagram') {
        const solved = synthesizeTopicAccurateSvg({
          prompt: autoPrompt,
          preset: inferredPreset,
        });
        const svgHtml = solved.svg || DIAGRAM_SVG_PRESETS[inferredPreset];
        setTutorChat((prev) =>
          prev.map((t) =>
            t.id === turn.id
              ? {
                  ...t,
                  embeddedVisual: {
                    type: '2D Diagram',
                    preset: inferredPreset,
                    svgHtml,
                    promptUsed: autoPrompt,
                  },
                }
              : t
          )
        );
        await onSaveCreation({
          type: 'diagram',
          title: `2D Diagram · ${inferredPreset}`,
          prompt: autoPrompt,
          subject: selectedMaterial?.subject || 'Physics',
          preset: inferredPreset,
          assetData: svgHtml,
          resolutionOrRatio: '2D SVG',
        });
      } else if (targetType === '3D Scene') {
        setTutorChat((prev) =>
          prev.map((t) =>
            t.id === turn.id
              ? {
                  ...t,
                  embeddedVisual: {
                    type: '3D Scene',
                    preset: inferredPreset,
                    promptUsed: autoPrompt,
                  },
                }
              : t
          )
        );
        await onSaveCreation({
          type: '3d',
          title: `3D Scene · ${inferredPreset}`,
          prompt: autoPrompt,
          subject: selectedMaterial?.subject || 'Physics',
          preset: inferredPreset,
          assetData: JSON.stringify({
            kind: '3d',
            preset: inferredPreset,
            angleDeg: 30,
            paramSecondary: 1.5,
            cameraPreset: 'iso',
            previewPngDataUrl: '',
          }),
          resolutionOrRatio: '3D Interactive',
        });
      } else if (targetType === 'Concept Image') {
        const res = await apiFetchWithAuth<{ imageUrl?: string }>('/api/ai/image-pro', {
          prompt: autoPrompt,
          imageSize: '1K',
        });
        const imgUrl = res.ok && res.data.imageUrl ? res.data.imageUrl : '';
        const fallbackSvg = synthesizeTopicAccurateSvg({
          prompt: autoPrompt,
          preset: inferredPreset,
        }).svg;
        setTutorChat((prev) =>
          prev.map((t) =>
            t.id === turn.id
              ? {
                  ...t,
                  embeddedVisual: {
                    type: 'Concept Image',
                    preset: inferredPreset,
                    imageUrl: imgUrl,
                    svgHtml: !imgUrl ? fallbackSvg : undefined,
                    promptUsed: autoPrompt,
                  },
                }
              : t
          )
        );
        await onSaveCreation({
          type: 'visual',
          title: `Concept Visual · ${selectedMaterial?.chapter || inferredPreset}`,
          prompt: autoPrompt,
          subject: selectedMaterial?.subject || 'Physics',
          preset: inferredPreset,
          assetData: imgUrl || fallbackSvg,
          resolutionOrRatio: '1K',
        });
      } else if (targetType === 'Animated Video') {
        const res = await apiFetchWithAuth<{ videoUrl?: string }>('/api/ai/video', {
          prompt: autoPrompt,
          aspectRatio: '16:9',
        });
        const vidUrl = res.ok && res.data.videoUrl ? res.data.videoUrl : '';
        const fallbackSvg = synthesizeTopicAccurateSvg({
          prompt: autoPrompt,
          preset: inferredPreset,
        }).svg;
        setTutorChat((prev) =>
          prev.map((t) =>
            t.id === turn.id
              ? {
                  ...t,
                  embeddedVisual: {
                    type: 'Animated Video',
                    preset: inferredPreset,
                    videoUrl: vidUrl,
                    svgHtml: !vidUrl ? fallbackSvg : undefined,
                    promptUsed: autoPrompt,
                  },
                }
              : t
          )
        );
        if (vidUrl) {
          await onSaveCreation({
            type: 'video',
            title: `Animated Video · ${selectedMaterial?.chapter || inferredPreset}`,
            prompt: autoPrompt,
            subject: selectedMaterial?.subject || 'Physics',
            preset: inferredPreset,
            assetData: vidUrl,
            resolutionOrRatio: '16:9',
          });
        }
      }
    } finally {
      setGeneratingInlineVisual(null);
    }
  };

  const handlePlayTTS = async () => {
    if (!currentPageData) return;
    setTtsPlaying(true);
    try {
      const lastTutor = [...tutorChat].reverse().find((t) => t.role === 'tutor');
      const textToSpeak =
        lastTutor?.text ||
        currentPageData.aiTutorSummary[tutorLang === 'Hinglish' ? 'hinglish' : 'english'];
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(
          textToSpeak.replace(/\$\$[^$]+\$\$/g, ' formula ').replace(/[*#$_]/g, '')
        );
        utter.onend = () => setTtsPlaying(false);
        window.speechSynthesis.speak(utter);
      } else {
        setTtsPlaying(false);
      }
    } catch {
      setTtsPlaying(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col">
      {/* Permanent Horizontal Sub-Navigation Bar (horizontally scrollable <1024px) */}
      <nav
        aria-label="Study workspace sections"
        data-testid="study-subnav"
        className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2 flex items-center lg:flex-wrap gap-2.5 text-xs overflow-x-auto whitespace-nowrap"
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('Syllabus')}
            className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
              subTab === 'Syllabus'
                ? 'text-[#4F46E5] bg-[#EEF2FF]'
                : 'text-slate-600 dark:text-slate-300'
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
            {(
              [
                { id: 'Full', label: 'Full Detailed' },
                { id: 'Quick', label: 'Quick' },
                { id: 'Original', label: 'Original File' },
                { id: 'Split', label: 'Split Screen' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setNotesDensity(d.id);
                  setSubTab('Chapter Notes');
                }}
                className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                  notesDensity === d.id ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'text-slate-500'
                }`}
              >
                {d.label}
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
      </nav>

      {/* 1. 3-in-1 Syllabus Hub */}
      {subTab === 'Syllabus' && (
        <div className="w-full px-6 lg:px-10 xl:px-12 py-5 space-y-5 flex-1">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold tracking-wider uppercase text-[#4F46E5]">
                  OFFICIAL NTA {syllabusExam.toUpperCase()} SYLLABUS &amp; TRACKER
                </div>
                <h1 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white mt-0.5">
                  JEE {syllabusExam} 2027 Syllabus Hub
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowAiPlannerDrawer((v) => !v)}
                  className="px-3.5 py-2 rounded-xl bg-[#EEF2FF] text-[#4F46E5] border border-indigo-200 font-semibold inline-flex items-center gap-1.5 hover:bg-indigo-100 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {showAiPlannerDrawer ? 'Hide 69-Day AI Planner' : 'AI 69-Day Syllabus Planner'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const txt = JEE_SYLLABUS_DATA.map(
                      (c) =>
                        `[${c.subject} · Class ${c.classLevel} · ${c.weightage} (${c.expectedQs})] ${c.chapter}\n  Topics: ${c.unitSummary}`
                    ).join('\n\n');
                    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Official_NTA_JEE_${syllabusExam}_2027_Syllabus.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download NTA Syllabus</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              {(['Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => {
                const subjRows = JEE_SYLLABUS_DATA.filter((s) => s.subject === subj);
                const doneCount = subjRows.filter((s) => completedChapters[s.id]).length;
                const pct = Math.round((doneCount / Math.max(1, subjRows.length)) * 100);
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setSyllabusSubject(subj)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      syllabusSubject === subj
                        ? 'border-[#4F46E5] bg-[#EEF2FF]/40 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white mb-1.5">
                      <span>{subj}</span>
                      <span className="text-[#4F46E5] tabular-nums">
                        {doneCount} / {subjRows.length} Units ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-[#4F46E5] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {showAiPlannerDrawer && (
              <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-sm text-[#4F46E5]">
                    AI 69-Day Smart Pacing Plan (Target: JEE {syllabusExam} Session 1)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-white text-slate-700 font-semibold border border-indigo-100">
                    High-Weightage First Strategy
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white">
                      Days 1 – 25 · Core High-Weightage
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      Complete Rotational Motion, Electrostatics, Current Electricity, Coordination
                      Compounds &amp; Definite Integration (3 Qs/shift chapters).
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white">
                      Days 26 – 50 · Class 11 &amp; 12 Consolidation
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      Finish Ray &amp; Wave Optics, Chemical Thermodynamics, Vector &amp; 3D
                      Geometry + solve 2024 Shift 1 &amp; 2 PYQs.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white">
                      Days 51 – 69 · Full NTA CBT Mocks &amp; Mistake DNA
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      Alternate-day 180-min 75-Q CBT Mocks + daily 30-min Spaced Repetition
                      Flashcards and Formula Book drills.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
                <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Filter className="w-4 h-4 text-[#4F46E5]" />
                  <span>Filter Chapters</span>
                </h2>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(['All', 'High Weightage', 'Completed', 'Pending'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSyllabusFilter(f)}
                      className={`px-3 py-2 rounded-xl font-semibold border text-left cursor-pointer ${
                        syllabusFilter === f
                          ? 'bg-[#EEF2FF] text-[#4F46E5] border-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 bg-slate-50/60 dark:bg-slate-800/40">
                    <th className="py-3.5 px-4 font-semibold">Done</th>
                    <th className="py-3.5 px-4 font-semibold">Chapter &amp; Official NTA Topics</th>
                    <th className="py-3.5 px-4 font-semibold">Class</th>
                    <th className="py-3.5 px-4 font-semibold">JEE Weightage</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {JEE_SYLLABUS_DATA.filter((item) => {
                    if (item.subject !== syllabusSubject) return false;
                    if (syllabusFilter === 'High Weightage' && item.weightage !== 'High')
                      return false;
                    if (syllabusFilter === 'Completed' && !completedChapters[item.id]) return false;
                    if (syllabusFilter === 'Pending' && completedChapters[item.id]) return false;
                    return true;
                  }).map((item) => {
                    const isDone = Boolean(completedChapters[item.id]);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4 align-top">
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() =>
                              setCompletedChapters((prev) => ({
                                ...prev,
                                [item.id]: !prev[item.id],
                              }))
                            }
                            aria-label={`Mark ${item.chapter} completed`}
                            className="w-4 h-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5] cursor-pointer mt-0.5"
                          />
                        </td>
                        <td className="py-3.5 px-4 space-y-1">
                          <div
                            className={`font-display font-bold text-sm ${
                              isDone
                                ? 'line-through text-slate-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {item.chapter}
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            {item.unitSummary}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 align-top font-semibold text-slate-600 dark:text-slate-300">
                          {item.classLevel}
                        </td>
                        <td className="py-3.5 px-4 align-top">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md font-bold text-[11px] whitespace-nowrap ${
                              item.weightage === 'High'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {item.weightage} · {item.expectedQs}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 align-top text-right">
                          <button
                            type="button"
                            onClick={() => onOpenAddMaterial('pdf')}
                            className="px-3 py-1.5 rounded-lg bg-[#EEF2FF] text-[#4F46E5] font-semibold hover:bg-indigo-100 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            + Upload Notes
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. Searchable Student Material Library (Sub-Tab: My Materials) */}
      {subTab === 'My Materials' && (
        <div className="w-full px-6 lg:px-10 xl:px-12 py-5 space-y-5 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold tracking-wider uppercase text-[#4F46E5]">
                STUDY / MY MATERIALS
              </div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
                My Uploaded &amp; Imported Materials ({materials.length})
              </h1>
            </div>

            <button
              type="button"
              onClick={() => onOpenAddMaterial('pdf')}
              className="px-4 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>+ Upload Material</span>
            </button>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={materialSearchQuery}
                onChange={(e) => setMaterialSearchQuery(e.target.value)}
                placeholder="Search your uploaded PDFs, handwritten notes, YouTube lectures..."
                className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs focus:outline-none focus:border-[#4F46E5]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setMaterialSubjFilter(subj)}
                  className={`px-3.5 py-1.5 rounded-xl font-semibold cursor-pointer ${
                    materialSubjFilter === subj
                      ? 'bg-[#EEF2FF] text-[#4F46E5] border border-indigo-200'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {subj}
                </button>
              ))}
            </div>
          </div>

          {materials.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center space-y-3">
              <Upload className="w-9 h-9 text-[#4F46E5] mx-auto" />
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                No materials uploaded yet
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Upload a PDF, handwritten notes photo (OCR), or up-to-12-hour YouTube lecture to
                populate your personal library.
              </p>
              <button
                type="button"
                onClick={() => onOpenAddMaterial('pdf')}
                className="px-5 py-2.5 rounded-xl bg-[#4F46E5] text-white text-xs font-semibold cursor-pointer"
              >
                + Upload Material Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {materials
                .filter((mat) => {
                  if (materialSubjFilter !== 'All' && mat.subject !== materialSubjFilter)
                    return false;
                  if (
                    materialSearchQuery.trim() &&
                    !`${mat.title} ${mat.chapter} ${mat.contentSummary}`
                      .toLowerCase()
                      .includes(materialSearchQuery.toLowerCase())
                  ) {
                    return false;
                  }
                  return true;
                })
                .map((mat) => (
                  <div
                    key={mat.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between space-y-4 shadow-2xs hover:border-indigo-300 transition-colors"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5] text-[10px] font-bold uppercase">
                          {mat.sourceType} · {mat.subject}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {mat.addedLabel || `${mat.pageCount} pages`}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                        {mat.title}
                      </h3>
                      <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                        <MathRichText content={mat.contentSummary} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectMaterial(mat);
                          setSubTab('Chapter Notes');
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-center cursor-pointer"
                      >
                        Open in Workbench
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMaterial(mat.id)}
                        title="Remove Material"
                        aria-label={`Delete ${mat.title}`}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 hover:border-red-200 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Full-Desktop Study Workbench (Sub-Tabs: Chapter Notes & AI Tutor) */}
      {(subTab === 'Chapter Notes' || subTab === 'AI Tutor') && (
        <div className="w-full px-6 lg:px-10 xl:px-12 py-5 flex-1 flex flex-col gap-4">
          {!selectedMaterial || !currentPageData ? (
            /* Clean Zero-State when no material has been uploaded yet */
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 p-10 my-4 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-lg mx-auto">
                <h2 className="font-display font-extrabold text-xl text-slate-900 dark:text-white">
                  Upload Your First Material to Start Studying
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  LearnMate JEE starts 100% clean with zero preloaded demo notes. Upload a PDF
                  chapter, a photo of your handwritten notes (for 4-font handwriting
                  conversion), or an up-to-12-hour YouTube marathon lecture.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('pdf')}
                  className="px-4 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>+ Upload Chapter PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('photo')}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-[#4F46E5]" />
                  <span>+ Handwritten Notes Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('youtube')}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Youtube className="w-4 h-4 text-rose-600" />
                  <span>+ 12h YouTube Marathon Lecture</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('text')}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <TypeIcon className="w-4 h-4 text-emerald-600" />
                  <span>+ Paste Study Notes</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Dual-Target "Annotate and Edit" Choice Modal */}
              {showAnnotateChoiceModal && (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Choose What to Annotate and Edit"
                  className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
                >
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl p-6 space-y-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase tracking-wider">
                          Annotate &amp; Edit Mode
                        </span>
                        <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white mt-1">
                          What would you like to annotate or edit?
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Choose whether to annotate your actual uploaded material or the full detailed chapter notes generated from your scan.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAnnotateChoiceModal(false)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Option 1: Annotate Original Uploaded Material */}
                      <button
                        type="button"
                        onClick={() => {
                          setAnnotateTarget('original');
                          setNotesDensity('Original');
                          setAnnotationTool('pen');
                          setAnnotateMode(true);
                          setShowAnnotateChoiceModal(false);
                        }}
                        className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-600 bg-slate-50/60 dark:bg-slate-800/60 text-left space-y-2.5 transition-all cursor-pointer group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <Eye className="w-5 h-5" />
                        </div>
                        <div className="font-display font-extrabold text-sm text-slate-900 dark:text-white">
                          1. Annotate Original Uploaded Material
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Draw with freehand pen, highlight, or pin sticky callouts directly over your uploaded{' '}
                          <strong>{selectedMaterial.sourceType.toUpperCase()}</strong> file ({selectedMaterial.title}).
                        </p>
                      </button>

                      {/* Option 2: Annotate & Edit Full Detailed Notes */}
                      <button
                        type="button"
                        onClick={() => {
                          setAnnotateTarget('notes');
                          if (notesDensity === 'Original') setNotesDensity('Full');
                          setAnnotateMode(true);
                          setShowAnnotateChoiceModal(false);
                        }}
                        className="p-4 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 hover:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 text-left space-y-2.5 transition-all cursor-pointer group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                          <Edit3 className="w-5 h-5" />
                        </div>
                        <div className="font-display font-extrabold text-sm text-slate-900 dark:text-white">
                          2. Annotate &amp; Edit Full Detailed Notes
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Highlight, draw, pin sticky notes, or directly edit the complete theory, derivations, solved examples, and formulas.
                        </p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Breadcrumb & Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm text-slate-500">Study</span>
                  <span className="text-slate-300">/</span>
                  <h1 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                    {selectedMaterial.chapter || selectedMaterial.title}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Detailed Notes &amp; Equations Ready
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* View Mode Switcher right in the Workbench Header */}
                  <div className="inline-flex items-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 text-xs font-bold">
                    {(
                      [
                        { id: 'Full', label: 'Full Notes' },
                        { id: 'Quick', label: 'Quick Notes' },
                        { id: 'Original', label: 'View Original File' },
                        { id: 'Split', label: 'Split Screen' },
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setNotesDensity(mode.id)}
                        className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                          notesDensity === mode.id
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onLaunchInstantPractice(
                        'chapter-quiz',
                        'Chapter Quiz',
                        selectedMaterial.chapter || selectedMaterial.title,
                        activeBundle?.quizQuestions
                      )
                    }
                    className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    Chapter Quiz
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onLaunchInstantPractice(
                        'adaptive-drill',
                        'Live Adaptive Difficulty Drill',
                        selectedMaterial.chapter || selectedMaterial.title,
                        activeBundle?.quizQuestions
                      )
                    }
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
                    <span>Live Voice Tutor</span>
                  </button>
                </div>
              </div>

              {/* Split-Screen Workbench */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
                {/* Left Document Viewer + Original PDF/Video Viewer + Handwritten View + Full Annotation Editor (8 Cols on wide screen) */}
                <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-hidden shadow-2xs">
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
                          {currentPageData.pageNumber} / {pagesList.length}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPageIdx((p) => Math.min(pagesList.length - 1, p + 1))
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
                          onClick={() => setZoomLevel((z) => Math.max(80, z - 10))}
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
                          onClick={() => setZoomLevel((z) => Math.min(140, z + 10))}
                          aria-label="Zoom in notes"
                          className="px-2 py-1 hover:bg-slate-50 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Toggle Handwritten Notebook View */}
                      <button
                        type="button"
                        onClick={() => setHandwrittenView((v) => !v)}
                        className={`px-3 py-1 rounded-lg border font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                          handwrittenView
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>{handwrittenView ? 'Handwritten View ON' : 'Handwritten View'}</span>
                      </button>

                      {/* Toggle Dual-Target Annotation & Editor (Opens Choice Modal when turning on) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (annotateMode) {
                            setAnnotateMode(false);
                          } else {
                            setShowAnnotateChoiceModal(true);
                          }
                        }}
                        className={`px-3 py-1 rounded-lg border font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                          annotateMode
                            ? 'border-[#4F46E5] bg-[#EEF2FF] text-[#4F46E5]'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>
                          {annotateMode
                            ? `Annotating: ${annotateTarget === 'original' ? 'Original File' : 'Detailed Notes'}`
                            : 'Annotate & Edit'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Handwritten 4-Font & Paper Switcher Bar */}
                  {handwrittenView && (
                    <div className="px-4 py-2 bg-amber-50/70 dark:bg-slate-800 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-amber-900 dark:text-amber-200">
                          Handwriting Font:
                        </span>
                        {(
                          [
                            { id: 'font-hand-caveat', label: 'Caveat (Neat Cursive)' },
                            { id: 'font-hand-kalam', label: 'Kalam (Indian Pen)' },
                            { id: 'font-hand-patrick', label: 'Patrick Hand (Print)' },
                            { id: 'font-hand-indie', label: 'Indie Flower' },
                          ] as const
                        ).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setHandwritingFont(f.id)}
                            className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                              handwritingFont === f.id
                                ? 'bg-amber-800 text-white'
                                : 'bg-white text-slate-700 border border-amber-200'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1">
                        {(
                          [
                            { id: 'paper-ruled', label: 'Ruled' },
                            { id: 'paper-grid', label: 'Grid' },
                            { id: 'paper-plain', label: 'Plain' },
                          ] as const
                        ).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPaperStyle(p.id)}
                            className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                              paperStyle === p.id
                                ? 'bg-[#4F46E5] text-white'
                                : 'bg-white text-slate-600 border border-slate-200'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full Dual-Mode Annotation & Rich-Text Equation Editor Toolbar */}
                  {annotateMode && (
                    <div className="px-4 py-2.5 bg-[#EEF2FF]/70 dark:bg-indigo-950/40 border-b border-indigo-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Target Switcher inside Annotation Bar */}
                        <div className="inline-flex rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 p-0.5 mr-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAnnotateTarget('original');
                              setNotesDensity('Original');
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                              annotateTarget === 'original'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-600'
                            }`}
                          >
                            Original File
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAnnotateTarget('notes');
                              if (notesDensity === 'Original') setNotesDensity('Full');
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                              annotateTarget === 'notes'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-600'
                            }`}
                          >
                            Detailed Notes
                          </button>
                        </div>

                        {[
                          { id: 'pen', label: 'Pen', icon: PenTool },
                          { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
                          { id: 'eraser', label: 'Eraser', icon: Eraser },
                          { id: 'callout', label: 'Sticky Callout', icon: StickyNote },
                          { id: 'edit-text', label: 'Edit Notes & Equations', icon: Edit3 },
                        ].map((t) => {
                          const Icon = t.icon;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setAnnotationTool(t.id as any)}
                              className={`px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer ${
                                annotationTool === t.id
                                  ? 'bg-[#4F46E5] text-white'
                                  : 'bg-white text-slate-700 border border-slate-200'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span>{t.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2">
                        {['#4F46E5', '#DC2626', '#059669', '#D97706'].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setPenColor(c)}
                            aria-label={`Select annotation color ${c}`}
                            className={`w-5 h-5 rounded-full cursor-pointer ${
                              penColor === c ? 'ring-2 ring-offset-1 ring-slate-900' : ''
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={handleUndoLastStroke}
                          className="px-2 py-1 rounded bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:text-indigo-600 cursor-pointer"
                        >
                          Undo Stroke
                        </button>
                        <button
                          type="button"
                          onClick={clearAnnotationCanvas}
                          className="px-2 py-1 rounded bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 hover:text-red-600 cursor-pointer"
                        >
                          Clear Ink ({savedStrokes.filter((s) => s.pageNumber === (currentPageData?.pageNumber || pageIdx + 1) && s.target === annotateTarget).length})
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Document Sheet Content: Supports Full Notes, Quick Notes, Original Uploaded File Viewer, and Split Screen */}
                  <div
                    className={`relative p-6 sm:p-8 space-y-5 flex-1 overflow-y-auto ${
                      handwrittenView ? `${handwritingFont} ${paperStyle}` : ''
                    }`}
                    style={{ fontSize: `${zoomLevel}%` }}
                  >
                    {/* Persistent Freehand Pen / Highlighter Canvas Overlay */}
                    {(annotateMode ||
                      savedStrokes.some(
                        (s) =>
                          s.pageNumber === (currentPageData?.pageNumber || pageIdx + 1) &&
                          s.target === annotateTarget
                      )) && (
                      <canvas
                        ref={canvasRef}
                        width={960}
                        height={680}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        className={`absolute inset-0 w-full h-full z-10 ${
                          annotateMode &&
                          (annotationTool === 'pen' ||
                            annotationTool === 'highlighter' ||
                            annotationTool === 'eraser')
                            ? 'cursor-crosshair'
                            : 'pointer-events-none'
                        }`}
                      />
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-[#4F46E5] text-xs font-bold">
                          {selectedMaterial.subject} · {selectedMaterial.sourceType.toUpperCase()}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                          Mode: {notesDensity === 'Full' ? 'Full Detailed Notes (All 4 Sections)' : notesDensity === 'Quick' ? 'Quick Revision Summary' : notesDensity === 'Original' ? 'Original Uploaded Material' : 'Split Screen (Original + Full Notes)'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        **Bold** = Key Law · *Italic* = Exam Trap · Visual Equations
                      </span>
                    </div>

                    {/* ORIGINAL UPLOADED MATERIAL VIEWER (Shown in 'Original' or Left Half of 'Split') */}
                    {(notesDensity === 'Original' || notesDensity === 'Split') && (
                      <div
                        className={
                          notesDensity === 'Split'
                            ? 'grid grid-cols-1 xl:grid-cols-2 gap-6 items-start'
                            : 'space-y-4'
                        }
                      >
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4 text-indigo-600" />
                              <span className="font-display font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                Original Uploaded {selectedMaterial.sourceType.toUpperCase()}: {selectedMaterial.title}
                              </span>
                            </div>
                            {selectedMaterial.sourceRef && (
                              <span className="text-[11px] font-mono text-slate-500 truncate max-w-[220px]">
                                {selectedMaterial.sourceRef}
                              </span>
                            )}
                          </div>

                          {/* Render Actual Video Player + 12-Hour Marathon Timestamp Chunks if YouTube */}
                          {selectedMaterial.sourceType === 'youtube' && (() => {
                            const rawUrl =
                              selectedMaterial.originalFileUrl ||
                              selectedMaterial.sourceRef ||
                              '';
                            const ytMatch = rawUrl.match(
                              /(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,15})/
                            );
                            const videoId = ytMatch ? ytMatch[1] : null;
                            const marathonChunks = parseOrGenerateMarathonTimestampChunks(
                              selectedMaterial.contentSummary,
                              6,
                              selectedMaterial.chapter
                            );
                            const embedSrc = videoId
                              ? `https://www.youtube.com/embed/${videoId}${
                                  youtubeSeekSeconds > 0
                                    ? `?start=${youtubeSeekSeconds}&autoplay=1`
                                    : ''
                                }`
                              : '';
                            return (
                              <div className="space-y-3">
                                {videoId ? (
                                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md">
                                    <iframe
                                      key={`${videoId}-${youtubeSeekSeconds}`}
                                      src={embedSrc}
                                      title={selectedMaterial.title}
                                      className="w-full h-full"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                  </div>
                                ) : (
                                  <div className="aspect-video w-full rounded-xl bg-slate-900 text-white p-6 flex flex-col items-center justify-center text-center space-y-2">
                                    <Youtube className="w-10 h-10 text-rose-500" />
                                    <div className="font-bold text-sm">{selectedMaterial.title}</div>
                                    <p className="text-xs text-slate-300 max-w-md">
                                      Video lecture source: {rawUrl || 'Uploaded YouTube Marathon Lecture'}
                                    </p>
                                  </div>
                                )}

                                {/* 12-Hour Marathon Interactive Timestamp Seeker */}
                                <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-slate-900 border border-indigo-200/80 dark:border-slate-700 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold text-indigo-800 dark:text-indigo-300">
                                      12-Hour Marathon Timestamp Chunks (Click to Seek Video &amp; Notes)
                                    </span>
                                    <span className="text-[11px] font-mono text-indigo-600">
                                      {marathonChunks.length} Segments
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                                    {marathonChunks.map((chunk) => (
                                      <button
                                        key={chunk.id}
                                        type="button"
                                        onClick={() => {
                                          setYoutubeSeekSeconds(chunk.seconds);
                                          const targetIdx = Math.max(
                                            0,
                                            Math.min(pagesList.length - 1, chunk.pageNumber - 1)
                                          );
                                          setPageIdx(targetIdx);
                                        }}
                                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-start gap-2 ${
                                          youtubeSeekSeconds === chunk.seconds
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                                        }`}
                                      >
                                        <span
                                          className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 ${
                                            youtubeSeekSeconds === chunk.seconds
                                              ? 'bg-white/20 text-white'
                                              : 'bg-indigo-100 text-indigo-700'
                                          }`}
                                        >
                                          {chunk.timestampLabel}
                                        </span>
                                        <span className="text-[11px] font-semibold line-clamp-1">
                                          {chunk.topicTitle}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 max-h-56 overflow-y-auto">
                                  <div className="font-bold text-indigo-600">
                                    Uploaded Lecture Transcript &amp; Timestamps:
                                  </div>
                                  <MathRichText content={selectedMaterial.contentSummary} />
                                </div>
                              </div>
                            );
                          })()}

                          {/* Render Actual PDF Document Viewer if PDF */}
                          {selectedMaterial.sourceType === 'pdf' && (
                            <div className="space-y-3">
                              {selectedMaterial.originalFileUrl &&
                              (selectedMaterial.originalFileUrl.startsWith('data:application/pdf') ||
                                selectedMaterial.originalFileUrl.startsWith('http') ||
                                selectedMaterial.originalFileUrl.startsWith('blob:')) ? (
                                <iframe
                                  src={selectedMaterial.originalFileUrl}
                                  title={`Original PDF: ${selectedMaterial.title}`}
                                  className="w-full h-[460px] rounded-xl border border-slate-200 bg-white"
                                />
                              ) : null}
                              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2 max-h-[420px] overflow-y-auto">
                                <div className="flex items-center justify-between text-xs font-bold text-indigo-600 border-b border-slate-100 pb-2">
                                  <span>Original Uploaded PDF Document Content ({selectedMaterial.sourceRef || selectedMaterial.title})</span>
                                  <span>Page {currentPageData.pageNumber}</span>
                                </div>
                                <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                                  <MathRichText content={selectedMaterial.contentSummary} />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Render Actual Uploaded Photo / Handwritten Scan if Photo */}
                          {selectedMaterial.sourceType === 'photo' && (
                            <div className="space-y-3">
                              {selectedMaterial.originalFileUrl &&
                              (selectedMaterial.originalFileUrl.startsWith('data:image') ||
                                selectedMaterial.originalFileUrl.startsWith('http')) ? (
                                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 flex justify-center">
                                  <img
                                    src={selectedMaterial.originalFileUrl}
                                    alt={selectedMaterial.title}
                                    className="max-h-[440px] w-auto object-contain rounded-lg"
                                  />
                                </div>
                              ) : null}
                              <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-slate-900 border border-amber-200 space-y-2">
                                <div className="text-xs font-bold text-amber-900 dark:text-amber-300">
                                  Original Handwritten Scan Content ({selectedMaterial.sourceRef || selectedMaterial.title}):
                                </div>
                                <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                                  <MathRichText content={selectedMaterial.contentSummary} />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Render Original Uploaded Text / Drive Document */}
                          {(selectedMaterial.sourceType === 'text' ||
                            selectedMaterial.sourceType === 'drive') && (
                            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2 max-h-[460px] overflow-y-auto">
                              <div className="text-xs font-bold text-indigo-600">
                                Original Uploaded Material ({selectedMaterial.sourceRef || selectedMaterial.title}):
                              </div>
                              <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                                <MathRichText content={selectedMaterial.contentSummary} />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right Half of Split Screen: Exhaustive Detailed Notes */}
                        {notesDensity === 'Split' && (
                          <div className="space-y-4">
                            <h2 className="font-display font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white">
                              <MathRichText content={currentPageData.heading} inline />
                            </h2>
                            {currentPageData.sections.map((sec, idx) => (
                              <div
                                key={idx}
                                className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-2.5"
                              >
                                <h3 className="font-display font-bold text-sm text-indigo-700 dark:text-indigo-300">
                                  <MathRichText content={sec.numberTitle} inline />
                                </h3>
                                {sec.paragraphs?.map((p, pIdx) => (
                                  <div
                                    key={pIdx}
                                    className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed"
                                  >
                                    <MathRichText content={p} />
                                  </div>
                                ))}
                                {sec.bullets && (
                                  <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                                    {sec.bullets.map((b, bIdx) => (
                                      <li key={bIdx}>
                                        <MathRichText content={b} inline />
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {sec.formulas && sec.formulas.length > 0 && (
                                  <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-slate-900 border border-indigo-200/80 space-y-2 text-xs sm:text-sm">
                                    {sec.formulas.map((f, fIdx) => (
                                      <div key={fIdx}>
                                        <MathRichText content={f} />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* FULL DETAILED NOTES OR QUICK NOTES VIEW */}
                    {(notesDensity === 'Full' || notesDensity === 'Quick') && (
                      <>
                        <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white">
                          <MathRichText content={currentPageData.heading} inline />
                        </h2>

                        {annotateMode && annotationTool === 'edit-text' ? (
                          <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-slate-800 border border-indigo-200 space-y-3 relative z-20">
                            <div className="text-xs font-bold text-[#4F46E5]">
                              Direct Rich-Text &amp; Equation Editor (Supports **bold**, *italic*, $...$ and $$...$$)
                            </div>
                            <textarea
                              rows={6}
                              value={editingPageText}
                              onChange={(e) => setEditingPageText(e.target.value)}
                              placeholder="Edit extracted paragraphs and derivations..."
                              className="w-full p-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 text-xs font-mono leading-relaxed"
                            />
                            <textarea
                              rows={3}
                              value={editingFormulasText}
                              onChange={(e) => setEditingFormulasText(e.target.value)}
                              placeholder="One equation block per line (e.g. $$E = mc^2$$)..."
                              className="w-full p-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 text-xs font-mono"
                            />
                            <button
                              type="button"
                              onClick={handleSaveEditedPageNotes}
                              className="px-4 py-2 rounded-xl bg-[#4F46E5] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Save Edited Page to Library</span>
                            </button>
                          </div>
                        ) : (
                          currentPageData.sections.map((sec, idx) => (
                            <div
                              key={idx}
                              className="p-4 sm:p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3"
                            >
                              <h3 className="font-display font-bold text-sm sm:text-base text-indigo-700 dark:text-indigo-300">
                                <MathRichText content={sec.numberTitle} inline />
                              </h3>
                              {notesDensity === 'Full' &&
                                sec.paragraphs?.map((p, pIdx) => (
                                  <div
                                    key={pIdx}
                                    className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed"
                                  >
                                    <MathRichText content={p} />
                                  </div>
                                ))}
                              {sec.bullets && (
                                <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                                  {sec.bullets.map((b, bIdx) => (
                                    <li key={bIdx}>
                                      <MathRichText content={b} inline />
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {sec.formulas && sec.formulas.length > 0 && (
                                <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-slate-800/90 border border-indigo-200/80 dark:border-slate-700 space-y-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                                  {sec.formulas.map((f, fIdx) => (
                                    <div key={fIdx}>
                                      <MathRichText content={f} />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </>
                    )}

                    {/* Sticky Callout Notes added by student */}
                    {callouts.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 relative z-20">
                        {callouts.map((c) => (
                          <div
                            key={c.id}
                            className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start justify-between gap-2 shadow-xs"
                          >
                            <MathRichText content={c.text} />
                            <button
                              type="button"
                              onClick={() =>
                                setCallouts((prev) => prev.filter((item) => item.id !== c.id))
                              }
                              className="text-amber-700 hover:text-red-600 font-bold cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {annotateMode && annotationTool === 'callout' && (
                      <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center gap-2 relative z-20">
                        <input
                          type="text"
                          value={newCalloutText}
                          onChange={(e) => setNewCalloutText(e.target.value)}
                          placeholder="Add sticky callout or equation ($...$) to this page..."
                          className="flex-1 px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newCalloutText.trim()) {
                              setCallouts((prev) => [
                                ...prev,
                                {
                                  id: `cal-${Date.now()}`,
                                  text: newCalloutText.trim(),
                                  color: penColor,
                                },
                              ]);
                              setNewCalloutText('');
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          Pin Callout
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bottom Page Progress Bar */}
                  <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 text-xs text-slate-500">
                    <span>Page Progress</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-[#4F46E5] rounded-full transition-all"
                        style={{
                          width: `${Math.round(((pageIdx + 1) / Math.max(1, pagesList.length)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="font-semibold tabular-nums">
                      {currentPageData.pageNumber} / {pagesList.length} pages
                    </span>
                  </div>
                </div>

                {/* Right AI Tutor Panel with 2-Way Context Toggle & One-Click "Create Visual" Button (4 Cols on wide screen) */}
                <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between space-y-4 shadow-2xs">
                  <div className="space-y-4 flex-1 flex flex-col">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                          AI Tutor
                        </h2>
                      </div>
                      <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px] font-semibold">
                        {(['English', 'Hinglish'] as const).map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setTutorLang(l)}
                            className={`px-2 py-0.5 rounded cursor-pointer ${
                              tutorLang === l
                                ? 'bg-white text-[#4F46E5] shadow-2xs'
                                : 'text-slate-500'
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2-Way Context Mode Toggle: Strict Uploaded Material Only vs Open JEE Tutor */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
                      <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
                        <button
                          type="button"
                          onClick={() => setTutorContextMode('strict_material')}
                          className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                            tutorContextMode === 'strict_material'
                              ? 'bg-[#EEF2FF] text-[#4F46E5] shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Strict Uploaded Material Only
                        </button>
                        <button
                          type="button"
                          onClick={() => setTutorContextMode('open_jee')}
                          className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                            tutorContextMode === 'open_jee'
                              ? 'bg-[#EEF2FF] text-[#4F46E5] shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Open JEE Tutor
                        </button>
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowCreateDropdown((v) => !v)}
                          className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-[#EEF2FF]/60 text-[#4F46E5] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Studio ▾</span>
                        </button>

                        {showCreateDropdown && (
                          <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 z-20 text-xs">
                            {(
                              [
                                { label: '2D / 3D Diagram', tab: 'Diagram Maker' },
                                { label: 'Concept Image', tab: 'Visual' },
                                { label: 'Animated Video', tab: 'Animated Lesson' },
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

                    {/* Difficulty Level Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 pb-1">
                      {(
                        [
                          { id: 'board', label: 'Board Level' },
                          { id: 'jee_main', label: 'JEE Main' },
                          { id: 'jee_advanced', label: 'JEE Advanced' },
                        ] as const
                      ).map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => setTutorDifficulty(lvl.id)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer ${
                            tutorDifficulty === lvl.id
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>

                    {/* Default Page Summary Card + Chat Thread */}
                    <div className="space-y-3 max-h-[430px] overflow-y-auto pr-1 flex-1">
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/40 dark:bg-slate-800/40">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5] text-xs font-bold">
                            Page {currentPageData.pageNumber} Summary
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

                        <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                          <MathRichText
                            content={
                              currentPageData.aiTutorSummary[
                                tutorLang === 'Hinglish' ? 'hinglish' : 'english'
                              ]
                            }
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
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
                          <button
                            type="button"
                            disabled={tutorLoading}
                            onClick={() => handleTutorExplain('UnitCheck')}
                            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 cursor-pointer"
                          >
                            Unit Check
                          </button>
                        </div>
                      </div>

                      {/* Chat Messages with Citations & One-Click "Create Visual" Button */}
                      {tutorChat.map((turn) => (
                        <div
                          key={turn.id}
                          className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                            turn.role === 'user'
                              ? 'bg-[#EEF2FF]/60 border-indigo-200 ml-6'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] uppercase text-[#4F46E5]">
                              {turn.role === 'user'
                                ? 'You'
                                : `AI Tutor (${
                                    turn.contextMode === 'strict_material'
                                      ? 'Strict Material'
                                      : 'Open JEE'
                                  })`}
                            </span>
                          </div>

                          <MathRichText content={turn.text} className="leading-relaxed" />

                          {turn.citations && turn.citations.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {turn.citations.map((cit, cIdx) => (
                                <button
                                  key={cIdx}
                                  type="button"
                                  onClick={() => setPageIdx(Math.max(0, cit.pageNumber - 1))}
                                  className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold hover:bg-indigo-100 cursor-pointer"
                                  title={cit.excerpt}
                                >
                                  Page {cit.pageNumber}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* One-Click "Create Visual" Button on Every AI Tutor Reply */}
                          {turn.role === 'tutor' && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setVisualPickerTurnId(
                                      visualPickerTurnId === turn.id ? null : turn.id
                                    )
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-[#EEF2FF] hover:bg-indigo-100 text-[#4F46E5] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>
                                    {generatingInlineVisual === turn.id
                                      ? 'Synthesizing Visual...'
                                      : 'Create Visual to Understand Better'}
                                  </span>
                                </button>
                              </div>

                              {visualPickerTurnId === turn.id && (
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 grid grid-cols-2 gap-1.5">
                                  {(
                                    [
                                      '2D Diagram',
                                      '3D Scene',
                                      'Concept Image',
                                      'Animated Video',
                                    ] as const
                                  ).map((vType) => (
                                    <button
                                      key={vType}
                                      type="button"
                                      onClick={() =>
                                        handleCreateVisualFromTutorReply(turn, vType)
                                      }
                                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 hover:border-[#4F46E5] text-left font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                                    >
                                      + {vType}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Inline Embedded Visual inside AI Tutor Reply */}
                              {turn.embeddedVisual && (
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-indigo-200 space-y-2">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-[#4F46E5]">
                                    <span>
                                      Generated {turn.embeddedVisual.type} (Saved to Create Library)
                                    </span>
                                  </div>
                                  {turn.embeddedVisual.type === '2D Diagram' &&
                                    turn.embeddedVisual.svgHtml && (
                                      <div
                                        className="w-full h-48 bg-white rounded-lg p-2 flex items-center justify-center overflow-hidden"
                                        dangerouslySetInnerHTML={{
                                          __html: sanitizeSvgMarkup(turn.embeddedVisual.svgHtml),
                                        }}
                                      />
                                    )}
                                  {turn.embeddedVisual.type === '3D Scene' &&
                                    turn.embeddedVisual.preset && (
                                      <div className="w-full h-56 rounded-lg overflow-hidden">
                                        <ThreeSceneCanvas
                                          preset={turn.embeddedVisual.preset}
                                          animateMotion={true}
                                        />
                                      </div>
                                    )}
                                  {turn.embeddedVisual.type === 'Concept Image' && (
                                    <div className="w-full bg-white rounded-lg p-2 flex items-center justify-center">
                                      {turn.embeddedVisual.imageUrl ? (
                                        <img
                                          src={turn.embeddedVisual.imageUrl}
                                          alt="Tutor Concept Visual"
                                          className="max-h-48 object-contain rounded"
                                        />
                                      ) : turn.embeddedVisual.svgHtml ? (
                                        <div
                                          className="w-full h-44 flex items-center justify-center"
                                          dangerouslySetInnerHTML={{
                                            __html: sanitizeSvgMarkup(turn.embeddedVisual.svgHtml),
                                          }}
                                        />
                                      ) : null}
                                    </div>
                                  )}
                                  {turn.embeddedVisual.type === 'Animated Video' &&
                                    turn.embeddedVisual.videoUrl && (
                                      <video
                                        controls
                                        src={turn.embeddedVisual.videoUrl}
                                        className="w-full max-h-48 rounded-lg"
                                      />
                                    )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
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
                      placeholder={
                        tutorContextMode === 'strict_material'
                          ? `Ask strictly from ${selectedMaterial.title}...`
                          : 'Ask any JEE Physics, Chemistry, or Math doubt...'
                      }
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
            </>
          )}
        </div>
      )}

      {subTab === 'Create' && (
        <CreateStudioPanel
          materials={materials}
          selectedMaterial={selectedMaterial ?? null}
          creations={creations}
          onSaveCreation={onSaveCreation}
          requestedCreateTab={createTab}
        />
      )}

      {subTab === 'Resources' && (
        <ResourcesAndGuidePanel onAddQuickSheetMaterial={onAddQuickSheetMaterial} />
      )}
    </div>
  );
};
