import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from './page';

describe('HomePage', () => {
  it.each([
    ['tr', 'Çok yakında'],
    ['en', 'Coming soon'],
  ])('shows the product and the heading in %s', async (lang, heading) => {
    render(await HomePage({ params: Promise.resolve({ lang }), searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getByText('NetBoxPlus')).toBeInTheDocument();
  });
});
