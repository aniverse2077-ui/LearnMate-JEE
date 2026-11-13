import React from 'react';
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
import { MaterialItem } from './HomeAndStudyViews';
import { PrimaryTab, StudySubTabId } from '../hooks/useLearnMateAppState';
import { ExamTrack } from '../utils/jeeEngine';

export interface AppShellFrameProps {
  children: React.ReactNode;
  activeTab: PrimaryTab;
  onSelectTab: (tab: PrimaryTab) => void;
  studySubTab: StudySubTabId;
  onSelectStudySubTab: (sub: StudySubTabId) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  subscriptionTier: 'free' | 'pro';
  onOpenProModal: () => void;
  materials: MaterialItem[];
  selectedMaterial: MaterialItem | null;
  onSelectMaterial: (mat: MaterialItem) => void;
  onOpenAddMaterial: () => void;
  searchModalOpen: boolean;
  onSetSearchModalOpen: (open: boolean) => void;
  globalSearchQuery: string;
  onSetGlobalSearchQuery: (q: string) => void;
  onOpenStudyTools: () => void;
  focusTimerOpen: boolean;
  focusRunning: boolean;
  focusClockLabel: string;
  onToggleFocusTimer: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  notificationsOpen: boolean;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  onOpenVoiceTutor: () => void;
  onOpenProfileModal: () => void;
  avatarColor: string;
  userInitial: string;
  onStartCBTMock: (mode: ExamTrack) => void;
  toastMessage: string | null;
}

export const AppShellFrame: React.FC<AppShellFrameProps> = ({
  children,
  activeTab,
  onSelectTab,
  studySubTab,
  onSelectStudySubTab,
  sidebarCollapsed,
  onToggleSidebar,
  subscriptionTier,
  onOpenProModal,
  materials,
  selectedMaterial,
  onSelectMaterial,
  onOpenAddMaterial,
  searchModalOpen,
  onSetSearchModalOpen,
  globalSearchQuery,
  onSetGlobalSearchQuery,
  onOpenStudyTools,
  focusTimerOpen,
  focusRunning,
  focusClockLabel,
  onToggleFocusTimer,
  darkMode,
  onToggleDarkMode,
  notificationsOpen,
  onToggleNotifications,
  onCloseNotifications,
  onOpenVoiceTutor,
  onOpenProfileModal,
  avatarColor,
  userInitial,
  onStartCBTMock,
  toastMessage,
}) => {
  return (
    <div
      className={`min-h-screen transition-colors ${
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* STREAMLINED TOP NAVBAR (Full Desktop Edge-to-Edge) */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 px-4 lg:px-8 h-16 flex items-center justify-between gap-4 w-full">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
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
            onClick={() => onSelectTab('Home')}
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

        {/* Right: Global Actions & Utilities ONLY */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenProModal}
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

          <button
            onClick={onOpenAddMaterial}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Material</span>
          </button>

          <button
            onClick={() => onSetSearchModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
            title="Global Search (Cmd+K)"
          >
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Search</span>
          </button>

          <button
            onClick={onOpenStudyTools}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
          >
            <Grid className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline leading-tight text-left">Study Tools</span>
          </button>

          <button
            onClick={onToggleFocusTimer}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
              focusTimerOpen || focusRunning
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>{focusClockLabel}</span>
          </button>

          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
            title="Toggle Theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="relative">
            <button
              onClick={onToggleNotifications}
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
                    onClick={onCloseNotifications}
                    className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-2.5 text-xs">
                  {materials.length === 0 ? (
                    <div
                      onClick={() => {
                        onCloseNotifications();
                        onOpenAddMaterial();
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
                        onCloseNotifications();
                        onSelectTab('Revise');
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

          <button
            onClick={onOpenVoiceTutor}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/70 hover:bg-indigo-100 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 transition-all cursor-pointer"
            title="Open Live Classroom Voice JEE Tutor"
          >
            <Mic className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden md:inline">Voice Tutor</span>
          </button>

          <button
            onClick={onOpenProfileModal}
            style={{ backgroundColor: avatarColor || '#4F46E5' }}
            className="w-9 h-9 rounded-full text-white font-extrabold text-xs flex items-center justify-center shadow-xs transition-all cursor-pointer ring-2 ring-indigo-100 hover:opacity-90"
            title="Open Student Profile & Account Settings"
          >
            {userInitial}
          </button>
        </div>
      </header>

      {/* FULL-DESKTOP SHELL: COLLAPSIBLE LEFT SIDEBAR + 100% FLUID STAGE */}
      <div className="flex min-h-[calc(100vh-4rem)] w-full">
        <aside
          className={`shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800 transition-all duration-200 flex flex-col justify-between sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto ${
            sidebarCollapsed ? 'w-[72px] px-2.5 py-4' : 'w-64 px-3.5 py-5'
          }`}
        >
          <div className="space-y-6">
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
                      onClick={() => onSelectTab(tab.id)}
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
                          onSelectStudySubTab(sub.id);
                          onSelectTab('Study');
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
                          onSelectMaterial(mat);
                          onSelectStudySubTab('Chapter Notes');
                          onSelectTab('Study');
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

          <div className="pt-4 pb-8 border-t border-slate-200/80 dark:border-slate-800">
            <button
              onClick={onToggleSidebar}
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

        <main className="flex-1 min-w-0 w-full pb-20">{children}</main>
      </div>

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
                onChange={(e) => onSetGlobalSearchQuery(e.target.value)}
                placeholder="Jump to uploaded materials, Desmos calculator, Voice Tutor, or 75-Q CBT..."
                className="flex-1 text-sm font-medium focus:outline-none bg-transparent"
              />
              <button
                onClick={() => onSetSearchModalOpen(false)}
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
                    onSelectMaterial(m);
                    onSelectTab('Study');
                    onSelectStudySubTab('Chapter Notes');
                  },
                })),
                {
                  label: 'Upload PDF, Handwritten Photo, or 12-Hour YouTube Marathon',
                  action: () => onOpenAddMaterial(),
                },
                {
                  label: 'Live Voice AI Tutor (Word-by-Word Streaming & Barge-In)',
                  action: () => onOpenVoiceTutor(),
                },
                {
                  label: 'Desmos Graphing Calculator & Offline Scientific Calculator',
                  action: () => onOpenStudyTools(),
                },
                {
                  label: 'Full 75-Question NTA JEE Main CBT Mock Exam',
                  action: () => onStartCBTMock('JEE Main'),
                },
                {
                  label: 'JEE Advanced Paper 1 Multi-Format CBT Mock Exam',
                  action: () => onStartCBTMock('JEE Advanced'),
                },
                {
                  label: 'Revise: Formula Book, Mind Maps & 4-Font Handwritten Notes',
                  action: () => onSelectTab('Revise'),
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
                      onSetSearchModalOpen(false);
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

      {toastMessage && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-lg flex items-center gap-2 border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
