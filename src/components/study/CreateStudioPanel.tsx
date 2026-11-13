import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Download,
  FileText,
  Image as ImageIcon,
  Layers,
  Play,
  RotateCw,
  Sparkles,
  Video,
} from 'lucide-react';
import {
  DIAGRAM_SVG_PRESETS,
} from '../../data/jeeInitialContent';
import {
  ThreeSceneCanvas,
  ThreeSceneCanvasHandle,
  Preset3DId,
  ThreeSceneSnapshot,
} from '../ThreeSceneCanvas';
import { DiagramVectorOverlayItem } from '../../utils/jeeEngine';
import {
  injectVectorsIntoSvg,
  synthesizeTopicAccurateSvg,
} from '../../utils/opticsAndGeometrySolver';
import { sanitizeSvgMarkup } from '../../utils/svgSanitizer';
import { apiFetchWithAuth } from '../../services/workspaceService';
import type { CreationItem, MaterialItem } from '../HomeAndStudyViews';

export type CreateStudioTabId = 'Diagram Maker' | 'Visual' | 'Animated Lesson' | 'Saved Library';

interface CreateStudioPanelProps {
  materials: MaterialItem[];
  selectedMaterial: MaterialItem | null;
  creations: CreationItem[];
  onSaveCreation: (creation: Omit<CreationItem, 'id'>) => Promise<void>;
  requestedCreateTab?: CreateStudioTabId;
}

const PRESET_LIST: Preset3DId[] = [
  'Incline',
  'Convex Lens',
  'RC Circuit',
  'VSEPR',
  'Parabola',
  'Ellipse',
];

function parse3DSavedSnapshot(assetData?: string): ThreeSceneSnapshot | null {
  if (!assetData || !assetData.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(assetData);
    if (parsed && parsed.kind === '3d') {
      return parsed as ThreeSceneSnapshot;
    }
  } catch {
    // ignore malformed JSON
  }
  return null;
}

