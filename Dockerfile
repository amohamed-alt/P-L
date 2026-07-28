FROM node:24-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
COPY data ./data

RUN mkdir -p public/data \
    && cp -R data/. public/data/ \
    && npm run build

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/public \
    DATA_DIR=/app/runtime-data

RUN addgroup --system --gid 1001 pnl \
    && adduser --system --uid 1001 --ingroup pnl pnl \
    && mkdir -p /app/public /app/runtime-data

COPY --from=build /app/dist /app/public
COPY server.mjs /app/server.mjs

RUN chown -R pnl:pnl /app

USER pnl

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=8s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
