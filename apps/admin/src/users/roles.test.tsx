import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { RoleDetails, RoleSummary } from '../data/users';
import { gatewayUrl, locationOf, problem, renderApp, server, signInWith } from '../test/render';
import { groupPermissions } from './permissions';

const authUrl = `${gatewayUrl}/admin/auth`;

/** Auth's catalog, in its own (alphabetical) order. */
const catalog = [
  'auth:roles:read',
  'auth:roles:write',
  'auth:users:delete',
  'auth:users:read',
  'billing:plans:read',
  'catalog:movies:delete',
  'catalog:movies:publish',
  'catalog:movies:read',
  'sample:notes:delete',
];
const editing = [
  'auth:roles:read',
  'auth:roles:write',
  'catalog:movies:read',
  'catalog:movies:publish',
  'billing:plans:read',
];

const editor: RoleDetails = {
  id: 'role-editor',
  name: 'Editor',
  isSystem: false,
  permissions: ['catalog:movies:read'],
  createdAt: '2026-11-01T10:00:00Z',
  modifiedAt: null,
};

/** Auth's copy of the role; a change the test makes is seen on the next read. */
function answerRole(role: RoleDetails = editor) {
  let current = role;
  server.use(
    http.get(`${authUrl}/roles/${role.id}`, () => HttpResponse.json(current)),
    http.get(`${authUrl}/permissions`, () => HttpResponse.json(catalog)),
  );
  return (next: Partial<RoleDetails>) => {
    current = { ...current, ...next };
  };
}

const form = () => screen.getByRole('form', { name: 'Rol bilgileri' });
const box = (code: string) => screen.getByRole('checkbox', { name: (name) => name.endsWith(code) });

describe('groupPermissions', () => {
  it('groups by service in a fixed order, then by resource and from reading to deleting', () => {
    expect(groupPermissions(catalog)).toEqual([
      {
        service: 'auth',
        permissions: ['auth:roles:read', 'auth:roles:write', 'auth:users:read', 'auth:users:delete'],
      },
      {
        service: 'catalog',
        permissions: ['catalog:movies:read', 'catalog:movies:publish', 'catalog:movies:delete'],
      },
      { service: 'billing', permissions: ['billing:plans:read'] },
      { service: 'sample', permissions: ['sample:notes:delete'] },
    ]);
    expect(groupPermissions(['x:a:zap', 'x:a:read', 'auth:admin:sign-in', 'auth:admin:read'])).toEqual([
      { service: 'auth', permissions: ['auth:admin:sign-in', 'auth:admin:read'] },
      { service: 'x', permissions: ['x:a:read', 'x:a:zap'] },
    ]);
  });
});

describe('RolesPage', () => {
  it('lists the roles, the system one first, with how many permissions and users', async () => {
    signInWith(['auth:roles:read', 'auth:roles:write']);
    const roles: RoleSummary[] = [
      { id: 'r2', name: 'Support', isSystem: false, permissions: ['auth:users:read'], userCount: 0 },
      { id: 'r1', name: 'Yönetici', isSystem: true, permissions: catalog, userCount: 1 },
      { id: 'r3', name: 'Editor', isSystem: false, permissions: ['a:b:c', 'a:b:d'], userCount: 3 },
    ];
    server.use(http.get(`${authUrl}/roles`, () => HttpResponse.json(roles)));
    renderApp('/roles');

    const table = await screen.findByRole('table');
    expect(document.title).toBe('Roller');
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) =>
          within(row)
            .getAllByRole('cell')
            .map((cell) => cell.textContent),
        ),
    ).toEqual([
      ['YöneticiSistem rolü', '9', '1'],
      ['Editor', '2', '3'],
      ['Support', '1', '0'],
    ]);
    expect(screen.getByRole('link', { name: 'Editor' })).toHaveAttribute('href', '/roles/r3');
    expect(screen.getByRole('link', { name: 'Yeni rol' })).toHaveAttribute('href', '/roles/new');
  });

  it('offers no new role without the write permission and shows a failure', async () => {
    signInWith(['auth:roles:read']);
    server.use(http.get(`${authUrl}/roles`, () => problem(403, 'Error.Forbidden')));
    renderApp('/roles');

    expect(await screen.findByRole('alert')).toHaveTextContent(/./);
    expect(screen.queryByRole('link', { name: 'Yeni rol' })).not.toBeInTheDocument();
  });
});

