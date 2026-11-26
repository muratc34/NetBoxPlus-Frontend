# NetBoxPlus Frontend

[![CI](https://github.com/muratc34/NetBoxPlus-Frontend/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/muratc34/NetBoxPlus-Frontend/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

The web and admin applications of NetBoxPlus, a subscription video streaming platform. They talk only to the
gateway of [NetBoxPlus-Backend](https://github.com/muratc34/NetBoxPlus-Backend): five .NET 10 services
behind a YARP gateway that keeps browser sessions in httpOnly cookies, so no access token ever reaches JavaScript.

> This is the rewrite of an earlier graduation project (Create React App), which is preserved under the
> [`v1-graduation`](../../tree/v1-graduation) tag.

## What is in it

**Web app** (customers, Turkish and English):

- Home page with a billboard that plays the title's trailer, a weekly Top 10, new titles and genre rows; movie, series,
  person and genre pages; search with suggestions. All of them render on the server, so they work without JavaScript.
- Sign-up, sign-in, e-mail verification and password reset; up to five profiles per account, each with an age limit
  that filters what it sees.
- Plans and subscription through Stripe Checkout, managed in Stripe's customer portal.
- An HLS player with quality, audio language (dubbing) and subtitle choices remembered per profile, a screen limit,
  resume and "continue watching"; My List.
- Account page: changing the e-mail address or the password, invoices, and deleting the account.

**Admin panel**:

- Movies, series (seasons and episodes), people and genres in both languages, with posters and backgrounds; publishing.
- Video upload straight to storage, transcoding progress, dubbing, subtitles and trailers.
- Users and their roles, roles and permissions; plans, subscriptions and invoices; the outgoing e-mail queue.

## Layout

```
apps/web          Customer site: Next.js (App Router). Catalog pages render on the server for search engines
                  and fast first paint; profiles, My List, playback and account pages call the gateway from the browser.
apps/admin        Admin panel: Vite + React single-page app, served as static files.
apps/e2e          End-to-end flows with Playwright against the running system (local, not in CI).
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

| Command               | What it does                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm dev`            | Both apps in development mode                                                                |
| `pnpm build`          | Production builds (web: Next.js standalone output; admin: static files in `apps/admin/dist`) |
| `pnpm lint`           | ESLint with type-aware and accessibility rules                                               |
| `pnpm typecheck`      | TypeScript in strict mode                                                                    |
| `pnpm test`           | Vitest and Testing Library                                                                   |
| `pnpm format:check`   | Prettier                                                                                     |
| `pnpm e2e`            | Playwright against the whole system (backend `up -App` and `seed`, Stripe CLI, Chrome)       |
| `pnpm e2e:lighthouse` | Lighthouse on the catalog pages, against the web app's production build                      |

### Configuration

The web app reads [`apps/web/.env.example`](apps/web/.env.example) (copy it to `.env.local`); the defaults fit the
backend running locally. In containers:

| Variable                  | What it is                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_GATEWAY_URL` | The gateway as the browser reaches it (built into the browser bundle)                         |
| `GATEWAY_INTERNAL_URL`    | The gateway as the server reaches it while rendering (`http://gateway:8080` in compose)       |
| `GATEWAY_SERVER_KEY`      | The backend's `GATEWAY_SERVER_KEY`: rendering requests count against the visitor's rate limit |
| `TRUSTED_PROXY_HOPS`      | Proxies in front that append to `X-Forwarded-For`; with 0 no visitor address is forwarded     |
| `STORAGE_ORIGINS`         | Where images and video are served from, for the Content-Security-Policy                       |
| `CATALOG_IMAGES_URL`      | Catalog's images container as the server reaches it, for the image optimizer                  |
| `SITE_URL`                | The site's public address, for canonical links and the sitemap                                |

The admin panel is told the gateway's address at build time (`VITE_GATEWAY_URL`; `http://localhost:5100` by default).

## Engineering notes

- **Strict by default:** TypeScript strict mode, type-aware ESLint, and accessibility rules (jsx-a11y) as errors.
- **Dependencies pinned to exact, current versions;** pnpm refuses releases younger than a day.
- **Generated API client:** types come from the backend's OpenAPI documents at a pinned commit; the web app's
  client cannot even name an admin path, and requests that change data carry the session's CSRF token.
- **Security headers** on every web response, including a Content-Security-Policy; no framework banner.
- **Server rendering within the gateway's rate limits:** the web server identifies itself with a key, so requests
  it makes while rendering count against the visitor, not against the server.
- **Images sized for the screen:** Catalog keeps one size per image; Next's optimizer serves each page the width it
  draws, as AVIF or WebP.
- **Tested end to end:** Playwright drives a customer from sign-up through a Stripe test payment, playback with
  dubbing and subtitles, My List, an e-mail change and account deletion; and an administrator from a new movie
  through video, dubbing, subtitles and trailer to publishing. Lighthouse scores the catalog pages 98–100 for
  performance, accessibility and SEO on desktop (search is `noindex` on purpose) and 84–88 for performance on a
  throttled phone.

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
