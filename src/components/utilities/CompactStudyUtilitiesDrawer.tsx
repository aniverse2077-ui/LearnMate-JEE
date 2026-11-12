import React from 'react';
import { StudyToolsDrawer } from '../GlobalOverlays';

export interface CompactStudyUtilitiesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompactStudyUtilitiesDrawer: React.FC<CompactStudyUtilitiesDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  return <StudyToolsDrawer isOpen={isOpen} onClose={onClose} />;
};
