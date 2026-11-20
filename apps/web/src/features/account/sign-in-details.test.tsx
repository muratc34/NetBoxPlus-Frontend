import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { gatewayUrl, problem, renderPage, server } from '../../test/render';
import { SignInDetails } from './sign-in-details';

function verified(value: boolean) {
  server.use(
    http.get(`${gatewayUrl}/auth/email-verification`, () =>
      HttpResponse.json({ verified: value, verifiedAt: null }),
    ),
  );
}

/** What the gateway was sent at `path`, answering with `answer` (204 by default). */
function gatewayAt(path: string, answer?: () => Response) {
  const sent: unknown[] = [];
  server.use(
    http.post(`${gatewayUrl}${path}`, async ({ request }) => {
      sent.push(await request.json());
      return answer ? answer() : new HttpResponse(null, { status: 204 });
    }),
  );
  return sent;
}

function details() {
  return renderPage(<SignInDetails address="viewer@example.test" />, 'tr', { withProfiles: false });
}

describe('SignInDetails', () => {
  it('shows the address and that it is verified', async () => {
    verified(true);
    details();

    expect(screen.getByRole('region', { name: 'Giriş bilgileri' })).toHaveTextContent('viewer@example.test');
    expect(await screen.findByText('Doğrulandı')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bağlantıyı yeniden gönder' })).not.toBeInTheDocument();
  });

  it('offers nothing to resend while it does not know yet', async () => {
    server.use(
      http.get(`${gatewayUrl}/auth/email-verification`, async () => {
        await delay(80);
        return HttpResponse.json({ verified: true, verifiedAt: null });
      }),
    );
    details();

    expect(screen.queryByRole('button', { name: 'Bağlantıyı yeniden gönder' })).not.toBeInTheDocument();
    expect(await screen.findByText('Doğrulandı')).toBeInTheDocument();
  });

  it('offers a new link for an address not verified yet', async () => {
    verified(false);
    const sent: string[] = [];
    server.use(
      http.post(`${gatewayUrl}/auth/email-verification`, () => {
        sent.push('link');
        return new HttpResponse(null, { status: 202 });
      }),
    );
    details();

    expect(await screen.findByText('Doğrulanmadı')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Bağlantıyı yeniden gönder' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Yeni bir bağlantı gönderdik.');
    expect(sent).toEqual(['link']);
  });

  it('says why no new link was sent', async () => {
    verified(false);
    server.use(
      http.post(`${gatewayUrl}/auth/email-verification`, () =>
        problem(409, 'EmailVerification.RequestedRecently'),
      ),
    );
    details();

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Bağlantıyı yeniden gönder' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/dakika/);
  });

  it('opens one form at a time, focused on its first field, and closes it again', async () => {
    verified(true);
    details();
    const user = userEvent.setup();
    const emailButton = screen.getByRole('button', { name: 'E-postayı değiştir' });

    await user.click(emailButton);
    expect(emailButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Yeni e-posta')).toHaveFocus();
    expect(document.getElementById(emailButton.getAttribute('aria-controls') ?? '')).toContainElement(
      screen.getByRole('form', { name: 'E-postayı değiştir' }),
    );

    await user.click(screen.getByRole('button', { name: 'Şifreyi değiştir' }));
    expect(screen.queryByRole('form', { name: 'E-postayı değiştir' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Mevcut şifre')).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    await user.click(emailButton);
    await user.click(emailButton);
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });
});

describe('changing the e-mail address', () => {
  async function request(newEmail: string, password: string) {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'E-postayı değiştir' }));
    const form = screen.getByRole('form', { name: 'E-postayı değiştir' });
    if (newEmail) {
      await user.type(within(form).getByLabelText('Yeni e-posta'), newEmail);
    }
    if (password) {
      await user.type(within(form).getByLabelText('Mevcut şifre'), password);
    }
    await user.click(within(form).getByRole('button', { name: 'Onay bağlantısı gönder' }));
    return form;
  }

  it('checks the fields before sending anything', async () => {
    verified(true);
    const sent = gatewayAt('/session/email');
    details();

    await request('not an address', '');

    expect(await screen.findByText('Geçerli bir e-posta adresi yaz.')).toBeInTheDocument();
    expect(screen.getByText('Bu alan zorunlu.')).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it('sends a link to the new address, which changes nothing until it is opened', async () => {
    verified(true);
    const sent = gatewayAt('/session/email');
    details();

    await request(' new@example.test ', 'the password');

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Onay bağlantısını new@example.test adresine gönderdik.',
    );
    expect(sent).toEqual([{ newEmail: 'new@example.test', password: 'the password' }]);
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Giriş bilgileri' })).toHaveTextContent('viewer@example.test');
  });

  it.each([
    ['User.PasswordIncorrect', 'Mevcut şifre', 'Şifre hatalı.'],
    ['User.EmailTaken', 'Yeni e-posta', 'Bu e-posta adresiyle zaten bir hesap var.'],
    ['User.EmailUnchanged', 'Yeni e-posta', 'Bu zaten şu anki e-posta adresin.'],
  ])('puts %s on its field', async (code, field, text) => {
    verified(true);
    gatewayAt('/session/email', () => problem(code === 'User.EmailTaken' ? 409 : 400, code));
    details();

    await request('new@example.test', 'the password');

    await waitFor(() => {
      expect(screen.getByLabelText(field)).toHaveAttribute('aria-invalid', 'true');
    });
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says when a link was asked for too recently', async () => {
    verified(true);
    gatewayAt('/session/email', () => problem(409, 'EmailChange.RequestedRecently'));
    details();

    await request('new@example.test', 'the password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Az önce bir bağlantı gönderdik.');
  });
});

describe('changing the password', () => {
  async function change(current: string, next: string, again = next) {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Şifreyi değiştir' }));
    const form = screen.getByRole('form', { name: 'Şifreyi değiştir' });
    if (current) {
      await user.type(within(form).getByLabelText('Mevcut şifre'), current);
    }
    await user.type(within(form).getByLabelText('Yeni şifre'), next);
    await user.type(within(form).getByLabelText('Yeni şifre (tekrar)'), again);
    await user.click(within(form).getByRole('button', { name: 'Kaydet' }));
  }

  it('checks the new password before sending anything', async () => {
    verified(true);
    const sent = gatewayAt('/session/password');
    details();

    await change('', 'short', 'other');

    expect(await screen.findByText('Şifre en az 12 karakter olmalı.')).toBeInTheDocument();
    expect(screen.getByText('Şifreler aynı değil.')).toBeInTheDocument();
    expect(screen.getByText('Bu alan zorunlu.')).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it('changes it and says the other devices were signed out', async () => {
    verified(true);
    const sent = gatewayAt('/session/password');
    details();

    await change('the old password', 'a brand new password');

    expect(await screen.findByRole('status')).toHaveTextContent('Şifren değişti.');
    expect(sent).toEqual([{ currentPassword: 'the old password', newPassword: 'a brand new password' }]);
    expect(screen.queryByRole('form')).not.toBeInTheDocument();

    // Opening a form again puts the message away.
    await userEvent.setup().click(screen.getByRole('button', { name: 'E-postayı değiştir' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('puts a wrong current password on its field, and the rules on the new one', async () => {
    verified(true);
    gatewayAt('/session/password', () => problem(400, 'User.PasswordIncorrect'));
    const { unmount } = details();

    await change('wrong', 'a brand new password');
    expect(await screen.findByText('Şifre hatalı.')).toBeInTheDocument();
    expect(screen.getByLabelText('Mevcut şifre')).toHaveAttribute('aria-invalid', 'true');
    unmount();

    gatewayAt('/session/password', () =>
      problem(400, 'Error.Validation', { errorCodes: { NewPassword: ['User.PasswordTooLong'] } }),
    );
    details();
    await change('the old password', 'a brand new password');
    expect(await screen.findByText('Şifre en fazla 128 karakter olabilir.')).toBeInTheDocument();
    expect(screen.getByLabelText('Yeni şifre')).toHaveAttribute('aria-invalid', 'true');
  });

  it('says when there were too many tries', async () => {
    verified(true);
    gatewayAt('/session/password', () => problem(429, 'RateLimit.Exceeded'));
    details();

    await change('the old password', 'a brand new password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Çok fazla deneme yaptın.');
  });
});
