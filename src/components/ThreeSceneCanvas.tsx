import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export type Preset3DId = 'Incline' | 'Convex Lens' | 'RC Circuit' | 'VSEPR' | 'Parabola' | 'Ellipse';

interface ThreeSceneCanvasProps {
  preset: Preset3DId;
  animateMotion?: boolean;
}

// Pre-allocated scratch vectors outside render loop (zero GC in tick)
const _targetCameraPos = new THREE.Vector3();

function createProceduralGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 256, 256);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  for (let i = 64; i < 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createArrowGroup(colorHex: number, length: number, radius = 0.06): THREE.Group {
  const group = new THREE.Group();
  const shaftMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.25,
    metalness: 0.4,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.5,
    metalness: 0.2,
  });

  const shaftLen = Math.max(0.2, length - 0.32);
  const shaftGeo = new THREE.CylinderGeometry(radius, radius, shaftLen, 20);
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.y = shaftLen / 2;
  group.add(shaft);

  const headGeo = new THREE.ConeGeometry(radius * 2.4, 0.32, 24);
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = shaftLen + 0.16;
  group.add(head);

  return group;
}

export const ThreeSceneCanvas: React.FC<ThreeSceneCanvasProps> = ({ preset, animateMotion }) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [angleDeg, setAngleDeg] = useState<number>(30);
  const [paramSecondary, setParamSecondary] = useState<number>(1.5);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [cameraPreset, setCameraPreset] = useState<'front' | 'iso' | 'top'>('iso');

  const stateRef = useRef({
    preset,
    angleDeg,
    paramSecondary,
    animateMotion,
    cameraPreset,
  });
  stateRef.current = { preset, angleDeg, paramSecondary, animateMotion, cameraPreset };

  const requestRenderRef = useRef<(() => void) | null>(null);
  const rebuildModelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL detection from GPU renderer string
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 680;
    const height = container.clientHeight || 420;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(width, height);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    scene.fog = new THREE.FogExp2(0xf8fafc, 0.032);

    // 2. Studio PBR Environment via RoomEnvironment + PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
    camera.position.set(5.4, 3.8, 6.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1.1, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 2.5;
    controls.maxDistance = 16;

    // 3. Warm Directional Key Light + Cool Hemisphere Fill
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0xe2e8f0, 0.85);
    hemiLight.position.set(0, 15, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.65);
    keyLight.position.set(6, 9, 5);
    keyLight.castShadow = !isSoftwareGl;
    const d = 6;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 0.55);
    rimLight.position.set(-5, 4, -5);
    scene.add(rimLight);

    // Ground Floor + Contact Shadow Grounding (offset >= 0.015 on Y to prevent Z-fighting)
    const gridTex = createProceduralGridTexture(renderer.capabilities.getMaxAnisotropy());
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: gridTex,
      roughness: 0.85,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(3.1, 36),
      new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.016;
    scene.add(contactShadow);

    const subjectRoot = new THREE.Group();
    scene.add(subjectRoot);

    let dynamicBlockGroup: THREE.Group | null = null;
    const clock = new THREE.Clock();

    function buildCompositeSubject() {
      while (subjectRoot.children.length > 0) {
        subjectRoot.remove(subjectRoot.children[0]);
      }
      dynamicBlockGroup = null;

      const { preset: activePreset, angleDeg: deg, paramSecondary: sec } = stateRef.current;
      const theta = THREE.MathUtils.degToRad(deg);

      if (activePreset === 'Incline') {
        // Composite 9-part Procedural Inclined Plane + Force Vector Assembly
        const rampLen = 4.2;
        const rampWidth = 1.6;
        const baseLen = rampLen * Math.cos(theta);
        const rampHeight = rampLen * Math.sin(theta);

        // Part 1: Brushed steel base rail
        const baseRail = new THREE.Mesh(
          new THREE.BoxGeometry(baseLen + 0.4, 0.14, rampWidth + 0.2),
          new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.7 })
        );
        baseRail.position.set(0, 0.07, 0);
        subjectRoot.add(baseRail);

        // Part 2: Vertical support pillar
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.12, rampHeight, 24),
          new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.65, metalness: 0.35 })
        );
        pillar.position.set(baseLen / 2 - 0.1, rampHeight / 2 + 0.14, 0);
        subjectRoot.add(pillar);

        // Part 3: Extruded Wedge Ramp with Bevel
        const wedgeShape = new THREE.Shape();
        wedgeShape.moveTo(-baseLen / 2, 0.14);
        wedgeShape.lineTo(baseLen / 2, 0.14);
        wedgeShape.lineTo(baseLen / 2, 0.14 + rampHeight);
        wedgeShape.closePath();

        const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, {
          depth: rampWidth - 0.2,
          bevelEnabled: true,
          bevelThickness: 0.03,
          bevelSize: 0.03,
          bevelSegments: 2,
        });
        wedgeGeo.translate(0, 0, -(rampWidth - 0.2) / 2);
        const wedgeMesh = new THREE.Mesh(
          wedgeGeo,
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.75, metalness: 0.15 })
        );
        subjectRoot.add(wedgeMesh);

        // Part 4: Brass Protractor Arc at Pivot
        const arcMesh = new THREE.Mesh(
          new THREE.TorusGeometry(0.85, 0.025, 12, 32, theta),
          new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.25, metalness: 0.6 })
        );
        arcMesh.position.set(-baseLen / 2, 0.14, rampWidth / 2);
        subjectRoot.add(arcMesh);

        // Part 5-9: Sliding Mass Block Group + Normal N & Gravity mg Vectors
        const blockContainer = new THREE.Group();
        blockContainer.position.set(0, 0.14 + rampHeight * 0.5, 0);
        blockContainer.rotation.z = theta;

        const blockHull = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, 0.56, 0.85),
          new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.3, metalness: 0.45 })
        );
        blockHull.position.y = 0.28;
        blockContainer.add(blockHull);

        const brassHandle = new THREE.Mesh(
          new THREE.TorusGeometry(0.14, 0.03, 12, 24, Math.PI),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, metalness: 0.85 })
        );
        brassHandle.position.y = 0.56;
        blockContainer.add(brassHandle);

        // Normal Vector N (perpendicular to incline)
        const normalArrow = createArrowGroup(0x10b981, 1.55 * Math.cos(theta) * (sec / 1.5));
        normalArrow.position.set(0, 0.56, 0);
        blockContainer.add(normalArrow);

        // Gravity Vector mg (always straight down in world space, counter-rotated by -theta)
        const gravityArrow = createArrowGroup(0xef4444, 1.65 * (sec / 1.5));
        gravityArrow.position.set(0, 0.28, 0);
        gravityArrow.rotation.z = Math.PI - theta;
        blockContainer.add(gravityArrow);

        subjectRoot.add(blockContainer);
        dynamicBlockGroup = blockContainer;
      } else if (activePreset === 'Convex Lens') {
        // 8-Part Optical Bench + Biconvex Lens + Ray Paths
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(5.6, 0.12, 0.45),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.65 })
        );
        rail.position.y = 0.06;
        subjectRoot.add(rail);

        const mountRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.08, 0.07, 16, 48),
          new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.25, metalness: 0.8 })
        );
        mountRing.position.y = 1.35;
        subjectRoot.add(mountRing);

        const lensGeo = new THREE.SphereGeometry(1.02, 32, 32);
        lensGeo.scale(0.24, 1, 1);
        const lensMat = new THREE.MeshPhysicalMaterial({
          color: 0x93c5fd,
          roughness: 0.1,
          metalness: 0.05,
          transmission: isSoftwareGl ? 0 : 0.9,
          transparent: true,
          opacity: isSoftwareGl ? 0.48 : 1,
          ior: 1.52,
        });
        const lensMesh = new THREE.Mesh(lensGeo, lensMat);
        lensMesh.position.y = 1.35;
        subjectRoot.add(lensMesh);

        const uDist = -1.6 - (deg - 15) * 0.025;
        const fLen = 0.95;
        const vDist = 1 / (1 / fLen + 1 / uDist);

        const objArrow = createArrowGroup(0x10b981, 0.9);
        objArrow.position.set(uDist, 1.35, 0);
        subjectRoot.add(objArrow);

        const imgArrow = createArrowGroup(0xef4444, Math.min(1.6, Math.abs(vDist / uDist) * 0.9));
        imgArrow.position.set(Math.min(2.6, vDist), 1.35, 0);
        imgArrow.rotation.z = Math.PI;
        subjectRoot.add(imgArrow);

        // Refracted Ray Tubes
        const rayCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(uDist, 2.25, 0),
          new THREE.Vector3(0, 2.25, 0),
          new THREE.Vector3(Math.min(2.6, vDist), 1.35 - Math.min(1.4, Math.abs(vDist / uDist) * 0.9), 0),
        ]);
        const rayTube = new THREE.Mesh(
          new THREE.TubeGeometry(rayCurve, 32, 0.025, 8, false),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, metalness: 0.3 })
        );
        subjectRoot.add(rayTube);
      } else if (activePreset === 'VSEPR') {
        // d & f Block Octahedral Coordination Complex [Fe(CN)6]3- (8-part composite)
        const complexGroup = new THREE.Group();
        complexGroup.position.y = 1.55;

        const centralMetal = new THREE.Mesh(
          new THREE.SphereGeometry(0.46, 32, 32),
          new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.2, metalness: 0.75 })
        );
        complexGroup.add(centralMetal);

        const bondLen = 1.45 * (sec / 1.5);
        const dirs = [
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(-1, 0, 0),
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, -1, 0),
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, -1),
        ];

        const bondMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.55, metalness: 0.4 });
        const ligandMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.25, metalness: 0.2 });

        dirs.forEach((dir) => {
          const bond = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, bondLen, 16), bondMat);
          bond.position.copy(dir).multiplyScalar(bondLen / 2);
          bond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          complexGroup.add(bond);

          const ligand = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 24), ligandMat);
          ligand.position.copy(dir).multiplyScalar(bondLen);
          complexGroup.add(ligand);
        });

        subjectRoot.add(complexGroup);
        dynamicBlockGroup = complexGroup;
      } else if (activePreset === 'RC Circuit') {
        // 8-Part Parallel Plate Capacitor + E-Field Flux Tubes + Resistor
        const board = new THREE.Mesh(
          new THREE.BoxGeometry(4.6, 0.14, 2.8),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7, metalness: 0.2 })
        );
        board.position.y = 0.07;
        subjectRoot.add(board);

        const sep = 0.7 + (deg / 60) * 0.9;
        const plateGeo = new THREE.BoxGeometry(0.12, 1.5, 1.5);
        const platePos = new THREE.Mesh(
          plateGeo,
          new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25, metalness: 0.8 })
        );
        platePos.position.set(-sep / 2, 1.0, 0);
        subjectRoot.add(platePos);

        const plateNeg = new THREE.Mesh(
          plateGeo,
          new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.25, metalness: 0.8 })
        );
        plateNeg.position.set(sep / 2, 1.0, 0);
        subjectRoot.add(plateNeg);

        for (let y = 0.55; y <= 1.45; y += 0.45) {
          for (let z = -0.45; z <= 0.45; z += 0.45) {
            const flux = createArrowGroup(0xf59e0b, sep - 0.16, 0.03);
            flux.position.set(-sep / 2 + 0.08, y, z);
            flux.rotation.z = -Math.PI / 2;
            subjectRoot.add(flux);
          }
        }
      } else {
        // Parabola / Ellipse 3D Double Cone & Cutting Plane
        const coneMat = new THREE.MeshStandardMaterial({
          color: 0x6366f1,
          roughness: 0.35,
          metalness: 0.25,
          transparent: true,
          opacity: 0.65,
        });
        const lowerCone = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.6, 36), coneMat);
        lowerCone.position.y = 0.8;
        subjectRoot.add(lowerCone);

        const upperCone = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.6, 36), coneMat);
        upperCone.rotation.z = Math.PI;
        upperCone.position.y = 2.4;
        subjectRoot.add(upperCone);

        const slicePlane = new THREE.Mesh(
          new THREE.BoxGeometry(2.8, 0.04, 2.8),
          new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.2, metalness: 0.5 })
        );
        slicePlane.position.y = 1.25;
        slicePlane.rotation.z = activePreset === 'Parabola' ? 0.68 : theta * 0.5;
        subjectRoot.add(slicePlane);

        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.68, 0.045, 16, 48),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, metalness: 0.7 })
        );
        ring.position.y = 1.28;
        ring.rotation.x = Math.PI / 2;
        ring.rotation.y = slicePlane.rotation.z;
        subjectRoot.add(ring);
      }
    }

    buildCompositeSubject();
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const dt = Math.min(clock.getDelta(), 0.05);
        controls.update();

        if (stateRef.current.animateMotion) {
          const t = clock.getElapsedTime();
          if (dynamicBlockGroup) {
            if (stateRef.current.preset === 'VSEPR') {
              dynamicBlockGroup.rotation.y = t * 0.75;
              dynamicBlockGroup.rotation.x = Math.sin(t * 0.9) * 0.2;
            } else if (stateRef.current.preset === 'Incline') {
              const slideOffset = Math.sin(t * 1.8) * 0.55;
              const rad = THREE.MathUtils.degToRad(stateRef.current.angleDeg);
              dynamicBlockGroup.position.x = -slideOffset * Math.cos(rad);
              dynamicBlockGroup.position.y =
                0.14 + 2.1 * Math.sin(rad) - slideOffset * Math.sin(rad);
            }
          } else {
            subjectRoot.rotation.y = Math.sin(t * 0.85) * 0.35;
          }
          renderDirty = true;
        } else {
          subjectRoot.rotation.y = 0;
        }

        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty || stateRef.current.animateMotion) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    requestRenderRef.current = requestRender;
    rebuildModelRef.current = () => {
      buildCompositeSubject();
      const cam = stateRef.current.cameraPreset;
      if (cam === 'front') _targetCameraPos.set(0, 2.2, 6.8);
      else if (cam === 'top') _targetCameraPos.set(0, 7.2, 1.4);
      else _targetCameraPos.set(5.4, 3.8, 6.2);
      camera.position.lerp(_targetCameraPos, 0.85);
      controls.update();
      requestRender();
    };

    controls.addEventListener('change', requestRender);
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 680;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', handleResize);
    requestRender();

    return () => {
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('change', requestRender);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    rebuildModelRef.current?.();
  }, [preset, angleDeg, paramSecondary, cameraPreset]);

  useEffect(() => {
    requestRenderRef.current?.();
  }, [animateMotion]);

  return (
    <div className="relative w-full h-[420px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#F8FAFC]">
      {/* Isolated WebGL Mount Container */}
      <div
        ref={canvasMountRef}
        data-testid="three-diagram-canvas"
        className="w-full h-full"
      />

      {/* Minimal Top-Left Spec Title */}
      <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 pointer-events-none flex items-center gap-2">
        <span>3D Interactive Simulation · {preset} (θ = {angleDeg}°)</span>
        {animateMotion && (
          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
            Live Physics Motion
          </span>
        )}
      </div>

      {/* Collapsible Unified Bottom Control Dock (Zero Side-Panel Clutter, Solid Surface Over WebGL) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[94%] max-w-[640px] flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="px-3 py-1 rounded-t-lg bg-slate-900 text-white text-[11px] font-medium border border-b-0 border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {dockCollapsed ? '▴ Show 3D Controls' : '▾ Hide Controls'}
        </button>
        {!dockCollapsed && (
          <div className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
              <span>Angle / Param ({angleDeg}°):</span>
              <input
                type="range"
                min={15}
                max={60}
                value={angleDeg}
                onChange={(e) => setAngleDeg(Number(e.target.value))}
                className="w-24 accent-indigo-600"
              />
            </label>
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
              <span>Scale ({paramSecondary.toFixed(1)}x):</span>
              <input
                type="range"
                min={0.8}
                max={2.2}
                step={0.1}
                value={paramSecondary}
                onChange={(e) => setParamSecondary(Number(e.target.value))}
                className="w-20 accent-indigo-600"
              />
            </label>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              {(['iso', 'front', 'top'] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setCameraPreset(view)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer ${
                    cameraPreset === view
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
