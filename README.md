# NetBoxPlus Frontend

[![CI](https://github.com/muratc34/NetBoxPlus-Frontend/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/muratc34/NetBoxPlus-Frontend/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

The web and admin applications of NetBoxPlus, a subscription video streaming platform. They talk only to the
gateway of [NetBoxPlus-Backend](https://github.com/muratc34/NetBoxPlus-Backend): five .NET 10 services
behind a YARP gateway that keeps browser sessions in httpOnly cookies, so no access token ever reaches JavaScript.

> Work in progress. The original graduation project (Create React App) is preserved under the
> [`v1-graduation`](../../tree/v1-graduation) tag.

## Layout

```
apps/web          Customer site: Next.js (App Router). Catalog pages render on the server for search engines
                  and fast first paint; profiles, My List, playback and account pages call the gateway from the browser.
apps/admin        Admin panel: Vite + React single-page app, served as static files.
packages/api      Types and clients generated from the backend's OpenAPI documents.
packages/ui       Design tokens (Tailwind CSS v4) and shared components.
packages/i18n     Turkish and English texts, checked at compile time.
packages/config   Shared TypeScript and test setup.
```

## Getting started

Requires Node.js 26 and pnpm (the version in `package.json`; for example `npm install --global corepack`, then `corepack enable`).

```bash
pnpm install
pnpm dev
```

The web app runs on http://localhost:5173 and the admin panel on http://localhost:5174. These ports are the ones
the backend's gateway allows, so start the backend first (`./deploy/dev.ps1 up -App` in the backend repository).

| Command             | What it does                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm dev`          | Both apps in development mode                                                                |
| `pnpm build`        | Production builds (web: Next.js standalone output; admin: static files in `apps/admin/dist`) |
| `pnpm lint`         | ESLint with type-aware and accessibility rules                                               |
| `pnpm typecheck`    | TypeScript in strict mode                                                                    |
| `pnpm test`         | Vitest and Testing Library                                                                   |
| `pnpm format:check` | Prettier                                                                                     |

## Engineering notes

- **Strict by default:** TypeScript strict mode, type-aware ESLint, and accessibility rules (jsx-a11y) as errors.
- **Dependencies pinned to exact, current versions;** pnpm refuses releases younger than a day.
- **Generated API client:** types come from the backend's OpenAPI documents at a pinned commit; the web app's
  client cannot even name an admin path, and requests that change data carry the session's CSRF token.
- **Security headers** on every web response; no framework banner.

## Containers

Both apps build from the repository root:

```bash
docker build --file apps/web/Dockerfile --tag netboxplus/web:local .
docker build --file apps/admin/Dockerfile --tag netboxplus/admin:local .
```

- **web:** the Next.js standalone server on distroless Node.js, as a non-root user without a shell, on port 3000.
- **admin:** static files on unprivileged nginx (port 8080), with long-lived caching for hashed assets and a fallback
  to `index.html` for client-side routes.
- Both answer `/health/live` and send the same security headers.

## Continuous integration

[CI](.github/workflows/ci.yml) runs on every push and pull request to `master`:

1. A check that the copied OpenAPI documents match the backend at the recorded commit.
2. Formatting, lint, typecheck, tests and builds.
3. `pnpm audit`.
4. A build of both images.

Actions are pinned to commit SHAs; Dependabot proposes npm, action and image updates weekly.

## License

[MIT](LICENSE)
