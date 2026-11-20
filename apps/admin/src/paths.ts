import type { MessageKey } from '@netboxplus/i18n';

/** The panel's addresses, in one place. */
export const paths = {
  home: '/',
  signIn: '/sign-in',
  movies: '/movies',
  newMovie: '/movies/new',
  movie: (id: string) => `/movies/${id}`,
  series: '/series',
  newSeries: '/series/new',
  seriesItem: (id: string) => `/series/${id}`,
  genres: '/genres',
  people: '/people',
  newPerson: '/people/new',
  person: (id: string) => `/people/${id}`,
};

export interface Section {
  readonly label: MessageKey;
  readonly path: string;
  /** Shown only to a session with this permission. */
  readonly permission: string;
}

/** The menu, in order; each section needs its read permission. */
export const sections: readonly Section[] = [
  { label: 'admin.nav.movies', path: paths.movies, permission: 'catalog:movies:read' },
  { label: 'admin.nav.series', path: paths.series, permission: 'catalog:series:read' },
  { label: 'admin.nav.genres', path: paths.genres, permission: 'catalog:genres:read' },
  { label: 'admin.nav.people', path: paths.people, permission: 'catalog:people:read' },
];
