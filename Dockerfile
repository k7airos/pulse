# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build

WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# better-sqlite3 ships prebuilt binaries; the toolchain is only a fallback for odd platforms
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN NODE_OPTIONS=--max-old-space-size=4096 pnpm build

FROM node:22-alpine

WORKDIR /app
ENV HOST=0.0.0.0 \
    PORT=3000 \
    NODE_ENV=production \
    PULSE_DATA_DIR=/data
COPY --from=build --chown=node:node /app/.output /app/.output
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/v1/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
