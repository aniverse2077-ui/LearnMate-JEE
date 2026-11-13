import React from 'react';
import { GraduationCap } from 'lucide-react';
import { LandingPage, AuthScreen } from './components/LandingAndAuth';
import { ReviseWorkspaceView } from './components/RevisePracticeProgressCBT';
import {
  AddMaterialModal,
  FocusTimerModal,
  LiveVoiceTutorModal,
  WorkspaceConfirmModal,
  ProfileModal,
  LegalComplianceModal,
  InstantPracticeModal,
} from './components/GlobalOverlays';
import { syncStudyTasksWithCalendarAndTasks } from './services/workspaceService';
import { AuthAndWorkspaceContext } from './context/AuthAndWorkspaceContext';
import { DashboardView } from './components/dashboard/DashboardView';
import { StudyWorkbenchView } from './components/study/StudyWorkbenchView';
import { JeeCbtExamModal } from './components/cbt/JeeCbtExamModal';
import { CustomTestGeneratorModal } from './components/cbt/CustomTestGeneratorModal';
import { ProgressAndRankView } from './components/analytics/ProgressAndRankView';
import { CompactStudyUtilitiesDrawer } from './components/utilities/CompactStudyUtilitiesDrawer';
import { PracticeWorkspaceView } from './components/PracticeWorkspaceView';
import { DynamicCompanion } from './components/DynamicCompanion';
import { MistakeBookAndImprovementModal } from './components/MistakeBookAndImprovementModal';
import { PwaOfflineAndJobsBar } from './components/PwaOfflineAndJobsBar';
import { AdminCommercialConsoleModal } from './components/AdminCommercialConsoleModal';
import { AdminQuestionBankModal } from './components/AdminQuestionBankModal';
import { AppShellFrame } from './components/AppShellFrame';
import { useLearnMateAppState } from './hooks/useLearnMateAppState';

