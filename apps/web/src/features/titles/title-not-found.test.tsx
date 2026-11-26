import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../../test/render';
import { TitleNotFound } from './title-not-found';

describe('TitleNotFound', () => {
  it('says the title is not available and leads back home', () => {
    renderPage(<TitleNotFound />);

    expect(screen.getByRole('heading', { level: 1, name: 'Bu içerik yayında değil' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ana sayfaya dön' })).toHaveAttribute('href', '/tr');
  });

  it('speaks the visitor’s language', () => {
    renderPage(<TitleNotFound />, 'en');

    expect(
      screen.getByRole('heading', { level: 1, name: 'This title is not available' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/en');
  });
});
