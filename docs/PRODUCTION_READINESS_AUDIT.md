# LearnMate JEE — Production Readiness & Security Audit

**Audit Date:** 2026-11-13  
**Repository:** `aniverse2077-ui/LearnMate-JEE`  
**Overall Readiness Verdict:** **`BETA_READY`** (Production-hardened codebase, fail-closed auth, verified academic/scoring rules, sanitized SVG/AST math engines, and commercial webhook/entitlement plumbing; external live production secrets — Firebase service account / web config and Razorpay/Stripe gateway keys — remain unprovisioned in this sandbox and fail closed honestly with `503 PAYMENTS_NOT_CONFIGURED`).

---

## 1. Executive Summary & Scorecard

| Audit Domain | Baseline State (Imported) | Current Verified State | Score | Status |
| :--- | :--- | :--- | :---: | :--- |
| **Auth & Fail-Closed API Security** | Spoofable `x-learnmate-uid` & `local_token_*` accepted; unauthenticated WS & AI endpoints | Strict Firebase Admin / RS256 JWKS verification on all protected `/api/*` and WS `/api/live`; zero-trust tenant scoping | **9.5 / 10** | Hardened |
| **Firestore Rules & Data Isolation** | Legacy wildcard rules; cross-tenant read risks | Canonical `/users/{uid}/...` subcollections, field/size bounds, immutable server-only `billing` & `auditLogs`; ESLint security rules pass | **9.5 / 10** | Hardened |
| **Client Calculation & Render Safety** | Dynamic `new Function(...)` math evaluator; raw unsanitized `dangerouslySetInnerHTML` SVG injection | Zero-eval recursive-descent AST math parser (`safeMathParser.ts`) + allowlist DOM/regex SVG sanitizer (`svgSanitizer.ts`) | **9.8 / 10** | Verified |
| **Academic & Exam Pattern Accuracy** | Legacy JEE Main Section B `+4/0` & optional pattern drift; boilerplate formula injection | Official JEE Main 2027 Paper 1 (`75` compulsory Qs, `+4 / -1` in both Section A & B); source-grounded bundles; explicit `QuestionProvenanceType` | **9.5 / 10** | Verified |
| **Multimodal Ingestion Honesty** | Short 3-page slice limit; unverified YouTube URL fallbacks; synthetic study prose | Multi-page PDF chunking up to `250` client / `120` Firestore chunks (`60+` page packs tested); honest `422 CAPTIONS_UNAVAILABLE`; SRT/VTT/12h timestamp parser | **9.2 / 10** | Verified |
| **Commercial Billing & Abuse Prevention** | Client-side free tier self-upgrade; missing webhook HMAC checks | Server-authoritative entitlement catalog, HMAC-SHA256 `x-learnmate-signature` webhook verification, idempotency, refund revocation, honest `503 PAYMENTS_NOT_CONFIGURED` | **9.0 / 10** | Hardened (`BETA_READY` pending live gateway keys) |
| **Performance, Build & Responsive UX** | Unsplit monolith bundle; inline mobile sidebar breaking `< 768px` layout | Rollup `manualChunks` (`vendor`, `three-vendor`, `firebase-vendor`, `math-vendor`, `pdfjs-vendor`); verified `1440x900` light/dark & `390x844` mobile slide-over drawer | **9.0 / 10** | Verified |

---

## 2. Automated Verification Evidence (Measured Post-Final-Edit)

