import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
    STATIC_DIR: resolve('.'),
    DATA_DIR: dataDir,
    PNL_DATA_INGEST_TOKEN: token,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let logs = '';
child.stdout.on('data', (chunk) => { logs += chunk.toString(); });
child.stderr.on('data', (chunk) => { logs += chunk.toString(); });

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // The process may still be starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Server did not become healthy. Logs:\n${logs}`);
}

try {
  await waitForHealth();

  const unauthorized = await fetch(`${baseUrl}/api/dashboard-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monthlyData: [{ year: 2026, monthNumber: 1 }] }),
  });
  if (unauthorized.status !== 401) {
    throw new Error(`Expected unauthorized status 401, received ${unauthorized.status}.`);
  }

  const payload = {
    metadata: { currentReportingYear: 2026 },
    monthlyData: [
      {
        year: 2026,
        monthNumber: 1,
        booking: 100,
        cashing: 80,
        cogs: 20,
        overheads: 10,
        supportAllocation: 5,
        hasMeaningfulData: true,
      },
    ],
  };

  const ingest = await fetch(`${baseUrl}/api/dashboard-data`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!ingest.ok) {
    throw new Error(`Ingest failed with ${ingest.status}: ${await ingest.text()}`);
  }

  const dataResponse = await fetch(`${baseUrl}/data/dashboard-data.json`, { cache: 'no-store' });
  if (!dataResponse.ok) {
    throw new Error(`Data fetch failed with status ${dataResponse.status}.`);
  }

  const stored = await dataResponse.json();
  if (stored.monthlyData?.[0]?.booking !== 100 || !stored.metadata?.ingestedAt) {
    throw new Error('Stored dashboard data failed validation.');
  }

  const indexResponse = await fetch(`${baseUrl}/`);
  if (!indexResponse.ok || !(await indexResponse.text()).includes('Executive Dashboard')) {
    throw new Error('Static dashboard index failed validation.');
  }

  console.log('P&L dashboard smoke test passed.');
} finally {
  child.kill('SIGTERM');
  await new Promise((resolvePromise) => {
    const timer = setTimeout(resolvePromise, 2000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolvePromise();
    });
  });
  await rm(dataDir, { recursive: true, force: true });
}
