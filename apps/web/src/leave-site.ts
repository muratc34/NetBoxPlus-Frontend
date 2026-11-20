/**
 * Sends the browser to another site (the payment provider's checkout or portal). In its own module so
 * tests can stand in for it: jsdom cannot navigate.
 */
export function leaveSiteFor(url: string): void {
  window.location.assign(url);
}