export function App() {
  const s = useLearnMateAppState();

  if (s.authLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md animate-pulse">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-slate-600">Loading LearnMate JEE...</div>
        </div>
      </div>
    );
  }

  if (!s.currentUser) {
    return (
      <>
        {s.unauthScreen === 'landing' ? (
          <LandingPage
            onOpenAuth={(mode) => {
              s.setAuthInitialMode(mode);
              s.setUnauthScreen('auth');
            }}
            onOpenLegal={s.handleOpenLegal}
          />
        ) : (
          <AuthScreen
            initialMode={s.authInitialMode}
            onBackToLanding={() => s.setUnauthScreen('landing')}
            onAuthComplete={() => s.setActiveTab('Home')}
            onOpenLegal={s.handleOpenLegal}
          />
        )}
        <LegalComplianceModal
          isOpen={s.legalModalState.isOpen}
          initialTab={s.legalModalState.tab}
          onClose={() => s.setLegalModalState((prev) => ({ ...prev, isOpen: false }))}
        />
      </>
    );
  }

  if (s.inCBTMockMode) {
    return (
      <JeeCbtExamModal
        candidateName={s.studentProfile.displayName || 'Candidate'}
        initialExamMode={s.cbtExamMode}
        customQuestions={s.customCbtConfig?.questions}
        customDurationMinutes={s.customCbtConfig?.durationMinutes}
        customPaperTitle={s.customCbtConfig?.paperTitle}
        onSubmitMock={(summary, focusEvents) => {
          s.setCustomCbtConfig(null);
          s.handleSubmitCBTMock(summary, focusEvents);
        }}
        onExitMock={() => {
          s.setCustomCbtConfig(null);
          s.setInCBTMockMode(false);
        }}
        onRecordMistake={(q, ans) => s.handleRecordMistake(q, ans, 'CBT Mock')}
      />
    );
  }

  const userInitial = (
    s.studentProfile.displayName?.[0] ||
    s.currentUser.email?.[0] ||
    'A'
  ).toUpperCase();

  const focusClockLabel = `${String(Math.floor(s.focusSecondsLeft / 60)).padStart(2, '0')}:${String(
    s.focusSecondsLeft % 60
  ).padStart(2, '0')}`;

  const activeBundle = s.selectedMaterial ? s.materialBundles[s.selectedMaterial.id] || null : null;

  return (
    <AuthAndWorkspaceContext.Provider
      value={{
        currentUser: s.currentUser,
        studentProfile: s.studentProfile,
        materials: s.materials,
        materialBundles: s.materialBundles,
        tasks: s.tasks,
        creations: s.creations,
        mistakesNotebook: s.mistakesNotebook,
        sm2Cards: s.sm2Cards,
        streakDays: s.streakDays,
        xp: s.xp,
        level: s.level,
        lastMockScore: s.lastMockScore,
        showToast: s.showToast,
        onSignOutAndPurgeAll: s.handleSignOutAndPurgeAll,
      }}
    >
      <AppShellFrame
        activeTab={s.activeTab}
        onSelectTab={s.setActiveTab}
        studySubTab={s.studySubTab}
        onSelectStudySubTab={s.setStudySubTab}
        sidebarCollapsed={s.sidebarCollapsed}
        onToggleSidebar={() => s.setSidebarCollapsed((prev) => !prev)}
        subscriptionTier={s.subscriptionTier}
        onOpenProModal={() => s.setProModalOpen(true)}
        materials={s.materials}
        selectedMaterial={s.selectedMaterial}
        onSelectMaterial={s.setSelectedMaterial}
        onOpenAddMaterial={() => {
          s.setAddMaterialInitialTab('youtube');
          s.setAddMaterialOpen(true);
        }}
        searchModalOpen={s.searchModalOpen}
        onSetSearchModalOpen={s.setSearchModalOpen}
        globalSearchQuery={s.globalSearchQuery}
        onSetGlobalSearchQuery={s.setGlobalSearchQuery}
        onOpenStudyTools={() => s.setStudyToolsOpen(true)}
        focusTimerOpen={s.focusTimerOpen}
        focusRunning={s.focusRunning}
        focusClockLabel={focusClockLabel}
        onToggleFocusTimer={() => s.setFocusTimerOpen((prev) => !prev)}
        darkMode={s.darkMode}
        onToggleDarkMode={() => {
          s.setDarkMode(!s.darkMode);
          s.showToast(s.darkMode ? 'Switched to High-Craft Light Mode' : 'Dark Mode Active');
        }}
        notificationsOpen={s.notificationsOpen}
        onToggleNotifications={() => s.setNotificationsOpen((prev) => !prev)}
        onCloseNotifications={() => s.setNotificationsOpen(false)}
        onOpenVoiceTutor={() => s.setVoiceTutorOpen(true)}
        onOpenProfileModal={() => s.setProfileModalOpen(true)}
        avatarColor={s.studentProfile.avatarColor || '#4F46E5'}
        userInitial={userInitial}
        onStartCBTMock={(mode) => {
          s.setCustomCbtConfig(null);
          s.setCbtExamMode(mode);
          s.setInCBTMockMode(true);
        }}
        toastMessage={s.toastMessage}
      >
        {s.activeTab === 'Home' && (
          <DashboardView
            userName={s.studentProfile.displayName}
            targetExam={s.studentProfile.targetExam}
            onChangeTargetExam={(exam) => {
              s.handleSaveStudentProfile({ ...s.studentProfile, targetExam: exam });
            }}
            materials={s.materials}
            tasks={s.tasks}
            streakDays={s.streakDays}
            xp={s.xp}
            level={s.level}
            lastMockScore={s.lastMockScore}
            onToggleTask={(taskId) => {
              s.setTasks((prev) =>
                prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
              );
            }}
            onAddTask={(title, durationMin) => {
              s.setTasks((prev) => [
                {
                  id: `task-${Date.now()}`,
                  title,
                  durationMin,
                  completed: false,
                  dueDate: 'Today',
                },
                ...prev,
              ]);
              s.showToast('Added new study task!');
            }}
            onDeleteTask={(taskId) => {
              s.setTasks((prev) => prev.filter((t) => t.id !== taskId));
            }}
            onSyncWorkspaceTasks={() => s.setWorkspaceSyncConfirmOpen(true)}
            onOpenStudyWorkbench={(mat) => {
              if (mat) s.setSelectedMaterial(mat);
              s.setStudySubTab('Chapter Notes');
              s.setActiveTab('Study');
            }}
            onOpenMyMaterials={() => {
              s.setStudySubTab('My Materials');
              s.setActiveTab('Study');
            }}
            onOpenSyllabus={() => {
              s.setStudySubTab('Syllabus');
              s.setActiveTab('Study');
            }}
            onOpenRevise={() => s.setActiveTab('Revise')}
            onOpenPractice={() => s.setActiveTab('Practice')}
            onOpenProgress={() => s.setActiveTab('Progress')}
            onOpenAddMaterial={(tab) => {
              s.setAddMaterialInitialTab(tab);
              s.setAddMaterialOpen(true);
            }}
            onOpenStudyTools={() => s.setStudyToolsOpen(true)}
          />
        )}

        {s.activeTab === 'Study' && (
          <StudyWorkbenchView
            initialSubTab={s.studySubTab}
            selectedMaterial={s.selectedMaterial}
            activeBundle={activeBundle}
            materials={s.materials}
            creations={s.creations}
            onSelectMaterial={(mat) => {
              s.setSelectedMaterial(mat);
              s.setStudySubTab('Chapter Notes');
              s.showToast(`Loaded "${mat.title}" in Study Workbench.`);
            }}
            onDeleteMaterial={s.handleDeleteMaterial}
            onUpdateMaterialPage={s.handleUpdateMaterialPage}
            onOpenAddMaterial={(tab) => {
              s.setAddMaterialInitialTab(tab);
              s.setAddMaterialOpen(true);
            }}
            onSaveCreation={s.handleSaveCreation}
            onAddQuickSheetMaterial={async (title, subject, summary) => {
              await s.handleAddMaterial({
                title,
                subject,
                chapter: title,
                sourceType: 'text',
                sourceRef: 'Quick Revision Sheet',
                contentSummary: summary,
              });
            }}
            onOpenVoiceTutor={() => s.setVoiceTutorOpen(true)}
            onLaunchInstantPractice={(mode, title, chapterName, customQuestions) => {
              s.setInstantPracticeConfig({
                isOpen: true,
                mode,
                title,
                chapterOrPaper: chapterName,
                customQuestions,
              });
            }}
            onEarnXp={(earned, reason) => {
              s.setXp((x) => x + earned);
              s.showToast(reason || `+${earned} XP earned!`);
            }}
          />
        )}

        {s.activeTab === 'Practice' && (
          <PracticeWorkspaceView
            onStartCBTMock={(mode = 'JEE Main') => {
              s.setCustomCbtConfig(null);
              s.setCbtExamMode(mode);
              s.setInCBTMockMode(true);
            }}
            onOpenCustomTestModal={() => s.setCustomTestModalOpen(true)}
            onOpenInstantPractice={(paperTitle, customQuestions) =>
              s.setInstantPracticeConfig({
                isOpen: true,
                mode: 'paper-solver',
                title: 'Official Paper Practice',
                chapterOrPaper: paperTitle,
                customQuestions,
              })
            }
            mistakesNotebook={s.mistakesNotebook}
            onRecordMistake={(q, ans) => s.handleRecordMistake(q, ans, 'PYQ Bank')}
          />
        )}

        {s.activeTab === 'Revise' && (
          <ReviseWorkspaceView
            materials={s.materials}
            selectedMaterial={s.selectedMaterial}
            materialBundles={s.materialBundles}
            mistakesNotebook={s.mistakesNotebook}
            sm2Cards={s.sm2Cards}
            onUpdateSM2Card={s.handleUpdateSM2Card}
            onAddSM2Card={s.handleAddSM2Card}
            onTagMistakeRootCause={s.handleTagMistakeRootCause}
            onSelectMaterial={(mat) => s.setSelectedMaterial(mat)}
            onOpenAddMaterial={(tab) => {
              s.setAddMaterialInitialTab(tab);
              s.setAddMaterialOpen(true);
            }}
            onAddFlashcard={(node) => {
              s.handleAddFlashcard(node);
              s.handleAddSM2Card({
                chapter: s.selectedMaterial?.chapter || 'General',
                subject: s.selectedMaterial?.subject || 'Physics',
                frontPrompt: `Define & Explain: **${node.title}**`,
                backAnswer: `${node.definition}\n\n**Example:** ${node.example}\n\n**Exam Trap:** ${node.commonTrap}`,
                intervalDays: 1,
                repetitionCount: 0,
                easeFactor: 2.5,
                nextReviewIso: new Date().toISOString(),
              });
            }}
            onPracticeQuestion={(q) =>
              s.setInstantPracticeConfig({
                isOpen: true,
                mode: 'adaptive-drill',
                title: 'Mistake DNA Remediation',
                chapterOrPaper: q.chapter,
                customQuestions: [q],
              })
            }
            showToast={s.showToast}
          />
        )}

        {s.activeTab === 'Progress' && (
          <ProgressAndRankView
            onStartCBTMock={(mode = 'JEE Main') => {
              s.setCustomCbtConfig(null);
              s.setCbtExamMode(mode);
              s.setInCBTMockMode(true);
            }}
            onPracticeWeakTopic={(topic) => {
              s.setInstantPracticeConfig({
                isOpen: true,
                mode: 'adaptive-drill',
                title: 'Weak-Chapter Remediation Drill',
                chapterOrPaper: topic,
              });
            }}
            lastMockScore={s.lastMockScore}
            materialsCount={s.materials.length}
            mistakesCount={s.mistakesNotebook.length}
            sm2CardsCount={s.sm2Cards.length}
          />
        )}
      </AppShellFrame>

      <DynamicCompanion
        activeChapterName={s.selectedMaterial?.chapter || 'Rotational Motion'}
        onEarnXp={(earned, reason) => {
          s.setXp((x) => x + earned);
          if (reason) s.showToast(reason);
        }}
      />

      <PwaOfflineAndJobsBar
        onOpenAdminConsole={() => s.setProModalOpen(true)}
        onOpenAdminQuestionBank={() => s.setQuestionBankModalOpen(true)}
      />

      <AddMaterialModal
        isOpen={s.addMaterialOpen}
        initialTab={s.addMaterialInitialTab}
        onClose={() => s.setAddMaterialOpen(false)}
        onAddMaterial={s.handleAddMaterial}
      />

      <CompactStudyUtilitiesDrawer
        isOpen={s.studyToolsOpen}
        onClose={() => s.setStudyToolsOpen(false)}
      />

      <CustomTestGeneratorModal
        isOpen={s.customTestModalOpen}
        mistakesNotebook={s.mistakesNotebook}
        onClose={() => s.setCustomTestModalOpen(false)}
        onLaunchCustomCBT={(questionsOrConfig, durationMinutes = 60, paperTitle = 'Custom Test') => {
          s.setCustomTestModalOpen(false);
          if (Array.isArray(questionsOrConfig)) {
            s.setCustomCbtConfig({ questions: questionsOrConfig, durationMinutes, paperTitle });
          } else {
            s.setCustomCbtConfig({
              questions: questionsOrConfig.questions,
              durationMinutes: questionsOrConfig.durationMinutes,
              paperTitle: questionsOrConfig.title,
            });
          }
          s.setCbtExamMode('JEE Main');
          s.setInCBTMockMode(true);
        }}
      />

      <FocusTimerModal
        isOpen={s.focusTimerOpen}
        secondsLeft={s.focusSecondsLeft}
        running={s.focusRunning}
        onToggleRun={() => s.setFocusRunning((r) => !r)}
        onReset={() => {
          s.setFocusRunning(false);
          s.setFocusSecondsLeft(25 * 60);
        }}
        onClose={() => s.setFocusTimerOpen(false)}
      />

      <LiveVoiceTutorModal
        isOpen={s.voiceTutorOpen}
        chapterTitle={s.selectedMaterial?.chapter || 'General JEE Physics, Chemistry & Mathematics'}
        materialContext={s.selectedMaterial?.contentSummary}
        onClose={() => s.setVoiceTutorOpen(false)}
      />

      <WorkspaceConfirmModal
        isOpen={s.workspaceSyncConfirmOpen}
        title="Sync Study Schedule with Google Calendar & Tasks"
        description="This will create study blocks on your primary Google Calendar and task items in your Google Tasks list for your pending JEE study tasks."
        confirmLabel="Confirm & Sync Now"
        onConfirm={async () => {
          try {
            const pending = s.tasks.filter((t) => !t.completed);
            const res = await syncStudyTasksWithCalendarAndTasks(pending);
            s.showToast(`Synced ${res.tasksCreated} JEE study tasks to Google Calendar & Tasks!`);
          } catch (err: any) {
            s.showToast(err?.message || 'Could not sync with Google Workspace.');
          } finally {
            s.setWorkspaceSyncConfirmOpen(false);
          }
        }}
        onCancel={() => s.setWorkspaceSyncConfirmOpen(false)}
      />

      <ProfileModal
        isOpen={s.profileModalOpen}
        profile={s.studentProfile}
        streakDays={s.streakDays}
        xp={s.xp}
        level={s.level}
        onClose={() => s.setProfileModalOpen(false)}
        onSaveProfile={s.handleSaveStudentProfile}
        onExportUserData={s.handleExportAccountData}
        onOpenLegalModal={(tab) => {
          s.setProfileModalOpen(false);
          s.handleOpenLegal(tab);
        }}
        onSignOut={s.handleSignOutAndPurgeAll}
      />

      <LegalComplianceModal
        isOpen={s.legalModalState.isOpen}
        initialTab={s.legalModalState.tab}
        onClose={() => s.setLegalModalState((prev) => ({ ...prev, isOpen: false }))}
      />

      <InstantPracticeModal
        config={s.instantPracticeConfig}
        onClose={() => s.setInstantPracticeConfig(null)}
        onEarnXp={(earned) => {
          s.setXp((prev) => prev + earned);
          s.showToast(`+${earned} XP earned!`);
        }}
        onLaunchFullCBT={() => {
          s.setInstantPracticeConfig(null);
          s.setInCBTMockMode(true);
        }}
        onRecordMistake={(q, ans) => s.handleRecordMistake(q, ans, 'Adaptive Drill')}
      />

      <MistakeBookAndImprovementModal
        isOpen={s.mistakeModalOpen}
        mistakes={s.mistakesNotebook}
        onClose={() => s.setMistakeModalOpen(false)}
        onTagRootCause={s.handleTagMistakeRootCause}
        onPracticeMistake={(q) =>
          s.setInstantPracticeConfig({
            isOpen: true,
            mode: 'adaptive-drill',
            title: 'Mistake DNA Remediation',
            chapterOrPaper: q.chapter,
            customQuestions: [q],
          })
        }
      />

      <AdminCommercialConsoleModal
        isOpen={s.proModalOpen}
        subscriptionTier={s.subscriptionTier}
        billingCycle={s.billingCycle}
        onChangeBillingCycle={s.setBillingCycle}
        onActivatePro={s.handleActivateProTier}
        onClose={() => s.setProModalOpen(false)}
      />

      <AdminQuestionBankModal
        isOpen={s.questionBankModalOpen}
        onClose={() => s.setQuestionBankModalOpen(false)}
      />
    </AuthAndWorkspaceContext.Provider>
  );
}

export default App;
