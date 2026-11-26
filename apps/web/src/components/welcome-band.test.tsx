import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderPage, signInAs } from '../test/render';
import { WelcomeBand } from './welcome-band';

describe('WelcomeBand', () => {
  it('shows a visitor the plans', async () => {
    renderPage(<WelcomeBand />);

    expect(await screen.findByRole('link', { name: 'Planları gör' })).toHaveAttribute('href', '/tr/plans');
  });

  it('is there from the first paint for a likely guest, and stays for a guest', async () => {
    renderPage(<WelcomeBand likelyGuest />);

    expect(screen.getByRole('link', { name: 'Planları gör' })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole('link', { name: 'Planları gör' })).toBeInTheDocument();
  });

  it('waits for the session without the guess', () => {
    const { container } = renderPage(<WelcomeBand />);

    expect(container).toBeEmptyDOMElement();
  });

  it('goes once a likely guest turns out to be signed in', async () => {
    signInAs();
    renderPage(<WelcomeBand likelyGuest />, 'tr', { withProfiles: false });

    expect(screen.getByRole('link', { name: 'Planları gör' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Planları gör' })).not.toBeInTheDocument();
    });
  });

  it('is not there for a signed-in account', async () => {
    signInAs();
    const { container } = renderPage(<WelcomeBand />, 'tr', { withProfiles: false });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });
});
