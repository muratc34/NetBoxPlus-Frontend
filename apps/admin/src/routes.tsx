import type { RouteObject } from 'react-router';
import { GenresPage } from './catalog/genres-page';
import { PeoplePage } from './catalog/people-page';
import { PersonPage } from './catalog/person-page';
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
