import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  FileText,
  Image as ImageIcon,
  Youtube,
  Type as TypeIcon,
  Link2,
  Clock,
  Calculator,
  Ruler,
  BarChart2,
  Sigma,
  TrendingUp,
  ZoomIn,
  ZoomOut,
  Hand,
  Music,
  Play,
  Pause,
  RotateCcw,
  Mic,
  Volume2,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { evaluateMathFunction, calculateStatistics } from '../utils/jeeEngine';
import {
  listDriveStudyFiles,
  readGoogleDocContent,
  DriveFileItem,
} from '../services/workspaceService';

// ============================================================================
// 1. Add Material Modal (Exact Match for Screen 3: LearnMate_JEE_Add_Material_Modal-8)
// ============================================================================
interface AddMaterialModalProps {
  isOpen: boolean;
  initialTab?: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
  onClose: () => void;
  onAddMaterial: (item: {
    title: string;
    subject: 'Physics' | 'Chemistry' | 'Mathematics';
    chapter: string;
    sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
    sourceRef: string;
    contentSummary: string;
  }) => Promise<void>;
}

export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({
  isOpen,
  initialTab = 'youtube',
  onClose,
  onAddMaterial,
}) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'photo' | 'youtube' | 'text' | 'drive'>(
    initialTab
  );
  const [youtubeUrl, setYoutubeUrl] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [subject, setSubject] = useState<'Physics' | 'Chemistry' | 'Mathematics'>('Chemistry');
  const [titleInput, setTitleInput] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Checking link');
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (!isOpen) return null;

  const handleAnalyzeYouTube = async () => {
    if (!youtubeUrl.trim()) {
      setErrorText('Please enter a valid YouTube lecture URL.');
      return;
    }
    setErrorText(null);
    setAnalyzing(true);
    setStatusMessage('Checking link & analyzing lecture with Gemini 4 Argon...');
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl,
          sourceType: 'youtube',
          prompt: `Extract JEE ${subject} lecture notes and formulas from ${youtubeUrl}`,
        }),
      });
      const data = await res.json();
      await onAddMaterial({
        title: titleInput.trim() || `YouTube Lecture (${subject})`,
        subject,
        chapter: titleInput.trim() || 'Electrochemistry & Redox',
        sourceType: 'youtube',
        sourceRef: youtubeUrl,
        contentSummary:
          data.text ||
          'Extracted key lecture concepts, Nernst equation derivations, and standard electrode potential traps.',
      });
      onClose();
    } catch (err: any) {
      setErrorText(err?.message || 'Failed to analyze YouTube link.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'pdf' | 'photo'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorText(null);
    setAnalyzing(true);
    setStatusMessage(`Analyzing ${file.name} with Gemini 4 Argon...`);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = String(reader.result || '');
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaBase64: base64Data,
          mimeType: file.type || (mode === 'pdf' ? 'application/pdf' : 'image/jpeg'),
          sourceType: mode,
          prompt: `Extract structured JEE ${subject} chapter notes, definitions, formulas, and common traps from ${file.name}.`,
        }),
      });
      const data = await res.json();
      await onAddMaterial({
        title: file.name,
        subject,
        chapter: file.name.replace(/\.[^/.]+$/, ''),
        sourceType: mode,
        sourceRef: file.name,
        contentSummary:
          data.text || `Structured JEE ${subject} notes extracted from ${file.name}.`,
      });
      onClose();
    } catch (err: any) {
      setErrorText(err?.message || 'Could not analyze uploaded file.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim()) {
      setErrorText('Please paste your study text or formulas first.');
      return;
    }
    setAnalyzing(true);
    setStatusMessage('Structuring your notes...');
    try {
      await onAddMaterial({
        title: titleInput.trim() || `${subject} Custom Notes`,
        subject,
        chapter: titleInput.trim() || `${subject} Notes`,
        sourceType: 'text',
        sourceRef: 'Pasted Notes',
        contentSummary: pastedText.trim(),
      });
      onClose();
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLoadDriveFiles = async () => {
    setDriveLoading(true);
    setErrorText(null);
    try {
      const files = await listDriveStudyFiles();
      setDriveFiles(files);
    } catch (err: any) {
      setErrorText(err?.message || 'Could not fetch Google Drive files.');
    } finally {
      setDriveLoading(false);
    }
  };

  const handleImportDriveFile = async (file: DriveFileItem) => {
    setAnalyzing(true);
    setStatusMessage(`Importing "${file.name}" from Google Workspace...`);
    try {
      let summary = `Imported from Google Drive: ${file.name}`;
      if (file.mimeType.includes('document')) {
        const docContent = await readGoogleDocContent(file.id);
        summary = docContent.text;
      }
      await onAddMaterial({
        title: file.name,
        subject,
        chapter: file.name,
        sourceType: 'drive',
        sourceRef: file.id,
        contentSummary: summary,
      });
      onClose();
    } catch (err: any) {
      setErrorText(err?.message || 'Failed to import file from Google Drive/Docs.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add Material"
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-[600px] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            Add Material
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Add Material modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subject Pill Selector */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Subject:</span>
          {(['Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
            <button
              key={subj}
              type="button"
              onClick={() => setSubject(subj)}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                subject === subj
                  ? 'bg-[#EEF2FF] text-[#4F46E5] border border-indigo-200'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {subj}
            </button>
          ))}
        </div>

        {/* Top Source Tabs matching Screen 3 + Google Drive/Docs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto">
          {[
            { id: 'pdf', label: 'PDF', icon: FileText },
            { id: 'photo', label: 'Photo', icon: ImageIcon },
            { id: 'youtube', label: 'YouTube', icon: Youtube },
            { id: 'text', label: 'Paste Text', icon: TypeIcon },
            { id: 'drive', label: 'Google Drive / Docs', icon: FolderOpen },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]'
                    : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        {activeTab === 'youtube' && (
          <div className="space-y-4">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[220px]">
                <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                />
              </div>
              <button
                type="button"
                onClick={handleAnalyzeYouTube}
                disabled={analyzing}
                className="px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-sm transition-colors cursor-pointer shrink-0"
              >
                Analyze
              </button>
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium shrink-0">
                <Clock className="w-3.5 h-3.5" />
                Up to 12 h
              </span>
            </div>

            <div className="px-4 py-3.5 rounded-xl bg-[#EEF2FF]/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 border-[#4F46E5] border-t-transparent ${
                    analyzing ? 'animate-spin' : ''
                  }`}
                />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {statusMessage}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAnalyzing(false);
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {activeTab === 'pdf' && (
          <div className="space-y-3">
            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-[#4F46E5] transition-colors cursor-pointer bg-slate-50/60 dark:bg-slate-800/40">
              <FileText className="w-8 h-8 text-[#4F46E5] mb-2" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Upload JEE Chapter PDF (up to 60 pages)
              </span>
              <span className="text-xs text-slate-500 mt-1">
                Extracts formulas, theorems, and page-referenced notes
              </span>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => handleFileChange(e, 'pdf')}
                className="hidden"
              />
            </label>
          </div>
        )}

        {activeTab === 'photo' && (
          <div className="space-y-3">
            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-[#4F46E5] transition-colors cursor-pointer bg-slate-50/60 dark:bg-slate-800/40">
              <ImageIcon className="w-8 h-8 text-[#4F46E5] mb-2" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Upload Photo of Handwritten Notes or Doubt Question
              </span>
              <span className="text-xs text-slate-500 mt-1">
                Analyzed by Gemini 4 Argon for handwriting OCR & diagram extraction
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'photo')}
                className="hidden"
              />
            </label>
          </div>
        )}

        {activeTab === 'text' && (
          <div className="space-y-3">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Chapter title (e.g., Electrochemistry Formula Sheet)"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
            />
            <textarea
              rows={4}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste your JEE notes, reactions, or derivations here..."
              className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
            />
            <button
              type="button"
              onClick={handlePasteSubmit}
              className="px-5 py-2.5 rounded-xl bg-[#4F46E5] text-white text-sm font-semibold hover:bg-[#4338CA] cursor-pointer"
            >
              Save to Materials
            </button>
          </div>
        )}

        {activeTab === 'drive' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                Import PDFs and Google Docs directly from your Google Drive:
              </span>
              <button
                type="button"
                onClick={handleLoadDriveFiles}
                disabled={driveLoading}
                className="px-3.5 py-1.5 rounded-lg bg-[#4F46E5] text-white text-xs font-semibold hover:bg-[#4338CA] cursor-pointer"
              >
                {driveLoading ? 'Loading Drive...' : 'Browse Google Drive'}
              </button>
            </div>
            {driveFiles.length > 0 ? (
              <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                {driveFiles.map((df) => (
                  <div
                    key={df.id}
                    className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[320px]">
                      {df.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleImportDriveFile(df)}
                      className="px-2.5 py-1 rounded bg-indigo-50 text-[#4F46E5] font-semibold hover:bg-indigo-100 cursor-pointer"
                    >
                      Import
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">
                Click “Browse Google Drive” to list your study PDFs and Google Docs.
              </p>
            )}
          </div>
        )}

        {errorText && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
            {errorText}
          </div>
        )}

        {/* Bottom quick switcher matching Screen 3 */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Or upload instead:</span>
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF up to 60 pages</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('photo')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photo of Notes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer"
          >
            <TypeIcon className="w-3.5 h-3.5" />
            <span>Paste Text</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. Study Tools Slide-Over Drawer (Exact Match for Screen 11: Study_Tools_Graphing_Workspace-7)
// ============================================================================
interface StudyToolsDrawerProps {
  isOpen: boolean;
  initialTab?: 'Calculator' | 'Units' | 'Statistics' | 'Formulas' | 'Graph';
  onClose: () => void;
}

export const StudyToolsDrawer: React.FC<StudyToolsDrawerProps> = ({
  isOpen,
  initialTab = 'Graph',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    'Calculator' | 'Units' | 'Statistics' | 'Formulas' | 'Graph'
  >(initialTab);

  // Graphing State (matches y = x² − 4 in Screen 11)
  const [equationInput, setEquationInput] = useState('y = x^2 - 4');
  const [extraEquations, setExtraEquations] = useState<string[]>([]);
  const [showExtraInput, setShowExtraInput] = useState(false);
  const [secondEq, setSecondEq] = useState('y = 2x - 1');
  const [xMin, setXMin] = useState(-10);
  const [xMax, setXMax] = useState(10);
  const [yMin, setYMin] = useState(-10);
  const [yMax, setYMax] = useState(10);
  const [zoomPct, setZoomPct] = useState(100);
  const [panMode, setPanMode] = useState(true);

  // Calculator State
  const [calcExpr, setCalcExpr] = useState('2 * sin(pi / 6) + sqrt(16)');
  const [calcResult, setCalcResult] = useState<string>('5');

  // Units Converter State
  const [unitCategory, setUnitCategory] = useState<'Energy' | 'Pressure' | 'Angle'>('Energy');
  const [unitInputVal, setUnitInputVal] = useState<number>(1);

  // Statistics State
  const [statsRaw, setStatsRaw] = useState('12, 15, 18, 22, 25, 28');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (!isOpen) return null;

  // Build SVG polyline points for graphing calculator
  const scaleFactor = zoomPct / 100;
  const effXMin = xMin / scaleFactor;
  const effXMax = xMax / scaleFactor;
  const effYMin = yMin / scaleFactor;
  const effYMax = yMax / scaleFactor;

  const svgWidth = 560;
  const svgHeight = 360;
  const pad = 32;
  const plotW = svgWidth - pad * 2;
  const plotH = svgHeight - pad * 2;

  const toScreenX = (x: number) =>
    pad + ((x - effXMin) / Math.max(0.001, effXMax - effXMin)) * plotW;
  const toScreenY = (y: number) =>
    pad + plotH - ((y - effYMin) / Math.max(0.001, effYMax - effYMin)) * plotH;

  const buildCurvePath = (eq: string) => {
    const pts: string[] = [];
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const x = effXMin + (i / steps) * (effXMax - effXMin);
      const y = evaluateMathFunction(eq, x);
      if (y !== null && y >= effYMin * 1.4 && y <= effYMax * 1.4) {
        const sx = toScreenX(x).toFixed(1);
        const sy = toScreenY(y).toFixed(1);
        pts.push(`${pts.length === 0 ? 'M' : 'L'} ${sx} ${sy}`);
      }
    }
    return pts.join(' ');
  };

  const primaryPath = buildCurvePath(equationInput);
  const secondaryPaths = extraEquations.map((eq) => buildCurvePath(eq));

  const statsNumbers = statsRaw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  const statsSummary = calculateStatistics(statsNumbers);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Study Tools"
      className="fixed inset-0 z-50 bg-slate-900/35 flex justify-end"
    >
      <div className="w-full max-w-[660px] bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            Study Tools
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Study Tools"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5 Tabs matching Screen 11 */}
        <div className="px-6 pt-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
          {[
            { id: 'Calculator', icon: Calculator },
            { id: 'Units', icon: Ruler },
            { id: 'Statistics', icon: BarChart2 },
            { id: 'Formulas', icon: Sigma },
            { id: 'Graph', icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]'
                    : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.id}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-6 flex-1 space-y-4">
          {activeTab === 'Graph' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  Equation
                </label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="text"
                    value={equationInput}
                    onChange={(e) => setEquationInput(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border-2 border-[#4F46E5] text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (secondEq.trim() && !extraEquations.includes(secondEq.trim())) {
                        setExtraEquations((prev) => [...prev, secondEq.trim()]);
                      }
                      setShowExtraInput(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    Add Equation
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowExtraInput((v) => !v)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-left text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 cursor-pointer"
                >
                  <span>›</span>
                  <span>Additional equation</span>
                </button>
                {showExtraInput && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={secondEq}
                      onChange={(e) => setSecondEq(e.target.value)}
                      placeholder="e.g., y = 2x + 1"
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (secondEq.trim()) {
                          setExtraEquations((prev) => [...prev, secondEq.trim()]);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      Plot Line
                    </button>
                  </div>
                )}
              </div>

              {/* Range Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">x range</span>
                  <input
                    type="number"
                    value={xMin}
                    onChange={(e) => setXMin(Number(e.target.value))}
                    className="w-14 px-2 py-1.5 rounded-lg border border-slate-200 text-center tabular-nums"
                  />
                  <span className="text-slate-500">to</span>
                  <input
                    type="number"
                    value={xMax}
                    onChange={(e) => setXMax(Number(e.target.value))}
                    className="w-14 px-2 py-1.5 rounded-lg border border-slate-200 text-center tabular-nums"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">y range</span>
                  <input
                    type="number"
                    value={yMin}
                    onChange={(e) => setYMin(Number(e.target.value))}
                    className="w-14 px-2 py-1.5 rounded-lg border border-slate-200 text-center tabular-nums"
                  />
                  <span className="text-slate-500">to</span>
                  <input
                    type="number"
                    value={yMax}
                    onChange={(e) => setYMax(Number(e.target.value))}
                    className="w-14 px-2 py-1.5 rounded-lg border border-slate-200 text-center tabular-nums"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setZoomPct(100)}
                    className="px-4 py-1.5 rounded-lg bg-[#4F46E5] text-white font-semibold cursor-pointer"
                  >
                    Plot
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEquationInput('y = x^2 - 4');
                      setExtraEquations([]);
                      setXMin(-10);
                      setXMax(10);
                      setYMin(-10);
                      setYMax(10);
                      setZoomPct(100);
                    }}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Coordinate Graph Canvas matching Screen 11 */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white p-4 space-y-3">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-[340px] select-none"
                >
                  {/* Grid lines */}
                  {[-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10].map((tick) => {
                    const sx = toScreenX(tick);
                    const sy = toScreenY(tick);
                    return (
                      <g key={tick}>
                        <line
                          x1={sx}
                          y1={pad}
                          x2={sx}
                          y2={svgHeight - pad}
                          stroke="#E2E8F0"
                          strokeWidth="1"
                        />
                        <line
                          x1={pad}
                          y1={sy}
                          x2={svgWidth - pad}
                          y2={sy}
                          stroke="#E2E8F0"
                          strokeWidth="1"
                        />
                        {tick !== 0 && (
                          <>
                            <text
                              x={sx}
                              y={toScreenY(0) + 16}
                              textAnchor="middle"
                              fontSize="10"
                              fill="#334155"
                            >
                              {tick}
                            </text>
                            <text
                              x={toScreenX(0) - 10}
                              y={sy + 3}
                              textAnchor="end"
                              fontSize="10"
                              fill="#334155"
                            >
                              {tick}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  })}

                  {/* X and Y Axes */}
                  <line
                    x1={pad}
                    y1={toScreenY(0)}
                    x2={svgWidth - pad}
                    y2={toScreenY(0)}
                    stroke="#0F172A"
                    strokeWidth="1.6"
                  />
                  <line
                    x1={toScreenX(0)}
                    y1={pad}
                    x2={toScreenX(0)}
                    y2={svgHeight - pad}
                    stroke="#0F172A"
                    strokeWidth="1.6"
                  />
                  <text
                    x={svgWidth - pad + 10}
                    y={toScreenY(0) + 4}
                    fontStyle="italic"
                    fontWeight="bold"
                    fontSize="12"
                  >
                    x
                  </text>
                  <text
                    x={toScreenX(0) + 8}
                    y={pad - 6}
                    fontStyle="italic"
                    fontWeight="bold"
                    fontSize="12"
                  >
                    y
                  </text>

                  {/* Primary Plotted Function Curve */}
                  {primaryPath && (
                    <path
                      d={primaryPath}
                      fill="none"
                      stroke="#4338CA"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    />
                  )}
                  {secondaryPaths.map((p, idx) =>
                    p ? (
                      <path
                        key={idx}
                        d={p}
                        fill="none"
                        stroke="#059669"
                        strokeWidth="2"
                        strokeDasharray="5,3"
                      />
                    ) : null
                  )}
                </svg>

                {/* Bottom Zoom & Pan Controls */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <div className="inline-flex items-center rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setZoomPct((z) => Math.max(50, z - 25))}
                      aria-label="Zoom out graph"
                      className="px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 py-1.5 border-x border-slate-200 font-mono font-medium">
                      {zoomPct}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoomPct((z) => Math.min(200, z + 25))}
                      aria-label="Zoom in graph"
                      className="px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPanMode((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                      panMode
                        ? 'bg-[#EEF2FF] text-[#4F46E5]'
                        : 'border border-slate-200 text-slate-600'
                    }`}
                  >
                    <Hand className="w-3.5 h-3.5" />
                    <span>Pan</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Calculator' && (
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-700">
                Scientific Expression Evaluator (Radians)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={calcExpr}
                  onChange={(e) => setCalcExpr(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = evaluateMathFunction(calcExpr, 1);
                    setCalcResult(val !== null ? String(Number(val.toFixed(6))) : 'Syntax Error');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#4F46E5] text-white text-xs font-semibold cursor-pointer"
                >
                  Evaluate
                </button>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500">Result:</span>
                <span className="font-mono font-bold text-xl text-[#4F46E5] tabular-nums">
                  {calcResult}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                {['sin(pi/4)', 'cos(pi/3)', 'sqrt(2)', 'log(10)', 'exp(1)', '3^4', 'pi', 'abs(-9.8)'].map(
                  (preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setCalcExpr(preset);
                        const v = evaluateMathFunction(preset, 1);
                        if (v !== null) setCalcResult(String(Number(v.toFixed(6))));
                      }}
                      className="p-2.5 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer"
                    >
                      {preset}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {activeTab === 'Units' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {(['Energy', 'Pressure', 'Angle'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setUnitCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      unitCategory === cat
                        ? 'bg-[#4F46E5] text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Input Value ({unitCategory === 'Energy' ? 'Electron-Volts (eV)' : unitCategory === 'Pressure' ? 'Atmospheres (atm)' : 'Degrees (°)'})
                </label>
                <input
                  type="number"
                  value={unitInputVal}
                  onChange={(e) => setUnitInputVal(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono text-sm"
                />
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs font-mono">
                {unitCategory === 'Energy' && (
                  <>
                    <div>Joules (J): {(unitInputVal * 1.60218e-19).toExponential(4)} J</div>
                    <div>kJ / mol: {(unitInputVal * 96.485).toFixed(3)} kJ/mol</div>
                    <div>Calories: {(unitInputVal * 3.829e-20).toExponential(4)} cal</div>
                  </>
                )}
                {unitCategory === 'Pressure' && (
                  <>
                    <div>Pascals (Pa): {(unitInputVal * 101325).toFixed(1)} Pa</div>
                    <div>Bar: {(unitInputVal * 1.01325).toFixed(5)} bar</div>
                    <div>mmHg (Torr): {(unitInputVal * 760).toFixed(2)} Torr</div>
                  </>
                )}
                {unitCategory === 'Angle' && (
                  <>
                    <div>Radians (rad): {((unitInputVal * Math.PI) / 180).toFixed(6)} rad</div>
                    <div>Gradians: {(unitInputVal * (10 / 9)).toFixed(3)} grad</div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Statistics' && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-slate-700">
                Dataset (comma-separated numbers)
              </label>
              <input
                type="text"
                value={statsRaw}
                onChange={(e) => setStatsRaw(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-sm"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">Mean (x̄)</div>
                  <div className="font-mono font-bold text-base tabular-nums">{statsSummary.mean}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">Median</div>
                  <div className="font-mono font-bold text-base tabular-nums">{statsSummary.median}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">Variance (σ²)</div>
                  <div className="font-mono font-bold text-base tabular-nums">{statsSummary.variance}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">Std Dev (σ)</div>
                  <div className="font-mono font-bold text-base tabular-nums">{statsSummary.stdDev}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Formulas' && (
            <div className="space-y-3">
              {[
                {
                  subj: 'Chemistry · d & f Block',
                  title: 'Spin-Only Magnetic Moment',
                  eq: 'μ = √(n(n + 2)) BM   (where n = number of unpaired electrons)',
                },
                {
                  subj: 'Chemistry · Electrochemistry',
                  title: 'Nernst Equation at 298 K',
                  eq: 'E_cell = E°_cell − (0.0591 / n) log₁₀ Q',
                },
                {
                  subj: 'Physics · Mechanics',
                  title: 'Block on Inclined Plane with Friction',
                  eq: 'N = mg cos θ,   a = g(sin θ − μ_k cos θ)',
                },
                {
                  subj: 'Mathematics · Probability',
                  title: 'Conditional Probability & Bayes Theorem',
                  eq: 'P(A | B) = P(A ∩ B) / P(B)',
                },
              ].map((f, i) => (
                <div key={i} className="p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-[11px] font-semibold text-[#4F46E5]">{f.subj}</div>
                  <div className="text-xs font-bold text-slate-900">{f.title}</div>
                  <div className="font-mono text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">
                    {f.eq}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. Focus 25:00 Timer + Lyria 3 Focus Music Generator Popover
// ============================================================================
interface FocusTimerModalProps {
  isOpen: boolean;
  secondsLeft: number;
  running: boolean;
  onToggleRun: () => void;
  onReset: () => void;
  onClose: () => void;
}

export const FocusTimerModal: React.FC<FocusTimerModalProps> = ({
  isOpen,
  secondsLeft,
  running,
  onToggleRun,
  onReset,
  onClose,
}) => {
  const [musicPrompt, setMusicPrompt] = useState(
    'Ambient lo-fi acoustic piano and warm synth pad for deep JEE math & physics focus'
  );
  const [durationType, setDurationType] = useState<'clip' | 'full'>('clip');
  const [generatingMusic, setGeneratingMusic] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [musicError, setMusicError] = useState<string | null>(null);

  if (!isOpen) return null;

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  const handleGenerateMusic = async () => {
    setGeneratingMusic(true);
    setMusicError(null);
    try {
      const res = await fetch('/api/ai/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: musicPrompt, durationType }),
      });
      const data = await res.json();
      if (!res.ok || !data.audioUrl) {
        throw new Error(data.error || 'Could not generate focus track');
      }
      setAudioUrl(data.audioUrl);
    } catch (err: any) {
      setMusicError(err?.message || 'Failed to generate focus music');
    } finally {
      setGeneratingMusic(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Focus Timer and Study Music"
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#4F46E5]" />
            <h3 className="font-display font-bold text-lg">Pomodoro Focus Session</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Focus Timer"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-6 rounded-2xl bg-[#EEF2FF]/70 dark:bg-indigo-950/40 border border-indigo-100 text-center space-y-3">
          <div className="font-mono font-extrabold text-5xl text-[#4F46E5] tabular-nums">
            {mins}:{secs}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onToggleRun}
              className="px-5 py-2 rounded-xl bg-[#4F46E5] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{running ? 'Pause Focus' : 'Start 25m Focus'}</span>
            </button>
            <button
              type="button"
              onClick={onReset}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Lyria 3 Focus Music Generator */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Music className="w-4 h-4 text-[#4F46E5]" />
              <span>AI Focus Music Generator (Lyria 3)</span>
            </div>
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setDurationType('clip')}
                className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                  durationType === 'clip' ? 'bg-white text-[#4F46E5] shadow-2xs' : 'text-slate-500'
                }`}
              >
                30s Clip
              </button>
              <button
                type="button"
                onClick={() => setDurationType('full')}
                className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                  durationType === 'full' ? 'bg-white text-[#4F46E5] shadow-2xs' : 'text-slate-500'
                }`}
              >
                Full Track
              </button>
            </div>
          </div>

          <input
            type="text"
            value={musicPrompt}
            onChange={(e) => setMusicPrompt(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            placeholder="Describe your study soundtrack..."
          />

          <button
            type="button"
            disabled={generatingMusic}
            onClick={handleGenerateMusic}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
          >
            {generatingMusic
              ? 'Composing with Lyria 3...'
              : `Generate ${durationType === 'full' ? 'Full Track (Lyria Pro)' : '30s Focus Clip (Lyria Clip)'}`}
          </button>

          {audioUrl && (
            <audio controls src={audioUrl} className="w-full h-9 mt-2" />
          )}
          {musicError && (
            <p className="text-[11px] text-red-600">{musicError}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. Real-Time Live Voice Tutor Modal (gemini-3.8-live via WebSocket /api/live)
// ============================================================================
interface LiveVoiceTutorModalProps {
  isOpen: boolean;
  chapterTitle: string;
  onClose: () => void;
}

export const LiveVoiceTutorModal: React.FC<LiveVoiceTutorModalProps> = ({
  isOpen,
  chapterTitle,
  onClose,
}) => {
  const [connected, setConnected] = useState(false);
  const [transcriptLog, setTranscriptLog] = useState<{ speaker: 'You' | 'Tutor'; text: string }[]>(
    []
  );
  const [textFallback, setTextFallback] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/live`);
    wsRef.current = ws;

    const outputCtx = new AudioContext({ sampleRate: 24000 });
    outputCtxRef.current = outputCtx;
    nextStartTimeRef.current = 0;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.status === 'connected') {
          setConnected(true);
        }
        if (msg.inputTranscript) {
          setTranscriptLog((prev) => [...prev, { speaker: 'You', text: msg.inputTranscript }]);
        }
        if (msg.outputTranscript) {
          setTranscriptLog((prev) => [...prev, { speaker: 'Tutor', text: msg.outputTranscript }]);
        }
        if (msg.audio && outputCtxRef.current) {
          // Decode 24kHz 16-bit PCM little-endian
          const binary = atob(msg.audio);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const int16 = new Int16Array(bytes.buffer);
          const float32 = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 32768;
          }
          const audioBuffer = outputCtxRef.current.createBuffer(1, float32.length, 24000);
          audioBuffer.getChannelData(0).set(float32);

          const source = outputCtxRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(outputCtxRef.current.destination);
          const now = outputCtxRef.current.currentTime;
          const startAt = Math.max(now, nextStartTimeRef.current);
          source.start(startAt);
          nextStartTimeRef.current = startAt + audioBuffer.duration;
        }
        if (msg.error) {
          setStatusError(msg.error);
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      ws.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      inputCtxRef.current?.close();
      outputCtxRef.current?.close();
      setConnected(false);
    };
  }, [isOpen]);

  const startMicStreaming = async () => {
    try {
      setStatusError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      inputCtxRef.current = inputCtx;
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const floatData = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(floatData.length);
        for (let i = 0; i < floatData.length; i++) {
          const s = Math.max(-1, Math.min(1, floatData[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        wsRef.current.send(JSON.stringify({ audio: btoa(binary) }));
      };
    } catch (err: any) {
      setStatusError(err?.message || 'Microphone permission denied.');
    }
  };

  const sendTextPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textFallback.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ text: textFallback.trim() }));
    setTranscriptLog((prev) => [...prev, { speaker: 'You', text: textFallback.trim() }]);
    setTextFallback('');
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live Voice Tutor"
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
              Gemini 3.8 Live Voice Tutor · {chapterTitle}
            </h3>
            <p className="text-xs text-slate-500">
              {connected ? 'Live bidirectional voice session active' : 'Connecting to Gemini 3.8 Live...'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Voice Tutor"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-center py-4">
          <button
            type="button"
            onClick={startMicStreaming}
            className="px-5 py-3 rounded-2xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            <span>Enable Microphone (16kHz Live Stream)</span>
          </button>
        </div>

        <div className="h-44 overflow-y-auto rounded-xl bg-slate-50 dark:bg-slate-800 p-3.5 space-y-2 text-xs">
          {transcriptLog.length === 0 ? (
            <p className="text-slate-400 text-center py-10">
              Speak into your microphone or type a prompt below to converse with your Live Voice
              Tutor in real time.
            </p>
          ) : (
            transcriptLog.map((entry, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-lg ${
                  entry.speaker === 'You'
                    ? 'bg-indigo-50 text-indigo-950 ml-6'
                    : 'bg-white border border-slate-200 text-slate-800 mr-6'
                }`}
              >
                <span className="font-bold mr-1.5">{entry.speaker}:</span>
                <span>{entry.text}</span>
              </div>
            ))
          )}
        </div>

        <form onSubmit={sendTextPrompt} className="flex gap-2">
          <input
            type="text"
            value={textFallback}
            onChange={(e) => setTextFallback(e.target.value)}
            placeholder="Or type to speak with the Live session..."
            className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold cursor-pointer"
          >
            Send
          </button>
        </form>

        {statusError && <p className="text-xs text-red-600">{statusError}</p>}
      </div>
    </div>
  );
};

// ============================================================================
// 5. Mandatory User Confirmation Modal for Google Workspace Mutations
// ============================================================================
interface WorkspaceConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export const WorkspaceConfirmModal: React.FC<WorkspaceConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}) => {
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
              {title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              {description}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleConfirm}
            className="px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold cursor-pointer"
          >
            {busy ? 'Syncing with Google Workspace...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
