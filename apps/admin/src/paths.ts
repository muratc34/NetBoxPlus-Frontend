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
  videos: '/videos',
  video: (id: string) => `/videos/${id}`,
  genres: '/genres',
  people: '/people',
  newPerson: '/people/new',
  person: (id: string) => `/people/${id}`,
  users: '/users',
  user: (id: string) => `/users/${id}`,
  roles: '/roles',
  newRole: '/roles/new',
  role: (id: string) => `/roles/${id}`,
  plans: '/plans',
  newPlan: '/plans/new',
  plan: (id: string) => `/plans/${id}`,
  subscriptions: '/subscriptions',
  subscription: (id: string) => `/subscriptions/${id}`,
  emails: '/emails',
  email: (id: string) => `/emails/${id}`,
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
  { label: 'admin.nav.videos', path: paths.videos, permission: 'streaming:videos:read' },
  { label: 'admin.nav.genres', path: paths.genres, permission: 'catalog:genres:read' },
  { label: 'admin.nav.people', path: paths.people, permission: 'catalog:people:read' },
  { label: 'admin.nav.users', path: paths.users, permission: 'auth:users:read' },
  { label: 'admin.nav.roles', path: paths.roles, permission: 'auth:roles:read' },
  { label: 'admin.nav.plans', path: paths.plans, permission: 'billing:plans:read' },
  { label: 'admin.nav.subscriptions', path: paths.subscriptions, permission: 'billing:subscriptions:read' },
  { label: 'admin.nav.emails', path: paths.emails, permission: 'notification:emails:read' },
];
