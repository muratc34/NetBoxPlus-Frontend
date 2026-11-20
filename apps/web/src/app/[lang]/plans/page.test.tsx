import type { PlanOffer } from '@netboxplus/core';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { loadPlans } from '../../../server/billing';
import { renderPage, serverRendered } from '../../../test/render';
import PlansRoute, { generateMetadata } from './page';

vi.mock('../../../server/billing', () => ({ loadPlans: vi.fn() }));

const plan: PlanOffer = {
  id: '0195f0e0-0000-7000-8000-0000000000b1',
  name: 'Basic',
  description: 'One screen.',
  language: 'en',
  amountMinor: 999,
  currency: 'USD',
  quality: 'Sd',
  maxScreens: 1,
};

const props = (lang: string) => ({ params: Promise.resolve({ lang }), searchParams: Promise.resolve({}) });

describe('PlansRoute', () => {
  it("renders the language's plans on the server", async () => {
    vi.mocked(loadPlans).mockResolvedValue([plan]);

    renderPage(await serverRendered(PlansRoute(props('en'))), 'en');

    expect(loadPlans).toHaveBeenCalledWith('en');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Choose the plan that suits you' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic' }).closest('li')).toHaveTextContent('$9.99/month');
    expect(screen.getByText('1 screen at a time')).toBeInTheDocument();
  });

  it('is described for search engines in both languages', async () => {
    await expect(generateMetadata(props('tr'))).resolves.toEqual({
      title: 'Planlar',
      description: expect.stringContaining('aylık fiyat') as unknown,
      alternates: { canonical: '/tr/plans', languages: { tr: '/tr/plans', en: '/en/plans' } },
    });
    await expect(generateMetadata(props('de'))).resolves.toEqual({});
  });
});
