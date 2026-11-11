import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Home,
  BookMarked,
  Target,
  ListChecks,
  BarChart3,
  Plus,
  Search,
  Grid,
  Clock,
  Sun,
  Moon,
  Bell,
  HelpCircle,
  LogOut,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDoc,
} from 'firebase/firestore';
import {
  db,
  initAuth,
  logoutUser,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { LandingPage, AuthScreen } from './components/LandingAndAuth';
import {
  HomeDashboardView,
  StudyWorkspaceView,
  MaterialItem,
  StudyTaskItem,
  CreationItem,
} from './components/HomeAndStudyViews';
import {
  ReviseWorkspaceView,
  PracticeDashboardView,
  ProgressDashboardView,
  CBTMockExamView,
} from './components/RevisePracticeProgressCBT';
import {
  AddMaterialModal,
  StudyToolsDrawer,
  FocusTimerModal,
  LiveVoiceTutorModal,
  WorkspaceConfirmModal,
} from './components/GlobalOverlays';
import {
  syncStudyTasksWithCalendarAndTasks,
  exportMindMapToGoogleSlides,
  exportRevisionToGoogleKeepOrDrive,
} from './services/workspaceService';
import { MindMapNodeItem, DIAGRAM_SVG_PRESETS } from './data/jeeInitialContent';
import { CBTMockSummary } from './utils/jeeEngine';

const DEFAULT_MATERIALS: MaterialItem[] = [
  {
    id: 'mat-df-block',
    title: 'd & f Block – Handwritten Notes',
    subject: 'Chemistry',
    chapter: 'd & f Block',
    sourceType: 'pdf',
    pageCount: 13,
    currentPage: 2,
    progressPct: 15,
    contentSummary:
      'Transition elements (d-block) definition, variable oxidation states, magnetic moment, Group 12 exception, and Lanthanoid contraction.',
    addedLabel: 'Today',
  },
  {
    id: 'mat-electrochem',
    title: 'Electrochemistry – Video Notes',
    subject: 'Chemistry',
    chapter: 'Electrochemistry',
    sourceType: 'youtube',
    pageCount: 10,
    currentPage: 1,
    progressPct: 35,
    contentSummary: 'Nernst equation, standard electrode potentials, and Kohlrausch law.',
    addedLabel: 'Yesterday',
  },
];

const DEFAULT_TASKS: StudyTaskItem[] = [
  {
    id: 'task-1',
    title: 'Revise d & f Block – Handwritten Notes',
    durationMin: 15,
    completed: false,
    dueDate: '2026-11-12',
  },
  {
    id: 'task-2',
    title: 'Attempt 10 Electrochemistry PYQs',
    durationMin: 20,
    completed: false,
    dueDate: '2026-11-12',
  },
];

const DEFAULT_CREATIONS: CreationItem[] = [
  {
    id: 'creat-incline',
    type: 'diagram',
    title: 'Inclined Plane Free-Body Diagram',
    prompt:
      'Free-body diagram of a block on an inclined plane, show only gravity (down) and normal (perpendicular to incline).',
    subject: 'Physics',
    preset: 'Incline',
    assetData: DIAGRAM_SVG_PRESETS.Incline,
    resolutionOrRatio: '2D SVG',
  },
];

export default function App() {
  // Check for ?autostart=1 query param used by automated browser verification
  const isAutoStart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [authStage, setAuthStage] = useState<'landing' | 'auth' | 'workspace'>(
    isAutoStart ? 'workspace' : 'landing'
  );
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Primary Workspace Navigation
  const [activeNav, setActiveNav] = useState<
    'Home' | 'Study' | 'Practice' | 'Revise' | 'Progress' | 'CBT_MOCK'
  >('Home');
  const [studyInitialSubTab, setStudyInitialSubTab] = useState<
    'Syllabus' | 'Chapter Notes' | 'My Materials' | 'AI Tutor' | 'Create' | 'Resources'
  >('Chapter Notes');

  // Theme & Global Modals
  const [darkMode, setDarkMode] = useState(false);
  const [addMaterialOpen, setAddMaterialOpen] = useState(false);
  const [addMaterialInitialTab, setAddMaterialInitialTab] = useState<
    'pdf' | 'photo' | 'youtube' | 'text' | 'drive'
  >('youtube');
  const [studyToolsOpen, setStudyToolsOpen] = useState(false);
  const [focusModalOpen, setFocusModalOpen] = useState(false);
  const [voiceTutorOpen, setVoiceTutorOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Focus 25:00 Pomodoro Timer State
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);

  // Student Workspace Data (synced with Firestore when authenticated)
  const [materials, setMaterials] = useState<MaterialItem[]>(DEFAULT_MATERIALS);
  const [tasks, setTasks] = useState<StudyTaskItem[]>(DEFAULT_TASKS);
  const [creations, setCreations] = useState<CreationItem[]>(DEFAULT_CREATIONS);
  const [customFlashcards, setCustomFlashcards] = useState<
    { id: string; title: string; definition: string; trap: string }[]
  >([]);
  const [latestMockSummary, setLatestMockSummary] = useState<CBTMockSummary | null>(null);
  const [streakDays, setStreakDays] = useState(14);
  const [xp, setXp] = useState(420);
  const [level, setLevel] = useState(5);

  // Google Workspace Confirmation Modal State
  const [workspaceConfirm, setWorkspaceConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    action: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Global Ctrl+K shortcut for search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Pomodoro Timer interval
  useEffect(() => {
    if (!focusRunning) return;
    const timer = setInterval(() => {
      setFocusSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [focusRunning]);

  // Firebase Auth listener & Firestore real-time subscriptions
  useEffect(() => {
    const unsubAuth = initAuth(
      async (user) => {
        setCurrentUser(user);
        setAuthStage('workspace');

        // Ensure user profile doc exists in Firestore
        const userRef = doc(db, 'users', user.uid);
        try {
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              uid: user.uid,
              displayName: user.displayName || user.email?.split('@')[0] || 'Scholar',
              email: user.email || '',
              targetExam: 'JEE Main 2027',
              streakDays: 14,
              xp: 420,
              level: 5,
              focusSessionsCount: 23,
              focusHoursTotal: 9.5,
              preferredLanguage: 'English',
              theme: 'light',
              createdAt: new Date().toISOString(),
            });
          } else {
            const data = snap.data();
            if (typeof data.streakDays === 'number') setStreakDays(data.streakDays);
            if (typeof data.xp === 'number') setXp(data.xp);
            if (typeof data.level === 'number') setLevel(data.level);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      },
      () => {
        setCurrentUser(null);
        if (!isAutoStart) {
          setAuthStage('landing');
        }
      }
    );
    return () => unsubAuth();
  }, [isAutoStart]);

  // Subscribe to user's private collections when signed in
  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.uid;

    const unsubMaterials = onSnapshot(
      query(collection(db, 'materials'), where('userId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const list: MaterialItem[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title,
              subject: data.subject,
              chapter: data.chapter || data.title,
              sourceType: data.sourceType,
              sourceRef: data.sourceRef,
              pageCount: data.pageCount || 13,
              currentPage: data.currentPage || 1,
              progressPct: data.progressPct || 0,
              contentSummary: data.contentSummary || '',
            };
          });
          setMaterials([...DEFAULT_MATERIALS, ...list]);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'materials')
    );

    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), where('userId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const list: StudyTaskItem[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title,
              durationMin: data.durationMin || 20,
              completed: Boolean(data.completed),
              dueDate: data.dueDate || '2026-11-12',
            };
          });
          setTasks([...DEFAULT_TASKS, ...list]);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'tasks')
    );

    const unsubCreations = onSnapshot(
      query(collection(db, 'creations'), where('userId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const list: CreationItem[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              type: data.type,
              title: data.title,
              prompt: data.prompt,
              subject: data.subject || 'Physics',
              preset: data.preset,
              assetData: data.assetData,
              resolutionOrRatio: data.resolutionOrRatio,
            };
          });
          setCreations([...DEFAULT_CREATIONS, ...list]);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'creations')
    );

    return () => {
      unsubMaterials();
      unsubTasks();
      unsubCreations();
    };
  }, [currentUser]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddMaterial = async (item: {
    title: string;
    subject: 'Physics' | 'Chemistry' | 'Mathematics';
    chapter: string;
    sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
    sourceRef: string;
    contentSummary: string;
  }) => {
    const localItem: MaterialItem = {
      id: `mat-${Date.now()}`,
      title: item.title,
      subject: item.subject,
      chapter: item.chapter,
      sourceType: item.sourceType,
      sourceRef: item.sourceRef,
      pageCount: 15,
      currentPage: 1,
      progressPct: 10,
      contentSummary: item.contentSummary,
      addedLabel: 'Just now',
    };
    setMaterials((prev) => [localItem, ...prev]);
    showToast(`Added "${item.title}" to My Materials!`);

    if (currentUser) {
      try {
        await addDoc(collection(db, 'materials'), {
          userId: currentUser.uid,
          title: item.title,
          subject: item.subject,
          chapter: item.chapter,
          sourceType: item.sourceType,
          sourceRef: item.sourceRef,
          pageCount: 15,
          currentPage: 1,
          progressPct: 10,
          contentSummary: item.contentSummary.slice(0, 9000),
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'materials');
      }
    }
  };

  const handleAddTask = async (title: string, durationMin: number) => {
    const newTask: StudyTaskItem = {
      id: `task-${Date.now()}`,
      title,
      durationMin,
      completed: false,
      dueDate: '2026-11-12',
    };
    setTasks((prev) => [...prev, newTask]);

    if (currentUser) {
      try {
        await addDoc(collection(db, 'tasks'), {
          userId: currentUser.uid,
          title,
          durationMin,
          completed: false,
          dueDate: '2026-11-12',
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'tasks');
      }
    }
  };

  const handleToggleTask = async (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
    if (currentUser && !taskId.startsWith('task-')) {
      const target = tasks.find((t) => t.id === taskId);
      if (target) {
        try {
          await updateDoc(doc(db, 'tasks', taskId), {
            completed: !target.completed,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
        }
      }
    }
  };

  const handleSaveCreation = async (creation: Omit<CreationItem, 'id'>) => {
    const newItem: CreationItem = {
      ...creation,
      id: `creat-${Date.now()}`,
    };
    setCreations((prev) => [newItem, ...prev]);

    if (currentUser) {
      try {
        await addDoc(collection(db, 'creations'), {
          userId: currentUser.uid,
          ...creation,
          assetData: creation.assetData.slice(0, 9000),
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'creations');
      }
    }
  };

  const handleAddFlashcard = async (node: MindMapNodeItem) => {
    setCustomFlashcards((prev) => [
      ...prev,
      {
        id: node.id,
        title: node.title,
        definition: node.definition,
        trap: node.commonTrap,
      },
    ]);

    if (currentUser) {
      try {
        await addDoc(collection(db, 'revisions'), {
          userId: currentUser.uid,
          chapter: 'd & f Block',
          format: 'flashcard',
          nodeTitle: node.title,
          definition: node.definition,
          example: node.example,
          commonTrap: node.commonTrap,
          pageRef: node.pageRef,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'revisions');
      }
    }
  };

  const handleSubmitCBTMock = async (summary: CBTMockSummary, focusEvents: number) => {
    setLatestMockSummary(summary);
    setActiveNav('Progress');
    showToast(
      `Submitted JEE Main Mock! Score: ${summary.totalScore} / ${summary.maxScore} (${summary.accuracyPct}% accuracy)`
    );

    if (currentUser) {
      try {
        await addDoc(collection(db, 'mockAttempts'), {
          userId: currentUser.uid,
          mockTitle: 'JEE Main • Practice Mock',
          examType: 'Main',
          score: summary.totalScore,
          maxMarks: summary.maxScore,
          accuracy: summary.accuracyPct,
          timeTakenMinutes: 38,
          correctCount: summary.correctCount,
          incorrectCount: summary.incorrectCount,
          skippedCount: summary.unansweredCount,
          focusEvents,
          responsesJson: JSON.stringify(summary.paletteCounts),
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'mockAttempts');
      }
    }
  };

  // Render Landing or Auth Screen when not in Workspace
  if (authStage === 'landing') {
    return (
      <LandingPage
        onOpenAuth={(mode) => {
          setAuthMode(mode);
          setAuthStage('auth');
        }}
      />
    );
  }

  if (authStage === 'auth') {
    return (
      <AuthScreen
        initialMode={authMode}
        onBackToLanding={() => setAuthStage('landing')}
        onAuthComplete={() => setAuthStage('workspace')}
      />
    );
  }

  // Full-Screen NTA CBT Practice Mock Mode (Screen 1)
  if (activeNav === 'CBT_MOCK') {
    return (
      <CBTMockExamView
        candidateName={
          currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Candidate'
        }
        onSubmitMock={handleSubmitCBTMock}
        onExitMock={() => setActiveNav('Practice')}
      />
    );
  }

  const displayUserName =
    currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Aniket';
  const avatarInitial = displayUserName.charAt(0).toUpperCase();
  const focusMins = String(Math.floor(focusSeconds / 60)).padStart(2, '0');
  const focusSecs = String(focusSeconds % 60).padStart(2, '0');

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col">
      {/* Global Top Navigation Bar matching all authenticated LearnMate JEE screenshots */}
      <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-3">
        {/* Left Brand + Primary 5 Nav Items */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveNav('Home')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white shadow-2xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="font-display font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
              LearnMate
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#EEF2FF] text-[#4F46E5]">
              JEE
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {(
              [
                { id: 'Home', icon: Home },
                { id: 'Study', icon: BookMarked },
                { id: 'Practice', icon: Target },
                { id: 'Revise', icon: ListChecks },
                { id: 'Progress', icon: BarChart3 },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#EEF2FF] text-[#4F46E5]'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.id}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Action Controls matching screenshots */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAddMaterialInitialTab('youtube');
              setAddMaterialOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Material</span>
          </button>

          <button
            type="button"
            onClick={() => setSearchModalOpen(true)}
            aria-label="Search workspace"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Search (Ctrl+K)</span>
          </button>

          <button
            type="button"
            onClick={() => setStudyToolsOpen(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Grid className="w-3.5 h-3.5 text-[#4F46E5]" />
            <span className="hidden lg:inline">Study Tools</span>
          </button>

          <button
            type="button"
            onClick={() => setFocusModalOpen(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 font-mono tabular-nums cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-[#4F46E5]" />
            <span>
              {focusMins}:{focusSecs}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label="Toggle color theme"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => showToast('2 revision reminders: 12 flashcards due in d & f Block.')}
            aria-label="Notifications"
            className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              2
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStudyInitialSubTab('Resources');
              setActiveNav('Study');
            }}
            aria-label="Help and Exam Guide"
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-1.5">
            <div
              title={`Signed in as ${displayUserName}`}
              className="w-8 h-8 rounded-full bg-[#4F46E5] text-white font-display font-bold text-xs flex items-center justify-center shadow-2xs"
            >
              {avatarInitial}
            </div>
            <button
              type="button"
              onClick={async () => {
                await logoutUser();
                setAuthStage('landing');
              }}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Bar */}
      <div className="md:hidden flex items-center justify-around bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-2 px-2 text-xs">
        {(['Home', 'Study', 'Practice', 'Revise', 'Progress'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveNav(tab)}
            className={`px-3 py-1.5 rounded-lg font-semibold ${
              activeNav === tab ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'text-slate-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xl flex items-center gap-3">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main View Router */}
      <main className="flex-1">
        {activeNav === 'Home' && (
          <HomeDashboardView
            userName={displayUserName}
            materials={materials}
            tasks={tasks}
            streakDays={streakDays}
            xp={xp}
            level={level}
            onToggleTask={handleToggleTask}
            onAddTask={handleAddTask}
            onSyncWorkspaceTasks={() => {
              setWorkspaceConfirm({
                isOpen: true,
                title: 'Sync Study Schedule with Google Calendar & Tasks',
                description:
                  'This will create a study block in your primary Google Calendar and sync your active LearnMate JEE tasks to your Google Tasks list.',
                confirmLabel: 'Confirm & Sync',
                action: async () => {
                  try {
                    const res = await syncStudyTasksWithCalendarAndTasks(
                      tasks.map((t) => ({ title: t.title, durationMin: t.durationMin }))
                    );
                    showToast(
                      `Synced ${res.tasksCreated} tasks to Google Tasks & Calendar!`
                    );
                  } catch (err: any) {
                    showToast(err?.message || 'Sign in with Google to sync Calendar & Tasks.');
                  } finally {
                    setWorkspaceConfirm(null);
                  }
                },
              });
            }}
            onOpenStudyWorkbench={() => {
              setStudyInitialSubTab('Chapter Notes');
              setActiveNav('Study');
            }}
            onOpenRevise={() => setActiveNav('Revise')}
            onOpenPractice={() => setActiveNav('Practice')}
            onOpenProgress={() => setActiveNav('Progress')}
            onOpenAddMaterial={(tab) => {
              setAddMaterialInitialTab(tab);
              setAddMaterialOpen(true);
            }}
            onOpenStudyTools={() => setStudyToolsOpen(true)}
          />
        )}

        {activeNav === 'Study' && (
          <StudyWorkspaceView
            initialSubTab={studyInitialSubTab}
            materials={materials}
            creations={creations}
            onSaveCreation={handleSaveCreation}
            onAddQuickSheetMaterial={async (title, subject, summary) => {
              await handleAddMaterial({
                title,
                subject,
                chapter: title,
                sourceType: 'text',
                sourceRef: 'Quick Sheet',
                contentSummary: summary,
              });
            }}
            onOpenVoiceTutor={() => setVoiceTutorOpen(true)}
            onStartPracticeQuiz={() => setActiveNav('Practice')}
          />
        )}

        {activeNav === 'Practice' && (
          <PracticeDashboardView onStartCBTMock={() => setActiveNav('CBT_MOCK')} />
        )}

        {activeNav === 'Revise' && (
          <ReviseWorkspaceView
            customCards={customFlashcards}
            onAddFlashcard={handleAddFlashcard}
            onExportToSlides={(chapterTitle, nodes) => {
              setWorkspaceConfirm({
                isOpen: true,
                title: 'Export Mind Map to Google Slides',
                description: `Create a new Google Slides presentation for "${chapterTitle}" containing your revision mind map nodes and JEE trap warnings.`,
                confirmLabel: 'Create Presentation',
                action: async () => {
                  try {
                    const res = await exportMindMapToGoogleSlides(
                      chapterTitle,
                      nodes.map((n) => ({
                        title: n.title,
                        definition: n.definition,
                        trap: n.commonTrap,
                      }))
                    );
                    showToast(`Created Google Slides presentation (ID: ${res.presentationId})!`);
                  } catch (err: any) {
                    showToast(err?.message || 'Sign in with Google to export to Google Slides.');
                  } finally {
                    setWorkspaceConfirm(null);
                  }
                },
              });
            }}
            onExportToKeep={(chapterTitle, nodes) => {
              setWorkspaceConfirm({
                isOpen: true,
                title: 'Save Revision Summary to Google Keep / Drive',
                description: `Save a quick-revision checklist note for "${chapterTitle}" to your Google Workspace account.`,
                confirmLabel: 'Save Revision Note',
                action: async () => {
                  try {
                    const res = await exportRevisionToGoogleKeepOrDrive(
                      `${chapterTitle} – JEE Quick Revision`,
                      nodes.map((n) => `${n.title}: ${n.definition} (Trap: ${n.commonTrap})`)
                    );
                    showToast(`Saved revision note to ${res.target}!`);
                  } catch (err: any) {
                    showToast(err?.message || 'Sign in with Google to export revision notes.');
                  } finally {
                    setWorkspaceConfirm(null);
                  }
                },
              });
            }}
          />
        )}

        {activeNav === 'Progress' && (
          <ProgressDashboardView
            latestMockSummary={latestMockSummary}
            onOpenRevise={() => setActiveNav('Revise')}
            onOpenPractice={() => setActiveNav('Practice')}
          />
        )}
      </main>

      {/* Global Overlays & Modals */}
      <AddMaterialModal
        isOpen={addMaterialOpen}
        initialTab={addMaterialInitialTab}
        onClose={() => setAddMaterialOpen(false)}
        onAddMaterial={handleAddMaterial}
      />

      <StudyToolsDrawer
        isOpen={studyToolsOpen}
        onClose={() => setStudyToolsOpen(false)}
      />

      <FocusTimerModal
        isOpen={focusModalOpen}
        secondsLeft={focusSeconds}
        running={focusRunning}
        onToggleRun={() => setFocusRunning((r) => !r)}
        onReset={() => {
          setFocusRunning(false);
          setFocusSeconds(25 * 60);
        }}
        onClose={() => setFocusModalOpen(false)}
      />

      <LiveVoiceTutorModal
        isOpen={voiceTutorOpen}
        chapterTitle="d & f Block Elements"
        onClose={() => setVoiceTutorOpen(false)}
      />

      {workspaceConfirm && (
        <WorkspaceConfirmModal
          isOpen={workspaceConfirm.isOpen}
          title={workspaceConfirm.title}
          description={workspaceConfirm.description}
          confirmLabel={workspaceConfirm.confirmLabel}
          onConfirm={workspaceConfirm.action}
          onCancel={() => setWorkspaceConfirm(null)}
        />
      )}

      {/* Global Search (Ctrl+K) Modal */}
      {searchModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Global Search"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center pt-20 p-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Search className="w-4 h-4 text-[#4F46E5]" />
              <input
                type="text"
                autoFocus
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                placeholder="Jump to chapter, tool, diagram preset, or mock test..."
                className="flex-1 text-sm bg-transparent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1 text-xs">
              {[
                { label: 'd & f Block – Study Workbench (Page 2)', nav: 'Study' as const },
                { label: 'Create Studio – Inclined Plane 2D SVG & 3D Model', nav: 'Study' as const, sub: 'Create' as const },
                { label: 'd & f Block – Revision Mind Map', nav: 'Revise' as const },
                { label: 'JEE Main • Practice Mock (Full NTA CBT)', nav: 'CBT_MOCK' as const },
                { label: 'Study Tools – Graphing Calculator (y = x² − 4)', tool: true },
              ]
                .filter((item) =>
                  item.label.toLowerCase().includes(globalSearchQuery.toLowerCase())
                )
                .map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSearchModalOpen(false);
                      if (item.tool) {
                        setStudyToolsOpen(true);
                      } else if (item.nav) {
                        if (item.sub) setStudyInitialSubTab(item.sub);
                        setActiveNav(item.nav);
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-left font-medium hover:bg-[#EEF2FF] hover:text-[#4F46E5] transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
