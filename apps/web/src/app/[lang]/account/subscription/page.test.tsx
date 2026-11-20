import { describe, expect, it, vi } from 'vitest';
import SubscriptionReturnRoute from './page';

vi.mock('next/navigation', () => ({
  redirect: (href: string) => {
    throw new Error(`redirect ${href}`);
  },
  notFound: () => {
    throw new Error('not found');
  },
}));

const visit = (lang: string, searchParams: Record<string, string | string[] | undefined>) =>
  SubscriptionReturnRoute({
    params: Promise.resolve({ lang }),
    searchParams: Promise.resolve(searchParams),
  });

describe('SubscriptionReturnRoute', () => {
  it("goes on to the account page with the payment provider's query", async () => {
    await expect(visit('tr', { checkout: 'success' })).rejects.toThrow(
      'redirect /tr/account?checkout=success',
    );
    await expect(visit('en', { a: ['1', '2'], b: undefined })).rejects.toThrow(
      'redirect /en/account?a=1&a=2',
    );
    await expect(visit('tr', {})).rejects.toThrow(/^redirect \/tr\/account$/);
  });

  it('is not found in another language', async () => {
    await expect(visit('de', {})).rejects.toThrow('not found');
  });
});
