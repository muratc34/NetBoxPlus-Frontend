import type { RouteObject } from 'react-router';
import { PlanPage } from './billing/plan-page';
import { PlansPage } from './billing/plans-page';
import { SubscriptionPage } from './billing/subscription-page';
import { SubscriptionsPage } from './billing/subscriptions-page';
import { EmailPage } from './emails/email-page';
import { EmailsPage } from './emails/emails-page';
import { GenresPage } from './catalog/genres-page';
import { MoviePage } from './catalog/movie-page';
import { MoviesPage } from './catalog/movies-page';
import { PeoplePage } from './catalog/people-page';
import { PersonPage } from './catalog/person-page';
import { SeriesListPage } from './catalog/series-list-page';
import { SeriesPage } from './catalog/series-page';
import { Home, NotFound, RequirePermission, Shell } from './shell/shell';
import { VideoPage } from './videos/video-page';
import { VideosPage } from './videos/videos-page';
import { SignInPage } from './shell/sign-in-page';
import { RolePage } from './users/role-page';
import { RolesPage } from './users/roles-page';
import { UserPage } from './users/user-page';
import { UsersPage } from './users/users-page';

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
        path: 'videos',
        element: (
          <RequirePermission permission="streaming:videos:read">
            <VideosPage />
          </RequirePermission>
        ),
      },
      {
        path: 'videos/:id',
        element: (
          <RequirePermission permission="streaming:videos:read">
            <VideoPage />
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
      {
        path: 'users',
        element: (
          <RequirePermission permission="auth:users:read">
            <UsersPage />
          </RequirePermission>
        ),
      },
      {
        path: 'users/:id',
        element: (
          <RequirePermission permission="auth:users:read">
            <UserPage />
          </RequirePermission>
        ),
      },
      {
        path: 'roles',
        element: (
          <RequirePermission permission="auth:roles:read">
            <RolesPage />
          </RequirePermission>
        ),
      },
      {
        path: 'roles/new',
        element: (
          <RequirePermission permission="auth:roles:write">
            <RolePage />
          </RequirePermission>
        ),
      },
      {
        path: 'roles/:id',
        element: (
          <RequirePermission permission="auth:roles:read">
            <RolePage />
          </RequirePermission>
        ),
      },
      {
        path: 'plans',
        element: (
          <RequirePermission permission="billing:plans:read">
            <PlansPage />
          </RequirePermission>
        ),
      },
      {
        path: 'plans/new',
        element: (
          <RequirePermission permission="billing:plans:write">
            <PlanPage />
          </RequirePermission>
        ),
      },
      {
        path: 'plans/:id',
        element: (
          <RequirePermission permission="billing:plans:read">
            <PlanPage />
          </RequirePermission>
        ),
      },
      {
        path: 'subscriptions',
        element: (
          <RequirePermission permission="billing:subscriptions:read">
            <SubscriptionsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'subscriptions/:id',
        element: (
          <RequirePermission permission="billing:subscriptions:read">
            <SubscriptionPage />
          </RequirePermission>
        ),
      },
      {
        path: 'emails',
        element: (
          <RequirePermission permission="notification:emails:read">
            <EmailsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'emails/:id',
        element: (
          <RequirePermission permission="notification:emails:read">
            <EmailPage />
          </RequirePermission>
        ),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];
