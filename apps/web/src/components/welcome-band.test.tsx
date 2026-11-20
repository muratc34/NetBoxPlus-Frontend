import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderPage, signInAs } from '../test/render';
import { WelcomeBand } from './welcome-band';

describe('WelcomeBand', () => {
  it('shows a visitor the plans', async () => {
    renderPage(<WelcomeBand />);

    expect(await screen.findByRole('link', { name: 'Planları gör' })).toHaveAttribute('href', '/tr/plans');
  });

  it('is not there for a signed-in account', async () => {
    signInAs();
    const { container } = renderPage(<WelcomeBand />, 'tr', { withProfiles: false });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });
});
