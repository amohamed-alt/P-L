# P&L Executive Dashboard

Production P&L command center deployed as a Docker service on the Talentera VPS.

## Application stack

- React 19 and Vite
- Recharts for responsive executive charts
- Lucide icons
- Node.js runtime server for static delivery and secured n8n data ingestion
- Docker Compose and Traefik with automatic HTTPS

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
P&L command center: https://pnl.dashboardtalentera.tech
```

Dashboard code is deployed from GitHub. Live financial data is not written to GitHub during normal operation.

## Dashboard capabilities

### Actual performance

- Baseline versus comparison-year KPIs
- Available YTD, closed-month and custom date ranges
- Optional partial-month inclusion
- Booking, cashing, cost, coverage and conversion views
- Monthly performance charts and full-year context
- Cost mix and component comparison
- Monthly comparison matrix
- Generated management insights
- CSV export and print support

### Forecasting

- Actual plus forecast full-year position
- Booking and cashing forecast by owner
- Monthly and cumulative closing-position charts
- Annual cost-plan coverage
- Operating result, cash surplus and conversion metrics

## Runtime behavior

- Browser data requests use cache-disabled runtime JSON.
- n8n sends transformed Google Sheets data to the protected ingest endpoint.
- Data is validated before it replaces the live file.
- Writes are atomic and the previous successful file is retained.
- If no runtime file exists, repository data is used as the initial seed.
- `/api/health` reports application and data status without exposing financial values.
- HTTP is permanently redirected to HTTPS.
- HSTS and application security headers are enabled.

## Environment variables

```dotenv
PNL_DATA_INGEST_TOKEN=<random token of at least 32 characters>
PNL_DOMAIN=pnl.dashboardtalentera.tech
PNL_HOST_PORT=3020
DATA_MAX_BYTES=15728640
```

Never commit `/root/P-L/.env` or expose the ingest token in chat, GitHub, workflow logs or frontend code.

## n8n configuration

Keep the existing Google Sheets and transformation nodes. Replace the final GitHub file-edit node with an **HTTP Request** node.

- Method: `POST`
- URL: `https://pnl.dashboardtalentera.tech/api/dashboard-data`
- Authentication: Generic Credential Type → Header Auth
- Header name: `Authorization`
- Header value: `Bearer <PNL_DATA_INGEST_TOKEN>`
- Send Body: enabled
- Body Content Type: JSON

For a direct dashboard object:

```javascript
={{ $json }}
```

For an existing `fileContent` output:

```javascript
={{ { fileContent: $json.fileContent } }}
```

## Development

```bash
npm install
npm run dev
```

Production validation:

```bash
npm run check
npm run smoke
docker build -t pnl-dashboard .
```

## Automated deployment

Every pull request runs:

- dependency installation
- Vite production build
- Node server syntax validation
- secured-ingest and static-delivery smoke test
- Docker image build

Every push to `main` deploys the production stack and verifies the trusted public HTTPS health endpoint.
