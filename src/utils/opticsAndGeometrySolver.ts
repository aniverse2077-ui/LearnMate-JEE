import type { Preset3DId } from '../components/ThreeSceneCanvas';
import type { DiagramVectorOverlayItem } from './jeeEngine';
import { escapeXmlText, sanitizeHexOrCssColor, sanitizeSvgMarkup } from './svgSanitizer';

export interface ThinLensInput {
  focalLengthCm: number;
  /** Sign-convention object position (negative = left of lens, e.g. -30). Positive inputs are treated as distance magnitude |u| on left. */
  objectDistanceCm: number;
  objectHeightCm?: number;
}

export interface ThinLensSolution {
  uCm: number;
  fCm: number;
  vCm: number;
  magnification: number;
  imageHeightCm: number;
  isRealImage: boolean;
  isErect: boolean;
  isAtFocus: boolean;
  regime: 'real_inverted' | 'virtual_erect' | 'diverging_virtual' | 'at_focus_infinity';
  formulaSummary: string;
}

/**
 * Exact Cartesian thin-lens solver:
 * 1/v - 1/u = 1/f  =>  1/v = 1/f + 1/u
 * Object is placed to the left (u < 0). Guards |u + f| < 0.08 to prevent division explosion at focus.
 */
export function solveThinLens(input: ThinLensInput): ThinLensSolution {
  const fCm = Number.isFinite(input.focalLengthCm) && Math.abs(input.focalLengthCm) >= 0.5
    ? input.focalLengthCm
    : 20;
  const rawU = Number.isFinite(input.objectDistanceCm) ? input.objectDistanceCm : -30;
  const uCm = rawU > 0 ? -rawU : rawU === 0 ? -0.5 : rawU;
  const hObj = Number.isFinite(input.objectHeightCm) && input.objectHeightCm !== 0
    ? Number(input.objectHeightCm)
    : 4;

  // Asymptote guard near F1 where u = -f => 1/f + 1/u -> 0
  if (fCm > 0 && Math.abs(uCm + fCm) < 0.08) {
    return {
      uCm,
      fCm,
      vCm: Infinity,
      magnification: Infinity,
      imageHeightCm: Infinity,
      isRealImage: false,
      isErect: false,
      isAtFocus: true,
      regime: 'at_focus_infinity',
      formulaSummary: `u = ${uCm.toFixed(1)} cm ≈ -f (${fCm.toFixed(1)} cm) -> Image at ∞`,
    };
  }

  const invV = 1 / fCm + 1 / uCm;
  if (Math.abs(invV) < 1e-6) {
    return {
      uCm,
      fCm,
      vCm: Infinity,
      magnification: Infinity,
      imageHeightCm: Infinity,
      isRealImage: false,
      isErect: false,
      isAtFocus: true,
      regime: 'at_focus_infinity',
      formulaSummary: `u = ${uCm.toFixed(1)} cm -> Image at ∞`,
    };
  }

  const vCm = 1 / invV;
  const magnification = vCm / uCm;
  const imageHeightCm = magnification * hObj;
  const isRealImage = vCm > 0;
  const isErect = magnification > 0;
  const regime =
    fCm < 0
      ? 'diverging_virtual'
      : isRealImage
      ? 'real_inverted'
      : 'virtual_erect';

  return {
    uCm,
    fCm,
    vCm,
    magnification,
    imageHeightCm,
    isRealImage,
    isErect,
    isAtFocus: false,
    regime,
    formulaSummary: `1/v − 1/(${uCm.toFixed(1)}) = 1/${fCm.toFixed(1)}  ⇒  v = ${vCm.toFixed(1)} cm, m = ${magnification.toFixed(2)}`,
  };
}

export interface InclinedPlaneInput {
  massKg: number;
  thetaDeg: number;
  muStatic?: number;
  muKinetic?: number;
  g?: number;
}

export interface InclinedPlaneSolution {
  massKg: number;
  thetaDeg: number;
  weightN: number;
  normalN: number;
  parallelGravityN: number;
  maxStaticFrictionN: number;
  actualFrictionN: number;
  isSliding: boolean;
  accelerationMs2: number;
}

export function solveInclinedPlaneForces(input: InclinedPlaneInput): InclinedPlaneSolution {
  const massKg = Math.max(0.1, Number.isFinite(input.massKg) ? input.massKg : 2);
  const thetaDeg = Math.max(1, Math.min(85, Number.isFinite(input.thetaDeg) ? input.thetaDeg : 30));
  const muStatic = Math.max(0, Number.isFinite(input.muStatic) ? Number(input.muStatic) : 0.25);
  const muKinetic = Math.max(0, Number.isFinite(input.muKinetic) ? Number(input.muKinetic) : Math.min(muStatic, 0.2));
  const g = Number.isFinite(input.g) && Number(input.g) > 0 ? Number(input.g) : 9.8;

  const rad = (thetaDeg * Math.PI) / 180;
  const weightN = massKg * g;
  const normalN = weightN * Math.cos(rad);
  const parallelGravityN = weightN * Math.sin(rad);
  const maxStaticFrictionN = muStatic * normalN;
  const isSliding = parallelGravityN > maxStaticFrictionN + 1e-6;
  const actualFrictionN = isSliding ? muKinetic * normalN : parallelGravityN;
  const accelerationMs2 = isSliding
    ? Math.max(0, (parallelGravityN - actualFrictionN) / massKg)
    : 0;

  return {
    massKg,
    thetaDeg,
    weightN,
    normalN,
    parallelGravityN,
    maxStaticFrictionN,
    actualFrictionN,
    isSliding,
    accelerationMs2,
  };
}

export type DiagramTopicId =
  | 'incline'
  | 'lens'
  | 'rc_circuit'
  | 'wheatstone'
  | 'shm_pendulum'
  | 'carnot_pv'
  | 'galvanic_cell'
  | 'vsepr'
  | 'argand'
  | 'parabola'
  | 'ellipse'
  | 'area_curve'
  | 'unmatched';

