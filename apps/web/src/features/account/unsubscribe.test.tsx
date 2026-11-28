import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { gatewayUrl, navigation, problem, renderPage, server } from '../../test/render';
import { Unsubscribe } from './unsubscribe';

function answer(response: () => Response) {
  const sent: string[] = [];
  server.use(
    http.post(`${gatewayUrl}/notification/unsubscribe`, ({ request }) => {
      sent.push(new URL(request.url).searchParams.get('token') ?? '');
      return response();
    }),
  );
  return sent;
}

describe('Unsubscribe', () => {
  it('changes nothing on opening, and turns the alerts off with the button', async () => {
    navigation.search = new URLSearchParams('token=abc-_123');
    const sent = answer(() => new HttpResponse(null, { status: 204 }));
    renderPage(<Unsubscribe />, 'tr', { withProfiles: false });

    const button = await screen.findByRole('button', { name: 'Uyarıları kapat' });
    expect(sent).toEqual([]);

    await userEvent.click(button);

    expect(await screen.findByText('Yeni giriş uyarıları kapatıldı.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Güvenlik ayarlarına git' })).toHaveAttribute(
      'href',
      '/tr/account/security',
    );
    expect(sent).toEqual(['abc-_123']);
  });

  it('says where else to turn them off when the link has expired', async () => {
    navigation.search = new URLSearchParams('token=old');
    answer(() => problem(400, 'Unsubscribe.TokenInvalid'));
    renderPage(<Unsubscribe />, 'tr', { withProfiles: false });

    await userEvent.click(await screen.findByRole('button', { name: 'Uyarıları kapat' }));

    expect(await screen.findByText(/Bu bağlantı geçersiz ya da süresi dolmuş/)).toBeInTheDocument();
  });

  it('says a link without its token is broken', () => {
    renderPage(<Unsubscribe />, 'tr', { withProfiles: false });

    expect(screen.queryByRole('button', { name: 'Uyarıları kapat' })).not.toBeInTheDocument();
  });
});
