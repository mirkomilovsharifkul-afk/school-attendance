import { doc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import type { AttendanceStatus } from '@school-attendance/shared';
export type AttendanceInput = {studentId:string;status:AttendanceStatus;reason?:string};
export async function saveAttendance(db:Firestore, schoolId:string, classId:string, date:string, entry:AttendanceInput, uid:string) {
 const ref=doc(db,'attendance',`${schoolId}_${entry.studentId}_${date}`);
 await setDoc(ref,{schoolId,classId,studentId:entry.studentId,date,status:entry.status,reason:entry.reason||null,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),createdBy:uid,isLocked:false});
}
export async function updateAttendance(db:Firestore, schoolId:string, studentId:string, date:string, status:AttendanceStatus, changeReason:string) {
 await updateDoc(doc(db,'attendance',`${schoolId}_${studentId}_${date}`),{status,changeReason,updatedAt:serverTimestamp()});
}
