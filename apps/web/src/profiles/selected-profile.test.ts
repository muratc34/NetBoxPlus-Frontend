import { describe, expect, it } from 'vitest';
import {
  formatSelectedProfile,
  isStillValid,
  parseSelectedProfile,
  readSelectedProfileCookie,
  selectedProfileCookie,
} from './selected-profile';

const id = '0195f0e0-0000-7000-8000-0000000000a1';

describe('the selected profile cookie', () => {
  it('reads back what it wrote', () => {
    const profile = { id, maxAgeRating: 'Age7' as const };

    expect(parseSelectedProfile(formatSelectedProfile(profile))).toEqual(profile);
    expect(readSelectedProfileCookie(`nbp-lang=en; nbp-profile=${id}.Age7; other=1`)).toEqual(profile);
  });

  it.each([[undefined], [''], ['not-an-id.Age7'], [`${id}.Age21`], [id], [`${id}.Age7.extra`]])(
    'ignores %j',
    (value) => {
      expect(parseSelectedProfile(value)).toBeUndefined();
    },
  );

  it('lasts a year on every path, and is Secure over HTTPS; clearing expires it', () => {
    expect(selectedProfileCookie({ id, maxAgeRating: 'All' }, true)).toBe(
      `nbp-profile=${id}.All; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
    );
    expect(selectedProfileCookie(undefined, false)).toBe('nbp-profile=; Path=/; Max-Age=0; SameSite=Lax');
  });
});

describe('isStillValid', () => {
  const profiles = [{ id, name: 'Deniz', maxAgeRating: 'Age7' as const, locked: false }];

  it('holds while the profile exists with the same age limit', () => {
    expect(isStillValid({ id, maxAgeRating: 'Age7' }, profiles)).toBe(true);
  });

  it('fails for a removed profile or a changed age limit', () => {
    expect(isStillValid({ id: '0195f0e0-0000-7000-8000-0000000000ff', maxAgeRating: 'Age7' }, profiles)).toBe(
      false,
    );
    expect(isStillValid({ id, maxAgeRating: 'Age18' }, profiles)).toBe(false);
  });
});
