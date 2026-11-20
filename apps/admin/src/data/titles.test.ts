import { describe, expect, it } from 'vitest';
import { movieKeys } from './movies';
import { seriesKeys } from './series';
import { titleKeys } from './titles';

describe('titleKeys', () => {
  it('keeps the movie and series lists apart, also for the same filters', () => {
    const filters = { search: '', status: undefined, genreId: undefined, page: 1 };

    expect(titleKeys.lists('movie')).not.toEqual(titleKeys.lists('series'));
    expect(movieKeys.list(filters)).not.toEqual(seriesKeys.list(filters));
    expect(titleKeys.title('movie', 'a')).not.toEqual(titleKeys.title('series', 'a'));
  });
});
