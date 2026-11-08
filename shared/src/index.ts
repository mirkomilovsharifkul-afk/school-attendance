export const ATTENDANCE_STATUSES = ['PRESENT','ABSENT','LATE','EXCUSED','LEFT_EARLY'] as const;
export type AttendanceStatus = typeof ATTENDANCE_STATUSES[number];
export type UserRole = 'SUPER_ADMIN'|'ADMINISTRATOR'|'EMPLOYEE'|'PARENT';
export const SCHOOL_TIME_ZONE = 'Asia/Tashkent';
export const EDIT_WINDOW_MS = 5 * 60 * 60 * 1000;
export interface AttendanceRecord {
  id: string; schoolId: string; classId: string; studentId: string; date: string;
  status: AttendanceStatus; createdAt: number; lockedAt: number; isLocked: boolean;
  createdBy: string; updatedAt: number; parentUids: string[]; allowedEmployeeUids: string[];
  reason?: string; arrivalTime?: string; departureTime?: string; authorizedBy?: string;
}
export function isAttendanceLocked(createdAt: number, serverNow: number): boolean {
  return serverNow >= createdAt + EDIT_WINDOW_MS;
}
