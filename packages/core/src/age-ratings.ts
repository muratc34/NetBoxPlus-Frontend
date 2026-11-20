import type { AuthSchemas } from '@netboxplus/api';

export type AgeRating = AuthSchemas['AgeRating'];

/** Youngest first: the order a profile's age limit is chosen from. */
export const ageRatings: readonly AgeRating[] = ['All', 'Age7', 'Age13', 'Age16', 'Age18'];

/** Whether a title rated `rating` is for a profile limited to `limit`: the same rating or a younger one. */
export function isWithinAgeLimit(rating: AgeRating, limit: AgeRating): boolean {
  return ageRatings.indexOf(rating) <= ageRatings.indexOf(limit);
}
