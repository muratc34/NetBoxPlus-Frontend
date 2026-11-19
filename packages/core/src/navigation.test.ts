import { describe, expect, it } from 'vitest';
import { safeNextPath } from './navigation';

describe('safeNextPath', () => {
  it('keeps a path on this site with its query and fragment', () => {
    expect(safeNextPath('/tr/profiles')).toBe('/tr/profiles');
    expect(safeNextPath('/en/search?q=night#top')).toBe('/en/search?q=night#top');
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['profiles'],
    ['https://evil.example/'],
    ['//evil.example/'],
    ['/\\evil.example/'],
    ['/\t/evil.example/'],
    ['/\n/evil.example/'],
    ['javascript:alert(1)'],
  ])('drops %j', (value) => {
    expect(safeNextPath(value)).toBeUndefined();
  });
});
