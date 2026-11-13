# LearnMate JEE — Zero-Trust Firestore Security Specification

## 1. Canonical Tenant-Scoped Data Invariants

1. **Default-Deny Catch-All**: No collection or subcollection is accessible unless explicitly matched and validated (`allow read, write: if false;` at root).
2. **Strict Tenant Subcollection Isolation**: All user workspace entities live exclusively under `/users/{userId}/...` subcollections (`materials`, `materials/{materialId}/chunks`, `tasks`, `creations`, `mockAttempts`, `revisions`, `flashcards`, `studyJobs`, `cbtDrafts`, `entitlements`, `billingEvents`). Every document belongs to a single verified student (`userId == request.auth.uid && request.auth.uid == userId`) with `request.auth.token.email_verified == true` for writes.
3. **Zero User Enumeration & Server-Only Commercial State**: `/users/{userId}` sets `allow list: if false;`. Subscription `/entitlements/{docId}` and `/billingEvents/{eventId}` are strictly `allow write: if false;` on the client (mutated solely via Admin SDK webhook/billing handlers). `/issueReports/{reportId}` allows authenticated create and owner `get` only (`list`, `update`, `delete` denied).
4. **Legacy Migration Guard**: Top-level legacy collections (`/materials`, `/tasks`, `/creations`, `/mockAttempts`, `/revisions`) forbid `create` and `update` (`allow create, update: if false;`) while permitting owner-only `get, list, delete` so one-time client migration moves data safely into `/users/{userId}/...`.
5. **Path Variable & Field Hardening**: Every document ID satisfies `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars). Every `create` and `update` validates `hasAll`, `hasOnly`, enums, string lengths, numeric ranges, immutable `userId`/`createdAt`, and `request.time` timestamps.

## 2. Adversarial "Dirty Dozen" Payloads

1. **Cross-Tenant Material Create**: `uid_attacker` writes `/users/uid_victim/materials/mat_1` -> **PERMISSION_DENIED**.
2. **Ghost / Shadow Field Injection**: Owner updates `/users/uid_1` adding `{ isAdmin: true }` -> **PERMISSION_DENIED**.
3. **Unverified Email Write**: User with `email_verified: false` writes `/users/uid_1/tasks/task_1` -> **PERMISSION_DENIED**.
4. **Cross-Tenant PII Read**: `uid_attacker` reads `/users/uid_victim` -> **PERMISSION_DENIED**.
5. **User Enumeration Scrape**: Any authenticated user runs `list` on `/users` or `/issueReports` -> **PERMISSION_DENIED**.
6. **Self-Upgrade Entitlement Forgery**: Owner attempts to write `/users/uid_1/entitlements/current` -> **PERMISSION_DENIED**.
7. **Legacy Collection Write**: Owner attempts `create` on top-level `/materials/mat_1` -> **PERMISSION_DENIED**.
8. **ID Poisoning**: Owner creates `/users/uid_1/materials/bad$id with spaces` -> **PERMISSION_DENIED**.
9. **Timestamp Forgery**: Owner creates `/users/uid_1/mockAttempts/att_1` with backdated `createdAt` -> **PERMISSION_DENIED**.
10. **Invalid Enum Injection**: Owner writes `subject: "History"` or `sourceType: "exe"` -> **PERMISSION_DENIED**.
11. **Oversized Denial-of-Wallet Payload**: Owner submits 50,000-character `title` -> **PERMISSION_DENIED**.
12. **Immutable Ownership / Timestamp Mutation**: Owner modifies `userId` or `createdAt` on update -> **PERMISSION_DENIED**.
