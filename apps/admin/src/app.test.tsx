import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAdminGateway } from './data/gateway';
import { localeStorageKey, LocaleProvider, useLocale } from './i18n';

describe('providers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('are needed above the hooks that read them', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useAdminGateway())).toThrow(
      'useAdminGateway needs an AdminGatewayProvider',
    );
    expect(() => renderHook(() => useLocale())).toThrow('useLocale needs a LocaleProvider');
  });

  it('keep the language working when the browser storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    function Probe() {
      const { locale, t, setLocale } = useLocale();
      return (
        <button
          type="button"
          onClick={() => {
            setLocale('en');
          }}
        >
          {locale} {t('admin.save')}
        </button>
      );
    }
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );

    expect(screen.getByRole('button')).toHaveTextContent('tr Kaydet');
    await userEvent.click(screen.getByRole('button'));
    expect(setItem).toHaveBeenCalledWith(localeStorageKey, 'en');
    expect(await screen.findByText('en Save')).toBeInTheDocument();
  });
});
