import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './app';

describe('App', () => {
  it('shows the admin title', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'NetBoxPlus Yönetim' })).toBeInTheDocument();
  });
});
