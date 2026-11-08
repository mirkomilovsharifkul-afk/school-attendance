import { describe, expect, it } from 'vitest';
import { isAttendanceLocked, EDIT_WINDOW_MS } from '@school-attendance/shared';
describe('five-hour attendance lock',()=>{
 it('allows editing at 4h59m',()=>expect(isAttendanceLocked(1_000,1_000+EDIT_WINDOW_MS-60_000)).toBe(false));
 it('locks at exactly five hours',()=>expect(isAttendanceLocked(1_000,1_000+EDIT_WINDOW_MS)).toBe(true));
 it('stays locked after six hours',()=>expect(isAttendanceLocked(1_000,1_000+6*60*60*1000)).toBe(true));
});
