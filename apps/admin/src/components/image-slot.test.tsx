import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LocaleProvider } from '../i18n';
import { ImageSlot } from './image-slot';

const labels = {
  heading: 'Afiş',
  none: 'Afiş yok.',
  upload: 'Afiş yükle',
  replace: 'Afişi değiştir',
  remove: 'Afişi kaldır',
  hint: 'JPEG, PNG ya da WebP.',
};

function renderSlot(props: Partial<Parameters<typeof ImageSlot>[0]> = {}) {
  return render(
    <LocaleProvider>
      <ImageSlot
        labels={labels}
        imageUrl={null}
        alt="Afiş"
        imageClassName="w-40"
        writable
        onUpload={() => Promise.resolve()}
        onRemove={() => Promise.resolve()}
        {...props}
      />
    </LocaleProvider>,
  );
}

describe('ImageSlot', () => {
  it('says why it cannot be removed only when there is an image', () => {
    const first = renderSlot({ removeBlocked: 'Yayındaki filmin afişi kaldırılamaz.' });
    expect(screen.queryByText('Yayındaki filmin afişi kaldırılamaz.')).not.toBeInTheDocument();
    first.unmount();

    renderSlot({
      imageUrl: 'https://images.test/a.jpg',
      removeBlocked: 'Yayındaki filmin afişi kaldırılamaz.',
    });
    expect(screen.getByText('Yayındaki filmin afişi kaldırılamaz.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Afişi kaldır' })).not.toBeInTheDocument();
  });

  it('forgets the last failure when trying again', async () => {
    let attempts = 0;
    renderSlot({
      onUpload: () => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new Error('lost')) : Promise.resolve();
      },
    });
    const input = screen.getByLabelText('Afiş yükle');
    const file = new File(['x'], 'a.png', { type: 'image/png' });

    await userEvent.upload(input, file);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await userEvent.upload(input, file);
    expect(attempts).toBe(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
