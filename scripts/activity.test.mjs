import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createActivity } from '../activity.mjs';
const dataDir = await mkdtemp(join(tmpdir(), 'pnl-activity-test-'));
const realNow = Date.now;
let now = realNow();
Date.now = () => now;
const options = { dataDir, sendJson: (res, status, body) => Object.assign(res, { status, body }), readRequestBody: req => req.body };
function request(path, body, cookies = '', origin = 'https://dashboard.example') {
  return { method: body ? 'POST' : 'GET', body, headers: { cookie: cookies, host: 'dashboard.example', origin }, socket: { remoteAddress: '127.0.0.1' } };
}
async function call(activity, path, body, cookies, origin) {
  const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; } };
  await activity.handle(request(path, body, cookies, origin), res, new URL(path, 'https://dashboard.example'));
  return res;
}
try {
  const a = await createActivity(options);
  const enter = await call(a, '/api/viewer', { name: 'Test Person' });
  const cookie = enter.headers['Set-Cookie'].split(';')[0];
  const first = await call(a, '/api/activity/visit', { view: 'actual' }, cookie);
  const second = await call(a, '/api/activity/visit', { view: 'actual' }, cookie);
  now += 15000;
  await call(a, '/api/activity/heartbeat', { visitId: first.body.visitId, active: true }, cookie);
  await call(a, '/api/activity/heartbeat', { visitId: second.body.visitId, active: true }, cookie);
  // Read the private file solely in this test to check accounting without adding production introspection APIs.
  const { readFile } = await import('node:fs/promises');
  const stored = async () => JSON.parse(await readFile(join(dataDir, 'team-activity.private.json'), 'utf8'));
  assert.equal((await stored()).visits.reduce((sum,v) => sum+v.activeSeconds,0), 15, 'Overlapping tabs must count once');
  now += 15000;
  await call(a, '/api/activity/heartbeat', { visitId: first.body.visitId, active: false }, cookie);
  assert.equal((await stored()).visits[0].activeSeconds, 15, 'Idle interval must not count');
  now += 60000;
  await call(a, '/api/activity/heartbeat', { visitId: first.body.visitId, active: true }, cookie);
  assert.equal((await stored()).visits[0].activeSeconds, 15, 'Suspended interval must not count');
  const forged = await call(a, '/api/activity/heartbeat', { visitId: first.body.visitId, active: true }, 'pnl_viewer=forged');
  assert.equal(forged.status, 401);
  const cross = await call(a, '/api/viewer', { name: 'Attacker' }, '', 'https://untrusted.example');
  assert.equal(cross.status, 403);
  const b = await createActivity(options);
  assert.equal((await call(b, '/api/viewer', undefined, cookie)).body.name, 'Test Person', 'Viewer survives restart');
  assert.equal((await call(b, '/api/admin/activity', undefined, cookie)).status, 401, 'Visitor cannot access report');
  now += 91 * 86400000;
  await call(b, '/api/viewer', { name: 'New Viewer' });
  assert.equal((await stored()).visits.length, 0, 'Expired records must be removed');
  console.log('Activity overlap, idle, suspend, origin, persistence and retention checks passed.');
} finally { Date.now = realNow; await rm(dataDir, { recursive: true, force: true }); }
