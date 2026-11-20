import { NULL, NUMBER, tsUnion, type SchemaObject } from 'openapi-typescript';

/**
 * ASP.NET Core documents every number as `integer | string` (with a digits pattern) because it also reads
 * one written as a string; it always writes a number, and this client always sends one. Typed as a number.
 */
export function numberOrDigits(schema: SchemaObject) {
  const type: unknown = (schema as { type?: unknown }).type;
  if (!Array.isArray(type) || !type.includes('string') || !('pattern' in schema)) {
    return undefined;
  }
  if (!type.includes('integer') && !type.includes('number')) {
    return undefined;
  }
  return type.includes('null') ? tsUnion([NUMBER, NULL]) : NUMBER;
}
