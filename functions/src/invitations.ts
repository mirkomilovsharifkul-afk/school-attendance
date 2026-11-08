import { createHash, randomBytes } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

const db = getFirestore();
const auth = getAuth();
const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
type InviteRole = 'ADMINISTRATOR' | 'EMPLOYEE';

export function hashInviteCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase(), 'utf8').digest('hex');
}

function requireSuperAdmin(request: any): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Требуется вход в систему.');
  if (request.auth.token.role !== 'SUPER_ADMIN') {
    throw new HttpsError('permission-denied', 'Создавать приглашения может только Super Admin.');
  }
  return request.auth.uid as string;
}

const createSchema = z.object({
  role: z.enum(['ADMINISTRATOR', 'EMPLOYEE']),
  schoolId: z.string().trim().min(1).max(128),
});

/** Creates a single-use invite. Plaintext code is returned only in this response. */
export const createInvite = onCall({ region: 'us-central1', maxInstances: 5 }, async (request) => {
  const creatorUid = requireSuperAdmin(request);
  const parsed = createSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Укажите корректную роль и школу.');

  const schoolRef = db.collection('schools').doc(parsed.data.schoolId);
  const school = await schoolRef.get();
  if (!school.exists) throw new HttpsError('not-found', 'Школа не найдена.');

  const prefix = parsed.data.role === 'ADMINISTRATOR' ? 'ADM' : 'EMP';
  const secret = randomBytes(24).toString('base64url').toUpperCase();
  const code = `${prefix}-${secret}`;
  const codeHash = hashInviteCode(code);
  const now = Date.now();
  const expiresAt = Timestamp.fromMillis(now + INVITE_TTL_MS);
  const inviteRef = db.collection('invites').doc(codeHash);

  await inviteRef.create({
    codeHash,
    role: parsed.data.role,
    schoolId: parsed.data.schoolId,
    createdBy: creatorUid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    status: 'ACTIVE',
    usedBy: null,
    usedAt: null,
    revokedAt: null,
  });

  await db.collection('auditLogs').add({
    schoolId: parsed.data.schoolId,
    actorUid: creatorUid,
    action: 'INVITE_CREATED',
    targetId: inviteRef.id,
    details: { role: parsed.data.role, expiresAt },
    createdAt: FieldValue.serverTimestamp(),
  });

  return { code, role: parsed.data.role, schoolId: parsed.data.schoolId, expiresAt: expiresAt.toDate().toISOString() };
});

const redeemSchema = z.object({ code: z.string().trim().min(20).max(100) });

/** Redeems a code once, binds it to the authenticated UID, then assigns claims server-side. */
export const redeemInvite = onCall({ region: 'us-central1', maxInstances: 10 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Сначала войдите или зарегистрируйтесь.');
  const parsed = redeemSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Неверный формат приглашения.');

  const uid = request.auth.uid;
  const inviteRef = db.collection('invites').doc(hashInviteCode(parsed.data.code));
  let role: InviteRole;
  let schoolId: string;

  await db.runTransaction(async (tx) => {
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists) throw new HttpsError('not-found', 'Приглашение не найдено.');
    const invite = inviteSnap.data()!;
    if (invite.status === 'REVOKED') throw new HttpsError('failed-precondition', 'Приглашение отозвано.');
    if (invite.status === 'ACTIVE') {
      if (!(invite.expiresAt instanceof Timestamp) || invite.expiresAt.toMillis() <= Date.now()) {
        tx.update(inviteRef, { status: 'EXPIRED', expiredAt: FieldValue.serverTimestamp() });
        throw new HttpsError('deadline-exceeded', 'Срок действия приглашения истёк.');
      }
      role = invite.role as InviteRole;
      schoolId = invite.schoolId as string;
      if (!['ADMINISTRATOR', 'EMPLOYEE'].includes(role) || !schoolId) {
        throw new HttpsError('failed-precondition', 'Приглашение содержит недопустимые права.');
      }
      tx.update(inviteRef, { status: 'USED', usedBy: uid, usedAt: FieldValue.serverTimestamp() });
      const userRef = db.collection('users').doc(uid);
      tx.set(userRef, {
        uid,
        email: request.auth!.token.email ?? null,
        role,
        schoolId,
        status: 'ACTIVE',
        inviteId: inviteRef.id,
        roleAssignedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.create(db.collection('auditLogs').doc(), {
        schoolId,
        actorUid: uid,
        action: 'INVITE_REDEEMED',
        targetId: inviteRef.id,
        details: { role },
        createdAt: FieldValue.serverTimestamp(),
      });
    } else if (invite.status === 'USED' && invite.usedBy === uid) {
      // Safe retry for the same account if setting Auth claims failed after the transaction.
      role = invite.role as InviteRole;
      schoolId = invite.schoolId as string;
    } else if (invite.status === 'EXPIRED') {
      throw new HttpsError('deadline-exceeded', 'Срок действия приглашения истёк.');
    } else {
      throw new HttpsError('already-exists', 'Приглашение уже использовано.');
    }
  });

  const existing = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, {
    ...(existing.customClaims ?? {}),
    role: role!,
    schoolId: schoolId!,
  });
  return { success: true, role: role!, schoolId: schoolId!, tokenRefreshRequired: true };
});

const revokeSchema = z.object({ codeHash: z.string().regex(/^[a-f0-9]{64}$/i) });
export const revokeInvite = onCall({ region: 'us-central1', maxInstances: 5 }, async (request) => {
  const creatorUid = requireSuperAdmin(request);
  const parsed = revokeSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Некорректный идентификатор приглашения.');
  const ref = db.collection('invites').doc(parsed.data.codeHash.toLowerCase());
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Приглашение не найдено.');
    if (snap.data()!.status !== 'ACTIVE') throw new HttpsError('failed-precondition', 'Можно отозвать только активное приглашение.');
    tx.update(ref, { status: 'REVOKED', revokedAt: FieldValue.serverTimestamp(), revokedBy: creatorUid });
  });
  return { success: true };
});

export const listInvites = onCall({ region: 'us-central1', maxInstances: 5 }, async (request) => {
  requireSuperAdmin(request);
  const snap = await db.collection('invites').orderBy('createdAt', 'desc').limit(100).get();
  return {
    invites: snap.docs.map((doc) => {
      const value = doc.data();
      return {
        id: doc.id,
        role: value.role,
        schoolId: value.schoolId,
        status: value.status,
        createdAt: value.createdAt instanceof Timestamp ? value.createdAt.toDate().toISOString() : null,
        expiresAt: value.expiresAt instanceof Timestamp ? value.expiresAt.toDate().toISOString() : null,
        usedAt: value.usedAt instanceof Timestamp ? value.usedAt.toDate().toISOString() : null,
      };
    }),
  };
});
