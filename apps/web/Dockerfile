# The customer web app (Next.js standalone server). Build from the repository root:
#   docker build --file apps/web/Dockerfile --tag netboxplus/web:local .

FROM node:26.13.1-alpine3.24 AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1 \
    TURBO_TELEMETRY_DISABLED=1 \
    CI=true
WORKDIR /repo
# Node.js 25+ no longer ships corepack; it installs pnpm in the version packageManager names.
RUN npm install --global corepack@0.36.0 && corepack enable

# Packages first, from the lockfile alone, so a source change does not download them again.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch --frozen-lockfile --store-dir /pnpm/store

COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --store-dir /pnpm/store
RUN pnpm turbo run build --filter=@netboxplus/web

# Distroless: no shell or package manager, runs as an unprivileged user. Pinned by digest; Dependabot updates it.
FROM gcr.io/distroless/nodejs26-debian13:nonroot@sha256:1d736cf8b5716c07a245301f92717143215d248fd55771ee1936ef4b3302e531
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
