import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { solveThinLens } from '../utils/opticsAndGeometrySolver';

export type Preset3DId = 'Incline' | 'Convex Lens' | 'RC Circuit' | 'VSEPR' | 'Parabola' | 'Ellipse';

export interface ThreeSceneSnapshot {
  kind: '3d';
  preset: Preset3DId;
  angleDeg: number;
  paramSecondary: number;
  cameraPreset: 'front' | 'iso' | 'top';
  previewPngDataUrl: string;
}

export interface ThreeSceneCanvasHandle {
  getSnapshot: () => ThreeSceneSnapshot;
}

interface ThreeSceneCanvasProps {
  preset: Preset3DId;
  animateMotion?: boolean;
  initialAngleDeg?: number;
  initialParamSecondary?: number;
  initialCameraPreset?: 'front' | 'iso' | 'top';
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

  const safeLen = Math.max(0.28, length);
  const shaftLen = Math.max(0.14, safeLen - 0.3);
  const shaftGeo = new THREE.CylinderGeometry(radius, radius, shaftLen, 20);
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.y = shaftLen / 2;
  group.add(shaft);

  const headGeo = new THREE.ConeGeometry(radius * 2.4, 0.3, 24);
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = shaftLen + 0.15;
  group.add(head);

  return group;
}

