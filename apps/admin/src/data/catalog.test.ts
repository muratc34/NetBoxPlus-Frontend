import { describe, expect, it } from 'vitest';
import { filled } from './catalog';

describe('filled', () => {
  it('keeps only the languages with text, trimmed', () => {
    expect(filled({ tr: ' Dram ', en: '  ' })).toEqual({ tr: 'Dram' });
    expect(filled({ tr: 'Dram', en: 'Drama' })).toEqual({ tr: 'Dram', en: 'Drama' });
    expect(filled({})).toEqual({});
  });
});