export function detectDiagramTopic(prompt: string, category?: string, preset?: Preset3DId): DiagramTopicId {
  const text = `${prompt || ''} ${category || ''}`.toLowerCase();

  if (text.includes('lens') || text.includes('optic') || text.includes('focal') || text.includes('ray') || text.includes('mirror')) {
    return 'lens';
  }
  if (text.includes('galvanic') || text.includes('daniell') || text.includes('electrochem') || text.includes('nernst') || text.includes('salt bridge')) {
    return 'galvanic_cell';
  }
  if (text.includes('wheatstone') || text.includes('kirchhoff') || text.includes('meter bridge') || text.includes('galvanometer')) {
    return 'wheatstone';
  }
  if (text.includes('rc ') || text.includes('capacitor') || text.includes('circuit') || text.includes('charging')) {
    return 'rc_circuit';
  }
  if (text.includes('carnot') || text.includes('thermo') || text.includes('isothermal') || text.includes('adiabatic') || text.includes('pv ')) {
    return 'carnot_pv';
  }
  if (text.includes('pendulum') || text.includes('shm') || text.includes('oscillat') || text.includes('harmonic') || text.includes('wave')) {
    return 'shm_pendulum';
  }
  if (text.includes('vsepr') || text.includes('octahedral') || text.includes('hybrid') || text.includes('ligand') || text.includes('orbital')) {
    return 'vsepr';
  }
  if (text.includes('argand') || text.includes('complex') || text.includes('phasor') || text.includes('euler')) {
    return 'argand';
  }
  if (text.includes('area under') || text.includes('integral') || text.includes('riemann') || text.includes('definite')) {
    return 'area_curve';
  }
  if (text.includes('parabola') || text.includes('directrix') || text.includes('latus rectum')) {
    return 'parabola';
  }
  if (text.includes('ellipse') || text.includes('eccentricity')) {
    return 'ellipse';
  }
  if (text.includes('incline') || text.includes('free-body') || text.includes('fbd') || text.includes('friction') || text.includes('normal')) {
    return 'incline';
  }

  // Fallback to active preset only if no contradicting unknown prompt is entered
  if (!prompt.trim() || text.includes('preset')) {
    if (preset === 'Convex Lens') return 'lens';
    if (preset === 'RC Circuit') return 'rc_circuit';
    if (preset === 'VSEPR') return 'vsepr';
    if (preset === 'Parabola') return 'parabola';
    if (preset === 'Ellipse') return 'ellipse';
    return 'incline';
  }

  if (category && category !== 'Auto-detect') {
    if (category === 'Free-Body Diagram') return 'incline';
    if (category === 'Ray Optics') return 'lens';
    if (category === 'Circuit Schematic') return 'rc_circuit';
    if (category === 'VSEPR 3D Geometry') return 'vsepr';
    if (category === 'Conic Section') return 'parabola';
  }

  return 'unmatched';
}

export interface TopicSvgOptions {
  prompt: string;
  category?: string;
  preset?: Preset3DId;
  timeSec?: number;
  animateMotion?: boolean;
  thetaDeg?: number;
  objectDistanceCm?: number;
  focalLengthCm?: number;
}

/**
 * Synthesizes scientifically verified 680x420 SVG diagrams for JEE Physics, Chemistry, and Mathematics.
 * Supports smooth real-time `timeSec` motion in 2D SVG mode without switching to 3D.
 */
