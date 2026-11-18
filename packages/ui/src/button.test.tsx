import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('does not submit forms unless asked', () => {
    render(<Button>Play</Button>);

    expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('type', 'button');
  });

  it('keeps an explicit type', () => {
    render(<Button type="submit">Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  });

  it('applies the variant and the caller class', () => {
    render(
      <Button variant="secondary" className="w-full">
        More info
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'More info' });
    expect(button).toHaveClass('bg-white/15', 'w-full');
    expect(button).not.toHaveClass('bg-brand-strong');
  });
});
