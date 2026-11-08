# SCHOOL ATTENDANCE V7 — audit and repair notes

This archive is based on the supplied V6 source. It is an audited/repair package, NOT a claim of production readiness.

## Verified from supplied archive
- ZIP contains 45 entries and is structurally readable.
- React/Vite frontend, Firebase Admin Cloud Functions, Firestore rules and shared attendance policy are present.
- Five-hour lock helper uses `serverNow >= createdAt + 5 hours`.
- Firestore rules deny client writes to protected collections.
- Telegram code/integration is absent.
- V6 BUILD_STATUS.md itself marks dependency install, TypeScript build, emulator tests and deployment as NOT RUN.

## Important outstanding blockers
1. Super Admin bootstrap endpoint is an unauthenticated HTTP POST. `cors: false` is not authentication. Do NOT deploy or invoke it as-is.
2. Bootstrap creates a pending user but does not implement the required email OTP flow or MFA enrollment/verification lifecycle.
3. `actor()` checks role claims but does not verify email verification, MFA completion, or a server-side active account state.
4. `saveAttendance` uses `user.schoolId!`; the Super Admin has `schoolId: null`, so Super Admin attendance operations need an explicit school-selection/authorization design.
5. The status model conflates "Отпросился" and "Ранний уход": `LEFT_EARLY` is labelled as "Отпросился". These must be separate statuses and workflows.
6. The current attendance write code should be reviewed for transaction-safe uniqueness under concurrent requests. Batch create is useful, but all reads/authorization and duplicate protection need emulator tests.
7. The app's UI is not a complete CRUD implementation for users, classes, students, parents, invites, reporting, and notification delivery.
8. Full security-rule tests, role-isolation tests, end-to-end tests, backup/restore tests, and deployment validation are not present.
9. The five-hour lock must be enforced in every privileged server mutation. Firestore rules currently deny client writes, which is good, but all server endpoints must be audited because Admin SDK bypasses rules.

## Safe next steps
- Keep this source in a development environment only.
- Do not enter real student/parent data.
- Do not deploy `createSuperAdmin` until it is protected by a one-time high-entropy bootstrap credential or an equivalent operator-authenticated deployment procedure, with rate limiting and an explicit disable-after-success mechanism.
- Implement and test email verification + MFA lifecycle before enabling Super Admin operations.
- Separate `EXCUSED_LEAVE` from `LEFT_EARLY` in shared types, backend schemas, UI labels, reports, and tests.
- Run `npm install`, `npm run build`, `npm test`, Firebase Emulator tests and Rules tests in an environment with dependencies installed. Record actual results; never mark unrun checks PASS.

## Environment file
`.env.example` is only a template. Frontend Firebase Web config belongs in `frontend/.env.local`. Server secrets belong in Firebase Functions Secrets, not in `VITE_*` variables. Do not commit `.env` or share real secrets.
