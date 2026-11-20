import type { RouteObject } from 'react-router';
import { GenresPage } from './catalog/genres-page';
import { MoviePage } from './catalog/movie-page';
import { MoviesPage } from './catalog/movies-page';
import { PeoplePage } from './catalog/people-page';
import { PersonPage } from './catalog/person-page';
import { SeriesListPage } from './catalog/series-list-page';
import { SeriesPage } from './catalog/series-page';
import { Home, NotFound, RequirePermission, Shell } from './shell/shell';
import { SignInPage } from './shell/sign-in-page';

/** The panel's pages; each section asks for its permission (the menu shows only those the session has). */
export const routes: RouteObject[] = [
  { path: '/sign-in', element: <SignInPage /> },
  {
    element: <Shell />,
    children: [
      { index: true, element: <Home /> },
      {
        path: 'movies',
        element: (
          <RequirePermission permission="catalog:movies:read">
            <MoviesPage />
          </RequirePermission>
        ),
      },
      {
        path: 'movies/new',
        element: (
          <RequirePermission permission="catalog:movies:write">
            <MoviePage />
          </RequirePermission>
        ),
      },
      {
        path: 'movies/:id',
        element: (
          <RequirePermission permission="catalog:movies:read">
            <MoviePage />
          </RequirePermission>
        ),
      },
      {
        path: 'series',
        element: (
          <RequirePermission permission="catalog:series:read">
            <SeriesListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'series/new',
        element: (
          <RequirePermission permission="catalog:series:write">
            <SeriesPage />
          </RequirePermission>
        ),
      },
      {
        path: 'series/:id',
        element: (
          <RequirePermission permission="catalog:series:read">
            <SeriesPage />
          </RequirePermission>
        ),
      },
      {
        path: 'genres',
        element: (
          <RequirePermission permission="catalog:genres:read">
            <GenresPage />
          </RequirePermission>
        ),
      },
      {
        path: 'people',
        element: (
          <RequirePermission permission="catalog:people:read">
            <PeoplePage />
          </RequirePermission>
        ),
      },
      {
        path: 'people/new',
        element: (
          <RequirePermission permission="catalog:people:write">
            <PersonPage />
          </RequirePermission>
        ),
      },
      {
        path: 'people/:id',
        element: (
          <RequirePermission permission="catalog:people:read">
            <PersonPage />
          </RequirePermission>
        ),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];
