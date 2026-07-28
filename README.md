# P&L Executive Dashboard

Production P&L dashboard deployed as a Docker service on the Talentera VPS.

## Production architecture

```text
Google Sheets
    ↓
n8n transformation workflow
    ↓ HTTPS POST with Bearer token
https://pnl.dashboardtalentera.tech/api/dashboard-data
    ↓
Persistent VPS file: /root/P-L-runtime/data/dashboard-data.json
    ↓
P&L dashboard: https://pnl.dashboardtalentera.tech
```

The dashboard code is deployed from GitHub. Live financial data is not written to GitHub during normal operation.

## Runtime behavior

- The browser reads `/data/dashboard-data.json` with cache disabled.
- n8n sends the transformed Google Sheets result to the protected ingest endpoint.
- Data is validated before it replaces the live file.
- Writes are atomic, so users never receive a partially written JSON file.
- The previous successful file is retained as `dashboard-data.previous.json`.
- If no runtime file exists yet, the service uses the repository data file as its initial seed.
- `/api/health` reports service and data status without exposing financial values.

## One-time VPS setup

The VPS must already have Docker, Docker Compose, and the shared Traefik network named `n8n_default`.

```bash
mkdir -p /root/P-L
cd /root/P-L

git clone https://github.com/amohamed-alt/P-L.git .
cp .env.example .env

# Generate a strong token and paste it into PNL_DATA_INGEST_TOKEN in .env.
openssl rand -hex 32
nano .env

install -d -m 0770 -o 1001 -g 1001 /root/P-L-runtime/data

docker compose config
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:3020/api/health
```

Do not commit `/root/P-L/.env` or share the ingest token in chat, GitHub, workflow logs, or dashboard code.

## Environment variables

```dotenv
PNL_DATA_INGEST_TOKEN=<random token of at least 32 characters>
PNL_DOMAIN=pnl.dashboardtalentera.tech
PNL_HOST_PORT=3020
DATA_MAX_BYTES=15728640
```

## n8n configuration

Keep the existing Google Sheets and transformation nodes. Replace the final GitHub file-edit node with an **HTTP Request** node.

### HTTP Request node

- Method: `POST`
- URL: `https://pnl.dashboardtalentera.tech/api/dashboard-data`
- Authentication: Generic Credential Type → Header Auth
- Header name: `Authorization`
- Header value: `Bearer <the same PNL_DATA_INGEST_TOKEN stored on the VPS>`
- Send Body: enabled
- Body Content Type: JSON

The endpoint supports both existing output formats.

### When the transformation returns the dashboard object directly

Use the complete current item as the JSON body:

```javascript
={{ $json }}
```

### When the transformation returns `fileContent`

Use this JSON body:

```javascript
={{ { fileContent: $json.fileContent } }}
```

A successful response looks like:

```json
{
  "ok": true,
  "ingestedAt": "2026-07-28T09:00:00.000Z",
  "monthlyRecords": 24
}
```

The API rejects invalid data, empty `monthlyData`, incorrect tokens, and oversized payloads. Configure the n8n workflow to retry temporary network errors without replacing the last successful dashboard file.

## Automated deployment

Pushes to `main` run syntax checks, an end-to-end smoke test, and a Docker build before deployment.

Configure these GitHub Actions secrets:

- `VPS_HOST`
- `VPS_USER` — normally `root`
- `VPS_SSH_KEY`
- `VPS_KNOWN_HOSTS` — recommended; the workflow can fall back to `ssh-keyscan`

The deployment workflow:

1. Validates the Node server.
2. Tests authentication, ingestion, persistence, and static delivery.
3. Builds the Docker image.
4. Updates `/root/P-L` on the VPS.
5. Preserves `/root/P-L-runtime/data` outside Git.
6. Starts the service through Docker Compose and Traefik.
7. Fails the deployment if the local health check does not pass.

## Local validation

```bash
npm run check
npm run smoke
docker build -t pnl-dashboard:test .
```

## Endpoints

- `/` — dashboard
- `/data/dashboard-data.json` — active data used by the browser
- `/api/health` — service and data health
- `/api/data-status` — data freshness metadata
- `POST /api/dashboard-data` — protected n8n ingest endpoint
