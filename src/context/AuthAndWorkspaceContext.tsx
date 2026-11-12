import React, { createContext, useContext } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { StudentProfileData } from '../components/GlobalOverlays';
import { MaterialItem, StudyTaskItem, CreationItem } from '../components/HomeAndStudyViews';
import { MaterialStudyBundle } from '../data/jeeInitialContent';
import { MistakeNotebookEntry } from '../components/RevisePracticeProgressCBT';
import { SM2FlashcardItem, ErrorRootCauseTag } from '../utils/jeeEngine';

export interface AuthAndWorkspaceContextValue {
  currentUser: FirebaseUser | null;
  studentProfile: StudentProfileData;
  materials: MaterialItem[];
  materialBundles: Record<string, MaterialStudyBundle>;
  tasks: StudyTaskItem[];
  creations: CreationItem[];
  mistakesNotebook: MistakeNotebookEntry[];
  sm2Cards: SM2FlashcardItem[];
  streakDays: number;
  xp: number;
  level: number;
  lastMockScore: number | null;
  showToast: (msg: string) => void;
  onTagMistakeRootCause?: (mistakeId: string, rootCause: ErrorRootCauseTag) => void;
  onUpdateSM2Card?: (card: SM2FlashcardItem) => void;
  onAddSM2Card?: (card: Omit<SM2FlashcardItem, 'id'>) => void;
  onSignOutAndPurgeAll: () => Promise<void>;
}

export const AuthAndWorkspaceContext = createContext<AuthAndWorkspaceContextValue | null>(
  null
);

export function useAuthAndWorkspace() {
  const ctx = useContext(AuthAndWorkspaceContext);
  if (!ctx) {
    throw new Error('useAuthAndWorkspace must be used within AuthAndWorkspaceContext.Provider');
  }
  return ctx;
}
