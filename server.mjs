import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 3000);
const STATIC_DIR = resolve(process.env.STATIC_DIR || process.cwd());
const DATA_DIR = resolve(process.env.DATA_DIR || './runtime-data');
const DATA_FILE = resolve(DATA_DIR, 'dashboard-data.json');
const BACKUP_FILE = resolve(DATA_DIR, 'dashboard-data.previous.json');
const SEED_DATA_FILE = resolve(STATIC_DIR, 'data/dashboard-data.json');
const INGEST_TOKEN = String(process.env.PNL_DATA_INGEST_TOKEN || '');
const MAX_BODY_BYTES = Number(process.env.DATA_MAX_BYTES || 15 * 1024 * 1024);

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.csv', 'text/csv; charset=utf-8'],
]);

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

function setSecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
  );
}

function tokenMatches(request) {
  if (INGEST_TOKEN.length < 32) return false;
  const authorization = String(request.headers.authorization || '');
  const supplied = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : String(request.headers['x-pnl-ingest-token'] || '').trim();

  const expectedBuffer = Buffer.from(INGEST_TOKEN);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

async function readRequestBody(request) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      const error = new Error('Request body exceeds the configured size limit.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    const error = new Error('A JSON request body is required.');
    error.statusCode = 400;
    throw error;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('The request body is not valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

function normalizeIncomingPayload(body) {
  let payload = body;

  if (typeof body?.fileContent === 'string') {
    try {
      payload = JSON.parse(body.fileContent);
    } catch {
      const error = new Error('fileContent must contain valid JSON.');
      error.statusCode = 400;
      throw error;
    }
  } else if (body?.dashboardData && typeof body.dashboardData === 'object') {
    payload = body.dashboardData;
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    const error = new Error('The dashboard payload must be a JSON object.');
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(payload.monthlyData) || payload.monthlyData.length === 0) {
    const error = new Error('The dashboard payload must include a non-empty monthlyData array.');
    error.statusCode = 422;
    throw error;
  }

  const ingestedAt = new Date().toISOString();
  return {
    ...payload,
    metadata: {
      ...(payload.metadata || {}),
      ingestedAt,
      deliverySource: 'Google Sheets via n8n',
    },
  };
}

async function fileExists(path) {
  try {
    await access(path, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function activeDataFile() {
  return (await fileExists(DATA_FILE)) ? DATA_FILE : SEED_DATA_FILE;
}

async function persistDashboardData(payload) {
  await mkdir(DATA_DIR, { recursive: true });
  const temporaryFile = resolve(DATA_DIR, `.dashboard-data.${process.pid}.${Date.now()}.tmp`);

  if (await fileExists(DATA_FILE)) {
    await copyFile(DATA_FILE, BACKUP_FILE);
  }

  await writeFile(temporaryFile, `${JSON.stringify(payload)}\n`, {
    encoding: 'utf8',
    mode: 0o640,
  });
  await rename(temporaryFile, DATA_FILE);
}

async function dataStatus() {
  const path = await activeDataFile();
  try {
    const details = await stat(path);
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      available: true,
      source: path === DATA_FILE ? 'runtime' : 'seed',
      modifiedAt: details.mtime.toISOString(),
      ingestedAt: parsed?.metadata?.ingestedAt || null,
      generatedAt: parsed?.metadata?.generatedAt || null,
      monthlyRecords: Array.isArray(parsed?.monthlyData) ? parsed.monthlyData.length : 0,
    };
  } catch {
    return { available: false };
  }
}

async function serveFile(request, response, filePath, noStore = false) {
  try {
    const details = await stat(filePath);
    if (!details.isFile()) {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }

    response.writeHead(200, {
      'Content-Type': MIME_TYPES.get(extname(filePath).toLowerCase()) || 'application/octet-stream',
      'Content-Length': details.size,
      'Cache-Control': noStore ? 'no-store' : 'public, max-age=300',
      'Last-Modified': details.mtime.toUTCString(),
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }
    throw error;
  }
}

function resolveStaticPath(pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestedPath);
  } catch {
    return null;
  }

  const candidate = resolve(STATIC_DIR, `.${decodedPath}`);
  if (candidate !== STATIC_DIR && !candidate.startsWith(`${STATIC_DIR}${sep}`)) return null;
  return candidate;
}

async function handleRequest(request, response) {
  setSecurityHeaders(response);
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'pnl-dashboard',
      ingestConfigured: INGEST_TOKEN.length >= 32,
      data: await dataStatus(),
    });
    return;
  }

  if (url.pathname === '/api/data-status' && request.method === 'GET') {
    sendJson(response, 200, await dataStatus());
    return;
  }

  if (url.pathname === '/api/dashboard-data' && request.method === 'POST') {
    if (!tokenMatches(request)) {
      sendJson(response, 401, { error: 'Unauthorized' });
      return;
    }

    const body = await readRequestBody(request);
    const payload = normalizeIncomingPayload(body);
    await persistDashboardData(payload);
    sendJson(response, 200, {
      ok: true,
      ingestedAt: payload.metadata.ingestedAt,
      monthlyRecords: payload.monthlyData.length,
    });
    return;
  }

  if (url.pathname === '/data/dashboard-data.json' && ['GET', 'HEAD'].includes(request.method || '')) {
    await serveFile(request, response, await activeDataFile(), true);
    return;
  }

  if (!['GET', 'HEAD'].includes(request.method || '')) {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  const staticPath = resolveStaticPath(url.pathname);
  if (!staticPath) {
    sendJson(response, 400, { error: 'Invalid path' });
    return;
  }

  await serveFile(request, response, staticPath, url.pathname === '/' || url.pathname.endsWith('.html'));
}

await mkdir(DATA_DIR, { recursive: true });

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error(`[pnl-dashboard] ${error?.stack || error}`);
    if (!response.headersSent) {
      sendJson(response, Number(error?.statusCode) || 500, {
        error: Number(error?.statusCode) && Number(error.statusCode) < 500
          ? error.message
          : 'Internal server error',
      });
    } else {
      response.destroy();
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[pnl-dashboard] listening on 0.0.0.0:${PORT}`);
});

function shutdown(signal) {
  console.log(`[pnl-dashboard] received ${signal}; shutting down`);
  server.close((error) => {
    process.exit(error ? 1 : 0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
