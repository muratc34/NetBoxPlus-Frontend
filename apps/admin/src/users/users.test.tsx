import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { RoleSummary, UserDetails, UserSummary } from '../data/users';
import { adminSession, gatewayUrl, locationOf, problem, renderApp, server, signInWith } from '../test/render';

const authUrl = `${gatewayUrl}/admin/auth`;
const reading = ['auth:users:read'];
const writing = ['auth:users:read', 'auth:users:write', 'auth:roles:read', 'catalog:movies:read'];

const deniz: UserDetails = {
  id: '0195f0e0-0000-7000-8000-0000000000d1',
  email: 'deniz@example.test',
  emailVerified: true,
  isDisabled: false,
  lockedOutUntil: null,
  failedSignInCount: 2,
  createdAt: '2026-11-10T09:00:00Z',
  modifiedAt: null,
  roles: [{ id: 'role-editor', name: 'Editor' }],
};

const roles: RoleSummary[] = [
  {
    id: 'role-admin',
    name: 'Administrator',
    isSystem: true,
    permissions: ['auth:users:read', 'billing:plans:write'],
    userCount: 1,
  },
  { id: 'role-editor', name: 'Editor', isSystem: false, permissions: ['catalog:movies:read'], userCount: 3 },
  { id: 'role-support', name: 'Support', isSystem: false, permissions: ['auth:users:read'], userCount: 0 },
  {
    id: 'role-billing',
    name: 'Billing',
    isSystem: false,
    permissions: ['billing:plans:write'],
    userCount: 1,
  },
];

function summary(user: Partial<UserSummary> & { id: string; email: string }): UserSummary {
  return { isDisabled: false, lockedOutUntil: null, createdAt: '2026-11-10T09:00:00Z', roles: [], ...user };
}

/** Auth's copy of the user and the roles; a change the test makes is seen on the next read. */
function answerUser(user: UserDetails = deniz) {
  let current = user;
  server.use(
    http.get(`${authUrl}/users/${user.id}`, () => HttpResponse.json(current)),
    http.get(`${authUrl}/roles`, () => HttpResponse.json(roles)),
  );
  return (next: Partial<UserDetails>) => {
    current = { ...current, ...next };
  };
}

const section = (name: string) => screen.getByRole('region', { name });

