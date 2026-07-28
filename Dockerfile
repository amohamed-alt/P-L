FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/public \
    DATA_DIR=/app/runtime-data

RUN addgroup --system --gid 1001 pnl \
    && adduser --system --uid 1001 --ingroup pnl pnl \
    && mkdir -p /app/public/assets /app/public/data /app/runtime-data

COPY package.json server.mjs /app/
COPY index.html config.js /app/public/
COPY assets /app/public/assets/
COPY data /app/public/data/

RUN chown -R pnl:pnl /app

USER pnl

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=8s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
