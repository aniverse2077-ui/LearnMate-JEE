import test from 'node:test';
import assert from 'node:assert/strict';
import {
  solveThinLens,
  solveInclinedPlaneForces,
  detectDiagramTopic,
  synthesizeTopicAccurateSvg,
  injectVectorsIntoSvg,
} from './opticsAndGeometrySolver';

test('solveThinLens handles real inverted, virtual erect, diverging lens, and focus asymptote cleanly', () => {
  // Real inverted image: f = +20 cm, u = -30 cm => 1/v = 1/20 - 1/30 = 1/60 => v = +60 cm, m = -2
  const realImg = solveThinLens({ focalLengthCm: 20, objectDistanceCm: -30, objectHeightCm: 4 });
  assert.equal(realImg.regime, 'real_inverted');
  assert.equal(realImg.isRealImage, true);
  assert.equal(realImg.isErect, false);
  assert.ok(Math.abs(realImg.vCm - 60) < 1e-6);
  assert.ok(Math.abs(realImg.magnification - -2) < 1e-6);

  // Virtual erect image inside focus: f = +20 cm, u = -10 cm => 1/v = 1/20 - 1/10 = -1/20 => v = -20 cm, m = +2
  const virtualImg = solveThinLens({ focalLengthCm: 20, objectDistanceCm: -10, objectHeightCm: 4 });
  assert.equal(virtualImg.regime, 'virtual_erect');
  assert.equal(virtualImg.isRealImage, false);
  assert.equal(virtualImg.isErect, true);
  assert.ok(Math.abs(virtualImg.vCm - -20) < 1e-6);
  assert.ok(Math.abs(virtualImg.magnification - 2) < 1e-6);

  // Focal asymptote guard: f = +20 cm, u = -20 cm => Infinity guarded
  const focusImg = solveThinLens({ focalLengthCm: 20, objectDistanceCm: -20 });
  assert.equal(focusImg.isAtFocus, true);
  assert.equal(focusImg.regime, 'at_focus_infinity');

  // Diverging concave lens: f = -20 cm, u = -30 cm => 1/v = -1/20 - 1/30 = -5/60 => v = -12 cm, m = +0.4
  const concave = solveThinLens({ focalLengthCm: -20, objectDistanceCm: -30 });
  assert.equal(concave.regime, 'diverging_virtual');
  assert.equal(concave.isRealImage, false);
  assert.equal(concave.isErect, true);
  assert.ok(Math.abs(concave.vCm - -12) < 1e-6);
});

test('solveInclinedPlaneForces enforces static friction equilibrium and kinetic sliding threshold', () => {
  // Block at rest: theta = 15 deg, tan(15) ~ 0.268 < mu_s = 0.40 => a = 0, friction = mg sin(theta)
  const staticCase = solveInclinedPlaneForces({ massKg: 2, thetaDeg: 15, muStatic: 0.4, muKinetic: 0.3, g: 10 });
  assert.equal(staticCase.isSliding, false);
  assert.equal(staticCase.accelerationMs2, 0);
  assert.ok(Math.abs(staticCase.actualFrictionN - staticCase.parallelGravityN) < 1e-6);

  // Sliding: theta = 45 deg, mu_s = 0.2, mu_k = 0.2 => a > 0
  const slidingCase = solveInclinedPlaneForces({ massKg: 2, thetaDeg: 45, muStatic: 0.2, muKinetic: 0.2, g: 10 });
  assert.equal(slidingCase.isSliding, true);
  assert.ok(slidingCase.accelerationMs2 > 5);
});

test('detectDiagramTopic and synthesizeTopicAccurateSvg render topic-accurate geometry without unrelated substitutions', () => {
  assert.equal(detectDiagramTopic('Convex Lens Ray Optics with object inside focus'), 'lens');
  assert.equal(detectDiagramTopic('Wheatstone Bridge Kirchhoff Loop'), 'wheatstone');
  assert.equal(detectDiagramTopic('Daniell Galvanic Cell Nernst Salt Bridge'), 'galvanic_cell');
  assert.equal(detectDiagramTopic('Standard Parabola y^2 = 4ax and Directrix'), 'parabola');
  assert.equal(detectDiagramTopic('Unrelated random poem about clouds'), 'unmatched');

  const lensOut = synthesizeTopicAccurateSvg({ prompt: 'Convex Lens u = -12 cm inside focus', objectDistanceCm: 12 });
  assert.equal(lensOut.matched, true);
  assert.ok(lensOut.svg.includes('<svg'));
  assert.ok(lensOut.svg.includes('1/v'));

  const unknownOut = synthesizeTopicAccurateSvg({ prompt: 'Totally unknown abstract concept' });
  assert.equal(unknownOut.matched, false);
  assert.ok(!unknownOut.svg.includes('Projectile'));
  assert.ok(unknownOut.svg.includes('Custom Concept Canvas'));
});

test('injectVectorsIntoSvg rotates vectors safely and strips XSS payloads', () => {
  const base = synthesizeTopicAccurateSvg({ prompt: 'Inclined Plane FBD', thetaDeg: 30 }).svg;
  const injected = injectVectorsIntoSvg(base, [
    {
      id: 'v1',
      label: 'N <script>alert(1)</script>',
      xPct: 50,
      yPct: 50,
      dx: 40,
      dy: -40,
      angleDeg: 60,
      magnitude: 60,
      color: '#4F46E5',
    },
  ]);
  assert.ok(!injected.toLowerCase().includes('<script'));
  assert.ok(injected.includes('&lt;script&gt;'));
  assert.ok(injected.includes('marker-end="url(#vec-arr-0)"'));
});
