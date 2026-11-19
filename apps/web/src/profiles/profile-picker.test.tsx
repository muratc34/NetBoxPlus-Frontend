import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { gatewayUrl, navigation, problem, renderPage, server, signedOut } from '../test/render';
import { ProfilePicker } from './profile-picker';

const session = {
  userId: '0195f0e0-0000-7000-8000-000000000001',
  email: 'viewer@example.test',
  roles: [],
  permissions: [],
  csrfToken: 'csrf',
};
const deniz = { id: '0195f0e0-0000-7000-8000-0000000000a1', name: 'Deniz', maxAgeRating: 'Age18' as const };
const ada = { id: '0195f0e0-0000-7000-8000-0000000000a2', name: 'Ada', maxAgeRating: 'Age7' as const };

function signedInWith(profiles: unknown[]) {
  server.use(
    http.get(`${gatewayUrl}/session`, () => HttpResponse.json(session)),
    http.get(`${gatewayUrl}/auth/profiles`, () => HttpResponse.json(profiles)),
  );
}

function renderPicker() {
  return renderPage(<ProfilePicker />, 'tr', { withProfiles: true });
}

describe('ProfilePicker', () => {
  it('remembers the chosen profile and goes on to the page that asked', async () => {
    navigation.search = new URLSearchParams({ next: '/tr/search?q=gece' });
    signedInWith([deniz, ada]);
    renderPicker();

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Ada' }));

    expect(document.cookie).toContain(`nbp-profile=${ada.id}.Age7`);
    expect(navigation.push).toHaveBeenCalledWith('/tr/search?q=gece');
  });

  it('goes home after choosing when nothing else asked, and never off the site', async () => {
    navigation.search = new URLSearchParams({ next: 'https://evil.example/' });
    signedInWith([deniz]);
    renderPicker();

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Deniz' }));

    expect(navigation.push).toHaveBeenCalledWith('/tr');
  });

  it('sends a visitor without a session to sign in first', async () => {
    navigation.search = new URLSearchParams({ next: '/tr/search' });
    server.use(signedOut);
    renderPicker();

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(
        '/tr/sign-in?next=%2Ftr%2Fprofiles%3Fnext%3D%252Ftr%252Fsearch',
      );
    });
  });

  it('stops offering a new profile at five', async () => {
    const five = Array.from({ length: 5 }, (_, index) => ({
      ...deniz,
      id: `0195f0e0-0000-7000-8000-00000000010${String(index)}`,
      name: `P${String(index)}`,
    }));
    signedInWith(five);
    renderPicker();

    expect(await screen.findByText('Bir hesapta en fazla 5 profil olabilir.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Profil ekle' })).not.toBeInTheDocument();
  });

  it("adds a profile, showing the backend's answer on the field it names", async () => {
    const created: unknown[] = [];
    signedInWith([deniz]);
    server.use(
      http.post(`${gatewayUrl}/auth/profiles`, async ({ request }) => {
        const body = await request.json();
        created.push(body);
        return created.length === 1
          ? problem(409, 'Profile.NameTaken', { errorCodes: { Name: ['Profile.NameTaken'] } })
          : HttpResponse.json({ id: ada.id }, { status: 201 });
      }),
    );
    renderPicker();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Profil ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Profil ekle' });
    await user.type(within(dialog).getByLabelText('Profil adı'), 'Deniz');
    await user.selectOptions(within(dialog).getByLabelText('İzleyebileceği içerikler'), 'Age7');
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    expect(await within(dialog).findByText('Bu adda bir profil zaten var.')).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('Profil adı'));
    await user.type(within(dialog).getByLabelText('Profil adı'), '  Ada ');
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(created).toEqual([
      { name: 'Deniz', maxAgeRating: 'Age7' },
      { name: 'Ada', maxAgeRating: 'Age7' },
    ]);
  });

  it('edits a profile in managing mode instead of choosing it', async () => {
    let updated: unknown;
    signedInWith([deniz, ada]);
    server.use(
      http.put(`${gatewayUrl}/auth/profiles/${ada.id}`, async ({ request }) => {
        updated = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPicker();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Profilleri yönet' }));
    await user.click(screen.getByRole('button', { name: 'Ada, düzenle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Profili düzenle' });
    expect(within(dialog).getByLabelText('İzleyebileceği içerikler')).toHaveValue('Age7');
    // The limit includes everything below it: the options say so.
    expect(within(dialog).getByRole('option', { name: '7+ ve altı' })).toHaveProperty('selected', true);
    expect(within(dialog).getByRole('option', { name: 'Tümü (18+ dahil)' })).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText('İzleyebileceği içerikler'), 'Age13');
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    await waitFor(() => {
      expect(updated).toEqual({ name: 'Ada', maxAgeRating: 'Age13' });
    });
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('asks before deleting, and says why the last profile stays', async () => {
    let deletes = 0;
    signedInWith([deniz]);
    server.use(
      http.delete(`${gatewayUrl}/auth/profiles/${deniz.id}`, () => {
        deletes += 1;
        return problem(409, 'Profile.LastProfile');
      }),
    );
    renderPicker();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Profilleri yönet' }));
    await user.click(screen.getByRole('button', { name: 'Deniz, düzenle' }));
    await user.click(await screen.findByRole('button', { name: 'Profili sil' }));
    expect(deletes).toBe(0);

    const confirm = await screen.findByRole('dialog', { name: 'Profil silinsin mi?' });
    await user.click(within(confirm).getByRole('button', { name: 'Sil' }));

    expect(await within(confirm).findByRole('alert')).toHaveTextContent('Hesabın son profili silinemez.');
    expect(deletes).toBe(1);
  });

  it('drops a choice that no longer fits and asks again', async () => {
    document.cookie = `nbp-profile=${ada.id}.Age13; Path=/`;
    navigation.pathname = '/tr';
    signedInWith([deniz, ada]);
    renderPage(<p>home</p>, 'tr', { withProfiles: true });

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/tr/profiles?next=%2Ftr');
    });
    expect(document.cookie).not.toContain('nbp-profile=');
  });

  it('keeps a choice that still fits', async () => {
    document.cookie = `nbp-profile=${ada.id}.Age7; Path=/`;
    signedInWith([deniz, ada]);
    renderPage(<p>home</p>, 'tr', { withProfiles: true });

    expect(await screen.findByText('home')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(document.cookie).toContain(`nbp-profile=${ada.id}.Age7`);
  });
});