### 2.1 Security Rules, TypeScript & Unit/Integration Tests
- **`npx eslint firestore.rules`**: Exit `0` (passes `@firebase/eslint-plugin-security-rules` cleanly).
- **`npm run lint` (`tsc --noEmit`)**: Exit `0` (0 TypeScript errors across client and server).
- **`compile_applet`**: Succeeded cleanly.
- **`npm test`** (`tsx --test src/utils/*.test.ts src/server/*.test.ts firestore.rules.test.ts`): **25 / 25 tests passing (`0` failed, `1641.2 ms`)**:
  - `firestore.rules.test.ts` (2/2): Canonical tenant subcollections, zero user enumeration, server-only billing writes, adversarial payload rejection.
  - `src/server/securityAndBilling.test.ts` (4/4): Fail-closed `401` on missing/`local_token_*`/unsigned JWT/`x-learnmate-uid` spoofing in production across `/api/ai/tutor`, `/api/ai/think`, `/api/ingest/youtube`, `/api/storage/signed-url`, `/api/commercial/entitlements`, `/api/pyq/report-issue`; CORS + `/api/health` diagnostics; HMAC-SHA256 webhook verification, replay idempotency, refund revocation, and `503` when gateway secrets are unconfigured; cross-tenant chunk retrieval isolation (`student_A` vs `student_B`).
  - `src/utils/academicAndProvenance.test.ts` (6/6): JEE Main 2027 Paper 1 (`75` compulsory Qs, `+4/-1` Section A & B), JEE Advanced (`+4/-2` partial & `+4/0` integer), source-grounded 62-page material bundle with zero unrelated boilerplate formulas, 65-page document chunking, YouTube URL validation & SRT/VTT cue parsing (`00:00:05`, `00:05:10`), lazy PYQ pack provenance & `isPartialArchive: true` disclosure.
  - `src/utils/jeeEngine.test.ts` (7/7): NTA 58-chapter catalog (`20` Physics, `20` Chemistry, `18` Mathematics), multi-exam evaluation (`BITSAT +3/-1`, `NEET UG +4/-1`), SM-2 spaced repetition, shift percentile prediction, 12-hour marathon timestamp chunking.
  - `src/utils/safeMathParser.test.ts` (6/6): AST operator precedence, unary minus, implicit multiplication, constants, `RAD` vs `DEG` trig & inverse trig, domain asymptotes without exceptions, code injection payload rejection, graphing derivatives/roots/extrema/intersections, SVG XSS sanitizer (`<script>`, `onload`/`onerror`, `<foreignObject>`, `javascript:` URIs).

### 2.2 Production Bundle Output (`npm run build`)
Built via Vite 8 / Rolldown in `1.63s`:
- `dist/assets/index-DYfu2dUP.js`: `751.05 kB` (`gzip: 158.06 kB`)
- `dist/assets/vendor-DyuU6umf.js`: `622.06 kB` (`gzip: 186.66 kB`)
- `dist/assets/three-vendor-BZCGcEpL.js`: `600.43 kB` (`gzip: 149.82 kB`)
- `dist/assets/firebase-vendor-DEoHj9dG.js`: `573.49 kB` (`gzip: 171.85 kB`)
- `dist/assets/math-vendor-Dfb2AcFN.js`: `562.89 kB` (`gzip: 169.43 kB`) + CSS `29.80 kB` (`gzip: 7.97 kB`)
- `dist/assets/pdfjs-vendor-BBvN0uvO.js`: `444.36 kB` (`gzip: 133.86 kB`)
- `dist/assets/index-CMrQYYGx.css`: `90.32 kB` (`gzip: 14.19 kB`)

### 2.3 Live Browser Verification (`playwright-cli`, Headless Chromium)
- **Desktop `1440x900` Light Mode** (`/` Landing + `/?autostart=1` Dashboard, Practice, Study Tools Graphing Drawer): `scrollWidth === 1440`, zero layout overlap, Study Tools header & 5-tab bar (`Graph | Calculator | Units | Statistics | Formulas`) cleanly unclipped, zero API 401 console noise in preview mode.
- **Desktop `1440x900` Dark Mode**: Theme toggle applies `dark` class cleanly across sidebar, cards, modals, and status footer.
- **Mobile `390x844`**: `scrollWidth === 390` (`overflow: false`), compact header controls, desktop sidebar collapses behind slide-over mobile drawer (`LearnMate JEE Menu`), Practice & Dashboard cards reflow cleanly.

---

## 3. Security, Privacy & OWASP Hardening Inventory

- **Server-Side Token Verification (`src/server/studentAuth.ts`, `src/server/middleware/authAndSecurity.ts`)**:
  - Rejects `x-learnmate-uid` header spoofing and `local_token_*` when `NODE_ENV === 'production'` or `ALLOW_DEV_AUTH_BYPASS !== 'true'`.
  - Verifies Firebase ID tokens via Firebase Admin SDK or Google `securetoken` RS256 JWKS fallback with `aud`/`iss`/`exp` validation.
  - WebSocket `/api/live` (`src/server/ws/voiceLiveServer.ts`) enforces token auth via `learnmate-auth.<token>` subprotocol (no secrets in query strings) and applies per-connection message/session caps.
