import { describe, expect, it } from 'vitest';
import type { ServiceDocument } from '../src/services.ts';
import { splitDocument } from './split.ts';

const document = {
  openapi: '3.1.1',
  paths: {
    '/titles': { get: {} },
    '/admin/movies': { get: {} },
    '/admin/movies/{id}': { put: {} },
    '/administrators': { get: {} },
  },
  components: { schemas: { Movie: {} } },
};

describe('splitDocument', () => {
  it('serves /admin paths from the admin half without the prefix', () => {
    const halves = splitDocument(document, { name: 'catalog', prefix: '/catalog' });

    expect(Object.keys(halves.admin.paths ?? {})).toEqual(['/movies', '/movies/{id}']);
    expect(Object.keys(halves.public.paths ?? {})).toEqual(['/titles', '/administrators']);
  });

  it('keeps everything else of the document in both halves', () => {
    const halves = splitDocument(document, { name: 'catalog', prefix: '/catalog' });

    expect(halves.public.components).toBe(document.components);
    expect(halves.admin.openapi).toBe('3.1.1');
  });

  it('keeps only the browser paths of a service that lists them, matching whole segments', () => {
    const auth: ServiceDocument = {
      name: 'auth',
      prefix: '/auth',
      browserPaths: ['/profiles', '/email-change'],
    };
    const halves = splitDocument(
      {
        paths: {
          '/sign-in': {},
          '/refresh': {},
          '/me': {},
          '/profiles': {},
          '/profiles/{id}': {},
          '/profiles-export': {},
          '/email-change/confirm': {},
          '/admin/users': {},
        },
      },
      auth,
    );

    expect(Object.keys(halves.public.paths ?? {})).toEqual([
      '/profiles',
      '/profiles/{id}',
      '/email-change/confirm',
    ]);
    expect(Object.keys(halves.admin.paths ?? {})).toEqual(['/users']);
  });

  it('copes with a document that has no paths', () => {
    const halves = splitDocument({ openapi: '3.1.1' }, { name: 'gateway', prefix: '' });

    expect(halves.public.paths).toEqual({});
    expect(halves.admin.paths).toEqual({});
  });
});
