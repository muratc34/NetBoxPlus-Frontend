import path from 'node:path';
import type { NextConfig } from 'next';

// The monorepo root: standalone output and Turbopack must see the workspace packages.
const workspaceRoot = path.resolve(process.cwd(), '../..');

// The Content-Security-Policy is set per page by src/proxy.ts: it carries a new nonce each time.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@netboxplus/api', '@netboxplus/ui', '@netboxplus/i18n'],
  headers: () => Promise.resolve([{ source: '/:path*', headers: securityHeaders }]),
};

export default config;
