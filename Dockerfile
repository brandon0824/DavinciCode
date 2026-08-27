FROM node:22-bookworm AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm AS runner
ENV NODE_ENV=production
ENV PORT=60824
WORKDIR /app

# PostgreSQL remains root-managed; the Next.js process is dropped to node.
RUN apt-get update && \
    apt-get install -y --no-install-recommends postgresql postgresql-contrib sudo curl gosu && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh && chown -R node:node /app

EXPOSE 60824
EXPOSE 5432
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:60824/api/health || exit 1

ENTRYPOINT ["/bin/bash", "./entrypoint.sh"]