describe('RolePage', () => {
  it('shows the role grouped by service and saves the changes', async () => {
    signInWith(editing);
    const change = answerRole();
    let sent: unknown;
    server.use(
      http.put(`${authUrl}/roles/${editor.id}`, async ({ request }) => {
        sent = await request.json();
        change({ name: 'Publisher', permissions: ['catalog:movies:publish', 'catalog:movies:read'] });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(`/roles/${editor.id}`);

    await screen.findByRole('heading', { level: 1, name: 'Editor' });
    expect(document.title).toBe('Editor');
    expect(screen.getByLabelText('Ad')).toHaveValue('Editor');
    const groups = within(form())
      .getAllByRole('group')
      .map((group) => group.querySelector(':scope > legend')?.textContent)
      .filter(Boolean);
    expect(groups).toEqual(['Hesaplar', 'Katalog', 'Faturalama', 'sample']);
    expect(box('catalog:movies:read')).toBeChecked();
    expect(box('catalog:movies:read')).toHaveAccessibleName('Filmleri görcatalog:movies:read');
    expect(box('sample:notes:delete')).toHaveAccessibleName('sample:notes:deletesample:notes:delete');
    // A permission the session does not hold cannot be given.
    expect(box('catalog:movies:delete')).toBeDisabled();
    expect(box('catalog:movies:publish')).toBeEnabled();

    await userEvent.clear(screen.getByLabelText('Ad'));
    await userEvent.type(screen.getByLabelText('Ad'), ' Publisher ');
    await userEvent.click(box('catalog:movies:publish'));
    await userEvent.click(box('billing:plans:read'));
    await userEvent.click(box('billing:plans:read'));
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));

    expect(await within(form()).findByRole('status')).toHaveTextContent('Kaydedildi.');
    // In the catalog's order, whatever order they were ticked in.
    expect(sent).toEqual({
      name: 'Publisher',
      permissions: ['catalog:movies:publish', 'catalog:movies:read'],
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Publisher' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Roller' }));
    await screen.findByRole('heading', { level: 1, name: 'Roller' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('makes a role and goes on to its page, with the name checked first', async () => {
    signInWith(editing);
    answerRole({ ...editor, id: 'role-new', name: 'Reader', permissions: ['auth:roles:read'] });
    let sent: unknown;
    server.use(
      http.post(`${authUrl}/roles`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ id: 'role-new' }, { status: 201 });
      }),
    );
    const { router } = renderApp('/roles/new');

    await screen.findByRole('heading', { level: 1, name: 'Yeni rol' });
    expect(document.title).toBe('Yeni rol');
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Bu alan zorunlu.')).toBeInTheDocument();
    expect(sent).toBeUndefined();

    await userEvent.type(screen.getByLabelText('Ad'), 'x'.repeat(65));
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Ad en fazla 64 karakter olabilir.')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Ad'));
    await userEvent.type(screen.getByLabelText('Ad'), 'Reader');
    await userEvent.click(box('auth:roles:read'));
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));

    await waitFor(() => {
      expect(locationOf(router)).toBe('/roles/role-new');
    });
    expect(sent).toEqual({ name: 'Reader', permissions: ['auth:roles:read'] });
    expect(await screen.findByRole('heading', { level: 1, name: 'Reader' })).toBeInTheDocument();
  });

  it('puts a taken name on the field and another refusal on the form', async () => {
    signInWith(editing);
    answerRole();
    let answer = () => problem(409, 'Role.NameTaken');
    server.use(http.put(`${authUrl}/roles/${editor.id}`, () => answer()));
    renderApp(`/roles/${editor.id}`);

    await screen.findByRole('heading', { level: 1, name: 'Editor' });
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByLabelText('Ad')).toHaveAccessibleDescription('Bu adda bir rol zaten var.');

    answer = () => problem(403, 'Role.PermissionNotHeld');
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    expect(await within(form()).findByRole('alert')).toHaveTextContent('Sahip olmadığın bir yetkiyi');
  });

  it('keeps the system role read only', async () => {
    signInWith(editing);
    answerRole({ ...editor, id: 'role-admin', name: 'Administrator', isSystem: true, permissions: catalog });
    renderApp('/roles/role-admin');

    expect(
      await screen.findByText('Sistem rolü bütün yetkileri taşır ve değiştirilemez.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Ad')).toBeDisabled();
    expect(within(form()).queryByRole('button', { name: 'Kaydet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administrator: sil' })).not.toBeInTheDocument();
    expect(screen.queryByText(/sahip olmadığın yetkiler/)).not.toBeInTheDocument();
  });

  it('keeps a role with a permission the session lacks read only', async () => {
    signInWith(editing);
    answerRole({ ...editor, permissions: ['catalog:movies:read', 'catalog:movies:delete'] });
    renderApp(`/roles/${editor.id}`);

    expect(
      await screen.findByText('Bu rolde senin sahip olmadığın yetkiler var; değiştiremez ve silemezsin.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Ad')).toBeDisabled();
    expect(within(form()).queryByRole('button', { name: 'Kaydet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editor: sil' })).not.toBeInTheDocument();
  });

  it('only shows a role to a reader', async () => {
    signInWith(['auth:roles:read']);
    answerRole({ ...editor, permissions: ['catalog:movies:read', 'catalog:movies:delete'] });
    renderApp(`/roles/${editor.id}`);

    await screen.findByRole('heading', { level: 1, name: 'Editor' });
    expect(screen.getByLabelText('Ad')).toBeDisabled();
    expect(within(form()).queryByRole('button', { name: 'Kaydet' })).not.toBeInTheDocument();
    expect(screen.queryByText(/sahip olmadığın yetkiler/)).not.toBeInTheDocument();
  });

  it('keeps making a role to the write permission', async () => {
    signInWith(['auth:roles:read']);
    renderApp('/roles/new');

    expect(await screen.findByRole('alert')).toHaveTextContent('Bu sayfa için yetkin yok.');
  });

  it('deletes a role after asking and goes back to the list', async () => {
    signInWith(editing);
    answerRole();
    let answer = () => problem(409, 'Role.SystemRole');
    server.use(
      http.delete(`${authUrl}/roles/${editor.id}`, () => answer()),
      http.get(`${authUrl}/roles`, () => HttpResponse.json([])),
    );
    const { router } = renderApp(`/roles/${editor.id}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Editor: sil' }));
    const dialog = screen.getByRole('dialog', { name: '“Editor” silinsin mi?' });
    expect(dialog).toHaveTextContent('Rol, taşıyan bütün kullanıcılardan kalkar');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sil' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Sistem rolü değiştirilemez.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));

    answer = () => new HttpResponse(null, { status: 204 });
    await userEvent.click(screen.getByRole('button', { name: 'Editor: sil' }));
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sil' }));
    await waitFor(() => {
      expect(locationOf(router)).toBe('/roles');
    });
  });

  it('says when the role or the catalog cannot be read', async () => {
    signInWith(editing);
    server.use(
      http.get(`${authUrl}/roles/${editor.id}`, () => problem(404, 'Role.NotFound')),
      http.get(`${authUrl}/permissions`, () => HttpResponse.json(catalog)),
    );
    const first = renderApp(`/roles/${editor.id}`);
    expect(await screen.findByRole('alert')).toHaveTextContent('Bu rol artık yok.');
    first.unmount();

    server.use(http.get(`${authUrl}/permissions`, () => problem(403, 'Error.Forbidden')));
    renderApp('/roles/new');
    expect(await screen.findByRole('alert')).toHaveTextContent(/./);
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });
});
