import React from 'react';
import { Sliders, Brain, Zap } from 'lucide-react';
import {
  HomeDashboardView,
  MaterialItem,
  StudyTaskItem,
} from '../HomeAndStudyViews';

export interface DashboardViewProps {
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
  sm2DueCount?: number;
  mistakesCount?: number;
  onToggleTask: (taskId: string) => void;
  onAddTask: (title: string, durationMin: number) => void;
  onDeleteTask: (taskId: string) => void;
  onSyncWorkspaceTasks: () => void;
  onOpenStudyWorkbench: (mat?: MaterialItem) => void;
  onOpenMyMaterials: () => void;
  onOpenSyllabus: () => void;
  onOpenRevise: () => void;
  onOpenPractice: () => void;
  onOpenProgress: () => void;
  onOpenAddMaterial: (tab: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive') => void;
  onOpenStudyTools: () => void;
  onOpenCustomTestGenerator?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = (props) => {
  return (
    <div className="space-y-2">
      {/* Quick Action Bar */}
      <div className="w-full px-6 lg:px-10 xl:px-12 pt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={props.onOpenCustomTestGenerator}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            Custom Test Builder
          </button>
          <button
            type="button"
            onClick={props.onOpenRevise}
            className="px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 hover:bg-indigo-50 text-indigo-700 dark:text-indigo-300 font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Brain className="w-3.5 h-3.5" />
            Recall Queue ({props.sm2DueCount ?? 0})
          </button>
          <button
            type="button"
            onClick={props.onOpenRevise}
            className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 hover:bg-rose-50 text-rose-700 dark:text-rose-300 font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            Mistake Book ({props.mistakesCount ?? 0})
          </button>
        </div>
      </div>

      <HomeDashboardView {...props} />
    </div>
  );
};
