import React from 'react';
import { CBTMockSummary, CBTQuestion, ExamTrack } from '../../utils/jeeEngine';
import { CBTMockExamView } from '../RevisePracticeProgressCBT';

export interface JeeCbtExamModalProps {
  candidateName: string;
  initialExamMode?: ExamTrack;
  customQuestions?: CBTQuestion[];
  customDurationMinutes?: number;
  customPaperTitle?: string;
  onSubmitMock: (summary: CBTMockSummary, focusEvents: number) => void;
  onExitMock: () => void;
  onRecordMistake?: (question: CBTQuestion, userAnswer: string) => void;
}

export const JeeCbtExamModal: React.FC<JeeCbtExamModalProps> = ({
  candidateName,
  initialExamMode = 'JEE Main',
  customQuestions,
  customDurationMinutes,
  customPaperTitle,
  onSubmitMock,
  onExitMock,
  onRecordMistake,
}) => {
  return (
    <CBTMockExamView
      candidateName={candidateName}
      initialExamMode={initialExamMode}
      customQuestions={customQuestions}
      customDurationMinutes={customDurationMinutes}
      customPaperTitle={customPaperTitle}
      onSubmitMock={onSubmitMock}
      onExitMock={onExitMock}
      onRecordMistake={onRecordMistake}
    />
  );
};
