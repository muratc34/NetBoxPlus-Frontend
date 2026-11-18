# The admin panel: static files behind nginx. Build from the repository root:
#   docker build --file apps/admin/Dockerfile --tag netboxplus/admin:local .

FROM node:26.13.1-alpine3.24 AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    TURBO_TELEMETRY_DISABLED=1 \
    CI=true
WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch --frozen-lockfile --store-dir /pnpm/store

COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --store-dir /pnpm/store
RUN pnpm turbo run build --filter=@netboxplus/admin

# nginx as an unprivileged user on port 8080.
FROM nginxinc/nginx-unprivileged:1.31.7-alpine3.24
COPY apps/admin/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY apps/admin/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /repo/apps/admin/dist /usr/share/nginx/html
EXPOSE 8080
