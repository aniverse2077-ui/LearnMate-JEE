import React from 'react';
import { PracticeDashboardView, MistakeNotebookEntry } from './RevisePracticeProgressCBT';
import { CBTQuestion, ExamTrack } from '../utils/jeeEngine';

export interface PracticeWorkspaceViewProps {
  onStartCBTMock: (mode?: ExamTrack) => void;
  onOpenCustomTestModal: () => void;
  onOpenInstantPractice: (paperTitle: string, customQuestions?: CBTQuestion[]) => void;
  mistakesNotebook: MistakeNotebookEntry[];
  onRecordMistake: (q: CBTQuestion, userAnswer: string) => void;
}

export const PracticeWorkspaceView: React.FC<PracticeWorkspaceViewProps> = ({
  onStartCBTMock,
  onOpenCustomTestModal,
  onOpenInstantPractice,
  mistakesNotebook,
  onRecordMistake,
}) => {
  return (
    <PracticeDashboardView
      onStartCBTMock={onStartCBTMock}
      onOpenCustomTestModal={onOpenCustomTestModal}
      onOpenInstantPractice={onOpenInstantPractice}
      mistakesNotebook={mistakesNotebook}
      onRecordMistake={onRecordMistake}
    />
  );
};
