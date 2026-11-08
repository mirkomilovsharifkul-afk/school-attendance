# Firebase connection note — SCHOOL ATTENDANCE

This package has the Firebase Web App configuration visible in the user's Firebase Console screenshot:
- Project ID: school-attendance-a4778
- Web app: school-attendance-web

The frontend config is stored in `frontend/.env.local`. These are public Firebase Web SDK identifiers.
Do not put Firebase Admin SDK private keys, service-account JSON, passwords, or email-provider secrets in this file.

Firestore was created in Production mode. App Check remains unregistered and is NOT enforced.
Email/Password provider is enabled.

## Important status
This is a configuration handoff, not a production-ready deployment. The existing V7 source still has incomplete modules documented in README.md and V7_AUDIT_REPORT.md. No Firebase deployment, npm install, production build, emulator integration, or security test is claimed by this package.
