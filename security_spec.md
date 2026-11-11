# LearnMate JEE — Zero-Trust Firestore Security Specification

## 1. Data Invariants

1. **Default-Deny Catch-All**: No collection or subcollection is accessible unless explicitly matched and validated (`allow read, write: if false;` at root).
2. **Strict Tenant Isolation (No Shared/Public PII or Study Data)**: Every document in `/users/{userId}`, `/materials/{materialId}`, `/tasks/{taskId}`, `/creations/{creationId}`, `/mockAttempts/{attemptId}`, and `/revisions/{revisionId}` belongs to a single authenticated student (`userId == request.auth.uid`) with `request.auth.token.email_verified == true`.
3. **Path Variable Hardening**: Every document ID (`{userId}`, `{materialId}`, `{taskId}`, `{creationId}`, `{attemptId}`, `{revisionId}`) on single-document operations (`get`, `create`, `update`, `delete`) must satisfy `isValidId(id)` (`id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
4. **Anti-Update-Gap & Schema Completeness**: Every `create` and `update` must invoke `isValid[Entity](incoming())`, verifying exact required/allowed keys (`hasAll` and `hasOnly`), string length bounds, numeric ranges, enum membership, and immutable ownership (`incoming().userId == existing().userId` and `incoming().createdAt == existing().createdAt`).
5. **Temporal Integrity**: `createdAt` must equal `request.time` on `create`, and `updatedAt` must equal `request.time` on both `create` and `update`.
6. **Query Enforcer (No Blanket Reads)**: Every `allow list` rule explicitly enforces `resource.data.userId == request.auth.uid` so no client can list another student's materials, tasks, creations, mocks, or revisions.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Identity Spoofing on Create)**: Authenticated user `uid_attacker` creates `/materials/mat_1` with `userId: "uid_victim"` -> **PERMISSION_DENIED**.
2. **Payload 2 (Shadow / Ghost Field Injection)**: Owner updates `/users/uid_1` adding `{ isAdmin: true }` -> **PERMISSION_DENIED** (`hasOnly` & `affectedKeys().hasOnly()` rejection).
3. **Payload 3 (Unverified Email Write)**: User with `email_verified: false` attempts to create `/tasks/task_1` -> **PERMISSION_DENIED**.
4. **Payload 4 (Cross-Tenant PII Read)**: Authenticated user `uid_attacker` attempts `get` on `/users/uid_victim` -> **PERMISSION_DENIED**.
5. **Payload 5 (Blanket List Scraping)**: Authenticated user `uid_attacker` issues unconstrained `list` on `/materials` without `where('userId', '==', 'uid_attacker')` -> **PERMISSION_DENIED**.
6. **Payload 6 (Denial-of-Wallet Oversized String)**: Owner creates `/tasks/task_1` with a 50,000-character `title` (limit 200) -> **PERMISSION_DENIED**.
7. **Payload 7 (ID Poisoning)**: Owner creates `/materials/invalid$id!with spaces` -> **PERMISSION_DENIED** (`isValidId` regex failure).
8. **Payload 8 (Immutable Ownership Mutation)**: Owner updates `/materials/mat_1` changing `userId` to `"uid_other"` -> **PERMISSION_DENIED**.
9. **Payload 9 (Timestamp Forgery)**: Owner creates `/mockAttempts/att_1` with a backdated `createdAt` instead of `request.time` -> **PERMISSION_DENIED**.
10. **Payload 10 (Invalid Enum Injection)**: Owner creates `/materials/mat_1` with `subject: "Biology"` (only `Physics`, `Chemistry`, `Mathematics` allowed) -> **PERMISSION_DENIED**.
11. **Payload 11 (Value Poisoning on Update)**: Owner updates whitelisted key `xp` on `/users/uid_1` with a string `"999999"` instead of an integer -> **PERMISSION_DENIED** (`isValidUserProfile` blocks invalid type).
12. **Payload 12 (Immutable Creation Timestamp Mutation)**: Owner updates `/tasks/task_1` modifying `createdAt` -> **PERMISSION_DENIED**.