export const ThreeSceneCanvas = React.forwardRef<ThreeSceneCanvasHandle, ThreeSceneCanvasProps>(
  ({ preset, animateMotion, initialAngleDeg, initialParamSecondary, initialCameraPreset }, ref) => {
    const canvasMountRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const [angleDeg, setAngleDeg] = useState<number>(initialAngleDeg ?? 30);
    const [paramSecondary, setParamSecondary] = useState<number>(initialParamSecondary ?? 1.5);
    const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
    const [cameraPreset, setCameraPreset] = useState<'front' | 'iso' | 'top'>(
      initialCameraPreset ?? 'iso'
    );

    useEffect(() => {
      if (typeof initialAngleDeg === 'number') setAngleDeg(initialAngleDeg);
    }, [initialAngleDeg]);

    useEffect(() => {
      if (typeof initialParamSecondary === 'number') setParamSecondary(initialParamSecondary);
    }, [initialParamSecondary]);

    useEffect(() => {
      if (initialCameraPreset) setCameraPreset(initialCameraPreset);
    }, [initialCameraPreset]);

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

    useImperativeHandle(
      ref,
      () => ({
        getSnapshot: (): ThreeSceneSnapshot => {
          let previewPngDataUrl = '';
          try {
            previewPngDataUrl = rendererRef.current?.domElement?.toDataURL('image/png') || '';
          } catch {
            previewPngDataUrl = '';
          }
          return {
            kind: '3d',
            preset: stateRef.current.preset,
            angleDeg: stateRef.current.angleDeg,
            paramSecondary: stateRef.current.paramSecondary,
            cameraPreset: stateRef.current.cameraPreset,
            previewPngDataUrl,
          };
        },
      }),
      []
    );

    // Compute scientific optics readout when Convex Lens is active
    const lensReadout = (() => {
      if (preset !== 'Convex Lens') return null;
      // Map angleDeg 15..60 -> |u| = 0.6..2.4 * f (covers virtual erect < f, focus f, and real inverted > f)
      const fCm = 20;
      const uCm = -Number(((angleDeg / 32) * fCm).toFixed(1));
      return solveThinLens({ focalLengthCm: fCm, objectDistanceCm: uCm, objectHeightCm: 4 });
    })();

    useEffect(() => {
      const container = canvasMountRef.current;
      if (!container) return;

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
      rendererRef.current = renderer;
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
      let rcChargeDots: THREE.Mesh[] = [];
      const clock = new THREE.Clock();

      function buildCompositeSubject() {
        while (subjectRoot.children.length > 0) {
          subjectRoot.remove(subjectRoot.children[0]);
        }
        dynamicBlockGroup = null;
        rcChargeDots = [];

        const { preset: activePreset, angleDeg: deg, paramSecondary: sec } = stateRef.current;
        const theta = THREE.MathUtils.degToRad(deg);

        if (activePreset === 'Incline') {
          const rampLen = 4.2;
          const rampWidth = 1.6;
          const baseLen = rampLen * Math.cos(theta);
          const rampHeight = rampLen * Math.sin(theta);

          const baseRail = new THREE.Mesh(
            new THREE.BoxGeometry(baseLen + 0.4, 0.14, rampWidth + 0.2),
            new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.7 })
          );
          baseRail.position.set(0, 0.07, 0);
          subjectRoot.add(baseRail);

          const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.12, rampHeight, 24),
            new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.65, metalness: 0.35 })
          );
          pillar.position.set(baseLen / 2 - 0.1, rampHeight / 2 + 0.14, 0);
          subjectRoot.add(pillar);

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

          const arcMesh = new THREE.Mesh(
            new THREE.TorusGeometry(0.85, 0.025, 12, 32, theta),
            new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.25, metalness: 0.6 })
          );
          arcMesh.position.set(-baseLen / 2, 0.14, rampWidth / 2);
          subjectRoot.add(arcMesh);

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

          const normalArrow = createArrowGroup(0x10b981, 1.55 * Math.cos(theta) * (sec / 1.5));
          normalArrow.position.set(0, 0.56, 0);
          blockContainer.add(normalArrow);

          const gravityArrow = createArrowGroup(0xef4444, 1.65 * (sec / 1.5));
          gravityArrow.position.set(0, 0.28, 0);
          gravityArrow.rotation.z = Math.PI - theta;
          blockContainer.add(gravityArrow);

          subjectRoot.add(blockContainer);
          dynamicBlockGroup = blockContainer;
        } else if (activePreset === 'Convex Lens') {
          const axisY = 1.35;
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(6.2, 0.12, 0.48),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.65 })
          );
          rail.position.y = 0.06;
          subjectRoot.add(rail);

          const axisRod = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.015, 5.8, 12),
            new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
          );
          axisRod.rotation.z = Math.PI / 2;
          axisRod.position.y = axisY;
          subjectRoot.add(axisRod);

          const mountRing = new THREE.Mesh(
            new THREE.TorusGeometry(1.06, 0.06, 16, 48),
            new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.25, metalness: 0.8 })
          );
          mountRing.position.y = axisY;
          subjectRoot.add(mountRing);

          const lensGeo = new THREE.SphereGeometry(1.0, 32, 32);
          lensGeo.scale(0.22, 1, 1);
          const lensMat = new THREE.MeshPhysicalMaterial({
            color: 0x93c5fd,
            roughness: 0.1,
            metalness: 0.05,
            transmission: isSoftwareGl ? 0 : 0.9,
            transparent: true,
            opacity: isSoftwareGl ? 0.52 : 1,
            ior: 1.52,
          });
          const lensMesh = new THREE.Mesh(lensGeo, lensMat);
          lensMesh.position.y = axisY;
          subjectRoot.add(lensMesh);

          // Exact thin-lens physics solver (f = 1.15 world units)
          const fLen = 1.15;
          const uDist = -Math.max(0.42, (deg / 32) * fLen);
          const sol = solveThinLens({
            focalLengthCm: fLen,
            objectDistanceCm: uDist,
            objectHeightCm: 0.72 * (sec / 1.5),
          });

          // Focus markers F1 and F2
          [-fLen, fLen].forEach((fx) => {
            const fMarker = new THREE.Mesh(
              new THREE.SphereGeometry(0.055, 16, 16),
              new THREE.MeshStandardMaterial({ color: 0x0f172a })
            );
            fMarker.position.set(fx, axisY, 0);
            subjectRoot.add(fMarker);
          });

          const objH = 0.72 * (sec / 1.5);
          const objArrow = createArrowGroup(0x10b981, objH);
          objArrow.position.set(uDist, axisY, 0);
          subjectRoot.add(objArrow);

          if (sol.isAtFocus) {
            // Parallel exiting rays (image at infinity)
            const parallelRay = new THREE.Mesh(
              new THREE.TubeGeometry(
                new THREE.CatmullRomCurve3([
                  new THREE.Vector3(uDist, axisY + objH, 0),
                  new THREE.Vector3(0, axisY + objH, 0),
                  new THREE.Vector3(2.8, axisY - objH * 1.4, 0),
                ]),
                24,
                0.022,
                8,
                false
              ),
              new THREE.MeshStandardMaterial({ color: 0xf59e0b })
            );
            subjectRoot.add(parallelRay);
          } else if (sol.isRealImage) {
            const clampedV = Math.min(2.75, sol.vCm);
            const imgH = Math.min(1.5, Math.abs(sol.imageHeightCm));
            const imgArrow = createArrowGroup(0xef4444, imgH);
            imgArrow.position.set(clampedV, axisY, 0);
            imgArrow.rotation.z = Math.PI; // Real inverted image
            subjectRoot.add(imgArrow);

            const ray1 = new THREE.Mesh(
              new THREE.TubeGeometry(
                new THREE.CatmullRomCurve3([
                  new THREE.Vector3(uDist, axisY + objH, 0),
                  new THREE.Vector3(0, axisY + objH, 0),
                  new THREE.Vector3(clampedV, axisY - imgH, 0),
                ]),
                28,
                0.024,
                8,
                false
              ),
              new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25 })
            );
            subjectRoot.add(ray1);

            const ray2 = new THREE.Mesh(
              new THREE.TubeGeometry(
                new THREE.CatmullRomCurve3([
                  new THREE.Vector3(uDist, axisY + objH, 0),
                  new THREE.Vector3(clampedV, axisY - imgH, 0),
                ]),
                16,
                0.02,
                8,
                false
              ),
              new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.25 })
            );
            subjectRoot.add(ray2);
          } else {
            // Virtual Erect Image (|u| < f): image is on left (v < 0) and upright!
            const clampedV = Math.max(-2.75, sol.vCm);
            const imgH = Math.min(1.65, Math.abs(sol.imageHeightCm));
            const imgArrow = createArrowGroup(0xef4444, imgH);
            imgArrow.position.set(clampedV, axisY, 0);
            // Erect -> NO Math.PI rotation!
            subjectRoot.add(imgArrow);

            // Real refracted rays going rightward
            const rayRight1 = new THREE.Mesh(
              new THREE.TubeGeometry(
                new THREE.CatmullRomCurve3([
                  new THREE.Vector3(uDist, axisY + objH, 0),
                  new THREE.Vector3(0, axisY + objH, 0),
                  new THREE.Vector3(fLen, axisY, 0),
                  new THREE.Vector3(2.4, axisY - (objH * (2.4 - fLen)) / fLen, 0),
                ]),
                28,
                0.024,
                8,
                false
              ),
              new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25 })
            );
            subjectRoot.add(rayRight1);

            // Backward virtual ray extensions (translucent blue-indigo segments to virtual image tip)
            const virtualMat = new THREE.MeshStandardMaterial({
              color: 0x6366f1,
              transparent: true,
              opacity: 0.55,
            });
            const backRay = new THREE.Mesh(
              new THREE.TubeGeometry(
                new THREE.CatmullRomCurve3([
                  new THREE.Vector3(0, axisY + objH, 0),
                  new THREE.Vector3(clampedV, axisY + imgH, 0),
                ]),
                16,
                0.018,
                8,
                false
              ),
              virtualMat
            );
            subjectRoot.add(backRay);
          }
        } else if (activePreset === 'VSEPR') {
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
          // Closed copper loop + battery + resistor + switch + capacitor + animated charge dots
          const board = new THREE.Mesh(
            new THREE.BoxGeometry(5.2, 0.14, 3.2),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7, metalness: 0.2 })
          );
          board.position.y = 0.07;
          subjectRoot.add(board);

          const wireMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.25, metalness: 0.85 });
          const loopPoints = [
            new THREE.Vector3(-1.9, 0.45, -1.0),
            new THREE.Vector3(1.9, 0.45, -1.0),
            new THREE.Vector3(1.9, 0.45, 1.0),
            new THREE.Vector3(-1.9, 0.45, 1.0),
            new THREE.Vector3(-1.9, 0.45, -1.0),
          ];
          const wireLoop = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loopPoints, false, 'catmullrom', 0.05), 64, 0.045, 12, false),
            wireMat
          );
          subjectRoot.add(wireLoop);

          // Cylindrical Resistor R on back rail (z = -1.0)
          const resistor = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.18, 0.9, 20),
            new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.45 })
          );
          resistor.rotation.z = Math.PI / 2;
          resistor.position.set(0, 0.48, -1.0);
          subjectRoot.add(resistor);

          // Battery cell on left rail (x = -1.9)
          const batteryBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, 0.75, 20),
            new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.35, metalness: 0.35 })
          );
          batteryBody.rotation.x = Math.PI / 2;
          batteryBody.position.set(-1.9, 0.48, 0);
          subjectRoot.add(batteryBody);

          // Closed switch indicator on front rail (z = 1.0)
          const switchBar = new THREE.Mesh(
            new THREE.BoxGeometry(0.65, 0.08, 0.12),
            new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 })
          );
          switchBar.position.set(0, 0.52, 1.0);
          subjectRoot.add(switchBar);

          // Parallel-plate capacitor C on right rail (x = 1.9)
          const sep = (0.34 + (deg / 60) * 0.45) * (sec / 1.5);
          const plateGeo = new THREE.BoxGeometry(1.1, 1.15, 0.09);
          const platePos = new THREE.Mesh(
            plateGeo,
            new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25, metalness: 0.8 })
          );
          platePos.position.set(1.9, 0.75, -sep / 2);
          subjectRoot.add(platePos);

          const plateNeg = new THREE.Mesh(
            plateGeo,
            new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.25, metalness: 0.8 })
          );
          plateNeg.position.set(1.9, 0.75, sep / 2);
          subjectRoot.add(plateNeg);

          for (let x = 1.65; x <= 2.15; x += 0.25) {
            const flux = createArrowGroup(0xf59e0b, Math.max(0.28, sep - 0.12), 0.025);
            flux.position.set(x, 0.8, -sep / 2 + 0.06);
            flux.rotation.x = Math.PI / 2;
            subjectRoot.add(flux);
          }

          // Animated charge carriers along wire loop
          const dotMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.7,
          });
          for (let i = 0; i < 6; i++) {
            const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), dotMat);
            dot.userData.phase = i / 6;
            subjectRoot.add(dot);
            rcChargeDots.push(dot);
          }
        } else if (activePreset === 'Parabola') {
          // Open Parabola y = a*x^2 on tilted cutting plane + Double Cone + Focus sphere
          const coneMat = new THREE.MeshStandardMaterial({
            color: 0x6366f1,
            roughness: 0.35,
            metalness: 0.25,
            transparent: true,
            opacity: 0.52,
          });
          const lowerCone = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.75, 36), coneMat);
          lowerCone.position.y = 0.88;
          subjectRoot.add(lowerCone);

          const slantAngle = Math.atan2(1.35, 1.75);
          const slicePlane = new THREE.Mesh(
            new THREE.BoxGeometry(2.6, 0.03, 2.4),
            new THREE.MeshStandardMaterial({
              color: 0x10b981,
              transparent: true,
              opacity: 0.38,
              roughness: 0.2,
            })
          );
          slicePlane.position.set(0.25, 1.0, 0);
          slicePlane.rotation.z = slantAngle;
          subjectRoot.add(slicePlane);

          const aCoeff = 0.45 * (sec / 1.5);
          const parabolaPts: THREE.Vector3[] = [];
          for (let s = -1.1; s <= 1.1; s += 0.1) {
            parabolaPts.push(new THREE.Vector3(-0.35 + aCoeff * s * s, 0.72 + aCoeff * s * s * 0.78, s));
          }
          const parabolaCurve = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(parabolaPts), 40, 0.048, 12, false),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, metalness: 0.7 })
          );
          subjectRoot.add(parabolaCurve);

          const focusSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.11, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0xef4444 })
          );
          focusSphere.position.set(0.05, 0.98, 0);
          subjectRoot.add(focusSphere);
        } else {
          // True Elliptical Conic Section with eccentricity driven by angleDeg
          const coneMat = new THREE.MeshStandardMaterial({
            color: 0x6366f1,
            roughness: 0.35,
            metalness: 0.25,
            transparent: true,
            opacity: 0.52,
          });
          const lowerCone = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.85, 36), coneMat);
          lowerCone.position.y = 0.92;
          subjectRoot.add(lowerCone);

          const tilt = (deg / 90) * 0.48;
          const slicePlane = new THREE.Mesh(
            new THREE.BoxGeometry(2.6, 0.03, 2.4),
            new THREE.MeshStandardMaterial({
              color: 0x10b981,
              transparent: true,
              opacity: 0.38,
              roughness: 0.2,
            })
          );
          slicePlane.position.y = 1.05;
          slicePlane.rotation.z = tilt;
          subjectRoot.add(slicePlane);

          const aRad = (0.72 + tilt * 0.65) * (sec / 1.5);
          const bRad = 0.68 * (sec / 1.5);
          const ellipsePts: THREE.Vector3[] = [];
          for (let i = 0; i <= 48; i++) {
            const p = (i / 48) * Math.PI * 2;
            const localX = aRad * Math.cos(p);
            const localZ = bRad * Math.sin(p);
            ellipsePts.push(
              new THREE.Vector3(
                localX * Math.cos(tilt),
                1.08 + localX * Math.sin(tilt),
                localZ
              )
            );
          }
          const ellipseTube = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ellipsePts, true), 56, 0.045, 12, true),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, metalness: 0.7 })
          );
          subjectRoot.add(ellipseTube);

          const cFocus = Math.sqrt(Math.max(0.01, aRad * aRad - bRad * bRad));
          [-cFocus, cFocus].forEach((fx) => {
            const fSphere = new THREE.Mesh(
              new THREE.SphereGeometry(0.09, 16, 16),
              new THREE.MeshStandardMaterial({ color: 0xef4444 })
            );
            fSphere.position.set(fx * Math.cos(tilt), 1.08 + fx * Math.sin(tilt), 0);
            subjectRoot.add(fSphere);
          });
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
          controls.update();

          if (stateRef.current.animateMotion) {
            const t = clock.getElapsedTime();
            if (stateRef.current.preset === 'RC Circuit' && rcChargeDots.length > 0) {
              rcChargeDots.forEach((dot) => {
                const ph = (Number(dot.userData.phase || 0) + t * 0.22) % 1;
                let x = -1.9;
                let z = -1.0;
                if (ph < 0.25) {
                  x = -1.9 + (ph / 0.25) * 3.8;
                  z = -1.0;
                } else if (ph < 0.5) {
                  x = 1.9;
                  z = -1.0 + ((ph - 0.25) / 0.25) * 2.0;
                } else if (ph < 0.75) {
                  x = 1.9 - ((ph - 0.5) / 0.25) * 3.8;
                  z = 1.0;
                } else {
                  x = -1.9;
                  z = 1.0 - ((ph - 0.75) / 0.25) * 2.0;
                }
                dot.position.set(x, 0.45, z);
              });
            } else if (dynamicBlockGroup) {
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
              subjectRoot.rotation.y = Math.sin(t * 0.85) * 0.32;
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
        rendererRef.current = null;
      };
    }, []);

    useEffect(() => {
      rebuildModelRef.current?.();
    }, [preset, angleDeg, paramSecondary, cameraPreset]);

    useEffect(() => {
      requestRenderRef.current?.();
    }, [animateMotion]);

    const sliderPrimaryLabel =
      preset === 'Convex Lens'
        ? `|u| = ${Math.abs(lensReadout?.uCm || 20).toFixed(1)} cm (f=20)`
        : preset === 'RC Circuit'
        ? `Plate Sep (${angleDeg})`
        : preset === 'Ellipse'
        ? `Plane Tilt (${angleDeg}°)`
        : `Angle / Param (${angleDeg}°)`;

    return (
      <div className="relative w-full h-[420px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#F8FAFC]">
        <div
          ref={canvasMountRef}
          data-testid="three-diagram-canvas"
          className="w-full h-full"
        />

        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 pointer-events-none flex flex-wrap items-center gap-2 max-w-[92%]">
          <span>
            3D Simulation · {preset}
            {lensReadout
              ? lensReadout.isAtFocus
                ? ' · Object at Focus (Image at ∞)'
                : ` · ${lensReadout.isRealImage ? 'Real Inverted' : 'Virtual Erect'} (v=${lensReadout.vCm.toFixed(1)} cm)`
              : ` (θ = ${angleDeg}°)`}
          </span>
          {animateMotion && (
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              Live Physics Motion
            </span>
          )}
        </div>

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
                <span>{sliderPrimaryLabel}:</span>
                <input
                  type="range"
                  min={15}
                  max={60}
                  value={angleDeg}
                  onChange={(e) => setAngleDeg(Number(e.target.value))}
                  aria-label="Primary 3D physics parameter"
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
                  aria-label="Scale factor"
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
  }
);

ThreeSceneCanvas.displayName = 'ThreeSceneCanvas';
