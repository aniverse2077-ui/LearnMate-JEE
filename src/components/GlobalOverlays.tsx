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
  MicOff,
  Volume2,
  VolumeX,
  FolderOpen,
  AlertTriangle,
  ShieldCheck,
  Download,
  LogOut,
  Flame,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Table,
  History,
  Square,
  Sparkles,
} from 'lucide-react';
import {
  evaluateMathFunction,
  evaluateMathDetailed,
  validateMathSyntax,
  AngleMode,
  evaluateDerivative,
  detectEquationParameters,
  findRootsAndExtrema,
  findCurveIntersections,
  computeCombination,
  computePermutation,
  computeFactorial,
  computeDeterminant3x3,
  computeVectorOps,
  calculateStatistics,
  detectJeeSubjectAndChapter,
  CBTQuestion,
  GraphSpecialPoint,
} from '../utils/jeeEngine';
import {
  listDriveStudyFiles,
  readGoogleDocContent,
  DriveFileItem,
  saveDocumentToIndexedDb,
  extractPdfTextAndMetadataWithPdfJs,
  extractScannedPdfPagesViaOcr,
  apiFetchWithAuth,
  ingestYouTubeOnServer,
  reportQuestionIssueOnServer,
  verifySinglePyqAnswerOnServer,
  requestSignedCloudStorageUrl,
  confirmCloudUpload,
} from '../services/workspaceService';
import {
  getDaysToJeeMain2027Session1,
  GLOBAL_PPP_PRICING,
  SupportedCurrency,
} from '../config/examSpecs';
import { CBT_MOCK_QUESTIONS } from '../data/jeeInitialContent';
import {
  googleSignIn,
  getWorkspaceAccessToken,
  registerActiveVoiceSocket,
  getFirebaseIdToken,
} from '../firebase';
import { LegalModalTabId } from './LandingAndAuth';
import { MathRichText } from './MathRichText';

