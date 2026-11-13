import { useState, useEffect } from 'react';
import {
  db,
  initAuth,
  logoutUser,
  handleFirestoreError,
  OperationType,
} from '../firebase';
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
import { LegalModalTabId } from '../components/LandingAndAuth';
import {
  MaterialItem,
  StudyTaskItem,
  CreationItem,
} from '../components/HomeAndStudyViews';
import { MistakeNotebookEntry } from '../components/RevisePracticeProgressCBT';
import {
  StudentProfileData,
  InstantPracticeConfig,
} from '../components/GlobalOverlays';
import {
  MindMapNodeItem,
  MaterialStudyBundle,
  NotePageData,
  generateMaterialStudyBundle,
} from '../data/jeeInitialContent';
import {
  CBTMockSummary,
  CBTQuestion,
  SM2FlashcardItem,
  ErrorRootCauseTag,
  ExamTrack,
} from '../utils/jeeEngine';
import {
  clearAllIndexedDbDocuments,
  syncChunkedMaterialToFirestore,
  syncRevisionStateToFirestore,
} from '../services/workspaceService';

export type PrimaryTab = 'Home' | 'Study' | 'Practice' | 'Revise' | 'Progress';
export type StudySubTabId =
  | 'Syllabus'
  | 'Chapter Notes'
  | 'My Materials'
  | 'AI Tutor'
  | 'Create'
  | 'Resources';

export function useLearnMateAppState() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [unauthScreen, setUnauthScreen] = useState<'landing' | 'auth'>('landing');
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>('signup');

  const [activeTab, setActiveTab] = useState<PrimaryTab>('Home');
  const [studySubTab, setStudySubTab] = useState<StudySubTabId>('Chapter Notes');
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null);
  const [inCBTMockMode, setInCBTMockMode] = useState<boolean>(false);
  const [cbtExamMode, setCbtExamMode] = useState<ExamTrack>('JEE Main');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro'>('free');
  const [proModalOpen, setProModalOpen] = useState<boolean>(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [questionBankModalOpen, setQuestionBankModalOpen] = useState<boolean>(false);
  const [mistakeModalOpen, setMistakeModalOpen] = useState<boolean>(false);

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
          // ignore
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
          localStorage.setItem(`learnmate_${currentUser.uid}_sm2_cards`, JSON.stringify(next));
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
          localStorage.setItem(`learnmate_${currentUser.uid}_sm2_cards`, JSON.stringify(next));
        } catch {
          // ignore
        }
        syncRevisionStateToFirestore('sm2_cards', next);
      }
      return next;
    });
  };

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
            // ignore
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
          setCurrentUser({
            uid: 'local_autostart_student',
            displayName: 'JEE Aspirant',
            email: 'aspirant@learnmate.jee',
          } as FirebaseUser);
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
          handleFirestoreError(err, OperationType.LIST, `users/${currentUser.uid}/materials`);
        } catch {
          // Ignore snapshot error if offline
        }
      }
    );

    return () => unsub();
  }, [currentUser]);

  const handleSaveStudentProfile = async (updated: StudentProfileData) => {
    setStudentProfile(updated);
    if (!currentUser) return;
    localStorage.setItem(`learnmate_profile_${currentUser.uid}`, JSON.stringify(updated));
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
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LearnMate_JEE_Data_Export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded your complete LearnMate JEE account data JSON.');
  };

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

    setMaterialBundles((prev) => ({ ...prev, [newId]: bundle }));
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
    const item: CreationItem = { ...creation, id: `cr-${Date.now()}` };
    setCreations((prev) => [item, ...prev]);
    showToast(`Saved "${creation.title}" to your Create Library!`);
  };

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

  const handleSubmitCBTMock = async (summary: CBTMockSummary, focusEvents: number) => {
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

  return {
    currentUser,
    authLoading,
    unauthScreen,
    setUnauthScreen,
    authInitialMode,
    setAuthInitialMode,
    activeTab,
    setActiveTab,
    studySubTab,
    setStudySubTab,
    selectedMaterial,
    setSelectedMaterial,
    inCBTMockMode,
    setInCBTMockMode,
    cbtExamMode,
    setCbtExamMode,
    sidebarCollapsed,
    setSidebarCollapsed,
    subscriptionTier,
    proModalOpen,
    setProModalOpen,
    billingCycle,
    setBillingCycle,
    questionBankModalOpen,
    setQuestionBankModalOpen,
    mistakeModalOpen,
    setMistakeModalOpen,
    addMaterialOpen,
    setAddMaterialOpen,
    addMaterialInitialTab,
    setAddMaterialInitialTab,
    studyToolsOpen,
    setStudyToolsOpen,
    focusTimerOpen,
    setFocusTimerOpen,
    focusSecondsLeft,
    setFocusSecondsLeft,
    focusRunning,
    setFocusRunning,
    searchModalOpen,
    setSearchModalOpen,
    globalSearchQuery,
    setGlobalSearchQuery,
    voiceTutorOpen,
    setVoiceTutorOpen,
    profileModalOpen,
    setProfileModalOpen,
    notificationsOpen,
    setNotificationsOpen,
    workspaceSyncConfirmOpen,
    setWorkspaceSyncConfirmOpen,
    legalModalState,
    setLegalModalState,
    instantPracticeConfig,
    setInstantPracticeConfig,
    darkMode,
    setDarkMode,
    materials,
    materialBundles,
    tasks,
    setTasks,
    creations,
    mistakesNotebook,
    sm2Cards,
    customTestModalOpen,
    setCustomTestModalOpen,
    customCbtConfig,
    setCustomCbtConfig,
    streakDays,
    xp,
    setXp,
    level,
    lastMockScore,
    toastMessage,
    studentProfile,
    showToast,
    handleOpenLegal,
    handleActivateProTier,
    handleRecordMistake,
    handleTagMistakeRootCause,
    handleUpdateSM2Card,
    handleAddSM2Card,
    handleSignOutAndPurgeAll,
    handleSaveStudentProfile,
    handleExportAccountData,
    handleAddMaterial,
    handleUpdateMaterialPage,
    handleDeleteMaterial,
    handleSaveCreation,
    handleAddFlashcard,
    handleSubmitCBTMock,
  };
}
