import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateMathDetailed,
  safeEvaluateMathExpression,
  validateMathSyntax,
} from './safeMathParser';
import {
  evaluateDerivative,
  findCurveIntersections,
  findRootsAndExtrema,
} from './jeeEngine';
import {
  escapeXmlText,
  sanitizeHexOrCssColor,
  sanitizeSvgMarkup,
} from './svgSanitizer';

test('AST math parser evaluates precedence, unary minus, implicit multiplication, and constants', () => {
  assert.equal(safeEvaluateMathExpression('y = 2x^2 - 3x + 1', 3), 10);
  assert.equal(safeEvaluateMathExpression('-x^2 + 4', 2), 0);
  assert.equal(safeEvaluateMathExpression('a * x^2 - c', 2, { a: 3, c: 5 }), 7);
  const piSin = safeEvaluateMathExpression('sin(pi / 6)', 0, {}, 'rad');
  assert.ok(piSin !== null && Math.abs(piSin - 0.5) < 1e-6);
});

test('AST math parser respects RAD vs DEG angle mode across nested trig and inverse trig', () => {
  const degSin = safeEvaluateMathExpression('sin(30)', 0, {}, 'deg');
  assert.ok(degSin !== null && Math.abs(degSin - 0.5) < 1e-6);

  const degCos = safeEvaluateMathExpression('cos(x)', 60, {}, 'deg');
  assert.ok(degCos !== null && Math.abs(degCos - 0.5) < 1e-6);

  const degAsin = safeEvaluateMathExpression('asin(0.5)', 0, {}, 'deg');
  assert.ok(degAsin !== null && Math.abs(degAsin - 30) < 1e-6);

  const radSin = safeEvaluateMathExpression('sin(pi / 2)', 0, {}, 'rad');
  assert.ok(radSin !== null && Math.abs(radSin - 1) < 1e-6);
});

test('AST math parser handles domain asymptotes and invalid syntax without throwing', () => {
  assert.equal(safeEvaluateMathExpression('1 / x', 0), null);
  assert.equal(safeEvaluateMathExpression('sqrt(-4)', 0), null);
  assert.equal(safeEvaluateMathExpression('ln(0)', 0), null);
  assert.equal(safeEvaluateMathExpression('tan(90)', 0, {}, 'deg'), null);

  const syn = validateMathSyntax('2 * (x + 1');
  assert.equal(syn.valid, false);
  assert.match(syn.error || '', /parenthesis|"\)"/i);

  const det = evaluateMathDetailed('sin x', 1);
  assert.equal(det.value, null);
  assert.match(det.error || '', /parentheses/i);
});

test('AST math parser rejects code injection payloads cleanly', () => {
  const attacks = [
    'process.exit(1)',
    'constructor.constructor("return process")()',
    'window.alert(1)',
    'globalThis.fetch("https://evil.test")',
    'eval("1+1")',
    '__proto__',
  ];
  for (const payload of attacks) {
    const res = validateMathSyntax(payload);
    assert.equal(res.valid, false, `Expected injection payload rejected: ${payload}`);
    assert.equal(safeEvaluateMathExpression(payload, 1), null);
  }
});

test('Graphing derivatives, roots, extrema, and intersections honor angleMode', () => {
  const deriv = evaluateDerivative('x^3', 2);
  assert.ok(deriv !== null && Math.abs(deriv - 12) < 1e-3);

  const roots = findRootsAndExtrema('x^2 - 4', -3, 3);
  const xs = roots.filter((r) => r.type === 'root').map((r) => r.x);
  assert.ok(xs.some((x) => Math.abs(x + 2) < 0.05));
  assert.ok(xs.some((x) => Math.abs(x - 2) < 0.05));

  const degRoots = findRootsAndExtrema('sin(x)', 170, 190, {}, 'deg');
  assert.ok(degRoots.some((r) => r.type === 'root' && Math.abs(r.x - 180) < 0.2));

  const inters = findCurveIntersections('x^2', '4', -3, 3);
  assert.equal(inters.length, 2);
});

test('SVG XSS sanitizer removes scripts, event handlers, foreignObject, and unsafe URLs', () => {
  const dirty =
    '<svg viewBox="0 0 100 100" onload="alert(1)"><script>fetch("x")</script><foreignObject><body onload="x()"></body></foreignObject><use xlink:href="https://evil.com/x.svg#a"/><rect width="20" height="20" fill="red" onclick="steal()" style="background:url(javascript:alert(1))"/><text>Safe Vector</text></svg>';
  const clean = sanitizeSvgMarkup(dirty);
  assert.ok(clean.startsWith('<svg'));
  assert.ok(!clean.includes('<script'));
  assert.ok(!clean.includes('<foreignObject'));
  assert.ok(!clean.includes('onload='));
  assert.ok(!clean.includes('onclick='));
  assert.ok(!clean.includes('javascript:'));
  assert.ok(!clean.includes('https://evil.com'));
  assert.ok(clean.includes('Safe Vector'));

  assert.equal(escapeXmlText('<script>"&\''), '&lt;script&gt;&quot;&amp;&#39;');
  assert.equal(sanitizeHexOrCssColor('#4F46E5'), '#4F46E5');
  assert.equal(sanitizeHexOrCssColor('red" onclick="alert(1)'), '#2563EB');
});
