import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAttendanceLocked, EDIT_WINDOW_MS } from '@school-attendance/shared';
test('attendance remains editable at 4h59m', () => assert.equal(isAttendanceLocked(1000, 1000 + EDIT_WINDOW_MS - 60_000), false));
test('attendance locks at exactly five hours', () => assert.equal(isAttendanceLocked(1000, 1000 + EDIT_WINDOW_MS), true));
test('attendance stays locked after six hours', () => assert.equal(isAttendanceLocked(1000, 1000 + 6 * 60 * 60 * 1000), true));
