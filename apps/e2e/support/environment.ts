import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Where the system the tests run against is reached. */
export const urls = {
  web: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
  admin: process.env.E2E_ADMIN_URL ?? 'http://localhost:5174',
  gateway: process.env.E2E_GATEWAY_URL ?? 'http://localhost:5100',
  mailpit: process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025',
};

/**
 * The backend's `deploy/.env` (credentials, Stripe's test key), read into this process's environment once.
 * Its values are never written anywhere: the tests take them from `process.env` by name.
 */
export function loadBackendEnvironment(): void {
  const file = resolve(
    process.env.NETBOXPLUS_ENV_FILE ??
      resolve(import.meta.dirname, '../../../../NetBoxPlus-Backend/deploy/.env'),
  );
  if (!existsSync(file)) {
    throw new Error(
      `The backend's deploy/.env was not found at ${file}. Run ./deploy/dev.ps1 up -App there, or set NETBOXPLUS_ENV_FILE.`,
    );
  }
  process.loadEnvFile(file);
}

/** A value from deploy/.env that the run cannot go without. */
export function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing from the backend's deploy/.env.`);
  }
  return value;
}

/** Stripe's key, test mode only: the run makes customers and subscriptions with it. */
export function stripeTestKey(): string {
  const key = required('STRIPE_SECRET_KEY');
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) {
    throw new Error('STRIPE_SECRET_KEY is not a test-mode key; the end-to-end run refuses it.');
  }
  return key;
}