// ============================================================================
// 1. Add Material Modal (Clean Zero-State + Auto Subject/Chapter Detection + Up to 12-Hour YouTube Marathon + Handwritten OCR)
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
    originalFileUrl?: string;
    originalMimeType?: string;
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
  // Strictly empty by default — no preloaded link or fake spinner
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [lectureDurationHours, setLectureDurationHours] = useState<number>(3);
  const [transcriptOrOutline, setTranscriptOrOutline] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
    setErrorText(null);
    setAnalyzing(false);
    setStatusMessage('');
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  const hasTypedContext = Boolean(
    titleInput.trim() || youtubeUrl.trim() || transcriptOrOutline.trim() || pastedText.trim()
  );
  const liveDetected = detectJeeSubjectAndChapter(
    `${youtubeUrl} ${transcriptOrOutline} ${pastedText}`,
    titleInput
  );

  const handleAnalyzeYouTube = async () => {
    if (!youtubeUrl.trim() && !transcriptOrOutline.trim()) {
      setErrorText('Please enter a YouTube lecture URL or paste a lecture transcript/outline.');
      return;
    }
    setErrorText(null);
    setAnalyzing(true);
    setStatusMessage(
      'Validating YouTube video ID and verifying authorized captions or pasted transcript...'
    );
    try {
      const ingestRes = await ingestYouTubeOnServer({
        url: youtubeUrl.trim(),
        transcriptText: transcriptOrOutline.trim(),
        title: titleInput.trim() || undefined,
      });

      if (!ingestRes.ok) {
        const metaTitle = (ingestRes.data as any)?.metadata?.title
          ? ` (${(ingestRes.data as any).metadata.title})`
          : '';
        setErrorText(
          `[${ingestRes.error.errorCode}] ${ingestRes.error.message}${metaTitle}`
        );
        return;
      }

      const verifiedTranscript = String(
        (ingestRes.data as any).transcriptText || transcriptOrOutline.trim()
      );
      const ytTitle =
        titleInput.trim() ||
        String((ingestRes.data as any).metadata?.title || '').trim() ||
        detectJeeSubjectAndChapter(verifiedTranscript, titleInput).chapter;

      setStatusMessage(
        `Structuring verified transcript into chapter notes, formulas & mind map (${lectureDurationHours}h lecture)...`
      );

      const initialDetection = detectJeeSubjectAndChapter(
        `${youtubeUrl} ${verifiedTranscript}`,
        ytTitle
      );

      let extractedAiText = '';
      if (verifiedTranscript.length >= 20) {
        const aiRes = await apiFetchWithAuth<{ text?: string }>('/api/ai/analyze', {
          youtubeUrl: youtubeUrl.trim() || undefined,
          lectureDurationHours,
          transcriptOrOutline: verifiedTranscript.slice(0, 12000),
          sourceType: 'youtube',
          prompt: `Structure these verified lecture transcript segments for "${initialDetection.chapter}" into chapter notes, derivations, and equations without inventing external facts.`,
        });
        if (aiRes.ok && aiRes.data.text) {
          extractedAiText = aiRes.data.text;
        }
      }

      const finalDetection = detectJeeSubjectAndChapter(
        `${youtubeUrl} ${verifiedTranscript} ${extractedAiText}`,
        ytTitle
      );

      await onAddMaterial({
        title: ytTitle,
        subject: finalDetection.subject,
        chapter: finalDetection.chapter,
        sourceType: 'youtube',
        sourceRef: youtubeUrl.trim() || `YouTube Transcript`,
        originalFileUrl: youtubeUrl.trim() || undefined,
        originalMimeType: 'video/youtube',
        contentSummary: extractedAiText
          ? `${verifiedTranscript}\n\n---\n### Structured Lecture Synthesis\n${extractedAiText}`
          : verifiedTranscript,
      });
      setYoutubeUrl('');
      setTranscriptOrOutline('');
      setTitleInput('');
      onClose();
    } catch (err: any) {
      setErrorText(err?.message || 'Failed to ingest YouTube lecture.');
    } finally {
      setAnalyzing(false);
      setStatusMessage('');
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
    setStatusMessage(
      mode === 'photo'
        ? `Auto-detecting JEE subject & chapter and running Handwritten Notes Scan on ${file.name}...`
        : `Parsing ${file.name} via local pdf.js worker & storing binary in IndexedDB...`
    );

    try {
      const reader = new FileReader();
      const dataUrlPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          resolve(String(reader.result || ''));
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const fullDataUrl = await dataUrlPromise;
      const base64Data = fullDataUrl.split(',')[1] || '';

      let clientPdfText = '';
      let pdfPageCount = 1;
      let ocrNotesSummary = '';

      if (mode === 'pdf' && file.name.toLowerCase().endsWith('.pdf')) {
        const extractedPdf = await extractPdfTextAndMetadataWithPdfJs(
          file,
          (pct, cur, total) =>
            setStatusMessage(`Extracting PDF page ${cur}/${total} (${pct}%)...`)
        );
        if (extractedPdf.extractionError) {
          setErrorText(extractedPdf.extractionError);
          setAnalyzing(false);
          setStatusMessage('');
          return;
        }
        clientPdfText = extractedPdf.extractedText;
        pdfPageCount = extractedPdf.pageCount;

        if (extractedPdf.scannedPageNumbers.length > 0) {
          setStatusMessage(
            `Running vision OCR on ${Math.min(60, extractedPdf.scannedPageNumbers.length)} scanned page(s)...`
          );
          const { ocrTextByPage } = await extractScannedPdfPagesViaOcr(
            file,
            extractedPdf.scannedPageNumbers,
            (done, total) =>
              setStatusMessage(`Running vision OCR on scanned PDF pages (${done}/${total})...`)
          );
          if (ocrTextByPage.size > 0) {
            const existingBlocks = new Map<number, string>();
            for (const block of clientPdfText.split(/\n{2,}/)) {
              const m = /^\[Page\s+(\d+)\]/i.exec(block.trim());
              if (m) existingBlocks.set(Number(m[1]), block.trim());
            }
            for (const [pgNum, txt] of ocrTextByPage.entries()) {
              existingBlocks.set(pgNum, txt);
            }
            clientPdfText = Array.from(existingBlocks.entries())
              .sort((a, b) => a[0] - b[0])
              .map((entry) => entry[1])
              .join('\n\n');
            ocrNotesSummary = `Vision OCR completed on ${ocrTextByPage.size} scanned page(s).`;
          }
        }
      }

      const detectedMime = file.type || (mode === 'pdf' ? 'application/pdf' : 'image/jpeg');
      const docId = `idb-doc-${Date.now()}`;
      await saveDocumentToIndexedDb({
        id: docId,
        userId: 'active_user',
        file,
        title: file.name,
        mimeType: detectedMime,
        dataUrl: fullDataUrl,
        extractedText: clientPdfText,
        pageCount: pdfPageCount,
        sizeBytes: file.size,
        createdAt: new Date().toISOString(),
      });

      // Best-effort owner-scoped Cloud Storage upload when bucket is configured
      try {
        const ticket = await requestSignedCloudStorageUrl({
          fileName: file.name,
          mimeType: detectedMime,
          operation: 'upload',
          sizeBytes: file.size,
        });
        if (ticket.ok && ticket.storageConfigured && ticket.signedUrl && ticket.assetId) {
          const putRes = await fetch(ticket.signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': detectedMime },
            body: file,
          });
          if (putRes.ok) {
            await confirmCloudUpload(ticket.assetId);
          }
        }
      } catch {
        // Cloud Storage optional in local dev; IndexedDB holds full document safely
      }

      const fileStem = file.name.replace(/\.[^/.]+$/, '');
      const initialDetection = detectJeeSubjectAndChapter(
        `${fileStem} ${clientPdfText.slice(0, 2000)}`,
        titleInput
      );

      let aiText = '';
      if (mode === 'photo' || clientPdfText.trim().length < 80) {
        const { ok, data } = await apiFetchWithAuth<{ text?: string }>(
          '/api/ai/analyze',
          {
            mediaBase64: base64Data.slice(0, 600000),
            mimeType: detectedMime,
            sourceType: mode,
            prompt: `Automatically identify whether this material belongs to JEE Physics, Chemistry, or Mathematics and which chapter it covers, then extract concise notes for "${initialDetection.chapter}" from ${file.name}.\n\nExtracted Text Context:\n${clientPdfText.slice(0, 4000)}`,
          }
        );
        aiText = ok ? data.text || '' : '';
      }

      const finalDetection = detectJeeSubjectAndChapter(
        `${fileStem} ${clientPdfText.slice(0, 2000)} ${aiText}`,
        titleInput
      );

      await onAddMaterial({
        title: titleInput.trim() || finalDetection.chapter || file.name,
        subject: finalDetection.subject,
        chapter: finalDetection.chapter,
        sourceType: mode,
        sourceRef: file.name,
        originalFileUrl: fullDataUrl,
        originalMimeType: detectedMime,
        contentSummary: clientPdfText
          ? aiText
            ? `${clientPdfText}\n\n---\n### AI Extracted Notes\n${aiText}`
            : ocrNotesSummary
            ? `${clientPdfText}\n\n<!-- ${ocrNotesSummary} -->`
            : clientPdfText
          : aiText ||
            `**${finalDetection.chapter}** (${finalDetection.subject}): IndexedDB-stored document (${pdfPageCount} pages) from ${file.name}. Needs OCR or text extraction.`,
      });
      setTitleInput('');
      onClose();
    } catch (err: any) {
      setErrorText(err?.message || 'Could not analyze uploaded file.');
    } finally {
      setAnalyzing(false);
      setStatusMessage('');
    }
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim()) {
      setErrorText('Please paste your study text, handwritten transcription, or formulas first.');
      return;
    }
    setAnalyzing(true);
    setStatusMessage(
      'Auto-identifying JEE subject & chapter and structuring your notes into full detailed pages, flashcards & mind map...'
    );
    try {
      const detected = detectJeeSubjectAndChapter(pastedText, titleInput);
      await onAddMaterial({
        title: titleInput.trim() || detected.chapter,
        subject: detected.subject,
        chapter: detected.chapter,
        sourceType: 'text',
        sourceRef: 'Uploaded Notes',
        contentSummary: pastedText.trim(),
      });
      setTitleInput('');
      setPastedText('');
      onClose();
    } finally {
      setAnalyzing(false);
      setStatusMessage('');
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
    setStatusMessage(`Auto-detecting subject & importing "${file.name}" from Google Workspace...`);
    try {
      let summary = `**${file.name}** imported from Google Drive.`;
      if (file.mimeType.includes('document')) {
        const docContent = await readGoogleDocContent(file.id);
        summary = docContent.text;
      }
      const detected = detectJeeSubjectAndChapter(`${file.name} ${summary}`, titleInput);
      await onAddMaterial({
        title: titleInput.trim() || file.name,
        subject: detected.subject,
        chapter: detected.chapter,
        sourceType: 'drive',
        sourceRef: file.id,
        contentSummary: summary,
      });
      onClose();
    } catch (err: any) {
      setErrorText(err?.message || 'Failed to import file from Google Drive/Docs.');
    } finally {
      setAnalyzing(false);
      setStatusMessage('');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add Material"
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-[640px] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
              Add Study Material
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload PDFs, handwritten note photos (OCR), or up-to-12-hour YouTube marathon lectures — Subject &amp; Chapter are identified automatically
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Add Material modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auto-Subject & Chapter Identification Row (No manual Physics/Chemistry/Math selector) */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EEF2FF] text-[#4F46E5] font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              {hasTypedContext
                ? liveDetected.confidenceLabel
                : 'AI Auto-Identifies Subject & JEE Chapter'}
            </span>
          </div>
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="Optional: Custom title or topic hint (auto-detected from upload)"
            className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
          />
        </div>


        {/* Top Source Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto">
          {[
            { id: 'pdf', label: 'PDF Document', icon: FileText },
            { id: 'photo', label: 'Handwritten Photo (OCR)', icon: ImageIcon },
            { id: 'youtube', label: 'YouTube (Up to 12h)', icon: Youtube },
            { id: 'text', label: 'Paste Notes / Outline', icon: TypeIcon },
            { id: 'drive', label: 'Google Drive / Docs', icon: FolderOpen },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
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
          <div className="space-y-3.5">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[220px]">
                <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="Paste YouTube lecture or marathon URL (e.g., https://youtube.com/watch?v=...)"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                />
              </div>
              <button
                type="button"
                onClick={handleAnalyzeYouTube}
                disabled={analyzing}
                className="px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white font-semibold text-sm transition-colors cursor-pointer shrink-0"
              >
                {analyzing ? 'Extracting...' : 'Extract Lecture'}
              </button>
            </div>

            {/* Lecture Duration Selector up to 12 Hours */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                Lecture Length / Marathon Mode:
              </span>
              <div className="flex items-center gap-1.5">
                {[
                  { hrs: 1, label: '1h Lecture' },
                  { hrs: 3, label: '3h One-Shot' },
                  { hrs: 6, label: '6h Revision' },
                  { hrs: 12, label: '12h Full Marathon' },
                ].map((d) => (
                  <button
                    key={d.hrs}
                    type="button"
                    onClick={() => setLectureDurationHours(d.hrs)}
                    className={`px-2.5 py-1 rounded-lg font-semibold border cursor-pointer ${
                      lectureDurationHours === d.hrs
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={3}
              value={transcriptOrOutline}
              onChange={(e) => setTranscriptOrOutline(e.target.value)}
              placeholder="Optional: Paste lecture chapters, timestamps, or key topics covered in the video for instant detailed note & mind-map generation..."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 text-xs"
            />
          </div>
        )}

        {activeTab === 'pdf' && (
          <div className="space-y-3">
            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-[#4F46E5] transition-colors cursor-pointer bg-slate-50/60 dark:bg-slate-800/40">
              <FileText className="w-8 h-8 text-[#4F46E5] mb-2" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Upload JEE Chapter PDF or Handwritten Scan (up to 60 pages)
              </span>
              <span className="text-xs text-slate-500 mt-1 text-center">
                Automatically generates Full Detailed Notes, Original PDF Viewer, Mind Map, Flashcards, Formula Book &amp; Chapter Quiz
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
                Upload Handwritten Notes Photo for Smart Extraction
              </span>
              <span className="text-xs text-slate-500 mt-1 text-center">
                Reads your handwriting, formats mathematical equations cleanly, and lets you switch between 4 realistic handwriting fonts
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
            <textarea
              rows={5}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste your JEE notes, handwritten transcription, reactions, or derivations here (supports $...$ equations and **bold** highlights)..."
              className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs leading-relaxed"
            />
            <button
              type="button"
              onClick={handlePasteSubmit}
              disabled={analyzing}
              className="px-5 py-2.5 rounded-xl bg-[#4F46E5] text-white text-xs font-semibold hover:bg-[#4338CA] cursor-pointer"
            >
              Generate Study Bundle (Notes, Mind Map &amp; Flashcards)
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

        {/* ONLY show progress bar when analyzing === true */}
        {analyzing && (
          <div className="px-4 py-3.5 rounded-xl bg-[#EEF2FF]/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-[#4F46E5] border-t-transparent animate-spin shrink-0" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {statusMessage || 'Analyzing material...'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAnalyzing(false);
                setStatusMessage('');
              }}
              className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {errorText && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
            {errorText}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 2. Study Tools Slide-Over Drawer (Desmos Graphing Calculator + Offline Scientific Calculator)
// ============================================================================
interface StudyToolsDrawerProps {
  isOpen: boolean;
  initialTab?: 'Calculator' | 'Units' | 'Statistics' | 'Formulas' | 'Graph';
  onClose: () => void;
}

interface GraphEquationItem {
  id: string;
  expr: string;
  color: string;
  visible: boolean;
  showDerivative: boolean;
}

const GRAPH_COLORS = ['#4F46E5', '#059669', '#DC2626', '#D97706', '#7C3AED'];

export const StudyToolsDrawer: React.FC<StudyToolsDrawerProps> = ({
  isOpen,
  initialTab = 'Graph',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    'Calculator' | 'Units' | 'Statistics' | 'Formulas' | 'Graph'
  >(initialTab);

  // Desmos-Inspired Multi-Equation State
  const [equations, setEquations] = useState<GraphEquationItem[]>([
    {
      id: 'eq-1',
      expr: 'y = a * x^2 - 4',
      color: '#4F46E5',
      visible: true,
      showDerivative: false,
    },
    {
      id: 'eq-2',
      expr: 'y = m * x + c',
      color: '#059669',
      visible: true,
      showDerivative: false,
    },
  ]);
  const [sliderParams, setSliderParams] = useState<Record<string, number>>({
    a: 1,
    b: 1,
    c: -1,
    m: 1.5,
    k: 1,
  });
  const [animatingParam, setAnimatingParam] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<GraphSpecialPoint | null>(null);
  const [showTableOfValues, setShowTableOfValues] = useState<boolean>(false);
  const [tableXValues, setTableXValues] = useState<number[]>([-2, -1, 0, 1, 2]);

  const [xMin, setXMin] = useState(-10);
  const [xMax, setXMax] = useState(10);
  const [yMin, setYMin] = useState(-10);
  const [yMax, setYMax] = useState(10);
  const [zoomPct, setZoomPct] = useState(100);
  const [panMode, setPanMode] = useState(true);

  // Offline Scientific Calculator State
  const [calcExpr, setCalcExpr] = useState('2 * sin(pi / 6) + sqrt(16)');
  const [calcResult, setCalcResult] = useState<string>('5');
  const [angleMode, setAngleMode] = useState<'RAD' | 'DEG'>('RAD');
  const [calcSubMode, setCalcSubMode] = useState<'standard' | 'combinatorics' | 'matrix' | 'vectors'>('standard');

  // Combinatorics state
  const [combN, setCombN] = useState(10);
  const [combR, setCombR] = useState(3);

  // 3x3 Matrix state
  const [matrix3x3, setMatrix3x3] = useState<number[][]>([
    [2, -1, 3],
    [1, 4, -2],
    [0, 5, 1],
  ]);

  // 3D Vectors state
  const [vecA, setVecA] = useState<[number, number, number]>([2, 3, -1]);
  const [vecB, setVecB] = useState<[number, number, number]>([1, -2, 4]);

  // Units Converter State
  const [unitCategory, setUnitCategory] = useState<'Energy' | 'Pressure' | 'Angle'>('Energy');
  const [unitInputVal, setUnitInputVal] = useState<number>(1);

  // Statistics State
  const [statsRaw, setStatsRaw] = useState('12, 15, 18, 22, 25, 28');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Animate parameter slider if playing
  useEffect(() => {
    if (!animatingParam) return;
    const interval = setInterval(() => {
      setSliderParams((prev) => {
        const curr = prev[animatingParam] ?? 1;
        const next = curr >= 4 ? -4 : Number((curr + 0.2).toFixed(2));
        return { ...prev, [animatingParam]: next };
      });
    }, 120);
    return () => clearInterval(interval);
  }, [animatingParam]);

  if (!isOpen) return null;

  // Detect all active parameters across equations
  const activeParamNames = Array.from(
    new Set(equations.flatMap((eq) => detectEquationParameters(eq.expr)))
  );

  // Build SVG polyline points for graphing calculator
  const scaleFactor = zoomPct / 100;
  const effXMin = xMin / scaleFactor;
  const effXMax = xMax / scaleFactor;
  const effYMin = yMin / scaleFactor;
  const effYMax = yMax / scaleFactor;

  const svgWidth = 560;
  const svgHeight = 350;
  const pad = 32;
  const plotW = svgWidth - pad * 2;
  const plotH = svgHeight - pad * 2;

  const toScreenX = (x: number) =>
    pad + ((x - effXMin) / Math.max(0.001, effXMax - effXMin)) * plotW;
  const toScreenY = (y: number) =>
    pad + plotH - ((y - effYMin) / Math.max(0.001, effYMax - effYMin)) * plotH;

  const parsedAngleMode: AngleMode = angleMode === 'DEG' ? 'deg' : 'rad';

  const buildCurvePath = (expr: string, isDerivative = false) => {
    const pts: string[] = [];
    const steps = 180;
    for (let i = 0; i <= steps; i++) {
      const x = effXMin + (i / steps) * (effXMax - effXMin);
      const y = isDerivative
        ? evaluateDerivative(expr, x, sliderParams, parsedAngleMode)
        : evaluateMathFunction(expr, x, sliderParams, parsedAngleMode);
      if (y !== null && y >= effYMin * 1.4 && y <= effYMax * 1.4) {
        const sx = toScreenX(x).toFixed(1);
        const sy = toScreenY(y).toFixed(1);
        pts.push(`${pts.length === 0 ? 'M' : 'L'} ${sx} ${sy}`);
      }
    }
    return pts.join(' ');
  };

  // Compute Desmos-style Roots, Extrema & Intersections
  const specialPoints: GraphSpecialPoint[] = [];
  const visibleEqs = equations.filter((e) => e.visible && e.expr.trim());
  visibleEqs.forEach((eq) => {
    const pts = findRootsAndExtrema(eq.expr, effXMin, effXMax, sliderParams, parsedAngleMode);
    pts.forEach((p) => {
      if (p.y >= effYMin && p.y <= effYMax) {
        specialPoints.push(p);
      }
    });
  });
  if (visibleEqs.length >= 2) {
    const inters = findCurveIntersections(
      visibleEqs[0].expr,
      visibleEqs[1].expr,
      effXMin,
      effXMax,
      sliderParams,
      parsedAngleMode
    );
    inters.forEach((p) => {
      if (p.y >= effYMin && p.y <= effYMax) {
        specialPoints.push(p);
      }
    });
  }

  const evaluateScientificExpr = (raw: string) => {
    const res = evaluateMathDetailed(raw, 1, {}, parsedAngleMode);
    setCalcResult(
      res.value !== null ? String(Number(res.value.toFixed(6))) : res.error || 'Syntax Error'
    );
  };

  const statsNumbers = statsRaw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  const statsSummary = calculateStatistics(statsNumbers);
  const vecOps = computeVectorOps(vecA, vecB);
  const detValue = computeDeterminant3x3(matrix3x3);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Study Tools"
      className="fixed inset-0 z-50 bg-slate-900/35 flex justify-end"
    >
      <div className="w-full max-w-[700px] bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 shrink-0 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
              Study Tools &amp; Desmos Graphing Lab
            </h2>
            <p className="text-xs text-slate-500">
              Interactive parameter sliders, roots/extrema/intersections &amp; offline scientific calculator
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Study Tools"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5 Tabs */}
        <div className="px-6 pt-2.5 shrink-0 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
          {[
            { id: 'Graph', icon: TrendingUp },
            { id: 'Calculator', icon: Calculator },
            { id: 'Units', icon: Ruler },
            { id: 'Statistics', icon: BarChart2 },
            { id: 'Formulas', icon: Sigma },
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
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {activeTab === 'Graph' && (
            <div className="space-y-4">
              {/* Desmos Presets & Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="font-bold text-slate-500">Presets:</span>
                  {[
                    {
                      label: 'Parabola + Line',
                      eqs: [
                        { id: 'eq-1', expr: 'y = a * x^2 - 4', color: '#4F46E5', visible: true, showDerivative: false },
                        { id: 'eq-2', expr: 'y = m * x + c', color: '#059669', visible: true, showDerivative: false },
                      ],
                    },
                    {
                      label: 'SHM Wave y = a·sin(k·x)',
                      eqs: [
                        { id: 'eq-1', expr: 'y = a * sin(k * x)', color: '#4F46E5', visible: true, showDerivative: true },
                      ],
                    },
                    {
                      label: 'Cubic Extrema',
                      eqs: [
                        { id: 'eq-1', expr: 'y = x^3 - 3 * x', color: '#DC2626', visible: true, showDerivative: true },
                      ],
                    },
                  ].map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setEquations(p.eqs);
                        setSelectedPoint(null);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 font-semibold cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowTableOfValues((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border cursor-pointer ${
                      showTableOfValues
                        ? 'bg-[#EEF2FF] text-[#4F46E5] border-indigo-200'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>x vs f(x) Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextColor = GRAPH_COLORS[equations.length % GRAPH_COLORS.length];
                      setEquations((prev) => [
                        ...prev,
                        {
                          id: `eq-${Date.now()}`,
                          expr: 'y = cos(x)',
                          color: nextColor,
                          visible: true,
                          showDerivative: false,
                        },
                      ]);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Equation</span>
                  </button>
                </div>
              </div>

              {/* Multi-Equation List */}
              <div className="space-y-2">
                {equations.map((eq, idx) => {
                  const syntax = eq.expr.trim() ? validateMathSyntax(eq.expr) : { valid: true };
                  return (
                    <div
                      key={eq.id}
                      className={`p-2 rounded-xl border bg-slate-50/50 dark:bg-slate-800/50 space-y-1 ${
                        syntax.valid
                          ? 'border-slate-200 dark:border-slate-700'
                          : 'border-rose-300 bg-rose-50/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEquations((prev) =>
                              prev.map((item) =>
                                item.id === eq.id ? { ...item, visible: !item.visible } : item
                              )
                            )
                          }
                          aria-label={`Toggle visibility for equation ${idx + 1}`}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold cursor-pointer shrink-0"
                          style={{ backgroundColor: eq.visible ? eq.color : '#94A3B8' }}
                        >
                          {eq.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>

                        <input
                          type="text"
                          value={eq.expr}
                          onChange={(e) =>
                            setEquations((prev) =>
                              prev.map((item) =>
                                item.id === eq.id ? { ...item, expr: e.target.value } : item
                              )
                            )
                          }
                          placeholder="e.g., y = a * x^2 - 4"
                          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setEquations((prev) =>
                              prev.map((item) =>
                                item.id === eq.id
                                  ? { ...item, showDerivative: !item.showDerivative }
                                  : item
                              )
                            )
                          }
                          title="Toggle d/dx Derivative Curve Overlay"
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border cursor-pointer ${
                            eq.showDerivative
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          d/dx
                        </button>

                        {equations.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setEquations((prev) => prev.filter((item) => item.id !== eq.id))
                            }
                            aria-label="Remove equation"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {!syntax.valid && syntax.error && (
                        <div className="text-[10px] font-semibold text-rose-700 pl-8">
                          Syntax error: {syntax.error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desmos Interactive Parameter Sliders (a, b, c, m, k) */}
              {activeParamNames.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#EEF2FF]/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 space-y-2.5">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    Interactive Parameter Sliders ({activeParamNames.join(', ')})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeParamNames.map((param) => {
                      const val = sliderParams[param] ?? 1;
                      const isPlaying = animatingParam === param;
                      return (
                        <div
                          key={param}
                          className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2.5 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => setAnimatingParam(isPlaying ? null : param)}
                            aria-label={`Animate parameter ${param}`}
                            className="w-6 h-6 rounded-md bg-indigo-50 text-[#4F46E5] flex items-center justify-center cursor-pointer shrink-0"
                          >
                            {isPlaying ? (
                              <Pause className="w-3 h-3" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                          </button>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200 w-14">
                            {param} = {val}
                          </span>
                          <input
                            type="range"
                            min={-5}
                            max={5}
                            step={0.25}
                            value={val}
                            onChange={(e) =>
                              setSliderParams((prev) => ({
                                ...prev,
                                [param]: Number(e.target.value),
                              }))
                            }
                            className="flex-1 accent-[#4F46E5]"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dynamic x vs f(x) Table of Values */}
              {showTableOfValues && (
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Dynamic Table of Values: x vs f(x) &amp; f&apos;(x)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setTableXValues((prev) => [
                          ...prev,
                          (prev[prev.length - 1] ?? 2) + 1,
                        ])
                      }
                      className="text-[11px] font-bold text-[#4F46E5] hover:underline cursor-pointer"
                    >
                      + Add x Row
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-500">
                          <th className="py-1.5 px-2">x</th>
                          <th className="py-1.5 px-2">f₁(x)</th>
                          <th className="py-1.5 px-2">f₁&apos;(x) (Slope)</th>
                          {equations[1] && <th className="py-1.5 px-2">f₂(x)</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tableXValues.map((xv, rIdx) => {
                          const y1 = evaluateMathFunction(
                            equations[0]?.expr || 'x',
                            xv,
                            sliderParams,
                            parsedAngleMode
                          );
                          const dy1 = evaluateDerivative(
                            equations[0]?.expr || 'x',
                            xv,
                            sliderParams,
                            parsedAngleMode
                          );
                          const y2 = equations[1]
                            ? evaluateMathFunction(
                                equations[1].expr,
                                xv,
                                sliderParams,
                                parsedAngleMode
                              )
                            : null;
                          return (
                            <tr key={rIdx}>
                              <td className="py-1 px-2">
                                <input
                                  type="number"
                                  value={xv}
                                  onChange={(e) => {
                                    const next = [...tableXValues];
                                    next[rIdx] = Number(e.target.value);
                                    setTableXValues(next);
                                  }}
                                  className="w-14 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-center"
                                />
                              </td>
                              <td className="py-1 px-2 font-bold text-[#4F46E5]">
                                {y1 !== null ? Number(y1.toFixed(4)) : 'undef'}
                              </td>
                              <td className="py-1 px-2 text-amber-700">
                                {dy1 !== null ? Number(dy1.toFixed(4)) : 'undef'}
                              </td>
                              {equations[1] && (
                                <td className="py-1 px-2 font-bold text-emerald-700">
                                  {y2 !== null ? Number(y2.toFixed(4)) : 'undef'}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Range Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">x:</span>
                  <input
                    type="number"
                    value={xMin}
                    onChange={(e) => setXMin(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center tabular-nums"
                  />
                  <span>to</span>
                  <input
                    type="number"
                    value={xMax}
                    onChange={(e) => setXMax(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center tabular-nums"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">y:</span>
                  <input
                    type="number"
                    value={yMin}
                    onChange={(e) => setYMin(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center tabular-nums"
                  />
                  <span>to</span>
                  <input
                    type="number"
                    value={yMax}
                    onChange={(e) => setYMax(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center tabular-nums"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setZoomPct(100);
                    setSelectedPoint(null);
                  }}
                  className="px-3 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Reset View
                </button>
              </div>

              {/* Coordinate Graph Canvas with Clickable Roots, Extrema & Intersections */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500">
                    Click any gray key-point dot on the curve to inspect exact <strong>Roots</strong>,{' '}
                    <strong>Extrema</strong>, or <strong>Intersections</strong>:
                  </span>
                  {selectedPoint && (
                    <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-[#4F46E5] font-mono font-bold">
                      {selectedPoint.label}
                    </span>
                  )}
                </div>

                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-[330px] select-none"
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
                              y={toScreenY(0) + 15}
                              textAnchor="middle"
                              fontSize="10"
                              fill="#475569"
                            >
                              {tick}
                            </text>
                            <text
                              x={toScreenX(0) - 8}
                              y={sy + 3}
                              textAnchor="end"
                              fontSize="10"
                              fill="#475569"
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

                  {/* Plotted Function Curves & Optional d/dx Derivative Overlays */}
                  {visibleEqs.map((eq) => {
                    const pathD = buildCurvePath(eq.expr, false);
                    const derivPathD = eq.showDerivative ? buildCurvePath(eq.expr, true) : '';
                    return (
                      <g key={eq.id}>
                        {pathD && (
                          <path
                            d={pathD}
                            fill="none"
                            stroke={eq.color}
                            strokeWidth="2.6"
                            strokeLinecap="round"
                          />
                        )}
                        {derivPathD && (
                          <path
                            d={derivPathD}
                            fill="none"
                            stroke="#D97706"
                            strokeWidth="1.8"
                            strokeDasharray="5,4"
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* Desmos-style Clickable Key Points (Roots, Extrema, Intersections) */}
                  {specialPoints.slice(0, 18).map((pt, idx) => {
                    const cx = toScreenX(pt.x);
                    const cy = toScreenY(pt.y);
                    const isSelected =
                      selectedPoint &&
                      Math.abs(selectedPoint.x - pt.x) < 0.05 &&
                      Math.abs(selectedPoint.y - pt.y) < 0.05;
                    return (
                      <g
                        key={idx}
                        onClick={() => setSelectedPoint(pt)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isSelected ? 6 : 4.5}
                          fill={isSelected ? '#4F46E5' : '#64748B'}
                          stroke="#FFFFFF"
                          strokeWidth="1.8"
                        />
                        {isSelected && (
                          <g>
                            <rect
                              x={Math.min(svgWidth - 155, Math.max(8, cx - 70))}
                              y={Math.max(10, cy - 30)}
                              width="145"
                              height="20"
                              rx="5"
                              fill="#0F172A"
                            />
                            <text
                              x={Math.min(svgWidth - 82, Math.max(80, cx))}
                              y={Math.max(24, cy - 16)}
                              textAnchor="middle"
                              fontSize="10"
                              fontWeight="bold"
                              fill="#FFFFFF"
                            >
                              {pt.label}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Bottom Key Points Chips & Zoom Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {specialPoints.slice(0, 4).map((pt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedPoint(pt)}
                        className="px-2 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 text-[10px] font-mono font-semibold text-slate-700 cursor-pointer"
                      >
                        {pt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
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
            </div>
          )}

          {activeTab === 'Calculator' && (
            <div className="space-y-4">
              {/* Sub-mode switcher: Standard Keypad | nCr/nPr | 3x3 Matrix | 3D Vectors */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {(
                    [
                      { id: 'standard', label: 'Trig & Log Keypad' },
                      { id: 'combinatorics', label: 'nCr · nPr · n!' },
                      { id: 'matrix', label: '3×3 Matrix Det' },
                      { id: 'vectors', label: '3D Vectors (A·B, A×B)' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCalcSubMode(m.id)}
                      className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                        calcSubMode === m.id
                          ? 'bg-[#4F46E5] text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
                  {(['RAD', 'DEG'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAngleMode(mode)}
                      className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                        angleMode === mode ? 'bg-indigo-600 text-white' : 'text-slate-600'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {calcSubMode === 'standard' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={calcExpr}
                      onChange={(e) => setCalcExpr(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => evaluateScientificExpr(calcExpr)}
                      className="px-4 py-2.5 rounded-xl bg-[#4F46E5] text-white text-xs font-semibold cursor-pointer"
                    >
                      Evaluate
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Result ({angleMode}):</span>
                    <span className="font-mono font-bold text-xl text-[#4F46E5] tabular-nums">
                      {calcResult}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                    {[
                      'sin(pi/6)',
                      'cos(pi/3)',
                      'tan(pi/4)',
                      'asin(0.5)',
                      'acos(0.5)',
                      'atan(1)',
                      'ln(e)',
                      'log(100)',
                      'sqrt(2)',
                      '3^4',
                      'pi',
                      'abs(-9.8)',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setCalcExpr(preset);
                          evaluateScientificExpr(preset);
                        }}
                        className="p-2.5 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {calcSubMode === 'combinatorics' && (
                <div className="p-4 rounded-xl border border-slate-200 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">n (Total items)</label>
                      <input
                        type="number"
                        min={0}
                        max={170}
                        value={combN}
                        onChange={(e) => setCombN(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">r (Selected items)</label>
                      <input
                        type="number"
                        min={0}
                        max={170}
                        value={combR}
                        onChange={(e) => setCombR(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100">
                      <div className="text-[11px] text-slate-500">Combination (^nC_r)</div>
                      <div className="font-mono font-extrabold text-base text-[#4F46E5] mt-0.5">
                        {computeCombination(combN, combR)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                      <div className="text-[11px] text-slate-500">Permutation (^nP_r)</div>
                      <div className="font-mono font-extrabold text-base text-emerald-700 mt-0.5">
                        {computePermutation(combN, combR)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100">
                      <div className="text-[11px] text-slate-500">Factorial (n!)</div>
                      <div className="font-mono font-extrabold text-base text-amber-800 mt-0.5">
                        {computeFactorial(Math.min(20, combN))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {calcSubMode === 'matrix' && (
                <div className="p-4 rounded-xl border border-slate-200 space-y-4 text-xs">
                  <div className="font-bold text-slate-800">
                    3×3 Matrix Determinant Calculator (|A|)
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-w-xs">
                    {matrix3x3.map((row, r) =>
                      row.map((val, c) => (
                        <input
                          key={`${r}-${c}`}
                          type="number"
                          value={val}
                          onChange={(e) => {
                            const copy = matrix3x3.map((rw) => [...rw]);
                            copy[r][c] = Number(e.target.value);
                            setMatrix3x3(copy);
                          }}
                          className="px-2.5 py-2 rounded-lg border border-slate-200 font-mono text-center font-bold"
                        />
                      ))
                    )}
                  </div>
                  <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Determinant det(A):</span>
                    <span className="font-mono font-extrabold text-lg text-[#4F46E5]">
                      {detValue}
                    </span>
                  </div>
                </div>
              )}

              {calcSubMode === 'vectors' && (
                <div className="p-4 rounded-xl border border-slate-200 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="font-bold text-slate-700 mb-1">
                        Vector A (Aₓ, Aᵧ, A_z)
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <input
                            key={i}
                            type="number"
                            value={vecA[i]}
                            onChange={(e) => {
                              const next: [number, number, number] = [...vecA] as any;
                              next[i] = Number(e.target.value);
                              setVecA(next);
                            }}
                            className="px-2 py-1.5 rounded-lg border border-slate-200 font-mono text-center"
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-700 mb-1">
                        Vector B (Bₓ, Bᵧ, B_z)
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <input
                            key={i}
                            type="number"
                            value={vecB[i]}
                            onChange={(e) => {
                              const next: [number, number, number] = [...vecB] as any;
                              next[i] = Number(e.target.value);
                              setVecB(next);
                            }}
                            className="px-2 py-1.5 rounded-lg border border-slate-200 font-mono text-center"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 font-mono">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500">Dot Product (A · B)</div>
                      <div className="font-bold text-base text-[#4F46E5]">{vecOps.dot}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500">Cross Product (A × B)</div>
                      <div className="font-bold text-base text-emerald-700">
                        ({vecOps.cross.join(', ')})
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                  Input Value (
                  {unitCategory === 'Energy'
                    ? 'Electron-Volts (eV)'
                    : unitCategory === 'Pressure'
                    ? 'Atmospheres (atm)'
                    : 'Degrees (°)'}
                  )
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
                  <div className="font-mono font-bold text-base tabular-nums">
                    {statsSummary.mean}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">Median</div>
                  <div className="font-mono font-bold text-base tabular-nums">
                    {statsSummary.median}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">Variance (σ²)</div>
                  <div className="font-mono font-bold text-base tabular-nums">
                    {statsSummary.variance}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">Std Dev (σ)</div>
                  <div className="font-mono font-bold text-base tabular-nums">
                    {statsSummary.stdDev}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Formulas' && (
            <div className="space-y-3">
              {[
                {
                  subj: 'Physics · Rotational Mechanics',
                  title: 'Rolling Without Slipping Acceleration',
                  eq: '$$a = \\frac{g\\sin\\theta}{1 + \\frac{I_{cm}}{mR^2}}$$',
                },
                {
                  subj: 'Chemistry · Electrochemistry',
                  title: 'Nernst Equation at 298 K',
                  eq: '$$E_{\\text{cell}} = E^\\circ_{\\text{cell}} - \\frac{0.0591}{n}\\log_{10} Q$$',
                },
                {
                  subj: 'Physics · Electrostatics',
                  title: 'Gauss Law & Electric Flux',
                  eq: '$$\\Phi_E = \\oint \\vec{E}\\cdot d\\vec{A} = \\frac{q_{\\text{enclosed}}}{\\varepsilon_0}$$',
                },
                {
                  subj: 'Mathematics · Calculus',
                  title: 'King’s Property of Definite Integrals',
                  eq: '$$\\int_a^b f(x)\\,dx = \\int_a^b f(a + b - x)\\,dx$$',
                },
              ].map((f, i) => (
                <div key={i} className="p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-[11px] font-semibold text-[#4F46E5]">{f.subj}</div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{f.title}</div>
                  <div className="text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg">
                    <MathRichText content={f.eq} />
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
      const res = await apiFetchWithAuth<{ audioUrl?: string }>('/api/ai/music', {
        prompt: musicPrompt,
        durationType,
      });
      if (!res.ok || !res.data.audioUrl) {
        throw new Error(
          !res.ok
            ? `[${res.error.errorCode}] ${res.error.message}`
            : 'Could not generate focus track'
        );
      }
      setAudioUrl(res.data.audioUrl);
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
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

          {audioUrl && <audio controls src={audioUrl} className="w-full h-9 mt-2" />}
          {musicError && <p className="text-[11px] text-red-600">{musicError}</p>}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. Classroom Teacher Live Voice Tutor Modal
//    - 4 Teacher Personas: Hinglish IIT Faculty, Indian English Teacher, Pure Hindi, Pure English
//    - Step-by-step question solver that asks pedagogical check-in questions
//    - Word-by-word live paragraph streaming for Speaker (You) and Teacher
//    - Interruptible speech (Barge-In button or speaking stops AI output immediately)
//    - Persistent Voice Session History per chapter/material
// ============================================================================
export type VoiceTeacherPersonaId =
  | 'hinglish_faculty'
  | 'indian_english'
  | 'pure_hindi'
  | 'pure_english';

export interface VoiceTurnEntry {
  id: string;
  speaker: 'You' | 'Tutor';
  text: string;
  timestamp: string;
  streaming?: boolean;
  personaLabel?: string;
}

interface LiveVoiceTutorModalProps {
  isOpen: boolean;
  chapterTitle: string;
  materialContext?: string;
  onClose: () => void;
}

export const LiveVoiceTutorModal: React.FC<LiveVoiceTutorModalProps> = ({
  isOpen,
  chapterTitle,
  materialContext = '',
  onClose,
}) => {
  const storageKey = `learnmate_voice_history_${chapterTitle.replace(/\s+/g, '_').toLowerCase()}`;
  const [activeView, setActiveView] = useState<'live' | 'history'>('live');
  const [teacherPersona, setTeacherPersona] = useState<VoiceTeacherPersonaId>('hinglish_faculty');
  const [connected, setConnected] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [liveUserDraft, setLiveUserDraft] = useState('');
  const [turns, setTurns] = useState<VoiceTurnEntry[]>([]);
  const [voicePromptInput, setVoicePromptInput] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);
  const [voiceMuted, setVoiceMuted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const streamTimerRef = useRef<number | null>(null);
  const userStreamTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const PERSONA_OPTIONS: {
    id: VoiceTeacherPersonaId;
    label: string;
    subtitle: string;
    langCode: string;
  }[] = [
    {
      id: 'hinglish_faculty',
      label: 'Hinglish IIT Faculty',
      subtitle: 'Warm Indian English + Hindi Coaching Style',
      langCode: 'en-IN',
    },
    {
      id: 'indian_english',
      label: 'Indian English Teacher',
      subtitle: 'Articulate Indian Professor Accent',
      langCode: 'en-IN',
    },
    {
      id: 'pure_hindi',
      label: 'Pure Hindi (हिंदी शिक्षक)',
      subtitle: 'Complete Classroom Explanation in Hindi',
      langCode: 'hi-IN',
    },
    {
      id: 'pure_english',
      label: 'Pure English',
      subtitle: 'Standard Academic English Professor',
      langCode: 'en-US',
    },
  ];

  const activePersonaObj =
    PERSONA_OPTIONS.find((p) => p.id === teacherPersona) || PERSONA_OPTIONS[0];

  // Load saved voice history for this chapter
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setTurns(JSON.parse(saved));
      } else {
        setTurns([]);
      }
    } catch {
      setTurns([]);
    }
  }, [isOpen, storageKey]);

  // Persist voice history whenever turns update
  useEffect(() => {
    if (!isOpen || turns.length === 0) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(turns.slice(-40)));
    } catch {
      // ignore storage quota
    }
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, isOpen, storageKey]);

  const [retryNonce, setRetryNonce] = useState(0);
  const reconnectTimerRef = useRef<number | null>(null);

  // Connect to /api/live authenticated WebSocket with exponential backoff
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    let activeWs: WebSocket | null = null;
    let attempt = 0;

    const connectSocket = async () => {
      if (cancelled) return;
      const token = await getFirebaseIdToken();
      if (cancelled) return;
      if (!token) {
        setStatusError('Sign in required to connect authenticated Live Voice Tutor.');
        setConnected(false);
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live`, [
        `learnmate-auth.${token}`,
      ]);
      activeWs = ws;
      wsRef.current = ws;
      registerActiveVoiceSocket(ws);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.status === 'connected') {
            attempt = 0;
            setConnected(true);
            setStatusError(null);
          }
          if (msg.inputTranscript) {
            appendWordChunkToTurn('You', msg.inputTranscript);
          }
          if (msg.outputTranscript) {
            appendWordChunkToTurn('Tutor', msg.outputTranscript);
          }
          if (msg.interrupted) {
            handleInterruptSpeech();
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        setConnected(false);
        setStatusError('Authenticated Live Voice connection interrupted.');
      };

      ws.onclose = (event) => {
        setConnected(false);
        if (cancelled) return;
        if (event.code !== 1000 && event.code !== 1005) {
          if (attempt < 3) {
            const delayMs = 1000 * Math.pow(2, attempt);
            attempt += 1;
            setStatusError(
              `Live Voice reconnecting in ${delayMs / 1000}s (attempt ${attempt}/3)...`
            );
            reconnectTimerRef.current = window.setTimeout(() => {
              void connectSocket();
            }, delayMs);
          } else {
            setStatusError(
              `Live Voice closed (${event.reason || `code ${event.code}`}). Click Retry Connection below.`
            );
          }
        }
      };
    };

    void connectSocket();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (activeWs) activeWs.close();
      stopAllTimersAndSpeech();
      setConnected(false);
      setMicActive(false);
    };
  }, [isOpen, retryNonce]);

  const stopAllTimersAndSpeech = () => {
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    if (userStreamTimerRef.current) {
      window.clearInterval(userStreamTimerRef.current);
      userStreamTimerRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setAiSpeaking(false);
  };

  // Barge-In / Interrupt handler
  const handleInterruptSpeech = () => {
    stopAllTimersAndSpeech();
    setTurns((prev) =>
      prev.map((t, i) => (i === prev.length - 1 ? { ...t, streaming: false } : t))
    );
  };

  const appendWordChunkToTurn = (speaker: 'You' | 'Tutor', chunk: string) => {
    setTurns((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker && last.streaming) {
        return [
          ...prev.slice(0, -1),
          { ...last, text: `${last.text} ${chunk}`.replace(/\s+/g, ' ').trim() },
        ];
      }
      return [
        ...prev,
        {
          id: `vt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          speaker,
          text: chunk.trim(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          streaming: true,
          personaLabel: speaker === 'Tutor' ? activePersonaObj.label : undefined,
        },
      ];
    });
  };

  // Stream a full paragraph word-by-word into the transcript & speak it like a real classroom teacher
  const streamUserAndTutorConversation = async (spokenUserText: string) => {
    if (!spokenUserText.trim()) return;
    handleInterruptSpeech();
    setStatusError(null);

    const userWords = spokenUserText.trim().split(/\s+/);
    const userTurnId = `vt-user-${Date.now()}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Stream speaker's words word-by-word in a paragraph
    setTurns((prev) => [
      ...prev,
      { id: userTurnId, speaker: 'You', text: '', timestamp: nowTime, streaming: true },
    ]);

    await new Promise<void>((resolve) => {
      let idx = 0;
      userStreamTimerRef.current = window.setInterval(() => {
        if (idx < userWords.length) {
          const nextWord = userWords[idx];
          idx++;
          setLiveUserDraft(userWords.slice(0, idx).join(' '));
          setTurns((prev) =>
            prev.map((t) =>
              t.id === userTurnId
                ? { ...t, text: `${t.text} ${nextWord}`.trim() }
                : t
            )
          );
        } else {
          if (userStreamTimerRef.current) window.clearInterval(userStreamTimerRef.current);
          userStreamTimerRef.current = null;
          setLiveUserDraft('');
          setTurns((prev) =>
            prev.map((t) => (t.id === userTurnId ? { ...t, streaming: false } : t))
          );
          resolve();
        }
      }, 45);
    });

    // 2. Fetch Classroom Teacher response tailored to the active teacherPersona
    setAiSpeaking(true);
    let replyText = '';
    try {
      const res = await apiFetchWithAuth<{ text?: string }>(
        '/api/ai/think',
        {
          prompt: spokenUserText,
          teacherPersona,
          isVoiceTeacher: true,
          language:
            teacherPersona === 'pure_hindi'
              ? 'Pure Hindi'
              : teacherPersona === 'hinglish_faculty'
              ? 'Hinglish'
              : 'English',
          context: materialContext || `Active Chapter: ${chapterTitle}`,
          contextMode: materialContext ? 'strict_material' : 'open_jee',
        }
      );
      if (!res.ok || !res.data.text) {
        setStatusError(
          (!res.ok ? res.error.message : '') ||
            `[${(!res.ok ? res.error.errorCode : undefined) || 'AI_SERVICE_UNAVAILABLE'}] Live AI Teacher is temporarily unavailable. Please click Retry.`
        );
        setAiSpeaking(false);
        return;
      }
      replyText = res.data.text;
    } catch (err: any) {
      setStatusError(err?.message || 'Network error reaching AI Voice Teacher.');
      setAiSpeaking(false);
      return;
    }

    // Speak aloud using browser speechSynthesis with matching Indian English / Hindi teacher accent
    if (!voiceMuted && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const cleanSpoken = replyText
          .replace(/\$\$[^$]+\$\$/g, ' equation ')
          .replace(/\$[^$]+\$/g, ' formula ')
          .replace(/[*#_`]/g, '');
        const utter = new SpeechSynthesisUtterance(cleanSpoken);
        utter.lang = activePersonaObj.langCode;
        utter.rate = 1.0;
        const voices = window.speechSynthesis.getVoices();
        const matchedVoice = voices.find((v) =>
          v.lang.toLowerCase().includes(activePersonaObj.langCode.toLowerCase())
        );
        if (matchedVoice) utter.voice = matchedVoice;
        window.speechSynthesis.speak(utter);
      } catch {
        // ignore speech synthesis error
      }
    }

    // 3. Stream Teacher response word-by-word in a cohesive paragraph
    const tutorWords = replyText.trim().split(/\s+/);
    const tutorTurnId = `vt-tutor-${Date.now()}`;
    const tutorTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setTurns((prev) => [
      ...prev,
      {
        id: tutorTurnId,
        speaker: 'Tutor',
        text: '',
        timestamp: tutorTime,
        streaming: true,
        personaLabel: activePersonaObj.label,
      },
    ]);

    let wIdx = 0;
    streamTimerRef.current = window.setInterval(() => {
      if (wIdx < tutorWords.length) {
        const w = tutorWords[wIdx];
        wIdx++;
        setTurns((prev) =>
          prev.map((t) =>
            t.id === tutorTurnId ? { ...t, text: `${t.text} ${w}`.trim() } : t
          )
        );
      } else {
        if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
        setAiSpeaking(false);
        setTurns((prev) =>
          prev.map((t) => (t.id === tutorTurnId ? { ...t, streaming: false } : t))
        );
      }
    }, 50);
  };

  const toggleMicrophone = async () => {
    if (micActive) {
      setMicActive(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      return;
    }

    handleInterruptSpeech();
    setStatusError(null);
    setMicActive(true);

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = activePersonaObj.langCode;
        recognitionRef.current = rec;

        rec.onresult = (event: any) => {
          let interim = '';
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const txt = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += txt;
            } else {
              interim += txt;
            }
          }
          if (interim) {
            setLiveUserDraft(interim);
          }
          if (finalTranscript.trim()) {
            setLiveUserDraft('');
            setMicActive(false);
            streamUserAndTutorConversation(finalTranscript.trim());
          }
        };

        rec.onerror = () => {
          setMicActive(false);
        };
        rec.onend = () => {
          setMicActive(false);
        };
        rec.start();
        return;
      } catch {
        // Fallback below if browser blocks SpeechRecognition
      }
    }

    setMicActive(false);
    streamUserAndTutorConversation(
      teacherPersona === 'pure_hindi'
        ? `सर, कृपया ${chapterTitle} का मुख्य सूत्र और संख्यात्मक प्रश्न हल करने की चरण-दर-चरण विधि समझाइए।`
        : teacherPersona === 'hinglish_faculty'
        ? `Sir, ${chapterTitle} ka core derivation aur JEE Advanced numerical solve karne ka step-by-step method samjhaiye.`
        : `Professor, please explain the core derivation and step-by-step numerical method for ${chapterTitle}.`
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voicePromptInput.trim()) return;
    const q = voicePromptInput.trim();
    setVoicePromptInput('');
    streamUserAndTutorConversation(q);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live Voice Tutor"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl p-6 space-y-4 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm ${
                aiSpeaking
                  ? 'bg-emerald-600 animate-pulse'
                  : micActive
                  ? 'bg-rose-600 animate-pulse'
                  : 'bg-[#4F46E5]'
              }`}
            >
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Live Classroom Voice Teacher · {chapterTitle}
              </h3>
              <p className="text-xs text-slate-500">
                {aiSpeaking
                  ? `${activePersonaObj.label} is explaining step-by-step (Click Interrupt or Mic to barge-in)`
                  : micActive
                  ? 'Listening to your question word-by-word...'
                  : `${activePersonaObj.label} — ${activePersonaObj.subtitle}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveView('live')}
                className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                  activeView === 'live'
                    ? 'bg-white dark:bg-slate-900 text-[#4F46E5] shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                Live Class
              </button>
              <button
                type="button"
                onClick={() => setActiveView('history')}
                className={`px-3 py-1 rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer ${
                  activeView === 'history'
                    ? 'bg-white dark:bg-slate-900 text-[#4F46E5] shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>History ({turns.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setVoiceMuted((m) => !m);
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
              }}
              aria-label="Toggle voice audio"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              {voiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Voice Tutor"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 4-Way Classroom Teacher Persona & Accent Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <span className="font-semibold text-slate-600 dark:text-slate-300 px-1">
            Teacher Voice &amp; Language Mode:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {PERSONA_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setTeacherPersona(p.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                  teacherPersona === p.id
                    ? 'bg-[#4F46E5] text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Voice Controls & Barge-In Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#EEF2FF]/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleMicrophone}
              className={`px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 shadow-sm cursor-pointer transition-all ${
                micActive
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-[#4F46E5] hover:bg-[#4338CA] text-white'
              }`}
            >
              {micActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{micActive ? 'Stop Listening' : 'Speak to Teacher (Start Talking)'}</span>
            </button>

            {aiSpeaking && (
              <button
                type="button"
                onClick={handleInterruptSpeech}
                className="px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Interrupt / Ask Follow-Up</span>
              </button>
            )}
          </div>

          {/* Quick Classroom Doubt Starters */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {[
              `Walk me through ${chapterTitle} step by step`,
              'Solve a numerical example with me',
              'What exam trap should I avoid here?',
            ].map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => streamUserAndTutorConversation(q)}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200/80 text-[#4F46E5] font-semibold hover:bg-indigo-50 cursor-pointer"
              >
                “{q}”
              </button>
            ))}
          </div>
        </div>

        {/* Live Word-by-Word Paragraph Transcript Stream */}
        <div className="flex-1 min-h-[260px] max-h-[360px] overflow-y-auto rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 p-4 space-y-3.5 text-xs">
          {liveUserDraft && (
            <div className="p-3.5 rounded-2xl bg-indigo-600 text-white ml-8 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">
                You (Speaking Live...)
              </div>
              <p className="text-xs sm:text-sm leading-relaxed">{liveUserDraft} ▍</p>
            </div>
          )}

          {turns.length === 0 && !liveUserDraft ? (
            <div className="text-center py-12 space-y-2 text-slate-400">
              <Sparkles className="w-7 h-7 mx-auto text-indigo-400" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                Ask your teacher any question by voice or text below
              </p>
              <p className="text-[11px] max-w-md mx-auto">
                Your teacher explains concepts and solves problems step-by-step in Hindi, Hinglish,
                or Indian English—streaming word-by-word with visual equations and check-in questions.
              </p>
            </div>
          ) : (
            turns.map((turn) => (
              <div
                key={turn.id}
                className={`p-4 rounded-2xl leading-relaxed ${
                  turn.speaker === 'You'
                    ? 'bg-[#EEF2FF] dark:bg-indigo-950/60 border border-indigo-200/80 text-slate-900 dark:text-slate-100 ml-8'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 mr-6 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-[11px] font-extrabold uppercase tracking-wider ${
                      turn.speaker === 'You' ? 'text-[#4F46E5]' : 'text-emerald-600'
                    }`}
                  >
                    {turn.speaker === 'You'
                      ? 'You (Student)'
                      : `Classroom Teacher (${turn.personaLabel || activePersonaObj.label})`}
                    {turn.streaming ? ' · Explaining word-by-word...' : ''}
                  </span>
                  <span className="text-[10px] text-slate-400">{turn.timestamp}</span>
                </div>
                <div className="text-xs sm:text-sm leading-relaxed">
                  <MathRichText content={turn.text} />
                  {turn.streaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-[#4F46E5] ml-1 animate-pulse" />
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>

        {/* Bottom Voice / Text Input + Clear History */}
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleFormSubmit} className="flex-1 flex gap-2">
            <input
              type="text"
              value={voicePromptInput}
              onChange={(e) => setVoicePromptInput(e.target.value)}
              placeholder="Speak via mic or type a question to stream word-by-word voice response..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
            >
              Ask Voice Tutor
            </button>
          </form>

          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => {
                handleInterruptSpeech();
                setTurns([]);
                localStorage.removeItem(storageKey);
              }}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:text-red-600 cursor-pointer"
            >
              Clear History
            </button>
          )}
        </div>

        {statusError && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            <span>{statusError}</span>
            <button
              type="button"
              onClick={() => {
                setStatusError(null);
                setRetryNonce((n) => n + 1);
              }}
              className="px-3 py-1 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}
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

// ============================================================================
// 6. Student Profile Modal (Opened by clicking top-right user avatar)
// ============================================================================
export interface StudentProfileData {
  displayName: string;
  email: string;
  avatarColor: string;
  targetExam: 'JEE Main 2027' | 'JEE Advanced 2027' | 'NEET UG 2027' | 'BITSAT 2027' | 'JEE Main 2028';
  preferredLanguage: 'English' | 'Hinglish' | 'Hindi';
  preferredCurrency?: SupportedCurrency;
  isMinor?: boolean;
  guardianEmail?: string;
  guardianConsentAccepted?: boolean;
  dailyGoalHours: number;
  batchStatus: 'Class 11' | 'Class 12' | 'Dropper';
  coachingName: string;
  targetRankOrPercentile: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  profile: StudentProfileData;
  streakDays: number;
  xp: number;
  level: number;
  onClose: () => void;
  onSaveProfile: (updated: StudentProfileData) => Promise<void>;
  onExportUserData: () => void;
  onOpenLegalModal: (tab: LegalModalTabId) => void;
  onSignOut: () => Promise<void>;
  onDeleteAccountData?: () => Promise<void>;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  profile,
  streakDays,
  xp,
  level,
  onClose,
  onSaveProfile,
  onExportUserData,
  onOpenLegalModal,
  onSignOut,
  onDeleteAccountData,
}) => {
  const [formState, setFormState] = useState<StudentProfileData>(profile);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [workspaceConnected, setWorkspaceConnected] = useState<boolean>(
    Boolean(getWorkspaceAccessToken())
  );
  const [connectingWorkspace, setConnectingWorkspace] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingData, setDeletingData] = useState(false);

  useEffect(() => {
    setFormState(profile);
    setWorkspaceConnected(Boolean(getWorkspaceAccessToken()));
    setConfirmDelete(false);
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const avatarInitials = (formState.displayName || 'Student')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveProfile(formState);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleConnectWorkspace = async () => {
    setConnectingWorkspace(true);
    try {
      const res = await googleSignIn(true);
      if (res.token || getWorkspaceAccessToken()) {
        setWorkspaceConnected(true);
      }
    } finally {
      setConnectingWorkspace(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Student Profile & Settings"
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-2xl text-white font-display font-extrabold text-base flex items-center justify-center shadow-sm"
              style={{ backgroundColor: formState.avatarColor || '#4F46E5' }}
            >
              {avatarInitials}
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                Student Profile &amp; Preferences
              </h2>
              <p className="text-xs text-slate-500">
                {formState.email || 'Private Encrypted Student Account'} · Level {level} Scholar (
                {xp} XP · {streakDays}d Streak)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Profile Modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Avatar Color Picker */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Avatar Badge Theme:
            </span>
            <div className="flex items-center gap-2">
              {['#4F46E5', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0F172A'].map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setFormState((s) => ({ ...s, avatarColor: col }))}
                  aria-label={`Select avatar color ${col}`}
                  className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                    formState.avatarColor === col
                      ? 'scale-115 ring-2 ring-offset-2 ring-indigo-500'
                      : ''
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={formState.displayName}
                onChange={(e) => setFormState((s) => ({ ...s, displayName: e.target.value }))}
                placeholder="e.g., Aniket Sharma"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Target Exam &amp; Year
              </label>
              <select
                value={formState.targetExam}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    targetExam: e.target.value as StudentProfileData['targetExam'],
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
              >
                <option value="JEE Main 2027">JEE Main 2027</option>
                <option value="JEE Advanced 2027">JEE Advanced 2027</option>
                <option value="NEET UG 2027">NEET UG 2027</option>
                <option value="BITSAT 2027">BITSAT 2027</option>
                <option value="JEE Main 2028">JEE Main 2028</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Batch / Class Status
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Class 11', 'Class 12', 'Dropper'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setFormState((s) => ({ ...s, batchStatus: b }))}
                    className={`py-2 rounded-xl font-semibold border cursor-pointer ${
                      formState.batchStatus === b
                        ? 'bg-[#EEF2FF] text-[#4F46E5] border-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Preferred AI Tutor Language
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['English', 'Hinglish', 'Hindi'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setFormState((s) => ({ ...s, preferredLanguage: l }))}
                    className={`py-2 rounded-xl font-semibold border cursor-pointer ${
                      formState.preferredLanguage === l
                        ? 'bg-[#EEF2FF] text-[#4F46E5] border-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Billing Region &amp; Currency
              </label>
              <select
                value={formState.preferredCurrency || 'INR'}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    preferredCurrency: e.target.value as SupportedCurrency,
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
              >
                {Object.values(GLOBAL_PPP_PRICING).map((p) => (
                  <option key={p.currency} value={p.currency}>
                    {p.label} ({p.symbol}{p.proMonthly}/mo)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Coaching Institute / School (Optional)
              </label>
              <input
                type="text"
                value={formState.coachingName}
                onChange={(e) => setFormState((s) => ({ ...s, coachingName: e.target.value }))}
                placeholder="e.g., Allen / FIITJEE / PW / Self-Study"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Target AIR / Percentile Goal
              </label>
              <input
                type="text"
                value={formState.targetRankOrPercentile}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, targetRankOrPercentile: e.target.value }))
                }
                placeholder="e.g., 99.5+ Percentile / AIR < 1500"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Daily Study Goal Slider */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold text-slate-800 dark:text-slate-200">
                Daily Self-Study Goal: {formState.dailyGoalHours} hrs / day
              </div>
              <div className="text-[11px] text-slate-500">
                Used to calibrate your {getDaysToJeeMain2027Session1()}-day JEE Main Session 1 revision schedule
              </div>
            </div>
            <input
              type="range"
              min={2}
              max={14}
              step={1}
              value={formState.dailyGoalHours}
              onChange={(e) =>
                setFormState((s) => ({ ...s, dailyGoalHours: Number(e.target.value) }))
              }
              className="w-40 accent-[#4F46E5]"
            />
          </div>

          {/* Google Workspace Connection Status */}
          <div className="p-4 rounded-xl bg-[#EEF2FF]/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Google Workspace Integration</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    workspaceConnected
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {workspaceConnected ? 'Connected' : 'Authorization Needed'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Drive, Docs, Slides, Calendar, Tasks &amp; Keep sync for your notes and study
                schedule.
              </p>
            </div>
            <button
              type="button"
              disabled={connectingWorkspace}
              onClick={handleConnectWorkspace}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 text-[#4F46E5] font-semibold hover:bg-indigo-50 cursor-pointer"
            >
              {connectingWorkspace
                ? 'Connecting...'
                : workspaceConnected
                ? 'Reconnect Google Scopes'
                : 'Connect Google Workspace'}
            </button>
          </div>

          {savedNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-center">
              Profile preferences saved and synced to your account!
            </div>
          )}

          {/* Save & Data Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onExportUserData}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export My Data (JSON)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLegalModal('privacy');
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Legal, Privacy &amp; Policies</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  onClose();
                  await onSignOut();
                }}
                className="px-3.5 py-2 rounded-xl border border-red-200 bg-red-50/70 text-red-700 font-semibold inline-flex items-center gap-1.5 hover:bg-red-100 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {onDeleteAccountData && (
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold text-rose-800 dark:text-rose-200">
                  Right to Erasure (DPDP Act 2023 &amp; GDPR)
                </div>
                <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
                  Permanently delete your Firestore subcollections, IndexedDB PDFs, and local workspace caches.
                </p>
              </div>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-3.5 py-2 rounded-xl border border-rose-300 bg-white text-rose-700 font-bold hover:bg-rose-50 cursor-pointer"
                >
                  Delete Account &amp; Data
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={deletingData}
                    onClick={async () => {
                      setDeletingData(true);
                      try {
                        await onDeleteAccountData();
                        onClose();
                      } finally {
                        setDeletingData(false);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 cursor-pointer"
                  >
                    {deletingData ? 'Erasing...' : 'Confirm Permanent Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 7. Commercial Legal, Privacy & Compliance Center Modal
// ============================================================================
interface LegalComplianceModalProps {
  isOpen: boolean;
  initialTab: LegalModalTabId;
  onClose: () => void;
}

export const LegalComplianceModal: React.FC<LegalComplianceModalProps> = ({
  isOpen,
  initialTab,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalModalTabId>(initialTab);
  const [reportCategory, setReportCategory] = useState<
    | 'Wrong AI Answer / Hallucination'
    | 'Question Key Discrepancy'
    | 'Account & Privacy Request'
    | 'General Feedback'
  >('Wrong AI Answer / Hallucination');
  const [reportReference, setReportReference] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
    setReportSubmitted(false);
    setReportError(null);
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDescription.trim() || reportDescription.trim().length < 5) {
      setReportError('Please enter at least 5 characters describing the issue.');
      return;
    }
    setReportError(null);
    setReportSubmitting(true);
    try {
      const mappedType =
        reportCategory === 'Question Key Discrepancy'
          ? 'wrong_answer_key'
          : reportCategory === 'Wrong AI Answer / Hallucination'
          ? 'typo_or_latex'
          : 'other';
      const res = await reportQuestionIssueOnServer({
        questionId: reportReference.trim() || 'general-support',
        issueType: mappedType,
        details: `[${reportCategory}] ${reportDescription.trim()}`,
      });
      if (!res.ok) {
        setReportError(res.error.message || 'Unable to submit report to server.');
        return;
      }
      setReportSubmitted(true);
      setReportDescription('');
      setReportReference('');
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Legal, Privacy and Compliance Center"
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl p-6 space-y-5 my-8 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                Legal, Privacy &amp; Academic Compliance Center
              </h2>
              <p className="text-xs text-slate-500">
                Global Commercial Terms · India DPDP Act 2023 &amp; GDPR Compliant
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Legal Modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5 Tabs */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto text-xs">
          {(
            [
              { id: 'privacy', label: 'Privacy Policy' },
              { id: 'terms', label: 'Terms & Conditions' },
              { id: 'ai-safety', label: 'AI Safety & Integrity' },
              { id: 'google-api', label: 'Google API Data Policy' },
              { id: 'contact', label: 'Contact & Report Answer' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-2 rounded-t-xl font-semibold border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === t.id
                  ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed pr-1">
          {activeTab === 'privacy' && (
            <div className="space-y-3">
              <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                Privacy Policy (India DPDP Act 2023 &amp; EU GDPR Compliance)
              </h3>
              <p>
                <strong>1. Per-User Data Isolation:</strong> Every study material, uploaded PDF,
                handwritten note photo, flashcard, and CBT mock attempt you create in LearnMate JEE
                is strictly isolated to your authenticated Firebase UID (
                <code>request.auth.uid == userId</code>). Other students cannot view, query, or
                access your uploaded notes or test scores.
              </p>
              <p>
                <strong>2. Data Minimization &amp; Purpose Limitation:</strong> We collect only your
                name, email address, target examination preferences, and the study content you
                explicitly upload or generate. Your uploaded materials are never sold to third-party
                advertisers or coaching institutes.
              </p>
              <p>
                <strong>3. Student Data Rights (Right to Export &amp; Erasure):</strong> Under the
                Digital Personal Data Protection Act (DPDP Act 2023, India) and GDPR, you have the
                right to export a complete machine-readable JSON archive of your study data or trigger
                full erasure directly from your Profile Modal at any time.
              </p>
              <p>
                <strong>4. Minor &amp; Guardian Consent (DPDP Act 2023):</strong> Students under 18
                require parent/guardian consent; zero behavioral ad-tracking or third-party data brokerage is performed.
              </p>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-3">
              <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                Terms &amp; Conditions of Use
              </h3>
              <p>
                <strong>1. Non-Affiliation Disclaimer:</strong> LearnMate JEE is an independent
                educational technology platform. It is{' '}
                <strong>
                  not affiliated with, endorsed by, or connected to the National Testing Agency
                  (NTA), the Indian Institutes of Technology (IITs), JoSAA, NCERT
                </strong>
                , or any third-party coaching institute.
              </p>
              <p>
                <strong>2. Intellectual Property &amp; Uploaded Materials:</strong> You retain full
                ownership of the personal handwritten notes and study documents you upload. By
                uploading materials, you confirm that you have the right to use them for personal
                educational study and exam preparation.
              </p>
              <p>
                <strong>3. CBT Mock Simulation Accuracy:</strong> Our JEE Main &amp; Advanced CBT
                interfaces simulate official NTA examination rules (+4 / −1 Section A, +4 / 0
                Section B numericals, and JEE Advanced partial marking) for practice purposes only.
              </p>
            </div>
          )}

          {activeTab === 'ai-safety' && (
            <div className="space-y-3">
              <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                AI Safety, Hallucination Verification &amp; Exam Hall Rules
              </h3>
              <p>
                <strong>1. AI Verification &amp; Page Citations:</strong> While LearnMate JEE
                grounds responses against your uploaded notes and official syllabus concepts,
                generative AI models can occasionally make mathematical, sign, or stoichiometric
                errors. Always verify critical derivations against NCERT textbooks and cited page
                numbers.
              </p>
              <p>
                <strong>2. Prohibition of Calculators in NTA Exam Halls:</strong> The graphing
                calculator, unit converter, and scientific evaluator in <em>Study Tools</em> are
                designed strictly for conceptual visualization during home study. The National
                Testing Agency (NTA) strictly bans physical calculators, smartwatches, and
                electronic devices inside JEE Main and JEE Advanced examination centers.
              </p>
            </div>
          )}

          {activeTab === 'google-api' && (
            <div className="space-y-3">
              <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                Google API Services User Data Policy (Limited Use Disclosure)
              </h3>
              <p>
                LearnMate JEE’s use and transfer to any other app of information received from
                Google APIs adheres to the <strong>Google API Services User Data Policy</strong>,
                including the Limited Use requirements:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Google Drive &amp; Google Docs (`drive.readonly`, `documents.readonly`):</strong>{' '}
                  Used only when you explicitly click “Browse Google Drive” to import your own study
                  PDFs or Docs into your workbench.
                </li>
                <li>
                  <strong>Google Calendar &amp; Tasks (`calendar.events`, `tasks`):</strong> Used
                  only after your explicit confirmation to sync your daily JEE study schedule and
                  pending chapter tasks.
                </li>
                <li>
                  <strong>Google Slides &amp; Keep (`presentations`, `keep`, `drive.file`):</strong>{' '}
                  Used only when you explicitly click “Export to Slides” or “Save to Keep” in the
                  Revise workspace.
                </li>
              </ul>
            </div>
          )}

          {activeTab === 'contact' && (
            <form onSubmit={handleReportSubmit} className="space-y-3.5">
              <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                Contact Support or Report a Wrong Answer
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Issue Category
                  </label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="Wrong AI Answer / Hallucination">
                      Wrong AI Answer / Hallucination
                    </option>
                    <option value="Question Key Discrepancy">Question Key Discrepancy</option>
                    <option value="Account & Privacy Request">Account &amp; Privacy Request</option>
                    <option value="General Feedback">General Feedback</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Chapter / Question / Page Reference
                  </label>
                  <input
                    type="text"
                    value={reportReference}
                    onChange={(e) => setReportReference(e.target.value)}
                    placeholder="e.g., Rotational Motion Q4 or Mock Q12"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Details of the Discrepancy or Question
                </label>
                <textarea
                  rows={3}
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Describe the step, formula, or answer key issue so our academic review engine can verify it..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              {reportError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold">
                  {reportError}
                </div>
              )}
              {reportSubmitted && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                  Thank you! Your report has been logged to Firestore academic review.
                </div>
              )}
              <button
                type="submit"
                disabled={reportSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white font-semibold cursor-pointer"
              >
                {reportSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 8. Instant Practice & Adaptive Drill Modal (With KaTeX + Auto Mistakes Logging)
// ============================================================================
export interface InstantPracticeConfig {
  isOpen: boolean;
  mode: 'chapter-quiz' | 'adaptive-drill' | 'paper-solver';
  title: string;
  chapterOrPaper: string;
  customQuestions?: CBTQuestion[];
}

interface InstantPracticeModalProps {
  config: InstantPracticeConfig | null;
  onClose: () => void;
  onEarnXp: (earnedXp: number) => void;
  onLaunchFullCBT: () => void;
  onRecordMistake?: (question: CBTQuestion, userSelection: string) => void;
}

export const InstantPracticeModal: React.FC<InstantPracticeModalProps> = ({
  config,
  onClose,
  onEarnXp,
  onLaunchFullCBT,
  onRecordMistake,
}) => {
  const [qIndex, setQIndex] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedKey, setVerifiedKey] = useState<{
    isCorrect: boolean;
    correctIndex: number;
    explanation: string;
  } | null>(null);
  const [streak, setStreak] = useState(0);
  const [difficultyLevel, setDifficultyLevel] = useState<'Easy' | 'Moderate' | 'JEE Advanced Hard'>(
    'Easy'
  );
  const [scoreCount, setScoreCount] = useState(0);

  useEffect(() => {
    setQIndex(0);
    setSelectedOpt(null);
    setChecked(false);
    setVerifiedKey(null);
    setVerifyError(null);
    setStreak(0);
    setDifficultyLevel('Easy');
    setScoreCount(0);
  }, [config]);

  if (!config || !config.isOpen) return null;

  const questionsPool: CBTQuestion[] =
    config.customQuestions && config.customQuestions.length > 0
      ? config.customQuestions
      : CBT_MOCK_QUESTIONS.slice(0, 10);
  const currentQ = questionsPool[qIndex] || questionsPool[0];
  const resolvedCorrectIndex =
    verifiedKey?.correctIndex ??
    (Number.isInteger(currentQ.correctIndex) ? currentQ.correctIndex : -1);
  const isCorrect = verifiedKey
    ? verifiedKey.isCorrect
    : selectedOpt !== null && selectedOpt === resolvedCorrectIndex;
  const resolvedExplanation = verifiedKey?.explanation || currentQ.explanation || '';

  const handleCheckAnswer = async () => {
    if (selectedOpt === null || checked || verifying) return;
    setVerifyError(null);

    let answerIsCorrect = false;
    let finalCorrectIndex = Number.isInteger(currentQ.correctIndex) ? currentQ.correctIndex : -1;
    let finalExplanation = currentQ.explanation || '';

    if (finalCorrectIndex < 0) {
      setVerifying(true);
      const res = await verifySinglePyqAnswerOnServer({
        questionId: currentQ.id,
        selectedOption: selectedOpt,
      });
      setVerifying(false);
      if (!res.ok) {
        setVerifyError(res.error.message || 'Unable to verify answer against server key.');
        return;
      }
      answerIsCorrect = res.data.isCorrect;
      finalCorrectIndex = res.data.correctIndex;
      finalExplanation = res.data.explanation || '';
      setVerifiedKey({
        isCorrect: answerIsCorrect,
        correctIndex: finalCorrectIndex,
        explanation: finalExplanation,
      });
    } else {
      answerIsCorrect = selectedOpt === finalCorrectIndex;
    }

    setChecked(true);
    if (answerIsCorrect) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setScoreCount((s) => s + 1);
      onEarnXp(config.mode === 'adaptive-drill' ? 15 : 10);
      if (config.mode === 'adaptive-drill') {
        if (nextStreak >= 3) setDifficultyLevel('JEE Advanced Hard');
        else if (nextStreak >= 1) setDifficultyLevel('Moderate');
      }
    } else {
      setStreak(0);
      if (config.mode === 'adaptive-drill') {
        setDifficultyLevel('Easy');
      }
      if (onRecordMistake) {
        onRecordMistake(
          {
            ...currentQ,
            correctIndex: finalCorrectIndex >= 0 ? finalCorrectIndex : 0,
            explanation: finalExplanation,
          },
          currentQ.options[selectedOpt] || `Option ${selectedOpt + 1}`
        );
      }
    }
  };

  const handleNext = () => {
    setSelectedOpt(null);
    setChecked(false);
    setVerifiedKey(null);
    setVerifyError(null);
    setQIndex((idx) => (idx + 1) % questionsPool.length);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={config.title}
      className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5] text-[11px] font-bold uppercase">
                {config.mode === 'adaptive-drill'
                  ? `Adaptive Drill · ${difficultyLevel}`
                  : config.mode === 'chapter-quiz'
                  ? `${questionsPool.length}-Question Chapter Quiz`
                  : 'Instant-Feedback Paper Solver'}
              </span>
              {config.mode === 'adaptive-drill' && (
                <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[11px] font-bold inline-flex items-center gap-1">
                  <Flame className="w-3 h-3 fill-current" />
                  Streak: {streak}
                </span>
              )}
            </div>
            <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white mt-1">
              {config.title} · {config.chapterOrPaper}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
              Score: {scoreCount} / {questionsPool.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Practice Modal"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Question {qIndex + 1} of {questionsPool.length} · {currentQ.subject} (
              {currentQ.chapter})
            </span>
            <span>+4 / −1 NTA Conceptual Check</span>
          </div>

          <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-relaxed">
            <span className="mr-1.5">Q{qIndex + 1}.</span>
            <MathRichText content={currentQ.stem} inline />
          </div>

          <div className="space-y-2.5">
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedOpt === idx;
              let borderStyle = 'border-slate-200 dark:border-slate-700 hover:bg-slate-50';
              if (isSelected && !checked) {
                borderStyle = 'border-[#4F46E5] bg-[#EEF2FF]/60 text-[#4F46E5]';
              } else if (checked) {
                if (idx === resolvedCorrectIndex) {
                  borderStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900';
                } else if (isSelected && idx !== resolvedCorrectIndex) {
                  borderStyle = 'border-red-400 bg-red-50 text-red-900';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={checked}
                  onClick={() => setSelectedOpt(idx)}
                  className={`w-full p-3 rounded-xl border text-left text-xs sm:text-sm font-medium flex items-center justify-between transition-colors cursor-pointer ${borderStyle}`}
                >
                  <span className="flex items-center gap-2">
                    <strong>({['A', 'B', 'C', 'D'][idx]})</strong>
                    <MathRichText content={opt} inline />
                  </span>
                  {checked && idx === resolvedCorrectIndex && (
                    <span className="text-[11px] font-bold text-emerald-700">✓ Correct</span>
                  )}
                </button>
              );
            })}
          </div>

          {verifyError && (
            <p className="text-xs text-red-600 font-semibold">{verifyError}</p>
          )}

          {checked && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                isCorrect
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/70 border-amber-200 text-amber-950'
              }`}
            >
              <div className="font-bold">
                {isCorrect
                  ? 'Spot On! Step-by-Step Verification:'
                  : 'Conceptual Trap Detected (Logged to My Mistakes Notebook) — Solution Breakdown:'}
              </div>
              <MathRichText content={resolvedExplanation} className="leading-relaxed" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLaunchFullCBT();
            }}
            className="text-xs font-semibold text-[#4F46E5] hover:underline cursor-pointer"
          >
            Switch to Full 75-Q NTA CBT Mode →
          </button>

          <div className="flex items-center gap-2">
            {!checked ? (
              <button
                type="button"
                disabled={selectedOpt === null || verifying}
                onClick={handleCheckAnswer}
                className="px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {verifying ? 'Verifying...' : 'Check Answer'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                Next Question →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
