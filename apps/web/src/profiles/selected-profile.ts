import type { Profile } from '@netboxplus/core';
import { ageRatings, type AgeRating } from '@netboxplus/core/reads';

/**
 * The profile being watched, kept in a cookie of the web application's own host: `<id>.<maxAgeRating>`.
 * The session cookie belongs to the gateway, so this is what the web server can read to render a
 * child's pages with the age filter. It is no secret and no boundary: Streaming checks the age itself.
 */
export const profileCookie = 'nbp-profile';

export interface SelectedProfile {
  readonly id: string;
  readonly maxAgeRating: AgeRating;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAgeRating(value: string): value is AgeRating {
  return (ageRatings as readonly string[]).includes(value);
}

/** The cookie's value, if it is one this application wrote. */
export function parseSelectedProfile(value: string | undefined): SelectedProfile | undefined {
  const [id = '', rating = '', ...rest] = (value ?? '').split('.');
  return rest.length === 0 && uuid.test(id) && isAgeRating(rating) ? { id, maxAgeRating: rating } : undefined;
}

export function formatSelectedProfile(profile: SelectedProfile): string {
  return `${profile.id}.${profile.maxAgeRating}`;
}

/** Whether the chosen profile still exists with the same age limit; otherwise it is chosen again. */
export function isStillValid(selected: SelectedProfile, profiles: readonly Profile[]): boolean {
  return profiles.some(
    (profile) => profile.id === selected.id && profile.maxAgeRating === selected.maxAgeRating,
  );
}

export function readSelectedProfileCookie(cookies: string): SelectedProfile | undefined {
  const entry = cookies
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${profileCookie}=`));
  return parseSelectedProfile(entry?.slice(profileCookie.length + 1));
}

/** For a year, on every path; `Secure` wherever the site is served over HTTPS. */
export function selectedProfileCookie(profile: SelectedProfile | undefined, secure: boolean): string {
  const value = profile ? formatSelectedProfile(profile) : '';
  const lifetime = profile ? 365 * 24 * 60 * 60 : 0;
  return `${profileCookie}=${value}; Path=/; Max-Age=${String(lifetime)}; SameSite=Lax${secure ? '; Secure' : ''}`;
}
