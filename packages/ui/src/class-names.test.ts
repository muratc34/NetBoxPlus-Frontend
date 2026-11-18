import { describe, expect, it } from 'vitest';
import { classNames } from './class-names';

describe('classNames', () => {
  it('skips empty and false values', () => {
    expect(classNames('a', false, null, undefined, '', 'b')).toBe('a b');
  });
});
