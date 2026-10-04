import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { scryptSync } from 'node:crypto';
import { spawn } from 'node:child_process';

const dataDir = await mkdtemp(join(tmpdir(), 'pnl-dashboard-'));
const port = 3941;
const token = 'smoke-test-token-abcdefghijklmnopqrstuvwxyz-1234567890';
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: resolve('.'),
  env: {
    ...process.env,
    PORT: String(port),
    STATIC_DIR: resolve('dist'),
    DATA_DIR: dataDir,
    PNL_DATA_INGEST_TOKEN: token,
    PNL_ACTIVITY_ADMIN_HASH: 'test-salt:' + scryptSync('test-admin-password', 'test-salt', 64).toString('hex'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let logs = '';
child.stdout.on('data', (chunk) => { logs += chunk.toString(); });
child.stderr.on('data', (chunk) => { logs += chunk.toString(); });

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return response;
    } catch {
      // Server may still be starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Server did not become healthy. Logs:\n${logs}`);
}

try {
  const health = await waitForHealth();
  const healthPayload = await health.json();
  if (healthPayload.version !== 2 || healthPayload.service !== 'pnl-dashboard') {
    throw new Error('Health response does not identify the modern dashboard service.');
  }

  const unauthorized = await fetch(`${baseUrl}/api/dashboard-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monthlyData: [{ year: 2026, monthNumber: 1 }] }),
  });
  if (unauthorized.status !== 401) throw new Error(`Expected 401, received ${unauthorized.status}.`);

  const payload = {
    metadata: { currentReportingYear: 2026, currency: 'AED' },
    monthlyData: [{
      year: 2026, monthNumber: 1, booking: 100, cashing: 80,
      cogs: 20, overheads: 10, supportAllocation: 5, hasMeaningfulData: true,
    }],
  };
  const ingest = await fetch(`${baseUrl}/api/dashboard-data`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!ingest.ok) throw new Error(`Ingest failed with ${ingest.status}: ${await ingest.text()}`);

  const anonymousData = await fetch(`${baseUrl}/data/dashboard-data.json`);
  if (anonymousData.status !== 401) throw new Error('Anonymous dashboard data access must be blocked.');
  const privateReport = await fetch(`${baseUrl}/api/admin/activity`);
  if (privateReport.status !== 401) throw new Error('Anonymous admin access must be blocked.');
  const jsonHeaders = { 'Content-Type': 'application/json', Origin: baseUrl };
  const enter = await fetch(`${baseUrl}/api/viewer`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ name: 'Smoke Viewer' }) });
  const viewerCookie = enter.headers.get('set-cookie')?.split(';')[0];
  if (!enter.ok || !viewerCookie) throw new Error('Viewer entry failed.');
  const viewerHeaders = { ...jsonHeaders, Cookie: viewerCookie };
  const crossOrigin = await fetch(`${baseUrl}/api/activity/visit`, { method: 'POST', headers: { ...viewerHeaders, Origin: 'https://untrusted.example' }, body: '{}' });
  if (crossOrigin.status !== 403) throw new Error('Cross-origin tracking must be blocked.');
  const visit = await fetch(`${baseUrl}/api/activity/visit`, { method: 'POST', headers: viewerHeaders, body: JSON.stringify({ view: 'actual' }) });
  const { visitId } = await visit.json();
  if (!visitId) throw new Error('Visit creation failed.');
  const viewerReport = await fetch(`${baseUrl}/api/admin/activity`, { headers: { Cookie: viewerCookie } });
  if (viewerReport.status !== 401) throw new Error('Viewer must not gain admin access.');
  const invalidLogin = await fetch(`${baseUrl}/api/admin/login`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ password: 'wrong' }) });
  if (invalidLogin.status !== 401) throw new Error('Wrong admin password accepted.');
  const login = await fetch(`${baseUrl}/api/admin/login`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ password: 'test-admin-password' }) });
  const adminCookie = login.headers.get('set-cookie')?.split(';')[0];
  if (!login.ok || !adminCookie?.includes('pnl_admin=')) throw new Error('Admin login failed.');
  const reportBefore = await (await fetch(`${baseUrl}/api/admin/activity`, { headers: { Cookie: adminCookie } })).json();
  if (reportBefore.people?.[0]?.name !== 'Smoke Viewer' || reportBefore.visits !== 1 || reportBefore.activeSeconds !== 0) throw new Error('Visit report incorrect.');
  await new Promise(resolve => setTimeout(resolve, 100));
  await fetch(`${baseUrl}/api/activity/heartbeat`, { method: 'POST', headers: viewerHeaders, body: JSON.stringify({ visitId, active: true, view: 'forecast' }) });
  const activeReport = await (await fetch(`${baseUrl}/api/admin/activity`, { headers: { Cookie: adminCookie } })).json();
  if (!(activeReport.activeSeconds > 0) || activeReport.people[0].view !== 'Forecast') throw new Error('Active heartbeat failed.');
  await new Promise(resolve => setTimeout(resolve, 100));
  await fetch(`${baseUrl}/api/activity/heartbeat`, { method: 'POST', headers: viewerHeaders, body: JSON.stringify({ visitId, active: false }) });
  const idleReport = await (await fetch(`${baseUrl}/api/admin/activity`, { headers: { Cookie: adminCookie } })).json();
  if (idleReport.activeSeconds !== activeReport.activeSeconds) throw new Error('Idle time counted.');
  const forged = await fetch(`${baseUrl}/api/admin/activity`, { headers: { Cookie: 'pnl_admin=forged' } });
  if (forged.status !== 401) throw new Error('Forged admin cookie accepted.');
  const logout = await fetch(`${baseUrl}/api/admin/logout`, { method: 'POST', headers: { ...jsonHeaders, Cookie: adminCookie }, body: '{}' });
  if (!logout.ok || (await fetch(`${baseUrl}/api/admin/activity`, { headers: { Cookie: adminCookie } })).status !== 401) throw new Error('Admin logout failed.');

  const dataResponse = await fetch(`${baseUrl}/data/dashboard-data.json`, { cache: 'no-store', headers: { Cookie: viewerCookie } });
  const stored = await dataResponse.json();
  if (stored.monthlyData?.[0]?.booking !== 100 || !stored.metadata?.ingestedAt) {
    throw new Error('Stored dashboard data failed validation.');
  }

  const indexResponse = await fetch(`${baseUrl}/`);
  const indexHtml = await indexResponse.text();
  if (!indexResponse.ok || !indexHtml.includes('Tech Licensing')) throw new Error('Vite dashboard index failed validation.');
  if (!indexResponse.headers.get('strict-transport-security')) throw new Error('HSTS header is missing.');
  if (!indexResponse.headers.get('content-security-policy')?.includes("script-src 'self'")) throw new Error('Content Security Policy is missing.');

  const spaResponse = await fetch(`${baseUrl}/forecasting`);
  if (!spaResponse.ok || !(await spaResponse.text()).includes('Tech Licensing')) throw new Error('SPA fallback failed validation.');

  console.log('Modern P&L dashboard smoke test passed.');
} finally {
  child.kill('SIGTERM');
  await new Promise((resolvePromise) => {
    const timer = setTimeout(resolvePromise, 2000);
    child.once('exit', () => { clearTimeout(timer); resolvePromise(); });
  });
  await rm(dataDir, { recursive: true, force: true });
}