export function synthesizeTopicAccurateSvg(opts: TopicSvgOptions): {
  svg: string;
  topic: DiagramTopicId;
  matched: boolean;
} {
  const topic = detectDiagramTopic(opts.prompt, opts.category, opts.preset);
  const t = opts.animateMotion ? opts.timeSec || 0 : 0;
  const safeTitle = escapeXmlText((opts.prompt || 'JEE Scientific Diagram').slice(0, 58));

  const sharedDefs = `<defs>
    <marker id="arr-dark" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0F172A"/>
    </marker>
    <marker id="arr-emerald" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#059669"/>
    </marker>
    <marker id="arr-rose" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#DC2626"/>
    </marker>
    <marker id="arr-indigo" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#4F46E5"/>
    </marker>
    <marker id="arr-amber" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#D97706"/>
    </marker>
  </defs>`;

  if (topic === 'incline') {
    const theta = opts.thetaDeg ?? 25;
    const sol = solveInclinedPlaneForces({ massKg: 2, thetaDeg: theta, muStatic: 0.25, muKinetic: 0.2 });
    const slideShift = opts.animateMotion ? Math.sin(t * 1.9) * 44 : 0;
    const rad = (theta * Math.PI) / 180;
    const baseRightX = 560;
    const baseY = 345;
    const baseLeftX = 110;
    const topY = Math.max(95, Math.round(baseY - (baseRightX - baseLeftX) * Math.tan(rad)));
    const midX = 340 + slideShift * Math.cos(rad);
    const midY = baseY - (midX - baseLeftX) * ((baseY - topY) / (baseRightX - baseLeftX));

    const svg = `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, Inter, sans-serif">
      ${sharedDefs}
      <rect width="680" height="420" fill="#FFFFFF"/>
      <text x="24" y="34" font-size="15" font-weight="700" fill="#0F172A">Inclined Plane FBD · θ = ${theta}° | N = ${sol.normalN.toFixed(1)} N | f = ${sol.actualFrictionN.toFixed(1)} N</text>
      <polygon points="${baseLeftX},${baseY} ${baseRightX},${baseY} ${baseRightX},${topY}" fill="#F1F5F9" stroke="#0F172A" stroke-width="3" stroke-linejoin="round"/>
      <path d="M ${baseLeftX + 75},${baseY} A 75,75 0 0,0 ${baseLeftX + Math.round(75 * Math.cos(rad))},${baseY - Math.round(75 * Math.sin(rad))}" fill="#DBEAFE" fill-opacity="0.7" stroke="#1E40AF" stroke-width="2"/>
      <text x="${baseLeftX + 86}" y="${baseY - 12}" font-family="Georgia, serif" font-style="italic" font-size="20" fill="#1E40AF">θ = ${theta}°</text>
      <g transform="translate(${midX.toFixed(1)}, ${midY.toFixed(1)}) rotate(${(-theta).toFixed(2)})">
        <rect x="-54" y="-58" width="108" height="58" rx="5" fill="#E0E7FF" stroke="#1E1B4B" stroke-width="3"/>
        <text x="-10" y="-22" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="20" fill="#1E1B4B">m</text>
        <line x1="0" y1="-58" x2="0" y2="-155" stroke="#059669" stroke-width="3.2" marker-end="url(#arr-emerald)"/>
        <text x="8" y="-142" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="18" fill="#059669">N = mg cos θ</text>
        <line x1="54" y1="-29" x2="142" y2="-29" stroke="#4F46E5" stroke-width="3" marker-end="url(#arr-indigo)"/>
        <text x="80" y="-40" font-family="Georgia, serif" font-style="italic" font-size="16" fill="#4F46E5">f</text>
        <line x1="-54" y1="-29" x2="-142" y2="-29" stroke="#DC2626" stroke-width="2.4" stroke-dasharray="5,3" marker-end="url(#arr-rose)"/>
        <text x="-152" y="-42" font-family="Georgia, serif" font-style="italic" font-size="15" fill="#DC2626">mg sin θ</text>
        <line x1="0" y1="0" x2="0" y2="85" stroke="#64748B" stroke-width="2.2" stroke-dasharray="5,3" marker-end="url(#arr-dark)"/>
        <text x="10" y="78" font-family="Georgia, serif" font-style="italic" font-size="15" fill="#334155">mg cos θ</text>
      </g>
      <line x1="${midX.toFixed(1)}" y1="${(midY - 29).toFixed(1)}" x2="${midX.toFixed(1)}" y2="${(midY + 92).toFixed(1)}" stroke="#DC2626" stroke-width="3.2" marker-end="url(#arr-rose)"/>
      <text x="${(midX - 34).toFixed(1)}" y="${(midY + 108).toFixed(1)}" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="20" fill="#DC2626">mg</text>
      <text x="24" y="396" font-size="13" font-weight="700" fill="#059669">${sol.isSliding ? `Block accelerating: a = ${sol.accelerationMs2.toFixed(2)} m/s²` : 'Static equilibrium: f_s = mg sin θ ≤ μ_s N'}</text>
    </svg>`;
    return { svg: sanitizeSvgMarkup(svg), topic, matched: true };
  }

  if (topic === 'lens') {
    const fCm = opts.focalLengthCm ?? 20;
    const baseU = opts.objectDistanceCm ?? (opts.animateMotion ? -32 + Math.sin(t * 1.2) * 18 : -32);
    const sol = solveThinLens({ focalLengthCm: fCm, objectDistanceCm: baseU, objectHeightCm: 4 });

    // Map cm to SVG px centered at optical center (340, 215); scale 4.5 px/cm
    const cx = 340;
    const cy = 215;
    const pxPerCm = 4.5;
    const clampX = (x: number) => Math.max(40, Math.min(640, x));
    const clampY = (y: number) => Math.max(55, Math.min(375, y));

    const f1X = cx - fCm * pxPerCm;
    const f2X = cx + fCm * pxPerCm;
    const objX = clampX(cx + sol.uCm * pxPerCm);
    const objTopY = 140;

    let imageMarkup = '';
    if (sol.isAtFocus) {
      imageMarkup = `
        <line x1="${objX}" y1="${objTopY}" x2="${cx}" y2="${objTopY}" stroke="#4F46E5" stroke-width="2.5"/>
        <line x1="${cx}" y1="${objTopY}" x2="635" y2="270" stroke="#4F46E5" stroke-width="2.5" marker-end="url(#arr-indigo)"/>
        <line x1="${objX}" y1="${objTopY}" x2="635" y2="305" stroke="#D97706" stroke-width="2.5" marker-end="url(#arr-amber)"/>
        <text x="656" y="105" text-anchor="end" font-size="14" font-weight="700" fill="#DC2626">Parallel refracted rays → Image at ∞</text>
      `;
    } else if (sol.isRealImage) {
      const imgX = clampX(cx + sol.vCm * pxPerCm);
      const rawTipY = cy - (sol.imageHeightCm / 4) * (cy - objTopY);
      const imgTipY = clampY(rawTipY);
      imageMarkup = `
        <line x1="${objX}" y1="${objTopY}" x2="${cx}" y2="${objTopY}" stroke="#4F46E5" stroke-width="2.5"/>
        <line x1="${cx}" y1="${objTopY}" x2="${imgX}" y2="${imgTipY}" stroke="#4F46E5" stroke-width="2.5" marker-end="url(#arr-indigo)"/>
        <line x1="${objX}" y1="${objTopY}" x2="${imgX}" y2="${imgTipY}" stroke="#D97706" stroke-width="2.5" marker-end="url(#arr-amber)"/>
        <line x1="${imgX}" y1="${cy}" x2="${imgX}" y2="${imgTipY}" stroke="#DC2626" stroke-width="3.5" marker-end="url(#arr-rose)"/>
        <text x="${Math.min(656, Math.max(410, imgX + 18))}" y="${Math.min(398, imgTipY + 22)}" text-anchor="end" font-size="14" font-weight="700" fill="#DC2626">Real Inverted Image (v = +${sol.vCm.toFixed(1)} cm)</text>
      `;
    } else {
      // Virtual Erect Image (u between O and F1 -> v < 0 on same left side)
      const imgX = clampX(cx + sol.vCm * pxPerCm);
      const rawTipY = cy - (sol.imageHeightCm / 4) * (cy - objTopY);
      const imgTipY = clampY(rawTipY);
      const rightRayEndY = cy + (cy - objTopY) * ((630 - cx) / (f2X - cx));
      const optRayEndY = cy + ((cy - objTopY) / Math.max(12, cx - objX)) * (630 - cx);
      imageMarkup = `
        <line x1="${objX}" y1="${objTopY}" x2="${cx}" y2="${objTopY}" stroke="#4F46E5" stroke-width="2.5"/>
        <line x1="${cx}" y1="${objTopY}" x2="625" y2="${clampY(rightRayEndY)}" stroke="#4F46E5" stroke-width="2.5" marker-end="url(#arr-indigo)"/>
        <line x1="${objX}" y1="${objTopY}" x2="625" y2="${clampY(optRayEndY)}" stroke="#D97706" stroke-width="2.5" marker-end="url(#arr-amber)"/>
        <line x1="${cx}" y1="${objTopY}" x2="${imgX}" y2="${imgTipY}" stroke="#4F46E5" stroke-width="2" stroke-dasharray="6,4"/>
        <line x1="${objX}" y1="${objTopY}" x2="${imgX}" y2="${imgTipY}" stroke="#D97706" stroke-width="2" stroke-dasharray="6,4"/>
        <line x1="${imgX}" y1="${cy}" x2="${imgX}" y2="${imgTipY}" stroke="#DC2626" stroke-width="3.5" stroke-dasharray="5,3" marker-end="url(#arr-rose)"/>
        <text x="${Math.min(410, Math.max(24, imgX - 55))}" y="${Math.max(58, imgTipY - 12)}" font-size="14" font-weight="700" fill="#DC2626">Virtual Erect Image (v = ${sol.vCm.toFixed(1)} cm)</text>
      `;
    }

    const svg = `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, Inter, sans-serif">
      ${sharedDefs}
      <rect width="680" height="420" fill="#FFFFFF"/>
      <text x="24" y="32" font-size="14" font-weight="700" fill="#0F172A">Thin Convex Lens · ${escapeXmlText(sol.formulaSummary)}</text>
      <line x1="30" y1="${cy}" x2="650" y2="${cy}" stroke="#64748B" stroke-width="2" stroke-dasharray="6,4"/>
      <path d="M ${cx},70 Q ${cx + 42},${cy} ${cx},360 Q ${cx - 42},${cy} ${cx},70 Z" fill="#DBEAFE" fill-opacity="0.65" stroke="#1E40AF" stroke-width="3"/>
      <line x1="${cx}" y1="70" x2="${cx}" y2="360" stroke="#93C5FD" stroke-width="1.5" stroke-dasharray="4,4"/>
      <circle cx="${f1X}" cy="${cy}" r="4.5" fill="#0F172A"/><text x="${f1X - 10}" y="${cy + 22}" font-size="14" font-weight="700">F₁</text>
      <circle cx="${f2X}" cy="${cy}" r="4.5" fill="#0F172A"/><text x="${f2X - 10}" y="${cy + 22}" font-size="14" font-weight="700">F₂</text>
      <line x1="${objX}" y1="${cy}" x2="${objX}" y2="${objTopY}" stroke="#059669" stroke-width="3.5" marker-end="url(#arr-emerald)"/>
      <text x="${objX - 24}" y="${objTopY - 10}" font-size="13" font-weight="700" fill="#059669">Object (u=${sol.uCm.toFixed(0)}cm)</text>
      ${imageMarkup}
    </svg>`;
    return { svg: sanitizeSvgMarkup(svg), topic, matched: true };
  }

  if (topic === 'rc_circuit') {
    const phase = (t * 0.45) % 1;
    const dotX = phase < 0.25 ? 110 + (phase / 0.25) * 320 : phase < 0.5 ? 430 : phase < 0.75 ? 430 - ((phase - 0.5) / 0.25) * 320 : 110;
    const dotY = phase < 0.25 ? 105 : phase < 0.5 ? 105 + ((phase - 0.25) / 0.25) * 205 : phase < 0.75 ? 310 : 310 - ((phase - 0.75) / 0.25) * 205;
    const svg = `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, Inter, sans-serif">
      ${sharedDefs}
      <rect width="680" height="420" fill="#FFFFFF"/>
      <text x="24" y="34" font-size="15" font-weight="700" fill="#0F172A">RC Charging Circuit · q(t) = Cε(1 − e^(−t/RC)), τ = RC</text>
      <path d="M 110,310 L 110,105 L 185,105 L 198,85 L 216,125 L 234,85 L 252,125 L 270,85 L 282,105 L 430,105 L 430,188" fill="none" stroke="#0F172A" stroke-width="3"/>
      <line x1="395" y1="188" x2="465" y2="188" stroke="#4F46E5" stroke-width="4.5"/>
      <line x1="395" y1="214" x2="465" y2="214" stroke="#4F46E5" stroke-width="4.5"/>
      <text x="476" y="196" font-size="14" font-weight="700" fill="#DC2626">+Q</text>
      <text x="476" y="218" font-size="14" font-weight="700" fill="#2563EB">−Q</text>
      <path d="M 430,214 L 430,310 L 290,310" fill="none" stroke="#0F172A" stroke-width="3"/>
      <line x1="255" y1="310" x2="110" y2="310" stroke="#0F172A" stroke-width="3"/>
      <line x1="255" y1="286" x2="255" y2="334" stroke="#059669" stroke-width="4.5"/>
      <line x1="276" y1="298" x2="276" y2="322" stroke="#059669" stroke-width="3"/>
      <text x="225" y="72" font-size="18" font-weight="700" fill="#0F172A">R</text>
      <text x="448" y="166" font-size="17" font-weight="700" fill="#4F46E5">C</text>
      <text x="242" y="356" font-size="16" font-weight="700" fill="#059669">DC Source ε</text>
      <!-- Charging Curve Inset -->
      <rect x="505" y="95" width="150" height="130" rx="10" fill="#F8FAFC" stroke="#CBD5E1"/>
      <line x1="522" y1="205" x2="640" y2="205" stroke="#475569" stroke-width="1.5"/>
      <line x1="522" y1="205" x2="522" y2="115" stroke="#475569" stroke-width="1.5"/>
      <path d="M 522,205 Q 550,132 635,126" fill="none" stroke="#4F46E5" stroke-width="2.5"/>
      <text x="530" y="114" font-size="11" font-weight="700" fill="#4F46E5">q(t) vs t</text>
      <text x="572" y="218" font-size="11" font-weight="600" fill="#475569">τ = RC</text>
      <circle cx="${dotX.toFixed(1)}" cy="${dotY.toFixed(1)}" r="6" fill="#F59E0B" stroke="#0F172A" stroke-width="1.5"/>
    </svg>`;
    return { svg: sanitizeSvgMarkup(svg), topic, matched: true };
  }

  if (topic === 'wheatstone') {
    const pulse = opts.animateMotion ? Math.sin(t * 3) * 0.5 + 0.5 : 0.5;
    const svg = `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, Inter, sans-serif">
      ${sharedDefs}
      <rect width="680" height="420" fill="#FFFFFF"/>
      <text x="24" y="34" font-size="15" font-weight="700" fill="#0F172A">Balanced Wheatstone Bridge · R₁/R₂ = R₃/Rₓ (I_G = 0)</text>
      <polygon points="340,75 495,205 340,335 185,205" fill="none" stroke="#334155" stroke-width="3"/>
      <line x1="85" y1="205" x2="185" y2="205" stroke="#334155" stroke-width="3" marker-end="url(#arr-indigo)"/>
      <line x1="495" y1="205" x2="595" y2="205" stroke="#334155" stroke-width="3"/>
      <line x1="340" y1="75" x2="340" y2="335" stroke="#4F46E5" stroke-width="2.5" stroke-dasharray="6,4"/>
      <circle cx="340" cy="205" r="24" fill="#EEF2FF" stroke="#4F46E5" stroke-width="2.5"/>
      <text x="332" y="212" font-size="18" font-weight="800" fill="#4F46E5">G</text>
      <rect x="225" y="114" width="52" height="24" rx="5" fill="#DBEAFE" stroke="#2563EB" stroke-width="2"/><text x="242" y="131" font-size="13" font-weight="700" fill="#1D4ED8">R₁</text>
      <rect x="403" y="114" width="52" height="24" rx="5" fill="#DBEAFE" stroke="#2563EB" stroke-width="2"/><text x="420" y="131" font-size="13" font-weight="700" fill="#1D4ED8">R₂</text>
      <rect x="225" y="272" width="52" height="24" rx="5" fill="#D1FAE5" stroke="#059669" stroke-width="2"/><text x="242" y="289" font-size="13" font-weight="700" fill="#047857">R₃</text>
      <rect x="403" y="272" width="52" height="24" rx="5" fill="#FEF3C7" stroke="#D97706" stroke-width="2"/><text x="420" y="289" font-size="13" font-weight="700" fill="#B45309">Rₓ</text>
      <circle cx="${(185 + pulse * 155).toFixed(1)}" cy="${(205 - pulse * 130).toFixed(1)}" r="5" fill="#2563EB"/>
      <circle cx="${(185 + pulse * 155).toFixed(1)}" cy="${(205 + pulse * 130).toFixed(1)}" r="5" fill="#059669"/>
      <text x="210" y="385" font-size="14" font-weight="700" fill="#4F46E5">Null Deflection Condition: V_B = V_D ⇒ R₁Rₓ = R₂R₃</text>
    </svg>`;
    return { svg: sanitizeSvgMarkup(svg), topic, matched: true };
  }

  if (topic === 'shm_pendulum') {
    const phi = opts.animateMotion ? 0.42 * Math.cos(t * 2.2) : 0.38;
    const pivotX = 340;
    const pivotY = 70;
    const len = 210;
    const bobX = pivotX + len * Math.sin(phi);
    const bobY = pivotY + len * Math.cos(phi);
    const svg = `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, Inter, sans-serif">
      ${sharedDefs}
      <rect width="680" height="420" fill="#FFFFFF"/>
      <text x="24" y="34" font-size="15" font-weight="700" fill="#0F172A">Simple Harmonic Pendulum · T = 2π√(L/g), τ = −mgL sin θ</text>
      <line x1="220" y1="${pivotY}" x2="460" y2="${pivotY}" stroke="#0F172A" stroke-width="5"/>
      <line x1="${pivotX}" y1="${pivotY}" x2="${pivotX}" y2="330" stroke="#94A3B8" stroke-width="2" stroke-dasharray="6,4"/>
      <path d="M 240,262 A 210,210 0 0,0 440,262" fill="none" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="4,4"/>
      <line x1="${pivotX}" y1="${pivotY}" x2="${bobX.toFixed(1)}" y2="${bobY.toFixed(1)}" stroke="#334155" stroke-width="3"/>
      <circle cx="${bobX.toFixed(1)}" cy="${bobY.toFixed(1)}" r="22" fill="#4F46E5" stroke="#1E1B4B" stroke-width="2.5"/>
      <text x="${(bobX - 7).toFixed(1)}" y="${(bobY + 5).toFixed(1)}" font-size="14" font-weight="700" fill="#FFFFFF">m</text>
      <line x1="${bobX.toFixed(1)}" y1="${bobY.toFixed(1)}" x2="${bobX.toFixed(1)}" y2="${(bobY + 85).toFixed(1)}" stroke="#DC2626" stroke-width="3" marker-end="url(#arr-rose)"/>
      <text x="${(bobX + 8).toFixed(1)}" y="${(bobY + 82).toFixed(1)}" font-size="15" font-weight="700" fill="#DC2626">mg</text>
      <text x="215" y="388" font-size="14" font-weight="700" fill="#059669">Restoring Force: F_θ = −mg sin θ ≈ −(mg/L)x</text>
    </svg>`;
    return { svg: sanitizeSvgMarkup(svg), topic, matched: true };
  }

  if (topic === 'carnot_pv') {
    const markerIdx = opts.animateMotion ? Math.floor((t * 1.2) % 4) : 0;
    const pts = [
      { x: 165, y: 105, label: 'A (P₁,V₁,T_H)' },
      { x: 390, y: 145, label: 'B (Isothermal Q_in)' },
      { x: 495, y: 265, label: 'C (P₃,V₃,T_C)' },
      { x: 245, y: 225, label: 'D (Adiabatic)' },
    ];
    const activePt = pts[markerIdx];
    const svg = `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, Inter, sans-serif">
      ${sharedDefs}
      <rect width="680" height="420" fill="#FFFFFF"/>
      <text x="24" y="34" font-size="15" font-weight="700" fill="#0F172A">Carnot Thermodynamic Cycle · η = 1 − T_C / T_H</text>
      <line x1="90" y1="335" x2="600" y2="335" stroke="#334155" stroke-width="2.5" marker-end="url(#arr-dark)"/>
      <line x1="90" y1="335" x2="90" y2="65" stroke="#334155" stroke-width="2.5" marker-end="url(#arr-dark)"/>
      <text x="560" y="362" font-size="13" font-weight="700" fill="#334155">Volume (V)</text>
      <text x="35" y="80" font-size="13" font-weight="700" fill="#334155">P</text>
      <path d="M 165 105 Q 275 125 390 145 L 495 265 Q 355 250 245 225 Z" fill="#EEF2FF" stroke="#4F46E5" stroke-width="3"/>
      <circle cx="165" cy="105" r="5" fill="#DC2626"/><text x="128" y="94" font-size="12" font-weight="700" fill="#DC2626">A (T_H)</text>
      <circle cx="390" cy="145" r="5" fill="#DC2626"/><text x="402" y="146" font-size="12" font-weight="700" fill="#DC2626">B (Isothermal Q_in)</text>
      <circle cx="495" cy="265" r="5" fill="#2563EB"/><text x="506" y="272" font-size="12" font-weight="700" fill="#2563EB">C (T_C)</text>
      <circle cx="245" cy="225" r="5" fill="#2563EB"/><text x="148" y="242" font-size="12" font-weight="700" fill="#2563EB">D (Adiabatic)</text>
      <circle cx="${activePt.x}" cy="${activePt.y}" r="8" fill="#F59E0B" stroke="#0F172A" stroke-width="2"/>
      <text x="275" y="200" font-size="14" font-weight="800" fill="#4F46E5">W_net = ∮ P dV</text>
    </svg>`;
    return { svg: sanitizeSvgMarkup(svg), topic, matched: true };
  }

  if (topic === 'galvanic_cell') {
    const eX = opts.animateMotion ? 190 + ((t * 120) % 300) : 340;
    const svg = `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, Inter, sans-serif">
      ${sharedDefs}
      <rect width="680" height="420" fill="#FFFFFF"/>
      <text x="24" y="34" font-size="15" font-weight="700" fill="#0F172A">Daniell Galvanic Cell · E°_cell = 1.10 V (Zn | Zn²⁺ || Cu²⁺ | Cu)</text>
      <rect x="115" y="175" width="150" height="175" rx="8" fill="#F1F5F9" stroke="#334155" stroke-width="2.5"/>
      <rect x="415" y="175" width="150" height="175" rx="8" fill="#E0F2FE" stroke="#334155" stroke-width="2.5"/>
      <rect x="148" y="140" width="26" height="165" rx="3" fill="#94A3B8" stroke="#334155" stroke-width="2"/>
      <rect x="506" y="140" width="26" height="165" rx="3" fill="#D97706" stroke="#78350F" stroke-width="2"/>
      <path d="M 225,230 L 225,130 L 455,130 L 455,230" fill="none" stroke="#10B981" stroke-width="18" stroke-linecap="round"/>
      <path d="M 161,140 L 161,80 L 519,80 L 519,140" fill="none" stroke="#0F172A" stroke-width="3"/>
      <circle cx="340" cy="80" r="22" fill="#EEF2FF" stroke="#4F46E5" stroke-width="2.5"/>
      <text x="332" y="86" font-size="16" font-weight="800" fill="#4F46E5">V</text>
      <circle cx="${eX.toFixed(1)}" cy="80" r="5" fill="#F59E0B"/>
      <text x="125" y="375" font-size="13" font-weight="700" fill="#0F172A">Anode (−): Zn → Zn²⁺ + 2e⁻</text>
      <text x="415" y="375" font-size="13" font-weight="700" fill="#B45309">Cathode (+): Cu²⁺ + 2e⁻ → Cu</text>
      <text x="295" y="120" font-size="12" font-weight="700" fill="#047857">KCl Salt Bridge</text>
    </svg>`;
    return { svg: sanitizeSvgMarkup(svg), topic, matched: true };
  }

  if (topic === 'vsepr') {
    const rot = opts.animateMotion ? t * 0.6 : 0;
    const dx = Math.round(130 * Math.cos(rot * 0.4));
    const dy = Math.round(35 * Math.sin(rot * 0.4));
    const svg = `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, Inter, sans-serif">
      <rect width="680" height="420" fill="#FFFFFF"/>
      <text x="24" y="34" font-size="15" font-weight="700" fill="#0F172A">Octahedral VSEPR / Coordination Complex · sp³d² / d²sp³ (90° &amp; 180°)</text>
      <line x1="340" y1="210" x2="340" y2="85" stroke="#1E293B" stroke-width="3.5"/>
      <line x1="340" y1="210" x2="340" y2="335" stroke="#1E293B" stroke-width="3.5"/>
      <line x1="340" y1="210" x2="${340 + dx}" y2="${210 - dy}" stroke="#1E293B" stroke-width="3.5"/>
      <line x1="340" y1="210" x2="${340 - dx}" y2="${210 + dy}" stroke="#1E293B" stroke-width="3.5"/>
      <line x1="340" y1="210" x2="445" y2="258" stroke="#1E293B" stroke-width="3.5"/>
      <line x1="340" y1="210" x2="235" y2="162" stroke="#1E293B" stroke-width="3.5"/>
      <circle cx="340" cy="210" r="30" fill="#4F46E5" stroke="#1E1B4B" stroke-width="2.5"/>
      <text x="322" y="216" font-weight="bold" font-size="16" fill="#FFFFFF">M³⁺</text>
      <circle cx="340" cy="85" r="19" fill="#10B981"/><text x="334" y="90" font-size="13" fill="#FFF" font-weight="bold">L</text>
      <circle cx="340" cy="335" r="19" fill="#10B981"/><text x="334" y="340" font-size="13" fill="#FFF" font-weight="bold">L</text>
      <circle cx="${340 + dx}" cy="${210 - dy}" r="19" fill="#10B981"/><text x="${334 + dx}" y="${215 - dy}" font-size="13" fill="#FFF" font-weight="bold">L</text>
      <circle cx="${340 - dx}" cy="${210 + dy}" r="19" fill="#10B981"/><text x="${334 - dx}" y="${215 + dy}" font-size="13" fill="#FFF" font-weight="bold">L</text>
      <circle cx="445" cy="258" r="19" fill="#10B981"/><text x="439" y="263" font-size="13" fill="#FFF" font-weight="bold">L</text>
      <circle cx="235" cy="162" r="19" fill="#10B981"/><text x="229" y="167" font-size="13" fill="#FFF" font-weight="bold">L</text>
    </svg>`;
    return { svg: sanitizeSvgMarkup(svg), topic, matched: true };
  }

  if (topic === 'argand') {
    const phi = opts.animateMotion ? 0.65 + t * 0.9 : 0.72;
    const r = 135;
    const zx = 340 + r * Math.cos(phi);
    const zy = 215 - r * Math.sin(phi);
    const svg = `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, Inter, sans-serif">
      ${sharedDefs}
      <rect width="680" height="420" fill="#FFFFFF"/>
      <text x="24" y="34" font-size="15" font-weight="700" fill="#0F172A">Complex Argand Plane · z = r(cos θ + i sin θ) = re^(iθ)</text>
      <line x1="120" y1="215" x2="560" y2="215" stroke="#475569" stroke-width="2" marker-end="url(#arr-dark)"/>
      <line x1="340" y1="385" x2="340" y2="55" stroke="#475569" stroke-width="2" marker-end="url(#arr-dark)"/>
      <circle cx="340" cy="215" r="${r}" fill="none" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="5,4"/>
      <line x1="340" y1="215" x2="${zx.toFixed(1)}" y2="${zy.toFixed(1)}" stroke="#4F46E5" stroke-width="3.5" marker-end="url(#arr-indigo)"/>
      <line x1="${zx.toFixed(1)}" y1="${zy.toFixed(1)}" x2="${zx.toFixed(1)}" y2="215" stroke="#059669" stroke-width="2" stroke-dasharray="4,4"/>
      <circle cx="${zx.toFixed(1)}" cy="${zy.toFixed(1)}" r="5" fill="#DC2626"/>
      <text x="${(zx + 10).toFixed(1)}" y="${(zy - 6).toFixed(1)}" font-size="15" font-weight="700" fill="#4F46E5">z = x + iy</text>
      <text x="530" y="236" font-size="13" font-weight="700" fill="#334155">Re(z)</text>
      <text x="352" y="70" font-size="13" font-weight="700" fill="#334155">Im(z)</text>
    </svg>`;
    return { svg: sanitizeSvgMarkup(svg), topic, matched: true };
  }

  if (topic === 'parabola') {
    const paramT = opts.animateMotion ? Math.sin(t * 1.1) * 1.1 : 0.75;
    const a = 90;
    const px = 260 + a * paramT * paramT;
    const py = 210 - 2 * a * paramT;
    const svg = `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, Inter, sans-serif">
      <rect width="680" height="420" fill="#FFFFFF"/>
      <text x="24" y="34" font-size="15" font-weight="700" fill="#0F172A">Standard Parabola · y² = 4ax (Focus S(a,0), Directrix x = −a)</text>
      <line x1="80" y1="210" x2="600" y2="210" stroke="#475569" stroke-width="2"/>
      <line x1="260" y1="45" x2="260" y2="385" stroke="#475569" stroke-width="2"/>
      <line x1="170" y1="45" x2="170" y2="385" stroke="#EF4444" stroke-width="2.5" stroke-dasharray="6,4"/>
      <path d="M 520,55 Q 0,210 520,365" fill="none" stroke="#4F46E5" stroke-width="3.5"/>
      <circle cx="350" cy="210" r="6" fill="#059669"/>
      <line x1="170" y1="${py.toFixed(1)}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#059669" stroke-width="2" stroke-dasharray="4,3"/>
      <line x1="350" y1="210" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#D97706" stroke-width="2"/>
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="#DC2626"/>
      <text x="342" y="236" font-size="15" font-weight="700" fill="#059669">S(a, 0)</text>
      <text x="82" y="70" font-size="14" font-weight="700" fill="#EF4444">Directrix x = −a</text>
      <text x="${(px + 10).toFixed(1)}" y="${(py - 8).toFixed(1)}" font-size="13" font-weight="700" fill="#DC2626">P(at², 2at): PS = PM</text>
    </svg>`;
    return { svg: sanitizeSvgMarkup(svg), topic, matched: true };
  }

  if (topic === 'ellipse') {
    const phi = opts.animateMotion ? t * 1.1 : 0.85;
    const a = 200;
    const b = 115;
    const c = Math.sqrt(a * a - b * b);
    const px = 340 + a * Math.cos(phi);
    const py = 215 - b * Math.sin(phi);
    const svg = `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, Inter, sans-serif">
      <rect width="680" height="420" fill="#FFFFFF"/>
      <text x="24" y="34" font-size="15" font-weight="700" fill="#0F172A">Standard Ellipse · x²/a² + y²/b² = 1,  PF₁ + PF₂ = 2a</text>
      <line x1="60" y1="215" x2="620" y2="215" stroke="#475569" stroke-width="2"/>
      <line x1="340" y1="50" x2="340" y2="385" stroke="#475569" stroke-width="2"/>
      <ellipse cx="340" cy="215" rx="${a}" ry="${b}" fill="#EEF2FF" fill-opacity="0.5" stroke="#4F46E5" stroke-width="3.5"/>
      <circle cx="${(340 - c).toFixed(1)}" cy="215" r="5" fill="#DC2626"/>
      <circle cx="${(340 + c).toFixed(1)}" cy="215" r="5" fill="#DC2626"/>
      <line x1="${(340 - c).toFixed(1)}" y1="215" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#059669" stroke-width="2" stroke-dasharray="4,3"/>
      <line x1="${(340 + c).toFixed(1)}" y1="215" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#D97706" stroke-width="2" stroke-dasharray="4,3"/>
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="#4F46E5"/>
      <text x="${(340 - c - 26).toFixed(1)}" y="238" font-size="14" font-weight="700" fill="#DC2626">F₁(−ae, 0)</text>
      <text x="${(340 + c - 26).toFixed(1)}" y="238" font-size="14" font-weight="700" fill="#DC2626">F₂(ae, 0)</text>
      <text x="${(px + 8).toFixed(1)}" y="${(py - 8).toFixed(1)}" font-size="13" font-weight="700" fill="#4F46E5">P(a cos φ, b sin φ)</text>
    </svg>`;
    return { svg: sanitizeSvgMarkup(svg), topic, matched: true };
  }

  if (topic === 'area_curve') {
    const svg = `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, Inter, sans-serif">
      ${sharedDefs}
      <rect width="680" height="420" fill="#FFFFFF"/>
      <text x="24" y="34" font-size="15" font-weight="700" fill="#0F172A">Definite Integral &amp; Area Under Curve · A = ∫_a^b f(x) dx</text>
      <line x1="80" y1="335" x2="600" y2="335" stroke="#334155" stroke-width="2.5" marker-end="url(#arr-dark)"/>
      <line x1="110" y1="365" x2="110" y2="65" stroke="#334155" stroke-width="2.5" marker-end="url(#arr-dark)"/>
      <path d="M 190,335 L 190,235 Q 320,90 490,190 L 490,335 Z" fill="#C7D2FE" fill-opacity="0.65"/>
      <path d="M 120,305 Q 305,70 550,235" fill="none" stroke="#4F46E5" stroke-width="3.5"/>
      <line x1="190" y1="235" x2="190" y2="335" stroke="#DC2626" stroke-width="2" stroke-dasharray="4,3"/>
      <line x1="490" y1="190" x2="490" y2="335" stroke="#DC2626" stroke-width="2" stroke-dasharray="4,3"/>
      <text x="184" y="356" font-size="14" font-weight="700" fill="#DC2626">x = a</text>
      <text x="484" y="356" font-size="14" font-weight="700" fill="#DC2626">x = b</text>
      <text x="285" y="255" font-size="16" font-weight="800" fill="#4F46E5">∫_a^b f(x) dx</text>
    </svg>`;
    return { svg: sanitizeSvgMarkup(svg), topic, matched: true };
  }

  // Honest structured schematic when prompt doesn't match a verified solver preset (never substitutes an unrelated projectile diagram!)
  const svg = `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, Inter, sans-serif">
    ${sharedDefs}
    <rect width="680" height="420" fill="#FFFFFF"/>
    <rect x="20" y="20" width="640" height="380" rx="14" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
    <line x1="60" y1="330" x2="620" y2="330" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#arr-dark)"/>
    <line x1="100" y1="360" x2="100" y2="85" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#arr-dark)"/>
    <text x="40" y="54" font-size="15" font-weight="700" fill="#0F172A">Custom Concept Canvas: ${safeTitle}</text>
    <text x="40" y="76" font-size="12" font-weight="600" fill="#475569">Use the interactive vector tools below to place force/field arrows, or switch to Visual Pro for AI artwork.</text>
    <circle cx="340" cy="210" r="46" fill="#EEF2FF" stroke="#4F46E5" stroke-width="2.5" stroke-dasharray="6,4"/>
    <text x="292" y="215" font-size="13" font-weight="700" fill="#4F46E5">System Node</text>
  </svg>`;
  return { svg: sanitizeSvgMarkup(svg), topic: 'unmatched', matched: false };
}

