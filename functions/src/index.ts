import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp, type Transaction } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { createSuperAdmin } from './create-super-admin';
import { z } from 'zod';
import { EDIT_WINDOW_MS, isAttendanceLocked, type AttendanceStatus, type UserRole } from '@school-attendance/shared';

initializeApp();
const db = getFirestore();

function actor(request: any, roles: UserRole[]) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Требуется вход в систему.');
  const role = request.auth.token.role as UserRole;
  if (!roles.includes(role)) throw new HttpsError('permission-denied', 'Недостаточно прав.');
  const schoolId = request.auth.token.schoolId as string | undefined;
  if (!schoolId && role !== 'SUPER_ADMIN') throw new HttpsError('permission-denied', 'Не назначена школа.');
  return { uid: request.auth.uid, role, schoolId };
}
function audit(tx: Transaction, schoolId: string, uid: string, action: string, targetId: string, details: object = {}) {
  const ref = db.collection('auditLogs').doc();
  tx.create(ref, { schoolId, actorUid: uid, action, targetId, details, createdAt: FieldValue.serverTimestamp() });
}

const saveSchema = z.object({ classId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), entries: z.array(z.object({ studentId: z.string().min(1), status: z.enum(['PRESENT','ABSENT','LATE','EXCUSED','LEFT_EARLY']), reason: z.string().max(500).optional(), arrivalTime: z.string().optional(), departureTime: z.string().optional(), authorizedBy: z.string().optional() })).min(1).max(100) });
export const saveAttendance = onCall(async (req) => {
  const user = actor(req, ['SUPER_ADMIN','ADMINISTRATOR','EMPLOYEE']);
  const parsed = saveSchema.safeParse(req.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Некорректные данные посещаемости.');
  const schoolId = user.schoolId!;
  const classRef = db.collection('classes').doc(parsed.data.classId);
  const cls = await classRef.get();
  if (!cls.exists || cls.data()!.schoolId !== schoolId) throw new HttpsError('permission-denied', 'Класс недоступен.');
  if (user.role === 'EMPLOYEE' && !(cls.data()!.employeeUids || []).includes(user.uid)) throw new HttpsError('permission-denied', 'Класс не назначен сотруднику.');
  const now = Date.now();
  const batch = db.batch();
  const ids = new Set<string>();
  for (const entry of parsed.data.entries) {
    if (ids.has(entry.studentId)) throw new HttpsError('invalid-argument', 'Ученик повторяется в запросе.');
    ids.add(entry.studentId);
    const studentRef = db.collection('students').doc(entry.studentId);
    const student = await studentRef.get();
    if (!student.exists || student.data()!.schoolId !== schoolId || student.data()!.classId !== parsed.data.classId || student.data()!.status !== 'ACTIVE') throw new HttpsError('permission-denied', 'Ученик не относится к выбранному классу.');
    const recordId = `${schoolId}_${entry.studentId}_${parsed.data.date}`;
    const ref = db.collection('attendance').doc(recordId);
    const existing = await ref.get();
    if (existing.exists) throw new HttpsError('already-exists', `Отметка уже существует для ученика ${entry.studentId}. Используйте редактирование, пока окно открыто.`);
    const createdAt = Timestamp.fromMillis(now);
    batch.create(ref, { schoolId, classId: parsed.data.classId, studentId: entry.studentId, date: parsed.data.date, status: entry.status, reason: entry.reason || null, arrivalTime: entry.arrivalTime || null, departureTime: entry.departureTime || null, authorizedBy: entry.authorizedBy || null, createdAt, lockedAt: Timestamp.fromMillis(now + EDIT_WINDOW_MS), isLocked: false, createdBy: user.uid, updatedAt: createdAt, parentUids: student.data()!.parentUids || [], allowedEmployeeUids: cls.data()!.employeeUids || [] });
    const auditRef = db.collection('auditLogs').doc();
    batch.create(auditRef, {
      schoolId,
      actorUid: user.uid,
      action: 'ATTENDANCE_CREATED',
      targetId: recordId,
      details: { status: entry.status },
      createdAt: FieldValue.serverTimestamp()
    });
  }
  await batch.commit();
  return { saved: parsed.data.entries.length, serverTime: now };
});

const editSchema = z.object({ attendanceId: z.string(), status: z.enum(['PRESENT','ABSENT','LATE','EXCUSED','LEFT_EARLY']), reason: z.string().max(500).optional(), changeReason: z.string().min(3).max(500) });
export const updateAttendance = onCall(async (req) => {
  const user = actor(req, ['SUPER_ADMIN','ADMINISTRATOR','EMPLOYEE']);
  const data = editSchema.parse(req.data);
  const ref = db.collection('attendance').doc(data.attendanceId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Отметка не найдена.');
    const old = snap.data()!;
    if (user.schoolId && old.schoolId !== user.schoolId) throw new HttpsError('permission-denied', 'Чужая школа.');
    if (user.role === 'EMPLOYEE' && !(old.allowedEmployeeUids || []).includes(user.uid)) throw new HttpsError('permission-denied', 'Нет доступа к этому классу.');
    const createdAt = old.createdAt instanceof Timestamp ? old.createdAt.toMillis() : Number(old.createdAt);
    const now = Date.now();
    if (isAttendanceLocked(createdAt, now)) throw new HttpsError('failed-precondition', 'Отметка заблокирована. Время редактирования истекло.');
    const history = db.collection('attendanceHistory').doc();
    tx.create(history, { schoolId: old.schoolId, attendanceId: ref.id, previousStatus: old.status, newStatus: data.status, reason: data.changeReason, actorUid: user.uid, createdAt: FieldValue.serverTimestamp() });
    tx.update(ref, { status: data.status, reason: data.reason || old.reason || null, updatedAt: FieldValue.serverTimestamp() });
    audit(tx, old.schoolId, user.uid, 'ATTENDANCE_UPDATED', ref.id, { from: old.status, to: data.status });
  });
  return { updated: true };
});

const correctionSchema = z.object({ attendanceId: z.string(), newStatus: z.enum(['PRESENT','ABSENT','LATE','EXCUSED','LEFT_EARLY']), reason: z.string().min(5).max(1000) });
export const correctLockedAttendance = onCall(async req => {
  const user = actor(req, ['SUPER_ADMIN']);
  const data = correctionSchema.parse(req.data);
  const ref = db.collection('attendance').doc(data.attendanceId);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Исходная отметка не найдена.');
    const old = snap.data()!;
    if (user.schoolId && old.schoolId !== user.schoolId) throw new HttpsError('permission-denied', 'Чужая школа.');
    const createdAt = old.createdAt instanceof Timestamp ? old.createdAt.toMillis() : Number(old.createdAt);
    if (!isAttendanceLocked(createdAt, Date.now())) throw new HttpsError('failed-precondition', 'Для этой отметки ещё доступно обычное редактирование.');
    const correction = db.collection('attendanceCorrections').doc();
    tx.create(correction, { schoolId: old.schoolId, attendanceId: ref.id, oldStatus: old.status, newStatus: data.newStatus, reason: data.reason, actorUid: user.uid, createdAt: FieldValue.serverTimestamp() });
    audit(tx, old.schoolId, user.uid, 'LOCKED_ATTENDANCE_CORRECTED', correction.id, { attendanceId: ref.id });
    return { correctionId: correction.id, originalPreserved: true };
  });
});


export { createSuperAdmin };

// Invite management: Super Admin only; invitation codes expire after 24 hours.
export { createInvite, redeemInvite, revokeInvite, listInvites } from './invitations';
