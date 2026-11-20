import openapiTS, { astToString } from 'openapi-typescript';
import { describe, expect, it } from 'vitest';
import { numberOrDigits } from './numbers.ts';

// The pattern ASP.NET Core writes next to such a number.
const digits = String.raw`^-?(?:0|[1-9]\d*)$`;

/** The type a property gets, generated through the same transform as the real documents. */
async function typeOf(schema: object): Promise<string> {
  const ast = await openapiTS(
    {
      openapi: '3.1.1',
      info: { title: 'test', version: '1' },
      paths: {},
      components: {
        schemas: { Probe: { type: 'object', required: ['value'], properties: { value: schema } } },
      },
    } as Parameters<typeof openapiTS>[0],
    { transform: numberOrDigits },
  );
  return /value: ([^;]+);/.exec(astToString(ast))?.[1] ?? '';
}

describe('numberOrDigits', () => {
  it("types ASP.NET Core's whole and decimal numbers as numbers", async () => {
    expect(await typeOf({ type: ['integer', 'string'], pattern: digits, format: 'int32' })).toBe('number');
    expect(await typeOf({ type: ['number', 'string'], pattern: digits, format: 'double' })).toBe('number');
  });

  it('keeps null where the number may be missing', async () => {
    expect(await typeOf({ type: ['null', 'integer', 'string'], pattern: digits })).toBe('number | null');
  });

  it('leaves everything else to the generator', async () => {
    expect(await typeOf({ type: ['null', 'string'] })).toBe('null | string');
    expect(await typeOf({ type: ['integer', 'string'] })).toBe('number | string');
    expect(await typeOf({ type: 'integer' })).toBe('number');
  });
});