describe('UsersPage', () => {
  it('lists the accounts with their roles and state, searched by address and paged', async () => {
    signInWith(reading);
    const asked: string[] = [];
    server.use(
      http.get(`${authUrl}/users`, ({ request }) => {
        const url = new URL(request.url);
        asked.push(url.search);
        const search = url.searchParams.get('search');
        const items = search
          ? [summary({ id: 'u3', email: 'can@example.test' })]
          : [
              summary({ id: 'u1', email: 'ada@example.test', roles: ['Editor', 'Support'] }),
              summary({ id: 'u2', email: 'bora@example.test', isDisabled: true }),
              summary({ id: 'u4', email: 'ece@example.test', lockedOutUntil: '2999-01-01T10:00:00Z' }),
              summary({ id: 'u5', email: 'fuat@example.test', lockedOutUntil: '2020-01-01T10:00:00Z' }),
            ];
        return HttpResponse.json({ items, pageNumber: 1, pageSize: 20, totalCount: search ? 21 : 45 });
      }),
    );
    const { router } = renderApp('/users');

    const table = await screen.findByRole('table');
    expect(document.title).toBe('Kullanıcılar');
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      );
    expect(rows.map((row) => row.slice(0, 3))).toEqual([
      ['ada@example.test', 'Editor, Support', 'Açık'],
      ['bora@example.test', '—', 'Kapalı'],
      ['ece@example.test', '—', expect.stringMatching(/^Kilitli \(.*2999.* saatine kadar\)$/) as string],
      ['fuat@example.test', '—', 'Açık'],
    ]);
    expect(screen.getByRole('link', { name: 'ada@example.test' })).toHaveAttribute('href', '/users/u1');
    expect(asked).toEqual(['?page=1&pageSize=20']);

    await userEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
    await waitFor(() => {
      expect(locationOf(router)).toBe('/users?page=2');
    });
    expect(asked).toContain('?page=2&pageSize=20');

    await userEvent.type(screen.getByLabelText('E-postaya göre ara'), ' can ');
    expect(await screen.findByRole('link', { name: 'can@example.test' })).toBeInTheDocument();
    expect(locationOf(router)).toBe('/users?search=can');
    expect(asked).toContain('?search=can&page=1&pageSize=20');

    // Paging keeps the search.
    await userEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
    await waitFor(() => {
      expect(locationOf(router)).toBe('/users?search=can&page=2');
    });
  });

  it('says when no account matches and when the list cannot be read', async () => {
    signInWith(reading);
    let answer = () => HttpResponse.json({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 });
    server.use(http.get(`${authUrl}/users`, () => answer()));
    const first = renderApp('/users?search=nobody');
    expect(await screen.findByText('Kullanıcı bulunamadı.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-postaya göre ara')).toHaveValue('nobody');
    first.unmount();

    answer = () => problem(403, 'Error.Forbidden');
    renderApp('/users');
    expect(await screen.findByRole('alert')).toHaveTextContent(/./);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the menu entries with their permissions', async () => {
    signInWith(['auth:users:read', 'auth:roles:read']);
    server.use(
      http.get(`${authUrl}/users`, () =>
        HttpResponse.json({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 }),
      ),
    );
    renderApp('/');
    const menu = await screen.findByRole('navigation', { name: 'Yönetim menüsü' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Kullanıcılar', 'Roller']);
  });
});

describe('UserPage', () => {
  it('shows the account and what an editor may do with it', async () => {
    signInWith(writing);
    answerUser();
    renderApp(`/users/${deniz.id}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'deniz@example.test' })).toBeInTheDocument();
    expect(document.title).toBe('deniz@example.test');
    const facts = Object.fromEntries(
      screen.getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]),
    );
    expect(facts).toMatchObject({
      'E-posta doğrulandı': 'Evet',
      'Başarısız giriş': '2',
      'Son değişiklik': '—',
    });
    expect(screen.getByText('Açık')).toBeInTheDocument();
    expect(screen.queryByText(/Bu senin hesabın/)).not.toBeInTheDocument();
    expect(section('Erişim')).toHaveTextContent('Hesap kapatılırsa kullanıcı giriş yapamaz');
    expect(within(section('Roller')).getByRole('link', { name: 'Editor' })).toHaveAttribute(
      'href',
      '/roles/role-editor',
    );
    // No delete permission: no deleting.
    expect(screen.queryByRole('region', { name: 'Sil' })).not.toBeInTheDocument();
  });

  it('closes the account after asking, and opens it again', async () => {
    signInWith(writing);
    const change = answerUser();
    const sent: string[] = [];
    let answer = () => problem(404, 'User.NotFound');
    server.use(
      http.post(`${authUrl}/users/${deniz.id}/:action`, ({ params }) => {
        sent.push(String(params.action));
        return answer();
      }),
    );
    renderApp(`/users/${deniz.id}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Hesabı kapat' }));
    let dialog = screen.getByRole('dialog', { name: '“deniz@example.test” kapatılsın mı?' });
    expect(dialog).toHaveTextContent('açık oturumları hemen kapanır');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hesabı kapat' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Bu kullanıcı artık yok.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));

    answer = () => {
      change({ isDisabled: true });
      return new HttpResponse(null, { status: 204 });
    };
    await userEvent.click(screen.getByRole('button', { name: 'Hesabı kapat' }));
    dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hesabı kapat' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(
      await within(section('Erişim')).findByText('Hesap kapalı: kullanıcı giriş yapamıyor.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Kapalı')).toBeInTheDocument();

    answer = () => {
      change({ isDisabled: false });
      return new HttpResponse(null, { status: 204 });
    };
    await userEvent.click(screen.getByRole('button', { name: 'Hesabı aç' }));
    expect(await screen.findByRole('button', { name: 'Hesabı kapat' })).toBeInTheDocument();
    expect(sent).toEqual(['disable', 'disable', 'enable']);
  });

  it('shows a refusal to open the account', async () => {
    signInWith(writing);
    answerUser({ ...deniz, isDisabled: true });
    server.use(http.post(`${authUrl}/users/${deniz.id}/enable`, () => problem(404, 'User.NotFound')));
    renderApp(`/users/${deniz.id}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Hesabı aç' }));
    expect(await within(section('Erişim')).findByRole('alert')).toHaveTextContent('Bu kullanıcı artık yok.');
  });

  it('gives only roles whose every permission the session holds, and takes one away after asking', async () => {
    signInWith(writing);
    const change = answerUser();
    const sent: string[] = [];
    let removal = () => problem(403, 'Role.PermissionNotHeld');
    server.use(
      http.put(`${authUrl}/users/${deniz.id}/roles/:roleId`, ({ params }) => {
        sent.push(`put ${String(params.roleId)}`);
        change({ roles: [...deniz.roles, { id: 'role-support', name: 'Support' }] });
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(`${authUrl}/users/${deniz.id}/roles/:roleId`, ({ params }) => {
        sent.push(`delete ${String(params.roleId)}`);
        return removal();
      }),
    );
    renderApp(`/users/${deniz.id}`);

    const form = await within(await screen.findByRole('region', { name: 'Roller' })).findByRole('form', {
      name: 'Rol ekle',
    });
    expect(
      within(within(form).getByLabelText('Rol ekle'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Support']);
    expect(section('Roller')).toHaveTextContent(
      'Sadece bütün yetkilerine sahip olduğun roller verilip alınabilir.',
    );
    await userEvent.click(within(form).getByRole('button', { name: 'Ekle' }));
    expect(await within(section('Roller')).findByRole('link', { name: 'Support' })).toBeInTheDocument();
    expect(sent).toEqual(['put role-support']);
    expect(within(section('Roller')).queryByRole('form')).not.toBeInTheDocument();
    // Nothing left to give, but some roles are beyond the session: not "every role is given".
    expect(within(section('Roller')).queryByText('Bütün roller atanmış.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Support: rolü kaldır' }));
    let dialog = screen.getByRole('dialog', { name: '“Support” rolü kaldırılsın mı?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaldır' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Sahip olmadığın bir yetkiyi');
    expect(
      within(screen.getByRole('region', { name: 'Roller', hidden: true })).queryByRole('alert', {
        hidden: true,
      }),
    ).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    expect(within(section('Roller')).queryByRole('alert')).not.toBeInTheDocument();

    removal = () => {
      change({ roles: deniz.roles });
      return new HttpResponse(null, { status: 204 });
    };
    await userEvent.click(screen.getByRole('button', { name: 'Support: rolü kaldır' }));
    dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaldır' }));
    await waitFor(() => {
      expect(within(section('Roller')).queryByRole('link', { name: 'Support' })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sent).toEqual(['put role-support', 'delete role-support', 'delete role-support']);
  });

  it('gives the chosen role and shows a refusal in the section', async () => {
    signInWith([...writing, 'billing:plans:write']);
    answerUser();
    const asked: string[] = [];
    server.use(
      http.put(`${authUrl}/users/${deniz.id}/roles/:roleId`, ({ params }) => {
        asked.push(String(params.roleId));
        return problem(404, 'Role.NotFound');
      }),
    );
    renderApp(`/users/${deniz.id}`);

    const form = await within(await screen.findByRole('region', { name: 'Roller' })).findByRole('form', {
      name: 'Rol ekle',
    });
    expect(
      within(within(form).getByLabelText('Rol ekle'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Administrator', 'Support', 'Billing']);
    await userEvent.selectOptions(within(form).getByLabelText('Rol ekle'), 'Billing');
    await userEvent.click(within(form).getByRole('button', { name: 'Ekle' }));
    expect(await within(section('Roller')).findByRole('alert')).toHaveTextContent('Bu rol artık yok.');
    expect(asked).toEqual(['role-billing']);
  });

  it('keeps one from closing, deleting or taking roles from their own account', async () => {
    signInWith([...writing, 'auth:users:delete', 'billing:plans:write']);
    answerUser({ ...deniz, id: adminSession.userId, roles: [{ id: 'role-admin', name: 'Administrator' }] });
    renderApp(`/users/${adminSession.userId}`);

    expect(
      await screen.findByText('Bu senin hesabın: kapatamaz, silemez ve rollerini buradan kaldıramazsın.'),
    ).toBeInTheDocument();
    await within(section('Roller')).findByRole('form', { name: 'Rol ekle' });
    expect(screen.queryByRole('region', { name: 'Erişim' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Sil' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rolü kaldır/ })).not.toBeInTheDocument();
    // Every role is open to someone holding every permission.
    expect(section('Roller')).not.toHaveTextContent('Sadece bütün yetkilerine');
  });

  it('says when every role is given, and takes away only roles the session fully holds', async () => {
    signInWith(writing);
    answerUser({ ...deniz, roles: roles.map((role) => ({ id: role.id, name: role.name })) });
    renderApp(`/users/${deniz.id}`);

    expect(
      await within(await screen.findByRole('region', { name: 'Roller' })).findByText('Bütün roller atanmış.'),
    ).toBeInTheDocument();
    expect(within(section('Roller')).queryByRole('form')).not.toBeInTheDocument();
    // Roles beyond the session are assigned already, so nothing is held back from the choice.
    expect(section('Roller')).not.toHaveTextContent('Sadece bütün yetkilerine');
    expect(screen.getByRole('button', { name: 'Editor: rolü kaldır' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Billing: rolü kaldır' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administrator: rolü kaldır' })).not.toBeInTheDocument();
  });

  it('offers nothing to change to a reader even with the roles already loaded', async () => {
    signInWith(['auth:users:read', 'auth:roles:read', 'catalog:movies:read']);
    answerUser();
    const { router } = renderApp('/roles');
    await screen.findByRole('table');

    await router.navigate(`/users/${deniz.id}`);
    const roleSection = await screen.findByRole('region', { name: 'Roller' });
    expect(within(roleSection).getByRole('link', { name: 'Editor' })).toBeInTheDocument();
    expect(within(roleSection).queryByRole('button')).not.toBeInTheDocument();
    expect(roleSection).not.toHaveTextContent('Sadece bütün yetkilerine');
  });

  it('only shows the account to a reader, without asking for the roles', async () => {
    signInWith(reading);
    let rolesAsked = false;
    server.use(
      http.get(`${authUrl}/users/${deniz.id}`, () =>
        HttpResponse.json({ ...deniz, roles: [], emailVerified: false }),
      ),
      http.get(`${authUrl}/roles`, () => {
        rolesAsked = true;
        return HttpResponse.json(roles);
      }),
    );
    renderApp(`/users/${deniz.id}`);

    expect(
      await within(await screen.findByRole('region', { name: 'Roller' })).findByText('Rolü yok.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Hayır')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Erişim' })).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByText(/Sadece bütün yetkilerine/)).not.toBeInTheDocument();
    expect(screen.queryByText('Bütün roller atanmış.')).not.toBeInTheDocument();
    expect(rolesAsked).toBe(false);
  });

  it('names a role without a link when roles cannot be read', async () => {
    signInWith(['auth:users:read', 'auth:users:write']);
    answerUser();
    renderApp(`/users/${deniz.id}`);

    const roleSection = await screen.findByRole('region', { name: 'Roller' });
    expect(within(roleSection).getByText('Editor')).toBeInTheDocument();
    expect(within(roleSection).queryByRole('link')).not.toBeInTheDocument();
  });

  it('deletes the account after asking and goes back to the list', async () => {
    signInWith([...reading, 'auth:users:delete']);
    answerUser();
    let answer = () => problem(409, 'User.LastAdministrator');
    let deleted = 0;
    server.use(
      http.delete(`${authUrl}/users/${deniz.id}`, () => {
        deleted += 1;
        return answer();
      }),
      http.get(`${authUrl}/users`, () =>
        HttpResponse.json({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 }),
      ),
    );
    const { router } = renderApp(`/users/${deniz.id}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Hesabı sil' }));
    const dialog = screen.getByRole('dialog', { name: '“deniz@example.test” silinsin mi?' });
    expect(dialog).toHaveTextContent('Geri alınamaz.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sil' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Bu, son yönetici hesabı; silinemez.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));

    answer = () => new HttpResponse(null, { status: 204 });
    await userEvent.click(screen.getByRole('button', { name: 'Hesabı sil' }));
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sil' }));
    await waitFor(() => {
      expect(locationOf(router)).toBe('/users');
    });
    expect(deleted).toBe(2);
  });

  it('says when the account is gone', async () => {
    signInWith(reading);
    server.use(http.get(`${authUrl}/users/${deniz.id}`, () => problem(404, 'User.NotFound')));
    renderApp(`/users/${deniz.id}`);

    expect(await screen.findByRole('alert')).toHaveTextContent('Bu kullanıcı artık yok.');
  });
});
