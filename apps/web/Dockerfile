# The customer web app (Next.js standalone server). Build from the repository root:
#   docker build --file apps/web/Dockerfile --tag netboxplus/web:local .

FROM node:24.22.3-alpine3.24 AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1 \
    TURBO_TELEMETRY_DISABLED=1 \
    CI=true
WORKDIR /repo
RUN corepack enable

# Packages first, from the lockfile alone, so a source change does not download them again.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch --frozen-lockfile --store-dir /pnpm/store

COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --store-dir /pnpm/store
RUN pnpm turbo run build --filter=@netboxplus/web

# Distroless: no shell or package manager, runs as an unprivileged user. Pinned by digest; Dependabot updates it.
FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:6abfcb367ebc291572c774c1592a986be2ab26a2486f73093401327495a5962a
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=nonroot:nonroot /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nonroot:nonroot /repo/apps/web/.next/static ./apps/web/.next/static
USER nonroot
EXPOSE 3000
CMD ["apps/web/server.js"]
