const test = require('node:test');
const assert = require('node:assert/strict');
const WINDOW = 5 * 60 * 60 * 1000;
const locked = (createdAt, serverNow) => serverNow >= createdAt + WINDOW;
test('editable at 1 hour', () => assert.equal(locked(0, 60 * 60 * 1000), false));
test('editable at 4 hours 59 minutes', () => assert.equal(locked(0, WINDOW - 60_000), false));
test('locked exactly at 5 hours', () => assert.equal(locked(0, WINDOW), true));
test('locked after 6 hours', () => assert.equal(locked(0, 6 * 60 * 60 * 1000), true));
