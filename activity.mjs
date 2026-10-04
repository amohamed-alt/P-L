import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function createActivity({ dataDir, sendJson, readRequestBody }) {
  await mkdir(dataDir, { recursive: true });
  const file = resolve(dataDir, 'team-activity.private.json');
  let db = { viewers: {}, visits: [] };
  try { db = JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  let passwordHash = process.env.PNL_ACTIVITY_ADMIN_HASH;
  if (!passwordHash) { try { passwordHash = (await readFile(resolve('admin-password.hash'), 'utf8')).trim(); } catch {} }
  const admins = new Map(), attempts = new Map();
  let writes = Promise.resolve();
  function save() {
    const cutoff = Date.now() - 90 * 86400000;
    db.visits = db.visits.filter(v => v.lastSeen >= cutoff);
    for (const [id, v] of Object.entries(db.viewers)) if (v.lastSeen < cutoff) delete db.viewers[id];
    const snapshot = JSON.stringify(db);
    writes = writes.then(async () => { await writeFile(`${file}.tmp`, snapshot, { mode: 0o600 }); await rename(`${file}.tmp`, file); });
    return writes;
  }
  function cookie(req, key) { return String(req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${key}=`))?.slice(key.length + 1); }
  function setCookie(req, res, key, value, age) {
    res.setHeader('Set-Cookie', `${key}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  }
  const viewer = req => db.viewers[cookie(req, 'pnl_viewer')];
  const admin = req => (admins.get(cookie(req, 'pnl_admin')) || 0) > Date.now();
  function sameOrigin(req) {
    if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) return false;
    try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
  }
  await save();
  const cleanup = setInterval(() => { save().catch(() => console.error('[pnl-dashboard] Activity retention cleanup failed.')); }, 24 * 3600000);
  cleanup.unref();
  return {
    viewer,
    async handle(req, res, url) {
      const path = url.pathname;
      if (!['/api/viewer', '/api/activity/visit', '/api/activity/heartbeat', '/api/admin/login', '/api/admin/logout', '/api/admin/activity'].includes(path)) return false;
      if (!['GET', 'POST'].includes(req.method)) { sendJson(res, 405, { error: 'Method not allowed' }); return true; }
      if (req.method === 'POST' && !sameOrigin(req)) { sendJson(res, 403, { error: 'Invalid origin' }); return true; }
      if (path === '/api/viewer' && req.method === 'GET') { sendJson(res, 200, { name: viewer(req)?.name || null }); return true; }
      if (path === '/api/viewer' && req.method === 'POST') {
        const body = await readRequestBody(req);
        const name = String(body.name || '').trim().replace(/\s+/g, ' ');
        if (name.length < 2 || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) { sendJson(res, 400, { error: 'Enter a name between 2 and 80 characters.' }); return true; }
        const id = randomBytes(32).toString('hex');
        db.viewers[id] = { name, lastSeen: Date.now() };
        setCookie(req, res, 'pnl_viewer', id, 90 * 86400); await save(); sendJson(res, 200, { name }); return true;
      }
      if (path === '/api/admin/login' && req.method === 'POST') {
        // Use the socket address, not client-supplied forwarding headers. Global backoff also protects behind a proxy.
        const key = req.socket.remoteAddress || 'global', now = Date.now();
        const attempt = attempts.get(key) || { count: 0, until: now + 900000 };
        if (attempt.until < now) { attempt.count = 0; attempt.until = now + 900000; }
        if (attempt.count >= 8) { sendJson(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' }); return true; }
        const body = await readRequestBody(req);
        const [salt, hash] = String(passwordHash || '').split(':');
        let valid = false;
        if (salt && /^[a-f0-9]{128}$/.test(hash || '') && typeof body.password === 'string' && body.password.length <= 256) {
          const actual = scryptSync(body.password, salt, 64); valid = timingSafeEqual(actual, Buffer.from(hash, 'hex'));
        }
        if (!valid) { attempt.count++; attempts.set(key, attempt); sendJson(res, 401, { error: 'Incorrect password.' }); return true; }
        attempts.delete(key);
        const id = randomBytes(32).toString('hex');
        for (const [key, expiry] of admins) if (expiry < now) admins.delete(key);
        admins.set(id, now + 8 * 3600000); setCookie(req, res, 'pnl_admin', id, 8 * 3600); sendJson(res, 200, { ok: true }); return true;
      }
      if (path.startsWith('/api/admin/')) {
        if (!admin(req)) { sendJson(res, 401, { error: 'Admin access required.' }); return true; }
        if (path === '/api/admin/logout' && req.method === 'POST') { admins.delete(cookie(req, 'pnl_admin')); setCookie(req, res, 'pnl_admin', '', 0); sendJson(res, 200, { ok: true }); return true; }
        if (path === '/api/admin/activity' && req.method === 'GET') {
          const days = [1, 7, 30, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
          const visits = db.visits.filter(v => v.lastSeen >= Date.now() - days * 86400000);
          const people = new Map();
          for (const v of visits) {
            const key = v.name.normalize('NFKC').toLocaleLowerCase();
            const p = people.get(key) || { name: v.name, visits: 0, activeSeconds: 0, firstSeen: v.startedAt, lastSeen: 0, view: '' };
            p.visits++; p.activeSeconds += v.activeSeconds; p.firstSeen = Math.min(p.firstSeen, v.startedAt);
            if (v.lastSeen >= p.lastSeen) { p.lastSeen = v.lastSeen; p.view = v.view; }
            people.set(key, p);
          }
          sendJson(res, 200, { days, retentionDays: 90, people: [...people.values()].sort((a,b) => b.lastSeen-a.lastSeen), visits: visits.length, activeSeconds: visits.reduce((sum,v) => sum+v.activeSeconds,0) }); return true;
        }
      }
      if (path.startsWith('/api/activity/') && req.method === 'POST') {
        const person = viewer(req);
        if (!person) { sendJson(res, 401, { error: 'Enter your name first.' }); return true; }
        const body = await readRequestBody(req), now = Date.now(), owner = cookie(req, 'pnl_viewer');
        if (path.endsWith('/visit')) {
          const recent = db.visits.filter(v => v.owner === owner && now - v.startedAt < 60000);
          if (recent.length >= 10) { sendJson(res, 429, { error: 'Too many visits.' }); return true; }
          const id = randomBytes(24).toString('hex');
          db.visits.push({ id, owner, name: person.name, startedAt: now, lastSeen: now, lastTick: now, activeSeconds: 0, view: body.view === 'forecast' ? 'Forecast' : 'Actual' });
          person.lastSeen = now; await save(); sendJson(res, 200, { visitId: id }); return true;
        }
        const visit = db.visits.find(v => v.id === body.visitId && v.owner === owner);
        if (!visit) { sendJson(res, 404, { error: 'Visit not found.' }); return true; }
        // Count only a recent foreground interval. Shared viewer timestamp avoids double-counting concurrent tabs.
        const seconds = Math.min(20, Math.max(0, (now - Math.max(visit.lastTick, person.lastActiveTick || visit.lastTick)) / 1000));
        if (body.active === true && now - visit.lastTick <= 30000) { visit.activeSeconds += seconds; person.lastActiveTick = now; }
        visit.lastTick = now;
        if (body.active === true) { visit.lastSeen = now; person.lastSeen = now; visit.view = body.view === 'forecast' ? 'Forecast' : 'Actual'; } await save(); sendJson(res, 200, { ok: true }); return true;
      }
      sendJson(res, 405, { error: 'Method not allowed' }); return true;
    },
  };
}
