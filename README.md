# NetBoxPlus Frontend

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

The web and admin applications of NetBoxPlus, a subscription video streaming platform. They talk only to the
gateway of [NetBoxPlus-Backend](https://github.com/muratc34/NetBoxPlus-Backend/tree/v2): five .NET 10 services
behind a YARP gateway that keeps browser sessions in httpOnly cookies, so no access token ever reaches JavaScript.

> Work in progress. The original graduation project (Create React App) is preserved under the
> [`v1-graduation`](../../tree/v1-graduation) tag.

## Layout

```
apps/web          Customer site: Next.js (App Router). Catalog pages render on the server for search engines
                  and fast first paint; profiles, My List, playback and account pages call the gateway from the browser.
apps/admin        Admin panel: Vite + React single-page app, served as static files.
packages/ui       Design tokens (Tailwind CSS v4) and shared components.
packages/i18n     Turkish and English texts, checked at compile time.
packages/config   Shared TypeScript and test setup.
```

## Getting started

Requires Node.js 24 and pnpm (the version in `package.json`, for example through `corepack enable`).

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
- **Security headers** on every web response; no framework banner.

## License

[MIT](LICENSE)
