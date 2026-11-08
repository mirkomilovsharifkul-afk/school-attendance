import { randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const loginSecret = defineSecret('SUPER_ADMIN_LOGIN');
const emailSecret = defineSecret('SUPER_ADMIN_EMAIL');
const passwordSecret = defineSecret('SUPER_ADMIN_PASSWORD');

export const createSuperAdmin = onRequest({ secrets: [loginSecret, emailSecret, passwordSecret], cors: false }, async (req, res) => {
  if (req.method !== 'POST') { res.set('Allow', 'POST').status(405).send('Method not allowed'); return; }
  const login = loginSecret.value();
  const email = emailSecret.value();
  const password = passwordSecret.value();
  if (!login || !email || password.length < 14 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    res.status(500).send('Bootstrap secrets are missing or password policy is not met.'); return;
  }
  const db = getFirestore();
  const auth = getAuth();
  const lockRef = db.doc('_system/bootstrap');
  const uid = randomUUID();
  try {
    await db.runTransaction(async tx => {
      const lock = await tx.get(lockRef);
      if (lock.exists) throw new Error('ALREADY_INITIALIZED');
      tx.create(lockRef, { status: 'INITIALIZING', reservationId: uid, startedAt: FieldValue.serverTimestamp() });
    });
  } catch (error: any) {
    res.status(error.message === 'ALREADY_INITIALIZED' ? 409 : 500).send(error.message === 'ALREADY_INITIALIZED' ? 'Bootstrap already initialized or reserved.' : 'Bootstrap reservation failed.'); return;
  }
  try {
    const user = await auth.createUser({ email, password, displayName: login, emailVerified: false });
    await auth.setCustomUserClaims(user.uid, { role: 'SUPER_ADMIN', schoolId: null, mfaRequired: true, bootstrapPending: true });
    await db.collection('users').doc(user.uid).create({ login, email, role: 'SUPER_ADMIN', status: 'PENDING_VERIFICATION', createdAt: FieldValue.serverTimestamp() });
    await lockRef.update({ status: 'INITIALIZED', uid: user.uid, initializedAt: FieldValue.serverTimestamp(), reservationId: FieldValue.delete() });
    res.status(201).send('Super Admin account created. Email verification and MFA enrollment are still required before operational access.');
  } catch (error) {
    await lockRef.update({ status: 'FAILED', failedAt: FieldValue.serverTimestamp() }).catch(() => undefined);
    res.status(500).send('Bootstrap failed. Contact the system operator; the one-time reservation was retained for safety.');
  }
});