export const CreateStudioPanel: React.FC<CreateStudioPanelProps> = ({
  materials,
  selectedMaterial,
  creations,
  onSaveCreation,
  requestedCreateTab,
}) => {
  const [createTab, setCreateTab] = useState<CreateStudioTabId>(
    requestedCreateTab || 'Diagram Maker'
  );
  useEffect(() => {
    if (requestedCreateTab) setCreateTab(requestedCreateTab);
  }, [requestedCreateTab]);
  const [selectedMaterialTitle, setSelectedMaterialTitle] = useState(
    selectedMaterial?.title || 'Uploaded Material'
  );
  const [sourcePageLabel] = useState('Page 1');
  const [diagramPrompt, setDiagramPrompt] = useState(
    'Free-body diagram of a block on an inclined plane, show gravity mg, normal N, and friction f.'
  );
  const [diagramCategory, setDiagramCategory] = useState('Auto-detect');
  const [subjectFilter] = useState<'All' | 'Physics' | 'Chemistry' | 'Maths'>('All');
  const [activePreset, setActivePreset] = useState<Preset3DId>('Incline');
  const [aiSvgOverride, setAiSvgOverride] = useState<string | null>(null);
  const [solverNotice, setSolverNotice] = useState<string | null>(null);
  const [diagramLoading, setDiagramLoading] = useState<boolean>(false);
  const [renderMode, setRenderMode] = useState<'2D SVG' | '3D Interactive'>('2D SVG');
  const [animateDiagramMotion, setAnimateDiagramMotion] = useState(false);
  const [animTimeSec, setAnimTimeSec] = useState<number>(0);
  const [diagramZoom, setDiagramZoom] = useState(100);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Restored 3D configuration
  const [restored3DConfig, setRestored3DConfig] = useState<{
    angleDeg?: number;
    paramSecondary?: number;
    cameraPreset?: 'front' | 'iso' | 'top';
  }>({});
  const threeCanvasRef = useRef<ThreeSceneCanvasHandle | null>(null);

  // Interactive Draggable & Rotatable Custom Vectors on 2D SVG Stage (starts empty so base diagrams stay uncluttered)
  const [diagramVectors, setDiagramVectors] = useState<DiagramVectorOverlayItem[]>([]);
  const [draggingVectorId, setDraggingVectorId] = useState<string | null>(null);
  const [selectedVectorId, setSelectedVectorId] = useState<string | null>(null);
  const [newVectorLabel, setNewVectorLabel] = useState('');
  const [newVectorAngle, setNewVectorAngle] = useState<number>(45);
  const [newVectorColor, setNewVectorColor] = useState('#4F46E5');
  const svgStageRef = useRef<HTMLDivElement | null>(null);

  // Visual state
  const [visualEngine, setVisualEngine] = useState<'pro' | 'nano'>('pro');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [visualAspectRatio, setVisualAspectRatio] = useState<'1:1' | '16:9' | '4:3' | '9:16'>('16:9');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [visualLoading, setVisualLoading] = useState(false);
  const [visualError, setVisualError] = useState<string | null>(null);
  const [editBase64, setEditBase64] = useState<string | null>(null);

  // Animated Lesson state
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoPhotoBase64, setVideoPhotoBase64] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showFallback3DPreview, setShowFallback3DPreview] = useState(false);

  // Real requestAnimationFrame loop for 2D SVG motion (never switches tab to 3D!)
  useEffect(() => {
    if (!animateDiagramMotion || renderMode !== '2D SVG' || createTab !== 'Diagram Maker') {
      return;
    }
    let rafId = 0;
    const startMs = performance.now();
    const tick = (now: number) => {
      setAnimTimeSec((now - startMs) / 1000);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [animateDiagramMotion, renderMode, createTab]);

  // Compute current 2D SVG diagram live
  const computedDiagram = (() => {
    if (aiSvgOverride) {
      return { svg: sanitizeSvgMarkup(aiSvgOverride), matched: true };
    }
    const solved = synthesizeTopicAccurateSvg({
      prompt: diagramPrompt,
      category: diagramCategory,
      preset: activePreset,
      timeSec: animTimeSec,
      animateMotion: animateDiagramMotion,
    });
    return { svg: solved.svg, matched: solved.matched };
  })();

  const displayedSvgWithVectors = injectVectorsIntoSvg(
    computedDiagram.svg || DIAGRAM_SVG_PRESETS[activePreset],
    diagramVectors
  );

  const handleGenerateDiagramSvg = async () => {
    const lower = diagramPrompt.toLowerCase();
    let matchedPreset: Preset3DId = activePreset;
    if (lower.includes('lens') || lower.includes('optic')) matchedPreset = 'Convex Lens';
    else if (lower.includes('circuit') || lower.includes('rc') || lower.includes('capacitor'))
      matchedPreset = 'RC Circuit';
    else if (lower.includes('vsepr') || lower.includes('octahedral') || lower.includes('orbital'))
      matchedPreset = 'VSEPR';
    else if (lower.includes('parabola')) matchedPreset = 'Parabola';
    else if (lower.includes('ellipse')) matchedPreset = 'Ellipse';
    else if (lower.includes('incline') || lower.includes('block') || lower.includes('friction'))
      matchedPreset = 'Incline';
    setActivePreset(matchedPreset);

    // Check deterministic physics/math solver first
    const localSolved = synthesizeTopicAccurateSvg({
      prompt: diagramPrompt,
      category: diagramCategory,
      preset: matchedPreset,
      timeSec: 0,
      animateMotion: false,
    });

    if (localSolved.matched) {
      setAiSvgOverride(null);
      setSolverNotice(null);
      return;
    }

    setDiagramLoading(true);
    setSolverNotice(null);
    try {
      const res = await apiFetchWithAuth<{ svg?: string }>('/api/ai/search', {
        prompt: `${diagramPrompt} (${diagramCategory})`,
        mode: 'svg_diagram',
        useSearch: false,
      });
      if (res.ok && res.data.svg && res.data.svg.includes('<svg')) {
        const clean = sanitizeSvgMarkup(res.data.svg);
        if (clean) {
          setAiSvgOverride(clean);
          return;
        }
      }
      setAiSvgOverride(null);
      setSolverNotice(
        'Topic did not match a built-in parametric solver; opened clean Concept Canvas with vector editor.'
      );
    } catch {
      setAiSvgOverride(null);
      setSolverNotice(
        'Custom AI SVG endpoint unavailable; opened clean Concept Canvas with vector editor.'
      );
    } finally {
      setDiagramLoading(false);
    }
  };

  const triggerDownloadUrl = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const handleExportSvg = () => {
    const blob = new Blob([displayedSvgWithVectors], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownloadUrl(url, `LearnMate_${activePreset.replace(/\s+/g, '_')}.svg`);
    URL.revokeObjectURL(url);
  };

  const handleExportPng = () => {
    if (renderMode === '3D Interactive') {
      const snap = threeCanvasRef.current?.getSnapshot();
      if (snap?.previewPngDataUrl) {
        triggerDownloadUrl(snap.previewPngDataUrl, `LearnMate_${activePreset.replace(/\s+/g, '_')}_3D.png`);
        return;
      }
    }
    const svgBlob = new Blob([displayedSvgWithVectors], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1360;
      canvas.height = 840;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            const pngUrl = URL.createObjectURL(pngBlob);
            triggerDownloadUrl(pngUrl, `LearnMate_${activePreset.replace(/\s+/g, '_')}_2D.png`);
            URL.revokeObjectURL(pngUrl);
          }
        }, 'image/png');
      }
      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  };

  const handleExport3DJson = () => {
    const snap = threeCanvasRef.current?.getSnapshot();
    if (!snap) return;
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    triggerDownloadUrl(url, `LearnMate_${activePreset.replace(/\s+/g, '_')}_Scene.json`);
    URL.revokeObjectURL(url);
  };

  const handleSaveDiagramOr3D = async () => {
    if (renderMode === '3D Interactive') {
      const snap = threeCanvasRef.current?.getSnapshot() || {
        kind: '3d',
        preset: activePreset,
        angleDeg: 30,
        paramSecondary: 1.5,
        cameraPreset: 'iso',
        previewPngDataUrl: '',
      };
      await onSaveCreation({
        type: '3d',
        title: `${activePreset} 3D (θ=${snap.angleDeg}°)`,
        prompt: diagramPrompt,
        subject: subjectFilter === 'All' ? 'Physics' : subjectFilter,
        preset: activePreset,
        assetData: JSON.stringify(snap),
        resolutionOrRatio: `3D · ${snap.cameraPreset}`,
      });
    } else {
      await onSaveCreation({
        type: 'diagram',
        title: `${diagramPrompt.slice(0, 34)} (2D SVG)`,
        prompt: diagramPrompt,
        subject: subjectFilter === 'All' ? 'Physics' : subjectFilter,
        preset: activePreset,
        assetData: displayedSvgWithVectors,
        resolutionOrRatio: '2D SVG',
      });
    }
    setSaveBanner('Saved to Saved Library!');
    setTimeout(() => setSaveBanner(null), 3000);
  };

  const handleGenerateVisual = async () => {
    setVisualLoading(true);
    setVisualError(null);
    try {
      const endpoint = visualEngine === 'pro' ? '/api/ai/image-pro' : '/api/ai/image-edit';
      const body =
        visualEngine === 'pro'
          ? { prompt: diagramPrompt, imageSize, aspectRatio: visualAspectRatio }
          : {
              prompt: diagramPrompt,
              imageBase64: editBase64,
              mimeType: 'image/png',
              aspectRatio: visualAspectRatio,
            };
      const res = await apiFetchWithAuth<{ imageUrl?: string }>(endpoint, body);
      if (!res.ok || !res.data.imageUrl) {
        const solved = synthesizeTopicAccurateSvg({
          prompt: diagramPrompt,
          category: diagramCategory,
          preset: activePreset,
        });
        const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(solved.svg)}`;
        setGeneratedImageUrl(svgDataUrl);
        await onSaveCreation({
          type: 'visual',
          title: `${diagramPrompt.slice(0, 30)} (${imageSize} · ${visualAspectRatio})`,
          prompt: diagramPrompt,
          subject: subjectFilter,
          preset: activePreset,
          assetData: svgDataUrl,
          resolutionOrRatio: `${imageSize} · ${visualAspectRatio}`,
        });
        if (!res.ok) {
          setVisualError(
            `Upstream Image API Notice (${res.error.errorCode}): ${res.error.message} — Rendered verified vector schematic instead.`
          );
        }
        return;
      }
      setGeneratedImageUrl(res.data.imageUrl);
      await onSaveCreation({
        type: 'visual',
        title: `${activePreset} Visual (${visualEngine === 'pro' ? `${imageSize} · ${visualAspectRatio}` : 'Edited'})`,
        prompt: diagramPrompt,
        subject: subjectFilter,
        preset: activePreset,
        assetData: res.data.imageUrl,
        resolutionOrRatio: visualEngine === 'pro' ? `${imageSize} · ${visualAspectRatio}` : 'Edited',
      });
    } catch (err: any) {
      setVisualError(err?.message || 'Visual generation failed.');
    } finally {
      setVisualLoading(false);
    }
  };

  const handleGenerateAnimatedVideo = async () => {
    setVideoLoading(true);
    setVideoError(null);
    setShowFallback3DPreview(false);
    try {
      const res = await apiFetchWithAuth<{ videoUrl?: string }>('/api/ai/video', {
        prompt: `Educational JEE physics/chemistry animated explanation: ${diagramPrompt}`,
        aspectRatio: videoAspectRatio,
        base64Image: videoPhotoBase64,
        mimeType: 'image/png',
      });
      if (!res.ok || !res.data.videoUrl) {
        setVideoError(
          !res.ok
            ? `[${res.error.errorCode}] ${res.error.message}`
            : 'Video endpoint returned no MP4 stream.'
        );
        return;
      }
      setGeneratedVideoUrl(res.data.videoUrl);
      await onSaveCreation({
        type: 'video',
        title: `${activePreset} Animated Lesson (${videoAspectRatio})`,
        prompt: diagramPrompt,
        subject: subjectFilter,
        preset: activePreset,
        assetData: res.data.videoUrl,
        resolutionOrRatio: videoAspectRatio,
      });
    } catch (err: any) {
      setVideoError(err?.message || 'Video generation failed.');
    } finally {
      setVideoLoading(false);
    }
  };

  const selectedVector = diagramVectors.find((v) => v.id === selectedVectorId) || null;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 py-5 space-y-5">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-slate-900 dark:text-white">
          Create Studio
        </h1>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto">
        {(['Diagram Maker', 'Visual', 'Animated Lesson', 'Saved Library'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setCreateTab(tab)}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              createTab === tab
                ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900'
            }`}
          >
            {tab} {tab === 'Saved Library' ? `(${creations.length})` : ''}
          </button>
        ))}
      </div>

      {saveBanner && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
          {saveBanner}
        </div>
      )}

      {createTab === 'Saved Library' ? (
        creations.length === 0 ? (
          <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 text-center text-xs text-slate-500">
            No saved visuals yet. Generate a 2D/3D diagram or click “Create Visual” in AI Tutor to save items here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {creations.map((item) => {
              const snap3d = item.type === '3d' ? parse3DSavedSnapshot(item.assetData) : null;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3 flex flex-col justify-between shadow-2xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5] text-[11px] font-bold uppercase">
                        {item.type}
                      </span>
                      <span className="text-xs text-slate-400">{item.resolutionOrRatio}</span>
                    </div>

                    <div className="h-44 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden p-2">
                      {item.type === 'video' && item.assetData?.startsWith('data:video') ? (
                        <video
                          controls
                          src={item.assetData}
                          className="max-h-full max-w-full rounded-lg"
                        />
                      ) : snap3d?.previewPngDataUrl ? (
                        <img
                          src={snap3d.previewPngDataUrl}
                          alt={item.title}
                          className="max-h-full max-w-full object-contain rounded-lg"
                        />
                      ) : item.type === 'visual' &&
                        (item.assetData?.startsWith('data:image') ||
                          item.assetData?.startsWith('http')) ? (
                        <img
                          src={item.assetData}
                          alt={item.title}
                          className="max-h-full max-w-full object-contain rounded-lg"
                        />
                      ) : item.assetData?.includes('<svg') ? (
                        <div
                          className="w-full h-full flex items-center justify-center overflow-hidden"
                          dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(item.assetData) }}
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center overflow-hidden"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeSvgMarkup(
                              DIAGRAM_SVG_PRESETS[(item.preset as Preset3DId) || 'Incline'] ||
                                DIAGRAM_SVG_PRESETS.Incline
                            ),
                          }}
                        />
                      )}
                    </div>

                    <div>
                      <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{item.prompt}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        if (item.preset) {
                          setActivePreset(item.preset as Preset3DId);
                        }
                        setDiagramPrompt(item.prompt);
                        if (item.type === '3d') {
                          if (snap3d) {
                            setActivePreset(snap3d.preset);
                            setRestored3DConfig({
                              angleDeg: snap3d.angleDeg,
                              paramSecondary: snap3d.paramSecondary,
                              cameraPreset: snap3d.cameraPreset,
                            });
                          }
                          setRenderMode('3D Interactive');
                          setCreateTab('Diagram Maker');
                        } else if (item.type === 'visual') {
                          if (item.assetData?.startsWith('data:image') || item.assetData?.startsWith('http')) {
                            setGeneratedImageUrl(item.assetData);
                          }
                          setCreateTab('Visual');
                        } else if (item.type === 'video') {
                          if (item.assetData?.startsWith('data:video')) {
                            setGeneratedVideoUrl(item.assetData);
                          }
                          setCreateTab('Animated Lesson');
                        } else {
                          if (item.assetData?.includes('<svg')) {
                            setAiSvgOverride(item.assetData);
                          }
                          setRenderMode('2D SVG');
                          setCreateTab('Diagram Maker');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#EEF2FF] text-[#4F46E5] font-semibold hover:bg-indigo-100 cursor-pointer"
                    >
                      Open in Studio
                    </button>

                    {item.assetData?.includes('<svg') && (
                      <button
                        type="button"
                        onClick={() => {
                          const blob = new Blob([sanitizeSvgMarkup(item.assetData)], {
                            type: 'image/svg+xml;charset=utf-8',
                          });
                          const url = URL.createObjectURL(blob);
                          triggerDownloadUrl(url, `${item.title.replace(/\s+/g, '_')}.svg`);
                          URL.revokeObjectURL(url);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        SVG
                      </button>
                    )}
                    {snap3d?.previewPngDataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          triggerDownloadUrl(
                            snap3d.previewPngDataUrl,
                            `${item.title.replace(/\s+/g, '_')}.png`
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PNG
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Prompt & Presets Column (3 Cols) */}
          <div className="lg:col-span-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Source Material
              </label>
              <select
                value={selectedMaterialTitle}
                onChange={(e) => setSelectedMaterialTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium bg-white dark:bg-slate-800"
              >
                {materials.length === 0 ? (
                  <option value="Uploaded Material">General JEE Concept</option>
                ) : (
                  materials.map((m) => (
                    <option key={m.id} value={m.title}>
                      {m.title}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Prompt
              </label>
              <textarea
                rows={3}
                value={diagramPrompt}
                onChange={(e) => {
                  setDiagramPrompt(e.target.value);
                  setAiSvgOverride(null);
                }}
                placeholder="Describe any JEE diagram, ray optics setup, Wheatstone bridge, Carnot cycle, or conic..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Category
              </label>
              <select
                value={diagramCategory}
                onChange={(e) => setDiagramCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800"
              >
                <option value="Auto-detect">Auto-detect</option>
                <option value="Free-Body Diagram">Free-Body Diagram</option>
                <option value="Ray Optics">Ray Optics</option>
                <option value="Circuit Schematic">Circuit Schematic</option>
                <option value="VSEPR 3D Geometry">VSEPR 3D Geometry</option>
                <option value="Conic Section">Conic Section</option>
              </select>
            </div>

            <button
              type="button"
              disabled={diagramLoading || visualLoading || videoLoading}
              onClick={() => {
                if (createTab === 'Visual') {
                  void handleGenerateVisual();
                } else if (createTab === 'Animated Lesson') {
                  void handleGenerateAnimatedVideo();
                } else {
                  void handleGenerateDiagramSvg();
                }
              }}
              className="w-full py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-60 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {diagramLoading || visualLoading || videoLoading ? 'Generating...' : 'Generate'}
              </span>
            </button>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                Quick Presets
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {PRESET_LIST.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setActivePreset(preset);
                      setAiSvgOverride(null);
                      setSolverNotice(null);
                      setDiagramVectors([]);
                      setSelectedVectorId(null);
                      setDiagramPrompt(
                        preset === 'Incline'
                          ? 'Free-body diagram of a block on an inclined plane, show gravity mg, normal N, and friction.'
                          : `JEE ${preset} diagram with labeled vectors and parameters.`
                      );
                    }}
                    className={`px-2 py-2 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                      activePreset === preset && !aiSvgOverride
                        ? 'bg-[#EEF2FF] text-[#4F46E5] border-indigo-300'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Center Canvas Area (6 Cols) */}
          <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-4 shadow-2xs">
            {createTab === 'Diagram Maker' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
                      {(['2D SVG', '3D Interactive'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setRenderMode(m)}
                          className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                            renderMode === m
                              ? 'bg-white dark:bg-slate-900 text-[#4F46E5] shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    {renderMode === '2D SVG' && (
                      <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setDiagramZoom((z) => Math.max(60, z - 20))}
                          aria-label="Zoom out diagram"
                          className="px-2.5 py-1 hover:bg-slate-50 cursor-pointer"
                        >
                          −
                        </button>
                        <span className="px-2.5 py-1 border-x border-slate-200 font-mono tabular-nums">
                          {diagramZoom}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setDiagramZoom((z) => Math.min(150, z + 20))}
                          aria-label="Zoom in diagram"
                          className="px-2.5 py-1 hover:bg-slate-50 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {renderMode === '2D SVG' ? (
                      <button
                        type="button"
                        onClick={handleExportSvg}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 hover:bg-slate-50 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>SVG</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleExport3DJson}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 hover:bg-slate-50 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Scene JSON</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleExportPng}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 hover:bg-slate-50 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PNG</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveDiagramOr3D()}
                      className="px-3.5 py-1.5 rounded-lg bg-[#4F46E5] text-white font-semibold inline-flex items-center gap-1.5 hover:bg-[#4338CA] cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>

                {solverNotice && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800">
                    {solverNotice}
                  </div>
                )}

                {renderMode === '2D SVG' ? (
                  <div className="space-y-2.5">
                    <div
                      ref={svgStageRef}
                      onMouseMove={(e) => {
                        if (!draggingVectorId || !svgStageRef.current) return;
                        const rect = svgStageRef.current.getBoundingClientRect();
                        const xPct = Math.max(
                          6,
                          Math.min(92, Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(1)))
                        );
                        const yPct = Math.max(
                          8,
                          Math.min(90, Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(1)))
                        );
                        setDiagramVectors((prev) =>
                          prev.map((v) =>
                            v.id === draggingVectorId ? { ...v, xPct, yPct } : v
                          )
                        );
                      }}
                      onMouseUp={() => setDraggingVectorId(null)}
                      onMouseLeave={() => setDraggingVectorId(null)}
                      className="w-full h-[420px] rounded-xl border border-slate-100 bg-white flex items-center justify-center overflow-hidden p-4 relative select-none"
                    >
                      {diagramLoading && (
                        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-indigo-50 text-[#4F46E5] text-[11px] font-bold z-20">
                          Synthesizing Custom SVG...
                        </span>
                      )}
                      {diagramVectors.length > 0 && (
                        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-900/80 text-white text-[10px] font-bold z-20">
                          Drag added vector badges or adjust angle below
                        </span>
                      )}
                      <div
                        className="w-full h-full flex items-center justify-center transition-transform"
                        style={{ transform: `scale(${diagramZoom / 100})` }}
                        dangerouslySetInnerHTML={{ __html: displayedSvgWithVectors }}
                      />

                      {diagramVectors.map((vec) => (
                        <div
                          key={vec.id}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSelectedVectorId(vec.id);
                            setDraggingVectorId(vec.id);
                          }}
                          style={{
                            left: `${vec.xPct}%`,
                            top: `${vec.yPct}%`,
                            borderColor: vec.color,
                            color: vec.color,
                          }}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 px-2.5 py-1 rounded-full bg-white/95 border-2 shadow-md text-[11px] font-extrabold flex items-center gap-1.5 cursor-grab active:cursor-grabbing ${
                            selectedVectorId === vec.id ? 'ring-2 ring-indigo-500/40' : ''
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: vec.color }}
                          />
                          <span>{vec.label}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDiagramVectors((prev) =>
                                prev.filter((item) => item.id !== vec.id)
                              );
                            }}
                            className="ml-1 text-slate-400 hover:text-rose-600 text-[10px] cursor-pointer"
                            aria-label={`Remove ${vec.label}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add & Rotate Vector Bar */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={newVectorLabel}
                          onChange={(e) => setNewVectorLabel(e.target.value)}
                          placeholder="Add vector/label (e.g. T_1, E_net, v_cm)..."
                          className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                        />
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                          <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{newVectorAngle}°</span>
                          <input
                            type="range"
                            min={0}
                            max={360}
                            value={newVectorAngle}
                            onChange={(e) => setNewVectorAngle(Number(e.target.value))}
                            aria-label="New vector angle"
                            className="w-16 accent-indigo-600"
                          />
                        </label>
                        <input
                          type="color"
                          value={newVectorColor}
                          onChange={(e) => setNewVectorColor(e.target.value)}
                          className="w-7 h-7 rounded cursor-pointer border border-slate-200"
                          aria-label="Vector color"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newVectorLabel.trim()) return;
                            const rad = (newVectorAngle * Math.PI) / 180;
                            const id = `vec-${Date.now()}`;
                            setDiagramVectors((prev) => [
                              ...prev,
                              {
                                id,
                                label: newVectorLabel.trim(),
                                xPct: 50,
                                yPct: 50,
                                dx: Math.round(48 * Math.cos(rad)),
                                dy: Math.round(-48 * Math.sin(rad)),
                                angleDeg: newVectorAngle,
                                magnitude: 48,
                                color: newVectorColor,
                              },
                            ]);
                            setSelectedVectorId(id);
                            setNewVectorLabel('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-xs cursor-pointer"
                        >
                          + Add Vector
                        </button>
                      </div>
                      {selectedVector && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70 text-[11px]">
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            Selected Vector: {selectedVector.label}
                          </span>
                          <label className="flex items-center gap-2 font-semibold text-slate-600">
                            <span>Angle ({selectedVector.angleDeg ?? 0}°):</span>
                            <input
                              type="range"
                              min={0}
                              max={360}
                              value={selectedVector.angleDeg ?? 0}
                              onChange={(e) => {
                                const deg = Number(e.target.value);
                                setDiagramVectors((prev) =>
                                  prev.map((v) =>
                                    v.id === selectedVector.id ? { ...v, angleDeg: deg } : v
                                  )
                                );
                              }}
                              aria-label="Rotate selected vector"
                              className="w-28 accent-indigo-600"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <ThreeSceneCanvas
                    ref={threeCanvasRef}
                    preset={activePreset}
                    animateMotion={animateDiagramMotion}
                    initialAngleDeg={restored3DConfig.angleDeg}
                    initialParamSecondary={restored3DConfig.paramSecondary}
                    initialCameraPreset={restored3DConfig.cameraPreset}
                  />
                )}

                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setAnimateDiagramMotion((prev) => !prev)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      animateDiagramMotion
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'text-[#4F46E5] hover:bg-[#EEF2FF]'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {animateDiagramMotion
                        ? `Stop ${renderMode === '2D SVG' ? '2D' : '3D'} Motion`
                        : `Animate ${renderMode === '2D SVG' ? '2D SVG' : '3D'} Motion`}
                    </span>
                  </button>
                </div>
              </>
            )}

            {createTab === 'Visual' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVisualEngine('pro')}
                      className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                        visualEngine === 'pro' ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'text-slate-600'
                      }`}
                    >
                      Pro Image (1K / 2K / 4K)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisualEngine('nano')}
                      className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                        visualEngine === 'nano' ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'text-slate-600'
                      }`}
                    >
                      Image Edit
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      {(['1:1', '16:9', '4:3', '9:16'] as const).map((ar) => (
                        <button
                          key={ar}
                          type="button"
                          onClick={() => setVisualAspectRatio(ar)}
                          className={`px-2 py-1 rounded-md font-bold cursor-pointer ${
                            visualAspectRatio === ar
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {ar}
                        </button>
                      ))}
                    </div>
                    {visualEngine === 'pro' && (
                      <div className="flex items-center gap-1">
                        {(['1K', '2K', '4K'] as const).map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setImageSize(sz)}
                            className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                              imageSize === sz
                                ? 'bg-[#4F46E5] text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {visualEngine === 'nano' && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span>Reference image to edit (optional):</span>
                    <label className="px-3 py-1 rounded-lg bg-white border border-slate-200 font-semibold cursor-pointer">
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const r = new FileReader();
                          r.onloadend = () =>
                            setEditBase64(String(r.result || '').split(',')[1] || null);
                          r.readAsDataURL(f);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                <div className="h-[360px] rounded-xl border border-slate-100 bg-slate-50 flex flex-col items-center justify-center p-4 overflow-hidden">
                  {visualLoading ? (
                    <p className="text-xs font-semibold text-[#4F46E5]">
                      Generating {imageSize} ({visualAspectRatio}) Visual...
                    </p>
                  ) : generatedImageUrl ? (
                    <img
                      src={generatedImageUrl}
                      alt="Generated JEE Visual"
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="text-center space-y-2 max-w-sm">
                      <ImageIcon className="w-8 h-8 text-[#4F46E5] mx-auto" />
                      <p className="text-xs text-slate-600">
                        Click <strong>Generate</strong> on the left panel to create a {imageSize} ({visualAspectRatio}) concept diagram.
                      </p>
                    </div>
                  )}
                </div>
                {visualError && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    {visualError}
                  </p>
                )}
              </div>
            )}

            {createTab === 'Animated Lesson' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 text-xs">
                  <span className="font-bold text-slate-800">Animated Concept Video</span>
                  <div className="flex items-center gap-1.5">
                    {(['16:9', '9:16'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setVideoAspectRatio(ratio)}
                        className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                          videoAspectRatio === ratio
                            ? 'bg-[#4F46E5] text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {ratio === '16:9' ? '16:9 Landscape' : '9:16 Portrait'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <span>Animate a static diagram photo (optional):</span>
                  <label className="px-3 py-1 rounded-lg bg-white border border-slate-200 font-semibold cursor-pointer">
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const r = new FileReader();
                        r.onloadend = () =>
                          setVideoPhotoBase64(String(r.result || '').split(',')[1] || null);
                        r.readAsDataURL(f);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="h-[340px] rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center p-4 overflow-hidden">
                  {videoLoading ? (
                    <p className="text-xs font-semibold text-[#4F46E5]">
                      Generating {videoAspectRatio} Animated Lesson...
                    </p>
                  ) : generatedVideoUrl ? (
                    <video
                      controls
                      src={generatedVideoUrl}
                      className="max-h-full max-w-full rounded-lg"
                    />
                  ) : showFallback3DPreview ? (
                    <div className="w-full h-full">
                      <ThreeSceneCanvas preset={activePreset} animateMotion={true} />
                    </div>
                  ) : (
                    <div className="text-center space-y-2 max-w-sm">
                      <Video className="w-8 h-8 text-[#4F46E5] mx-auto" />
                      <p className="text-xs text-slate-600">
                        Click <strong>Generate</strong> on the left panel to render an animated video via Gemini Omni.
                      </p>
                    </div>
                  )}
                </div>
                {videoError && (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                    <p>{videoError}</p>
                    {!showFallback3DPreview && (
                      <button
                        type="button"
                        onClick={() => setShowFallback3DPreview(true)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold cursor-pointer"
                      >
                        Preview Interactive 3D Physics Simulation Instead
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Cited Source Column (3 Cols) */}
          <div className="lg:col-span-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
              Cited Source
            </h2>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <div className="p-3 flex items-center gap-2.5 font-medium text-slate-800 dark:text-slate-200">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{selectedMaterial?.title || selectedMaterialTitle}</span>
              </div>
              <div className="p-3 flex items-center gap-2.5 font-medium text-slate-800 dark:text-slate-200">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{sourcePageLabel}</span>
              </div>
              <div className="p-3 flex items-center gap-2.5 font-medium text-slate-800 dark:text-slate-200">
                <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Preset: {activePreset}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCreateTab('Animated Lesson')}
              className="w-full py-2.5 px-4 rounded-xl border border-indigo-300 text-[#4F46E5] font-semibold text-xs flex items-center justify-center gap-2 hover:bg-[#EEF2FF] transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Open Animated Lesson</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