/**
 * Safely renders interactive draggable & rotatable vector overlays into any 680x420 SVG.
 */
export function injectVectorsIntoSvg(rawSvg: string, vectors: DiagramVectorOverlayItem[]): string {
  const cleanSvg = sanitizeSvgMarkup(rawSvg);
  if (!cleanSvg.includes('</svg>') || vectors.length === 0) return cleanSvg;

  const markerDefs: string[] = [];
  const overlayMarkup = vectors
    .map((v, idx) => {
      const x = Math.round((v.xPct / 100) * 680);
      const y = Math.round((v.yPct / 100) * 420);
      let dx = v.dx;
      let dy = v.dy;
      if (typeof v.angleDeg === 'number' && Number.isFinite(v.angleDeg)) {
        const rawMag = v.magnitude ?? Math.hypot(v.dx, v.dy);
        const len = Math.max(24, Math.min(140, rawMag || 48));
        const rad = (v.angleDeg * Math.PI) / 180;
        dx = Math.round(len * Math.cos(rad));
        dy = Math.round(-len * Math.sin(rad));
      }
      const x2 = x + dx;
      const y2 = y + dy;
      const safeColor = sanitizeHexOrCssColor(v.color);
      const safeLabel = escapeXmlText(v.label);
      const markerId = `vec-arr-${idx}`;
      markerDefs.push(
        `<marker id="${markerId}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${safeColor}"/></marker>`
      );

      return `<g>
        <line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${safeColor}" stroke-width="3" marker-end="url(#${markerId})" />
        <rect x="${x - 4}" y="${y - 18}" rx="6" width="${Math.max(48, safeLabel.length * 7 + 12)}" height="22" fill="#FFFFFF" stroke="${safeColor}" stroke-width="1.5"/>
        <text x="${x + 2}" y="${y - 3}" font-size="11" font-weight="700" fill="${safeColor}">${safeLabel}</text>
      </g>`;
    })
    .join('\n');

  const withMarkers = cleanSvg.replace('</svg>', `<defs>${markerDefs.join('')}</defs>\n${overlayMarkup}\n</svg>`);
  return sanitizeSvgMarkup(withMarkers);
}
