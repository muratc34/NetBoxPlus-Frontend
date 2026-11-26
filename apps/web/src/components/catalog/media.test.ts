import { describe, expect, it } from 'vitest';
import { mediaSource } from './media';

const name = '01a1d602b78a700baf02a83be30c9a09.jpg';

describe('mediaSource', () => {
  it('serves a Catalog image from the web app, whatever storage address it came with', () => {
    expect(mediaSource(`http://127.0.0.1:10000/devstoreaccount1/images/${name}`)).toBe(`/media/${name}`);
    expect(mediaSource(`https://media.netboxplus.test/images/${name}`)).toBe(`/media/${name}`);
  });

  it.each([
    'http://storage.test/poster.png',
    'http://storage.test/01A1D602B78A700BAF02A83BE30C9A09.jpg',
    `http://storage.test/${name}.svg`,
    'http://storage.test/01a1d602b78a700baf02a83be30c9a0.jpg',
    'not a url',
  ])('leaves %s as it is', (url) => {
    expect(mediaSource(url)).toBeUndefined();
  });
});
