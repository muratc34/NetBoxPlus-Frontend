import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './logo';

describe('Logo', () => {
  it('is read as the product name', () => {
    render(
      <a href="/">
        <Logo />
      </a>,
    );

    expect(screen.getByRole('link', { name: 'NetBoxPlus' })).toBeInTheDocument();
  });
});
