# LearnMate JEE — Production Operations, Rollback & Backup Runbook

## 1. Pre-Deployment Checklist
1. Verify all environment secrets are configured in Render (`render.yaml` / Dashboard):
   - `NODE_ENV=production`
   - `GEMINI_API_KEY`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (Service Account with Firebase Auth Admin, Cloud Firestore User, and Storage Object Admin)
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
   - `ALLOWED_ORIGINS` (exact HTTPS origin(s), never `*`)
   - `PAYMENT_WEBHOOK_SECRET` + Gateway key (`STRIPE_SECRET_KEY` or `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`)
2. Run preflight verification suite before merging:
   ```bash
   npm test
   npm run audit:rules
   npm run lint
   npm run build
   ```
3. Run Firestore Rules unit tests against the real Firebase Emulator (requires Java JRE):
   ```bash
   firebase emulators:exec --only firestore "npx tsx --test firestore.rules.test.ts"
   ```
4. Smoke test live health readiness after deploy:
   - `GET /api/health` must return HTTP `200` with `status: "ok"`, `firestoreReady: true`, `authAdminReady: true`.
   - In production, if Firebase Admin / Firestore is uninitialized, `/api/health` returns HTTP `503` (`status: "degraded"`).

## 2. Fail-Closed Guarantees
- **Authentication**: Production rejects `local_token_*` and refuses unrevoked JWKS fallback (`ALLOW_UNREVOKED_CERT_FALLBACK` is disabled by default).
- **WebSockets (`/api/live`)**: Query-string `?token=` is rejected. Clients authenticate exclusively via `Sec-WebSocket-Protocol: learnmate-auth.<jwt>`, and usage counts against daily UID quotas.
- **Persistence & Billing**: Production throws HTTP `503 PERSISTENCE_UNAVAILABLE` if Firestore Admin is missing; billing checkout returns `503 PAYMENTS_NOT_CONFIGURED` unless gateway keys and webhook secrets are set.
- **Exam Keys**: Public static packs (`/pyq-packs/*.json`) and CBT question endpoints strip answer keys and solutions. Official grading is executed on `/api/cbt/grade` against server-side answer keys.

## 3. Rollback Procedure
1. **Application Code Rollback (Render / Cloud Run)**:
   - Open Render Dashboard -> `learnmate-jee` service -> **Events** -> select last verified green deploy -> click **Rollback to this deploy** (< 60s).
   - Ensure `firestore.rules` and `storage.rules` remain backward-compatible with `N-1` schema (`MockAttempt` carries `examVersion` and `keyVersion`).
2. **Security Rules Rollback**:
   - Deploy previous `firestore.rules` / `storage.rules` via `firebase deploy --only firestore:rules,storage`.
   - Never roll back rules before checking active `migrationVersion` on student `/users/{uid}` documents.

## 4. Backup & Disaster Recovery (RPO <= 24h / PITR)
1. **Firestore Point-in-Time Recovery (PITR) & Scheduled Exports**:
   - Enable PITR (`gcloud firestore databases update --enable-pitr`) on the production database for 7-day 1-minute granularity recovery.
   - Schedule daily managed exports to a geo-redundant GCS backup bucket (`gs://<project>-backups/firestore/`):
     ```bash
     gcloud firestore export gs://<project>-backups/firestore/$(date +%Y-%m-%d)
     ```
2. **Cloud Storage Object Versioning**:
   - Enable Object Versioning + 30-day noncurrent retention lifecycle rule on `VITE_FIREBASE_STORAGE_BUCKET`.
3. **Privacy & Account Erasure Compliance (DPDP / GDPR)**:
   - Student-initiated account deletion triggers `DELETE /api/account` which purges `/users/{uid}/*`, `storage_assets/{uid}/*`, GCS user objects (`users/${uid}/`), billing records, and calls `firebaseAdmin.auth().deleteUser(uid)`.
