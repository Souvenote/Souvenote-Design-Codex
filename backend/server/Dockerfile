# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS dependencies
WORKDIR /workspace/backend/server
COPY backend/server/package.json backend/server/package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY backend/server/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app/backend/server

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && curl --fail --silent --show-error --location \
      https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
      --output /usr/local/share/ca-certificates/rds-global-bundle.pem \
    && rm -rf /var/lib/apt/lists/*

COPY backend/server/package.json backend/server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /workspace/backend/server/dist ./dist
COPY backend/server/scripts ./scripts
COPY backend/database /app/backend/database

USER node
EXPOSE 4000
CMD ["node", "dist/main"]
