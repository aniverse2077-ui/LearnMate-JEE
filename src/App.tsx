import React, { useState, useEffect } from 'react';
import {
  Home,
  BookOpen,
  Target,
  Layers,
  BarChart3,
  Plus,
  Search,
  Grid,
  Clock,
  Sun,
  Moon,
  Bell,
  HelpCircle,
  GraduationCap,
  CheckCircle2,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  Sparkles,
  FolderOpen,
  Mic,
} from 'lucide-react';
import {
  db,
  initAuth,
  logoutUser,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { User as FirebaseUser } from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';

import { LandingPage, AuthScreen, LegalModalTabId } from './components/LandingAndAuth';
import {
  MaterialItem,
  StudyTaskItem,
  CreationItem,
} from './components/HomeAndStudyViews';
import {
  ReviseWorkspaceView,
  PracticeDashboardView,
  MistakeNotebookEntry,
} from './components/RevisePracticeProgressCBT';
import {
  AddMaterialModal,
  FocusTimerModal,
  LiveVoiceTutorModal,
  WorkspaceConfirmModal,
  ProfileModal,
  LegalComplianceModal,
  InstantPracticeModal,
  StudentProfileData,
  InstantPracticeConfig,
} from './components/GlobalOverlays';
import {
  MindMapNodeItem,
  MaterialStudyBundle,
  NotePageData,
  generateMaterialStudyBundle,
} from './data/jeeInitialContent';
import {
  CBTMockSummary,
  CBTQuestion,
  SM2FlashcardItem,
  ErrorRootCauseTag,
  ExamTrack,
} from './utils/jeeEngine';
import {
  syncStudyTasksWithCalendarAndTasks,
  clearAllIndexedDbDocuments,
  syncChunkedMaterialToFirestore,
  syncRevisionStateToFirestore,
} from './services/workspaceService';
import { AuthAndWorkspaceContext } from './context/AuthAndWorkspaceContext';
import { DashboardView } from './components/dashboard/DashboardView';
import { StudyWorkbenchView } from './components/study/StudyWorkbenchView';
import { JeeCbtExamModal } from './components/cbt/JeeCbtExamModal';
import { CustomTestGeneratorModal } from './components/cbt/CustomTestGeneratorModal';
import { ProgressAndRankView } from './components/analytics/ProgressAndRankView';
import { CompactStudyUtilitiesDrawer } from './components/utilities/CompactStudyUtilitiesDrawer';

type PrimaryTab = 'Home' | 'Study' | 'Practice' | 'Revise' | 'Progress';

export function App() {
  // Authentication & View Routing State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [unauthScreen, setUnauthScreen] = useState<'landing' | 'auth'>('landing');
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>('signup');

  // Primary Navigation & Full-screen CBT Mode
  const [activeTab, setActiveTab] = useState<PrimaryTab>('Home');
  const [studySubTab, setStudySubTab] = useState<
    'Syllabus' | 'Chapter Notes' | 'My Materials' | 'AI Tutor' | 'Create' | 'Resources'
  >('Chapter Notes');
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null);
  const [inCBTMockMode, setInCBTMockMode] = useState<boolean>(false);
  const [cbtExamMode, setCbtExamMode] = useState<ExamTrack>('JEE Main');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Commercial B2C Freemium & Pro Aspirant Subscription State
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro'>('free');
  const [proModalOpen, setProModalOpen] = useState<boolean>(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  // Global Overlays State
  const [addMaterialOpen, setAddMaterialOpen] = useState<boolean>(false);
  const [addMaterialInitialTab, setAddMaterialInitialTab] = useState<
    'pdf' | 'photo' | 'youtube' | 'text' | 'drive'
  >('youtube');
  const [studyToolsOpen, setStudyToolsOpen] = useState<boolean>(false);
  const [focusTimerOpen, setFocusTimerOpen] = useState<boolean>(false);
  const [focusSecondsLeft, setFocusSecondsLeft] = useState<number>(25 * 60);
  const [focusRunning, setFocusRunning] = useState<boolean>(false);
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [voiceTutorOpen, setVoiceTutorOpen] = useState<boolean>(false);
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [workspaceSyncConfirmOpen, setWorkspaceSyncConfirmOpen] = useState<boolean>(false);
  const [legalModalState, setLegalModalState] = useState<{
    isOpen: boolean;
    tab: LegalModalTabId;
  }>({
    isOpen: false,
    tab: 'privacy',
  });
  const [instantPracticeConfig, setInstantPracticeConfig] =
    useState<InstantPracticeConfig | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // 100% Clean Zero-State User Data (Zero preloaded materials or tasks; keep only PYQs)
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [materialBundles, setMaterialBundles] = useState<Record<string, MaterialStudyBundle>>({});
  const [tasks, setTasks] = useState<StudyTaskItem[]>([]);
  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [mistakesNotebook, setMistakesNotebook] = useState<MistakeNotebookEntry[]>([]);
  const [sm2Cards, setSm2Cards] = useState<SM2FlashcardItem[]>([]);
  const [customTestModalOpen, setCustomTestModalOpen] = useState<boolean>(false);
  const [customCbtConfig, setCustomCbtConfig] = useState<{
    questions: CBTQuestion[];
    durationMinutes: number;
    paperTitle: string;
  } | null>(null);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [xp, setXp] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [lastMockScore, setLastMockScore] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Student Profile State
  const [studentProfile, setStudentProfile] = useState<StudentProfileData>({
    displayName: 'JEE Aspirant',
    email: '',
    avatarColor: '#4F46E5',
    targetExam: 'JEE Main 2027',
    preferredLanguage: 'English',
    dailyGoalHours: 6,
    batchStatus: 'Class 12',
    coachingName: 'Self-Study + LearnMate JEE',
    targetRankOrPercentile: '99.5+ Percentile / AIR < 1500',
  });

  // Sync global .dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3600);
  };

  const handleOpenLegal = (tab: LegalModalTabId = 'privacy') => {
    setLegalModalState({ isOpen: true, tab });
  };

  // Load user-scoped Mistakes, SM-2 Cards & Subscription Tier when currentUser changes
  useEffect(() => {
    if (!currentUser) {
      setMistakesNotebook([]);
      setSm2Cards([]);
      setSubscriptionTier('free');
      return;
    }
    try {
      const mRaw = localStorage.getItem(`learnmate_${currentUser.uid}_mistakes_notebook`);
      if (mRaw) setMistakesNotebook(JSON.parse(mRaw));
      const cRaw = localStorage.getItem(`learnmate_${currentUser.uid}_sm2_cards`);
      if (cRaw) setSm2Cards(JSON.parse(cRaw));
      const tierRaw = localStorage.getItem(`learnmate_${currentUser.uid}_subscription_tier`);
      if (tierRaw === 'pro' || tierRaw === 'free') setSubscriptionTier(tierRaw);
    } catch {
      // ignore storage errors
    }
  }, [currentUser?.uid]);

  const handleActivateProTier = () => {
    setSubscriptionTier('pro');
    setProModalOpen(false);
    if (currentUser) {
      try {
        localStorage.setItem(`learnmate_${currentUser.uid}_subscription_tier`, 'pro');
      } catch {
        // ignore
      }
    }
    showToast('Upgraded to LearnMate Pro Aspirant! Unlimited AI Scans, 3D Labs & CBT Mocks unlocked.');
  };

  const handleRecordMistake = (
    question: CBTQuestion,
    userAnswer: string,
    source: 'CBT Mock' | 'PYQ Bank' | 'Adaptive Drill' = 'PYQ Bank'
  ) => {
    setMistakesNotebook((prev) => {
      if (prev.some((m) => m.question.id === question.id)) return prev;
      const entry: MistakeNotebookEntry = {
        id: `mistake-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        question,
        userAnswer,
        loggedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source,
      };
      const next = [entry, ...prev];
      if (currentUser) {
        try {
          localStorage.setItem(
            `learnmate_${currentUser.uid}_mistakes_notebook`,
            JSON.stringify(next)
          );
        } catch {
          // ignore storage quota
        }
        syncRevisionStateToFirestore('mistakes', next);
      }
      return next;
    });
  };

  const handleTagMistakeRootCause = (mistakeId: string, rootCause: ErrorRootCauseTag) => {
    setMistakesNotebook((prev) => {
      const next = prev.map((m) =>
        m.id === mistakeId ? { ...m, rootCauseTag: rootCause } : m
      );
      if (currentUser) {
        try {
          localStorage.setItem(
            `learnmate_${currentUser.uid}_mistakes_notebook`,
            JSON.stringify(next)
          );
        } catch {
          // ignore
        }
        syncRevisionStateToFirestore('mistakes', next);
      }
      return next;
    });
  };

  const handleUpdateSM2Card = (updatedCard: SM2FlashcardItem) => {
    setSm2Cards((prev) => {
      const next = prev.map((c) => (c.id === updatedCard.id ? updatedCard : c));
      if (currentUser) {
        try {
          localStorage.setItem(
            `learnmate_${currentUser.uid}_sm2_cards`,
            JSON.stringify(next)
          );
        } catch {
          // ignore
        }
        syncRevisionStateToFirestore('sm2_cards', next);
      }
      return next;
    });
  };

  const handleAddSM2Card = (cardData: Omit<SM2FlashcardItem, 'id'>) => {
    const newCard: SM2FlashcardItem = {
      ...cardData,
      id: `sm2-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setSm2Cards((prev) => {
      const next = [newCard, ...prev];
      if (currentUser) {
        try {
          localStorage.setItem(
            `learnmate_${currentUser.uid}_sm2_cards`,
            JSON.stringify(next)
          );
        } catch {
          // ignore
        }
        syncRevisionStateToFirestore('sm2_cards', next);
      }
      return next;
    });
  };

  // Complete Shared-Device Sign-Out Purge Handler
  const handleSignOutAndPurgeAll = async () => {
    const uid = currentUser?.uid;
    setProfileModalOpen(false);
    setMaterials([]);
    setMaterialBundles({});
    setSelectedMaterial(null);
    setTasks([]);
    setCreations([]);
    setMistakesNotebook([]);
    setSm2Cards([]);
    setStreakDays(0);
    setXp(0);
    setLevel(1);
    setLastMockScore(null);
    await clearAllIndexedDbDocuments();
    await logoutUser(uid);
    setCurrentUser(null);
    setUnauthScreen('landing');
  };

  // Pomodoro countdown effect
  useEffect(() => {
    if (!focusRunning) return;
    const interval = setInterval(() => {
      setFocusSecondsLeft((prev) => {
        if (prev <= 1) {
          setFocusRunning(false);
          showToast('25-minute Pomodoro Focus Session completed! +50 XP');
          setXp((x) => x + 50);
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [focusRunning]);

  // Global Cmd+K / Ctrl+K shortcut for Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (currentUser) setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser]);

  // Listen to Firebase Auth state & sync Firestore user profile
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isAutoStart = params.get('autostart') === '1' || params.get('dev_guest') === '1';

    if (isAutoStart) {
      setCurrentUser({
        uid: 'local_autostart_student',
        displayName: 'JEE Aspirant',
        email: 'aspirant@learnmate.jee',
      } as FirebaseUser);
      setAuthLoading(false);
    }

    const fallbackTimer = setTimeout(() => {
      setAuthLoading(false);
    }, 1500);

    const unsubscribe = initAuth(
      async (user) => {
        clearTimeout(fallbackTimer);
        setCurrentUser(user);
        setAuthLoading(false);

        const localRaw = localStorage.getItem(`learnmate_profile_${user.uid}`);
        let localParsed: Partial<StudentProfileData> = {};
        if (localRaw) {
          try {
            localParsed = JSON.parse(localRaw);
          } catch {
            // ignore malformed JSON
          }
        }

        if (user.uid.startsWith('local_')) {
          setStudentProfile((prev) => ({
            ...prev,
            ...localParsed,
            displayName:
              localParsed.displayName ||
              user.displayName ||
              user.email?.split('@')[0] ||
              'JEE Aspirant',
            email: user.email || '',
          }));
          return;
        }

        const userRef = doc(db, 'users', user.uid);
        try {
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            const now = new Date().toISOString();
            const defaultName =
              user.displayName || user.email?.split('@')[0] || 'JEE Aspirant';
            await setDoc(userRef, {
              userId: user.uid,
              displayName: defaultName,
              targetExam: 'JEE Main 2027',
              preferredLanguage: 'English',
              streakDays: 0,
              xp: 0,
              level: 1,
              focusMinutes: 0,
              physicsMastery: 0,
              chemistryMastery: 0,
              mathsMastery: 0,
              createdAt: now,
              updatedAt: now,
            });
            setStudentProfile((prev) => ({
              ...prev,
              ...localParsed,
              displayName: localParsed.displayName || defaultName,
              email: user.email || '',
            }));
          } else {
            const data = snap.data();
            setStudentProfile((prev) => ({
              ...prev,
              ...localParsed,
              displayName:
                localParsed.displayName ||
                data.displayName ||
                user.displayName ||
                user.email?.split('@')[0] ||
                'JEE Aspirant',
              email: user.email || '',
              targetExam:
                (localParsed.targetExam as StudentProfileData['targetExam']) ||
                data.targetExam ||
                'JEE Main 2027',
              preferredLanguage:
                (localParsed.preferredLanguage as StudentProfileData['preferredLanguage']) ||
                data.preferredLanguage ||
                'English',
            }));
            if (typeof data.xp === 'number') setXp(data.xp);
            if (typeof data.level === 'number') setLevel(data.level);
            if (typeof data.streakDays === 'number') setStreakDays(data.streakDays);
          }
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
          } catch {
            // Non-blocking fallback
          }
        }
      },
      () => {
        clearTimeout(fallbackTimer);
        if (isAutoStart) {
          const autoUser = {
            uid: 'local_autostart_student',
            displayName: 'JEE Aspirant',
            email: 'aspirant@learnmate.jee',
          } as FirebaseUser;
          setCurrentUser(autoUser);
        } else {
          setCurrentUser(null);
        }
        setAuthLoading(false);
      }
    );

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  // Real-time listener for user's uploaded study materials in Firestore (Strictly user-uploaded only)
  useEffect(() => {
    if (!currentUser || currentUser.uid.startsWith('local_')) return;
    const materialsRef = collection(db, 'users', currentUser.uid, 'materials');
    const q = query(materialsRef, orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const loaded: MaterialItem[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title || 'Untitled Material',
              subject: (data.subject as MaterialItem['subject']) || 'Physics',
              chapter: data.chapter || 'General',
              sourceType: (data.sourceType as MaterialItem['sourceType']) || 'pdf',
              sourceRef: data.sourceRef || '',
              pageCount: data.pageCount || 3,
              currentPage: data.currentPage || 1,
              progressPct: data.progressPct || 15,
              contentSummary: data.contentSummary || '',
              addedLabel: 'Uploaded',
            };
          });
          setMaterials(loaded);
          setMaterialBundles((prev) => {
            const next = { ...prev };
            loaded.forEach((m) => {
              if (!next[m.id]) {
                next[m.id] = generateMaterialStudyBundle({
                  materialId: m.id,
                  title: m.title,
                  subject: m.subject,
                  chapter: m.chapter,
                  sourceType: m.sourceType,
                  rawText: m.contentSummary,
                });
              }
            });
            return next;
          });
          setSelectedMaterial((cur) => cur || loaded[0] || null);
        } else {
          setMaterials([]);
          setSelectedMaterial(null);
        }
      },
      (err) => {
        try {
          handleFirestoreError(
            err,
            OperationType.LIST,
            `users/${currentUser.uid}/materials`
          );
        } catch {
          // Ignore snapshot error if offline
        }
      }
    );

    return () => unsub();
  }, [currentUser]);

  // Save updated Student Profile
  const handleSaveStudentProfile = async (updated: StudentProfileData) => {
    setStudentProfile(updated);
    if (!currentUser) return;

    localStorage.setItem(
      `learnmate_profile_${currentUser.uid}`,
      JSON.stringify(updated)
    );

    if (!currentUser.uid.startsWith('local_')) {
      const userRef = doc(db, 'users', currentUser.uid);
      try {
        await setDoc(
          userRef,
          {
            userId: currentUser.uid,
            displayName: updated.displayName.slice(0, 90),
            targetExam: updated.targetExam,
            preferredLanguage: updated.preferredLanguage,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {
        // Local storage already updated
      }
    }
    showToast('Student profile & JEE target preferences saved!');
  };

  // Export User Data JSON (GDPR / India DPDP Data Portability)
  const handleExportAccountData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      platform: 'LearnMate JEE',
      profile: studentProfile,
      materialsCount: materials.length,
      materials,
      tasks,
      creations,
      mistakesNotebook,
      lastMockScore,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LearnMate_JEE_Data_Export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded your complete LearnMate JEE account data JSON.');
  };

  // Add New Material Handler — Generates Full MaterialStudyBundle (Detailed Notes, Mind Map, Flashcards, Sticky Notes, Quiz)
  const handleAddMaterial = async (newMat: {
    title: string;
    subject: 'Physics' | 'Chemistry' | 'Mathematics';
    chapter: string;
    sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
    sourceRef: string;
    contentSummary: string;
    originalFileUrl?: string;
    originalMimeType?: string;
  }) => {
    const newId = `mat-${Date.now()}`;
    const bundle = generateMaterialStudyBundle({
      materialId: newId,
      title: newMat.title,
      subject: newMat.subject,
      chapter: newMat.chapter,
      sourceType: newMat.sourceType,
      rawText: newMat.contentSummary,
      originalFileUrl: newMat.originalFileUrl || newMat.sourceRef,
      originalMimeType: newMat.originalMimeType,
    });

    const localItem: MaterialItem = {
      id: newId,
      title: newMat.title,
      subject: newMat.subject,
      chapter: newMat.chapter,
      sourceType: newMat.sourceType,
      sourceRef: newMat.sourceRef,
      originalFileUrl: newMat.originalFileUrl || newMat.sourceRef,
      originalMimeType: newMat.originalMimeType,
      pageCount: bundle.pages.length,
      currentPage: 1,
      progressPct: 15,
      contentSummary: newMat.contentSummary,
      addedLabel: 'Just now',
    };

    setMaterialBundles((prev) => ({
      ...prev,
      [newId]: bundle,
    }));
    setMaterials((prev) => [localItem, ...prev]);
    setSelectedMaterial(localItem);
    setStudySubTab('Chapter Notes');
    setActiveTab('Study');
    setXp((x) => x + 25);
    if (streakDays === 0) setStreakDays(1);
    showToast(
      `Extracted "${newMat.title}" into Full Detailed Notes, Formula Book, Mind Map & Quiz!`
    );

    if (currentUser && !currentUser.uid.startsWith('local_')) {
      try {
        await syncChunkedMaterialToFirestore(currentUser.uid, newId, {
          title: newMat.title,
          subject: newMat.subject,
          chapter: newMat.chapter,
          sourceType: newMat.sourceType,
          sourceRef: newMat.sourceRef || '',
          pageCount: bundle.pages.length,
          currentPage: 1,
          progressPct: 15,
          contentSummary: newMat.contentSummary || '',
        });
      } catch {
        // Local state already updated
      }
    }
  };

  const handleUpdateMaterialPage = (
    materialId: string,
    pageNumber: number,
    updatedPage: NotePageData
  ) => {
    setMaterialBundles((prev) => {
      const existing = prev[materialId];
      if (!existing) return prev;
      return {
        ...prev,
        [materialId]: {
          ...existing,
          pages: existing.pages.map((p) => (p.pageNumber === pageNumber ? updatedPage : p)),
        },
      };
    });
    showToast(`Saved annotated Page ${pageNumber} back to your library!`);
  };

  const handleDeleteMaterial = (matId: string) => {
    setMaterials((prev) => {
      const remaining = prev.filter((m) => m.id !== matId);
      if (selectedMaterial?.id === matId) {
        setSelectedMaterial(remaining[0] || null);
      }
      return remaining;
    });
    showToast('Removed study material from library.');
  };

  const handleSaveCreation = async (creation: Omit<CreationItem, 'id'>) => {
    const item: CreationItem = {
      ...creation,
      id: `cr-${Date.now()}`,
    };
    setCreations((prev) => [item, ...prev]);
    showToast(`Saved "${creation.title}" to your Create Library!`);
  };

  // Add Flashcard Handler (from Revise Mind Map)
  const handleAddFlashcard = async (node: MindMapNodeItem) => {
    showToast(`Added "${node.title}" to Spaced-Repetition Flashcards!`);
    if (currentUser && !currentUser.uid.startsWith('local_')) {
      const cardId = `card_${node.id}_${Date.now()}`;
      const cardRef = doc(db, 'users', currentUser.uid, 'flashcards', cardId);
      try {
        await setDoc(cardRef, {
          userId: currentUser.uid,
          chapter: selectedMaterial?.chapter || 'General',
          title: node.title,
          definition: node.definition,
          example: node.example,
          commonTrap: node.commonTrap,
          pageRef: node.pageRef,
          easeFactor: 2.5,
          intervalDays: 1,
          createdAt: new Date().toISOString(),
        });
      } catch {
        // Non-blocking
      }
    }
  };

  // Submit Full-Screen CBT Mock Test Handler
  const handleSubmitCBTMock = async (
    summary: CBTMockSummary,
    focusEvents: number
  ) => {
    const scaledScore = Math.max(
      0,
      Math.min(300, Math.round((summary.totalScore / Math.max(1, summary.maxScore)) * 300))
    );
    setLastMockScore(scaledScore);
    setInCBTMockMode(false);
    setActiveTab('Progress');
    setXp((x) => x + 100);
    showToast(
      `CBT Submitted! Score: ${summary.totalScore}/${summary.maxScore} (Scaled: ${scaledScore}/300)`
    );

    if (currentUser && !currentUser.uid.startsWith('local_')) {
      const attemptId = `mock_${Date.now()}`;
      const attemptRef = doc(db, 'users', currentUser.uid, 'mockAttempts', attemptId);
      try {
        await setDoc(attemptRef, {
          userId: currentUser.uid,
          paperTitle: `${cbtExamMode} • Official CBT Mock`,
          examType: cbtExamMode,
          score: scaledScore,
          maxScore: 300,
          accuracy: summary.accuracyPct,
          focusEvents,
          timeSpentSeconds: 1800,
          responsesJson: JSON.stringify(summary),
          completedAt: new Date().toISOString(),
        });
      } catch {
        // Non-blocking
      }
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md animate-pulse">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-slate-600">
            Loading LearnMate JEE...
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated Routing: Strict Landing Page -> Auth Screen
  if (!currentUser) {
    return (
      <>
        {unauthScreen === 'landing' ? (
          <LandingPage
            onOpenAuth={(mode) => {
              setAuthInitialMode(mode);
              setUnauthScreen('auth');
            }}
            onOpenLegal={handleOpenLegal}
          />
        ) : (
          <AuthScreen
            initialMode={authInitialMode}
            onBackToLanding={() => setUnauthScreen('landing')}
            onAuthComplete={() => setActiveTab('Home')}
            onOpenLegal={handleOpenLegal}
          />
        )}
        <LegalComplianceModal
          isOpen={legalModalState.isOpen}
          initialTab={legalModalState.tab}
          onClose={() => setLegalModalState((prev) => ({ ...prev, isOpen: false }))}
        />
      </>
    );
  }

  // Full-Screen NTA CBT Practice Mock Mode
  if (inCBTMockMode) {
    return (
      <JeeCbtExamModal
        candidateName={studentProfile.displayName || 'Candidate'}
        initialExamMode={cbtExamMode}
        customQuestions={customCbtConfig?.questions}
        customDurationMinutes={customCbtConfig?.durationMinutes}
        customPaperTitle={customCbtConfig?.paperTitle}
        onSubmitMock={(summary, focusEvents) => {
          setCustomCbtConfig(null);
          handleSubmitCBTMock(summary, focusEvents);
        }}
        onExitMock={() => {
          setCustomCbtConfig(null);
          setInCBTMockMode(false);
        }}
        onRecordMistake={(q, ans) => handleRecordMistake(q, ans, 'CBT Mock')}
      />
    );
  }

  const userInitial = (
    studentProfile.displayName?.[0] ||
    currentUser.email?.[0] ||
    'A'
  ).toUpperCase();

  const focusClockLabel = `${String(Math.floor(focusSecondsLeft / 60)).padStart(2, '0')}:${String(
    focusSecondsLeft % 60
  ).padStart(2, '0')}`;

  const activeBundle = selectedMaterial ? materialBundles[selectedMaterial.id] || null : null;

  return (
    <AuthAndWorkspaceContext.Provider
      value={{
        currentUser,
        studentProfile,
        materials,
        materialBundles,
        tasks,
        creations,
        mistakesNotebook,
        sm2Cards,
        streakDays,
        xp,
        level,
        lastMockScore,
        showToast,
        onSignOutAndPurgeAll: handleSignOutAndPurgeAll,
      }}
    >
      <div
        className={`min-h-screen transition-colors ${
          darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
        }`}
      >
      {/* ===================================================================== */}
      {/* STREAMLINED TOP NAVBAR (Full Desktop Edge-to-Edge)                    */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 px-4 lg:px-8 h-16 flex items-center justify-between gap-4 w-full">
        {/* Left: Sidebar Collapse Toggle + Brand Wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
            title={sidebarCollapsed ? 'Expand Navigation Sidebar' : 'Collapse Navigation Sidebar'}
            aria-label="Toggle Left Navigation Sidebar"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-indigo-600" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('Home')}
            className="flex items-center gap-2.5 text-left cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-base shadow-xs group-hover:bg-indigo-700 transition-colors">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
                LearnMate
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-600 rounded-md border border-indigo-200/70">
                JEE
              </span>
            </div>
          </button>
        </div>

        {/* Right: Global Actions & Utilities ONLY (Add Material, Search, Study Tools, Timer, Theme, Notifications, Voice Tutor, Profile) */}
        <div className="flex items-center gap-2.5">
          {/* B2C Freemium / Pro Aspirant Plan Badge */}
          <button
            onClick={() => setProModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all cursor-pointer ${
              subscriptionTier === 'pro'
                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                : 'border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
            }`}
            title="View Free vs Pro Aspirant Subscription Plan"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>
              {subscriptionTier === 'pro'
                ? 'PRO ASPIRANT'
                : `Free • ${Math.min(5, materials.length)}/5 Scans`}
            </span>
          </button>

          {/* + Add Material */}
          <button
            onClick={() => {
              setAddMaterialInitialTab('youtube');
              setAddMaterialOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Material</span>
          </button>

          {/* Search */}
          <button
            onClick={() => setSearchModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
            title="Global Search (Cmd+K)"
          >
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Search</span>
          </button>

          {/* Study Tools */}
          <button
            onClick={() => setStudyToolsOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
          >
            <Grid className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline leading-tight text-left">
              Study Tools
            </span>
          </button>

          {/* Focus Timer 25:00 */}
          <button
            onClick={() => setFocusTimerOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
              focusTimerOpen || focusRunning
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>{focusClockLabel}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => {
              setDarkMode(!darkMode);
              showToast(darkMode ? 'Switched to High-Craft Light Mode' : 'Dark Mode Active');
            }}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
            title="Toggle Theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications Bell with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen((prev) => !prev)}
              className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {materials.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-extrabold flex items-center justify-center">
                  {materials.length}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-4 z-50 text-slate-900 dark:text-white">
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-extrabold">
                    Study Alerts &amp; Workspace Status
                  </span>
                  <button
                    onClick={() => setNotificationsOpen(false)}
                    className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-2.5 text-xs">
                  {materials.length === 0 ? (
                    <div
                      onClick={() => {
                        setNotificationsOpen(false);
                        setAddMaterialOpen(true);
                      }}
                      className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 cursor-pointer"
                    >
                      <div className="font-extrabold text-indigo-950 dark:text-indigo-200">
                        Upload Your First Study Material
                      </div>
                      <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                        Add a PDF, handwritten photo, or 12-hour YouTube marathon to unlock detailed notes &amp; mind maps.
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setNotificationsOpen(false);
                        setActiveTab('Revise');
                      }}
                      className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 cursor-pointer"
                    >
                      <div className="font-extrabold text-indigo-950">
                        {materials.length} Uploaded Material(s) Ready for Revision
                      </div>
                      <div className="text-slate-600 mt-0.5">
                        Review your formula sheets, mind maps, handwritten sheets, and 3D flashcards.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Live AI Voice Tutor */}
          <button
            onClick={() => setVoiceTutorOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/70 hover:bg-indigo-100 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 transition-all cursor-pointer"
            title="Open Live Classroom Voice JEE Tutor"
          >
            <Mic className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden md:inline">Voice Tutor</span>
          </button>

          {/* Interactive Student Profile Avatar Button */}
          <button
            onClick={() => setProfileModalOpen(true)}
            style={{ backgroundColor: studentProfile.avatarColor || '#4F46E5' }}
            className="w-9 h-9 rounded-full text-white font-extrabold text-xs flex items-center justify-center shadow-xs transition-all cursor-pointer ring-2 ring-indigo-100 hover:opacity-90"
            title="Open Student Profile & Account Settings"
          >
            {userInitial}
          </button>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* FULL-DESKTOP SHELL: COLLAPSIBLE LEFT SIDEBAR + 100% FLUID STAGE       */}
      {/* ===================================================================== */}
      <div className="flex min-h-[calc(100vh-4rem)] w-full">
        {/* COLLAPSIBLE LEFT SIDEBAR */}
        <aside
          className={`shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800 transition-all duration-200 flex flex-col justify-between sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto ${
            sidebarCollapsed ? 'w-[72px] px-2.5 py-4' : 'w-64 px-3.5 py-5'
          }`}
        >
          <div className="space-y-6">
            {/* Primary Navigation */}
            <div>
              {!sidebarCollapsed && (
                <div className="px-2.5 mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Workspace Navigation
                </div>
              )}
              <nav className="space-y-1">
                {(
                  [
                    { id: 'Home', label: 'Home Dashboard', icon: Home },
                    { id: 'Study', label: 'Study Workbench', icon: BookOpen },
                    { id: 'Practice', label: 'Practice & PYQs', icon: Target },
                    { id: 'Revise', label: 'Revise & Formula Book', icon: Layers },
                    { id: 'Progress', label: 'Progress & Analytics', icon: BarChart3 },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      title={sidebarCollapsed ? tab.label : undefined}
                      className={`w-full flex items-center ${
                        sidebarCollapsed ? 'justify-center px-2 py-2.5' : ' gap-3 px-3 py-2.5'
                      } rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100/80 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!sidebarCollapsed && <span className="truncate">{tab.id}</span>}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Study Workbench Sub-Navigation */}
            {!sidebarCollapsed && (
              <div>
                <div className="px-2.5 mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Study Sections
                </div>
                <div className="space-y-1">
                  {(
                    [
                      { id: 'Chapter Notes', label: 'Full Chapter Notes', icon: FileText },
                      { id: 'My Materials', label: 'Uploaded Materials', icon: FolderOpen },
                      { id: 'AI Tutor', label: 'Doubt Solver & Visuals', icon: Sparkles },
                      { id: 'Syllabus', label: 'JEE Syllabus Tracker', icon: BookOpen },
                      { id: 'Create', label: 'Visual Creations', icon: Grid },
                      { id: 'Resources', label: 'Reference Books', icon: Layers },
                    ] as const
                  ).map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive = activeTab === 'Study' && studySubTab === sub.id;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setStudySubTab(sub.id);
                          setActiveTab('Study');
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSubActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800'
                        }`}
                      >
                        <SubIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Uploaded Materials List in Sidebar */}
            {!sidebarCollapsed && materials.length > 0 && (
              <div>
                <div className="px-2.5 mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Recent Uploads ({materials.length})
                </div>
                <div className="space-y-1">
                  {materials.slice(0, 5).map((mat) => {
                    const isSelected = selectedMaterial?.id === mat.id;
                    return (
                      <button
                        key={mat.id}
                        onClick={() => {
                          setSelectedMaterial(mat);
                          setStudySubTab('Chapter Notes');
                          setActiveTab('Study');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white font-extrabold'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold'
                        }`}
                      >
                        <div className="truncate">{mat.title}</div>
                        <div
                          className={`text-[10px] truncate ${
                            isSelected ? 'text-indigo-200' : 'text-slate-400'
                          }`}
                        >
                          {mat.subject} • {mat.chapter}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Bottom Collapse Toggle */}
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className={`w-full flex items-center ${
                sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
              } rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer`}
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {!sidebarCollapsed && <span>Collapse Sidebar</span>}
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-indigo-600" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-slate-500" />
              )}
            </button>
          </div>
        </aside>

        {/* ACTIVE VIEW ROUTER (Full-Width Desktop Canvas) */}
        <main className="flex-1 min-w-0 w-full pb-16">
        {activeTab === 'Home' && (
          <DashboardView
            userName={studentProfile.displayName}
            targetExam={studentProfile.targetExam}
            onChangeTargetExam={(exam) => {
              handleSaveStudentProfile({ ...studentProfile, targetExam: exam });
            }}
            materials={materials}
            tasks={tasks}
            streakDays={streakDays}
            xp={xp}
            level={level}
            lastMockScore={lastMockScore}
            onToggleTask={(taskId) => {
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === taskId ? { ...t, completed: !t.completed } : t
                )
              );
            }}
            onAddTask={(title, durationMin) => {
              setTasks((prev) => [
                {
                  id: `task-${Date.now()}`,
                  title,
                  durationMin,
                  completed: false,
                  dueDate: 'Today',
                },
                ...prev,
              ]);
              showToast('Added new study task!');
            }}
            onDeleteTask={(taskId) => {
              setTasks((prev) => prev.filter((t) => t.id !== taskId));
            }}
            onSyncWorkspaceTasks={() => setWorkspaceSyncConfirmOpen(true)}
            onOpenStudyWorkbench={(mat) => {
              if (mat) setSelectedMaterial(mat);
              setStudySubTab('Chapter Notes');
              setActiveTab('Study');
            }}
            onOpenMyMaterials={() => {
              setStudySubTab('My Materials');
              setActiveTab('Study');
            }}
            onOpenSyllabus={() => {
              setStudySubTab('Syllabus');
              setActiveTab('Study');
            }}
            onOpenRevise={() => setActiveTab('Revise')}
            onOpenPractice={() => setActiveTab('Practice')}
            onOpenProgress={() => setActiveTab('Progress')}
            onOpenAddMaterial={(tab) => {
              setAddMaterialInitialTab(tab);
              setAddMaterialOpen(true);
            }}
            onOpenStudyTools={() => setStudyToolsOpen(true)}
          />
        )}

        {activeTab === 'Study' && (
          <StudyWorkbenchView
            initialSubTab={studySubTab}
            selectedMaterial={selectedMaterial}
            activeBundle={activeBundle}
            materials={materials}
            creations={creations}
            onSelectMaterial={(mat) => {
              setSelectedMaterial(mat);
              setStudySubTab('Chapter Notes');
              showToast(`Loaded "${mat.title}" in Study Workbench.`);
            }}
            onDeleteMaterial={handleDeleteMaterial}
            onUpdateMaterialPage={handleUpdateMaterialPage}
            onOpenAddMaterial={(tab) => {
              setAddMaterialInitialTab(tab);
              setAddMaterialOpen(true);
            }}
            onSaveCreation={handleSaveCreation}
            onAddQuickSheetMaterial={async (title, subject, summary) => {
              await handleAddMaterial({
                title,
                subject,
                chapter: title,
                sourceType: 'text',
                sourceRef: 'Quick Revision Sheet',
                contentSummary: summary,
              });
            }}
            onOpenVoiceTutor={() => setVoiceTutorOpen(true)}
            onLaunchInstantPractice={(mode, title, chapterName, customQuestions) => {
              setInstantPracticeConfig({
                isOpen: true,
                mode,
                title,
                chapterOrPaper: chapterName,
                customQuestions,
              });
            }}
            onEarnXp={(earned, reason) => {
              setXp((x) => x + earned);
              showToast(reason || `+${earned} XP earned!`);
            }}
          />
        )}

        {activeTab === 'Practice' && (
          <PracticeDashboardView
            onStartCBTMock={(mode = 'JEE Main') => {
              setCustomCbtConfig(null);
              setCbtExamMode(mode);
              setInCBTMockMode(true);
            }}
            onOpenCustomTestModal={() => setCustomTestModalOpen(true)}
            onOpenInstantPractice={(paperTitle, customQuestions) =>
              setInstantPracticeConfig({
                isOpen: true,
                mode: 'paper-solver',
                title: 'Official Paper Practice',
                chapterOrPaper: paperTitle,
                customQuestions,
              })
            }
            mistakesNotebook={mistakesNotebook}
            onRecordMistake={(q, ans) => handleRecordMistake(q, ans, 'PYQ Bank')}
          />
        )}

        {activeTab === 'Revise' && (
          <ReviseWorkspaceView
            materials={materials}
            selectedMaterial={selectedMaterial}
            materialBundles={materialBundles}
            mistakesNotebook={mistakesNotebook}
            sm2Cards={sm2Cards}
            onUpdateSM2Card={handleUpdateSM2Card}
            onAddSM2Card={handleAddSM2Card}
            onTagMistakeRootCause={handleTagMistakeRootCause}
            onSelectMaterial={(mat) => setSelectedMaterial(mat)}
            onOpenAddMaterial={(tab) => {
              setAddMaterialInitialTab(tab);
              setAddMaterialOpen(true);
            }}
            onAddFlashcard={(node) => {
              handleAddFlashcard(node);
              handleAddSM2Card({
                chapter: selectedMaterial?.chapter || 'General',
                subject: selectedMaterial?.subject || 'Physics',
                frontPrompt: `Define & Explain: **${node.title}**`,
                backAnswer: `${node.definition}\n\n**Example:** ${node.example}\n\n**Exam Trap:** ${node.commonTrap}`,
                intervalDays: 1,
                repetitionCount: 0,
                easeFactor: 2.5,
                nextReviewIso: new Date().toISOString(),
              });
            }}
            onPracticeQuestion={(q) =>
              setInstantPracticeConfig({
                isOpen: true,
                mode: 'adaptive-drill',
                title: 'Mistake DNA Remediation',
                chapterOrPaper: q.chapter,
                customQuestions: [q],
              })
            }
            showToast={showToast}
          />
        )}

        {activeTab === 'Progress' && (
          <ProgressAndRankView
            onStartCBTMock={(mode = 'JEE Main') => {
              setCustomCbtConfig(null);
              setCbtExamMode(mode);
              setInCBTMockMode(true);
            }}
            onPracticeWeakTopic={(topic) => {
              setInstantPracticeConfig({
                isOpen: true,
                mode: 'adaptive-drill',
                title: 'Weak-Chapter Remediation Drill',
                chapterOrPaper: topic,
              });
            }}
            lastMockScore={lastMockScore}
            materialsCount={materials.length}
            mistakesCount={mistakesNotebook.length}
            sm2CardsCount={sm2Cards.length}
          />
        )}
        </main>
      </div>

      {/* ===================================================================== */}
      {/* GLOBAL OVERLAYS, DRAWERS & MODALS                                     */}
      {/* ===================================================================== */}
      <AddMaterialModal
        isOpen={addMaterialOpen}
        initialTab={addMaterialInitialTab}
        onClose={() => setAddMaterialOpen(false)}
        onAddMaterial={handleAddMaterial}
      />

      <CompactStudyUtilitiesDrawer
        isOpen={studyToolsOpen}
        onClose={() => setStudyToolsOpen(false)}
      />

      <CustomTestGeneratorModal
        isOpen={customTestModalOpen}
        mistakesNotebook={mistakesNotebook}
        onClose={() => setCustomTestModalOpen(false)}
        onLaunchCustomCBT={(questionsOrConfig, durationMinutes = 60, paperTitle = 'Custom Test') => {
          setCustomTestModalOpen(false);
          if (Array.isArray(questionsOrConfig)) {
            setCustomCbtConfig({
              questions: questionsOrConfig,
              durationMinutes,
              paperTitle,
            });
          } else {
            setCustomCbtConfig({
              questions: questionsOrConfig.questions,
              durationMinutes: questionsOrConfig.durationMinutes,
              paperTitle: questionsOrConfig.title,
            });
          }
          setCbtExamMode('JEE Main');
          setInCBTMockMode(true);
        }}
      />

      <FocusTimerModal
        isOpen={focusTimerOpen}
        secondsLeft={focusSecondsLeft}
        running={focusRunning}
        onToggleRun={() => setFocusRunning((r) => !r)}
        onReset={() => {
          setFocusRunning(false);
          setFocusSecondsLeft(25 * 60);
        }}
        onClose={() => setFocusTimerOpen(false)}
      />

      <LiveVoiceTutorModal
        isOpen={voiceTutorOpen}
        chapterTitle={selectedMaterial?.chapter || 'General JEE Physics, Chemistry & Mathematics'}
        materialContext={selectedMaterial?.contentSummary}
        onClose={() => setVoiceTutorOpen(false)}
      />

      <WorkspaceConfirmModal
        isOpen={workspaceSyncConfirmOpen}
        title="Sync Study Schedule with Google Calendar & Tasks"
        description="This will create study blocks on your primary Google Calendar and task items in your Google Tasks list for your pending JEE study tasks."
        confirmLabel="Confirm & Sync Now"
        onConfirm={async () => {
          try {
            const pending = tasks.filter((t) => !t.completed);
            const res = await syncStudyTasksWithCalendarAndTasks(pending);
            showToast(`Synced ${res.tasksCreated} JEE study tasks to Google Calendar & Tasks!`);
          } catch (err: any) {
            showToast(err?.message || 'Could not sync with Google Workspace.');
          } finally {
            setWorkspaceSyncConfirmOpen(false);
          }
        }}
        onCancel={() => setWorkspaceSyncConfirmOpen(false)}
      />

      <ProfileModal
        isOpen={profileModalOpen}
        profile={studentProfile}
        streakDays={streakDays}
        xp={xp}
        level={level}
        onClose={() => setProfileModalOpen(false)}
        onSaveProfile={handleSaveStudentProfile}
        onExportUserData={handleExportAccountData}
        onOpenLegalModal={(tab) => {
          setProfileModalOpen(false);
          handleOpenLegal(tab);
        }}
        onSignOut={handleSignOutAndPurgeAll}
      />

      <LegalComplianceModal
        isOpen={legalModalState.isOpen}
        initialTab={legalModalState.tab}
        onClose={() => setLegalModalState((prev) => ({ ...prev, isOpen: false }))}
      />

      <InstantPracticeModal
        config={instantPracticeConfig}
        onClose={() => setInstantPracticeConfig(null)}
        onEarnXp={(earned) => {
          setXp((prev) => prev + earned);
          showToast(`+${earned} XP earned!`);
        }}
        onLaunchFullCBT={() => {
          setInstantPracticeConfig(null);
          setInCBTMockMode(true);
        }}
        onRecordMistake={(q, ans) => handleRecordMistake(q, ans, 'Adaptive Drill')}
      />

      {/* Global Search Command Modal (Cmd+K) */}
      {searchModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Global Search"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-start justify-center pt-20 p-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl overflow-hidden text-slate-900 dark:text-white">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <Search className="w-5 h-5 text-indigo-600" />
              <input
                type="text"
                autoFocus
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                placeholder="Jump to uploaded materials, Desmos calculator, Voice Tutor, or 75-Q CBT..."
                className="flex-1 text-sm font-medium focus:outline-none bg-transparent"
              />
              <button
                onClick={() => setSearchModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 max-h-80 overflow-y-auto space-y-1.5 text-xs">
              {[
                ...materials.map((m) => ({
                  label: `Uploaded Material: ${m.title} (${m.subject})`,
                  action: () => {
                    setSelectedMaterial(m);
                    setActiveTab('Study');
                    setStudySubTab('Chapter Notes');
                  },
                })),
                {
                  label: 'Upload PDF, Handwritten Photo, or 12-Hour YouTube Marathon',
                  action: () => setAddMaterialOpen(true),
                },
                {
                  label: 'Live Voice AI Tutor (Word-by-Word Streaming & Barge-In)',
                  action: () => setVoiceTutorOpen(true),
                },
                {
                  label: 'Desmos Graphing Calculator & Offline Scientific Calculator',
                  action: () => setStudyToolsOpen(true),
                },
                {
                  label: 'Full 75-Question NTA JEE Main CBT Mock Exam',
                  action: () => {
                    setCbtExamMode('JEE Main');
                    setInCBTMockMode(true);
                  },
                },
                {
                  label: 'JEE Advanced Paper 1 Multi-Format CBT Mock Exam',
                  action: () => {
                    setCbtExamMode('JEE Advanced');
                    setInCBTMockMode(true);
                  },
                },
                {
                  label: 'Revise: Formula Book, Mind Maps & 4-Font Handwritten Notes',
                  action: () => setActiveTab('Revise'),
                },
              ]
                .filter(
                  (item) =>
                    !globalSearchQuery.trim() ||
                    item.label.toLowerCase().includes(globalSearchQuery.toLowerCase())
                )
                .map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      item.action();
                      setSearchModalOpen(false);
                    }}
                    className="w-full p-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-800 text-left font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>{item.label}</span>
                    <span className="text-indigo-600">Jump →</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* B2C Freemium & Pro Aspirant Subscription Upgrade Modal */}
      {proModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="LearnMate Pro Aspirant Subscription"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl p-6 space-y-5 text-slate-900 dark:text-white">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider">
                  Commercial Student Plans • JEE Main, Advanced, NEET UG &amp; BITSAT
                </span>
                <h2 className="text-xl font-extrabold mt-1.5">
                  Upgrade to LearnMate Pro Aspirant
                </h2>
              </div>
              <button
                onClick={() => setProModalOpen(false)}
                aria-label="Close Pro Modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Billing Cycle Toggle */}
            <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Includes JEE Main, JEE Advanced, NEET UG &amp; BITSAT Mock Engines + Cloud Sync
              </div>
              <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-700 text-xs font-extrabold">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Monthly (₹499/mo)
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                    billingCycle === 'annual'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Annual Exam Pass (₹2,999/yr • Save 50%)
                </button>
              </div>
            </div>

            {/* Free vs Pro Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm">Free Aspirant Tier</span>
                    <span className="font-black text-base text-slate-700 dark:text-slate-200">
                      ₹0 / forever
                    </span>
                  </div>
                  <ul className="space-y-2 text-slate-600 dark:text-slate-300 font-medium">
                    <li>• Up to 5 AI Document / Marathon Scans per day</li>
                    <li>• Official PYQ Bank &amp; Standard Chapter Notes</li>
                    <li>• 2 Full CBT Mock Tests per month</li>
                    <li>• Local Browser Storage + Basic Formula Book</li>
                  </ul>
                </div>
                <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700 text-[11px] font-bold text-slate-500">
                  {subscriptionTier === 'free' ? 'Current Active Plan' : 'Included in your account'}
                </div>
              </div>

              <div className="p-5 rounded-2xl border-2 border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/30 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">
                      Pro Aspirant Pass
                    </span>
                    <span className="font-black text-base text-slate-900 dark:text-white">
                      {billingCycle === 'annual' ? '₹2,999 / year' : '₹499 / month'}
                    </span>
                  </div>
                  <ul className="space-y-2 text-slate-700 dark:text-slate-200 font-semibold">
                    <li>• Unlimited 12-Hour YouTube Marathon Timestamp Extractions</li>
                    <li>• Unlimited Full-Screen Proctored CBT Mocks (JEE, NEET UG, BITSAT)</li>
                    <li>• Live Classroom Voice AI Tutor (Hindi, Hinglish &amp; Indian English)</li>
                    <li>• Interactive 2D Vector Diagram Maker, 3D WebGL Lab &amp; Cloud Sync</li>
                  </ul>
                </div>
                {subscriptionTier === 'pro' ? (
                  <div className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-center font-extrabold">
                    ✓ Pro Aspirant Active
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleActivateProTier}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-sm cursor-pointer"
                  >
                    Activate Pro Aspirant Pass Now
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-lg flex items-center gap-2 border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
    </AuthAndWorkspaceContext.Provider>
  );
}

export default App;