- **Transport, CORS & Payload Caps (`server.ts`, `src/server/middleware/rateLimiterAndQuotas.ts`)**:
  - `helmet` CSP & security headers enabled; configurable `TRUST_PROXY` (`1` on Render/reverse proxies).
  - Strict origin allowlist blocking untrusted cross-origin requests (`403 CORS_FORBIDDEN`).
  - Default `1mb` JSON limit globally; `15mb` scoped strictly to `/api/ai/analyze`, `/api/ai/transcribe`, `/api/ai/image-edit`, `/api/ingest`.
  - Structured JSON logging redacts tokens, cookies, and API keys; rate limits and per-tier daily scan/AI quotas return structured `429` JSON with `Retry-After`.
- **Safe Client Evaluation & Rendering (`src/utils/safeMathParser.ts`, `src/utils/svgSanitizer.ts`)**:
  - Replaced unsafe dynamic code evaluation with a pure TypeScript lexer/parser/AST evaluator supporting `RAD`/`DEG`, explicit syntax validation, and symbolic/numerical graphing (`d/dx`, roots, extrema, intersections).
  - Sanitized all SVG previews, exports, and vector overlays (`sanitizeSvgMarkup`) stripping `<script>`, event attributes, `<foreignObject>`, and `javascript:`/`data:text/html` links.
- **DPDP / Student Account Deletion (`src/components/GlobalOverlays.tsx`, `src/services/workspaceService.ts`)**:
  - Explicit minor/guardian DPDP compliance notice in `LegalComplianceModal`.
  - Two-step inline `Delete Account & Data` workflow purging UID-scoped IndexedDB, `localStorage`, and tenant Firestore subcollections.

---

## 4. Academic Integrity & Grounded Ingestion

- **Official Exam Spec (`src/config/examSpecs.ts`, `src/utils/jeeEngine.ts`)**:
  - JEE Main 2027 Paper 1 (`75` compulsory questions: `25` Physics, `25` Chemistry, `25` Mathematics; Section A MCQs `+4/-1`, Section B Numericals `+4/-1`), strict numerical rounding tolerance.
  - JEE Advanced partial marking (`MULTI_MCQ +4/-2/+3/+2/+1`, `NUMERICAL +4/0`, `PARAGRAPH +3/-1`, `MATRIX_MATCH +4/-1`).
- **Source-Grounded Study Engine (`src/services/studyBundleBuilder.ts`, `src/services/ingestionJobsService.ts`)**:
  - PDF extraction across `250` client pages / `120` Firestore page chunks with progress callbacks; content-hash deduplication; strict `uid` isolation in chunk retrieval.
  - YouTube ingestion validates URLs, parses genuine SRT/VTT/12h timestamped transcripts, and fails closed (`422 CAPTIONS_UNAVAILABLE`) when captions are missing — zero hallucinated summaries.
  - Inline `Report Issue` on practice questions submits structured reports to authenticated `POST /api/pyq/report-issue` (`src/server/routes/pyqAndCbtRoutes.ts`).
- **Closed-Loop Learning (`src/services/learningLoopService.ts`)**:
  - Connects `Attempt → Diagnose → Reteach → Recheck → Schedule (SM-2) → Verify Improvement` across CBT mocks, Practice, AI Tutor (`difficulty: board | jee_main | jee_advanced`, `strict_material | open_jee`, page citations, Unit Check), and Mistake Book.

---

## 5. Why Verdict is `BETA_READY` (and Promotion Checklist to `PRODUCTION_READY`)

All application code, security enforcement, test suites, CI workflow (`.github/workflows/ci.yml`), and k6 load test suite (`load-tests/k6-study-api.js`) are verified and passing. Full live production deployment requires configuring environment secrets outside this repository:
1. **Firebase Production Credentials**: Populate `FIREBASE_SERVICE_ACCOUNT_JSON` and `VITE_FIREBASE_*` keys; deploy `firestore.rules` to the target Firebase project.
2. **Payment Gateway Activation**: Set `PAYMENT_GATEWAY_PROVIDER`, `PAYMENT_WEBHOOK_SECRET`, and Razorpay/Stripe API keys to enable `/api/commercial/checkout` (currently returns `503 PAYMENTS_NOT_CONFIGURED` cleanly).
3. **Production Origins & AI Quota Monitoring**: Configure `CORS_ALLOWED_ORIGINS`, `TRUST_PROXY=true`, and `GEMINI_API_KEY` / `AI_REQUESTS_PER_MINUTE` on the host (e.g., Render via `render.yaml`).
