# Security Specification (`security_spec.md`)

## 1. Data Invariants & Master Source of Truth

1. **Global Default Deny**: Any path not explicitly matched in `firestore.rules` is unconditionally denied (`allow read, write: if false;`).
2. **Super Admin Authority**: Super Admin privileges are granted ONLY when `request.auth != null && request.auth.token.email_verified == true && (request.auth.token.email == 'arn.gingoyon@gmail.com' || exists(/databases/$(database)/documents/admins/$(request.auth.uid)))`. Unverified emails (`email_verified == false`) are strictly rejected to prevent email spoofing.
3. **User Profile Isolation (`/users/{userId}`)**:
   - A user profile document ID `{userId}` must match `^[a-zA-Z0-9_\-]+$` (max 128 chars) and equal `request.auth.uid`.
   - Only the document owner (`request.auth.uid == userId`) or the verified Super Admin (`isAdmin()`) can `get` the profile.
   - `list` queries on `/users` are restricted to `resource.data.uid == request.auth.uid || isAdmin()`.
   - `uid` and `createdAt` are immutable across updates; `createdAt` and `updatedAt` must equal `request.time`.
4. **Interaction Subcollection Relational Sync (`/users/{userId}/interactions/{interactionId}`)**:
   - Master Gate: Creating an interaction requires that the parent `/users/$(userId)` profile document exists (`exists(/databases/$(database)/documents/users/$(userId))`) and belongs to `request.auth.uid == userId`.
   - Strict Isolation: Users can only `get` or `list` interactions where `userId == request.auth.uid && resource.data.userId == request.auth.uid`. Super Admin (`isAdmin()`) has read (`get`, `list`) access across users to review quality audit results.
   - Interactions are immutable audit logs once created (or only deletable by owner/admin); `userId` and `createdAt` cannot be forged.
5. **Company Audit Basis Governance (`/company_docs/{docId}`)**:
   - Only the verified Super Admin (`isAdmin()`) can `create`, `update`, or `delete` documents in `/company_docs/{docId}`.
   - Authenticated users (`isSignedIn()`) can `get` or `list` documents in `/company_docs/{docId}` only when `resource.data.status == 'published' || isAdmin()`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Shadow Field Injection on UserProfile)**: Adding `"isAdmin": true` or `"role": "superadmin"` to `/users/{userId}`. Rejected by `data.keys().hasOnly(...)`.
2. **Payload 2 (Cross-User Profile Read/Write)**: Authenticated user `user_A` attempting `get` or `update` on `/users/user_B`. Rejected by `isOwner(userId) || isAdmin()`.
3. **Payload 3 (Unverified Admin Email Spoof)**: Attacker authenticating with `email: "arn.gingoyon@gmail.com"` and `email_verified: false` attempting to create `/company_docs/doc1` or list `/users`. Rejected by `request.auth.token.email_verified == true`.
4. **Payload 4 (Orphaned Interaction Write)**: User attempting to create `/users/{userId}/interactions/int_1` before creating `/users/{userId}`. Rejected by Master Gate `exists(/databases/$(database)/documents/users/$(userId))`.
5. **Payload 5 (Cross-User Interaction Read/Scrape)**: Authenticated user `user_A` attempting to `list` or `get` `/users/user_B/interactions`. Rejected by `isOwner(userId) && resource.data.userId == request.auth.uid`.
6. **Payload 6 (Denial-of-Wallet Oversized String)**: Submitting a 50,000-character `userPrompt` or 2KB `interactionId`. Rejected by `isValidId()` (`<= 128`) and `userPrompt.size() <= 5000`.
7. **Payload 7 (Timestamp Forgery / Backdating)**: Sending a past or future client timestamp for `createdAt` or `updatedAt` instead of `request.time`. Rejected by `data.createdAt == request.time`.
8. **Payload 8 (Identity Spoofing in Interaction Payload)**: User `user_A` writing to `/users/user_A/interactions/int_1` with `userId: "user_B"`. Rejected by `data.userId == request.auth.uid && data.userId == userId`.
9. **Payload 9 (Immortal Field Mutation)**: Updating `/users/user_A` while changing `uid` or `createdAt`. Rejected by `incoming().uid == existing().uid && incoming().createdAt == existing().createdAt`.
10. **Payload 10 (Unauthorized Company Basis Upload)**: Regular verified user attempting to `create` or `update` `/company_docs/sop_1`. Rejected by `isAdmin()`.
11. **Payload 11 (Invalid Enum Category / Severity Poisoning)**: Creating an interaction with `category: "sql_injection"` or `severityLevel: "critical_override"`. Rejected by strict enum validation in `isValidAuditInteraction`.
12. **Payload 12 (Archived Company Doc Scraping)**: Regular user attempting to `list` or `get` a `/company_docs/{docId}` where `status == 'archived'`. Rejected by `resource.data.status == 'published' || isAdmin()`.
