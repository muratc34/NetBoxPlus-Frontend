import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { server, signedOut } from './render';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  // Signed out unless a test says otherwise (its handlers come first).
  server.use(signedOut);
  window.localStorage.clear();
  document.documentElement.lang = '';
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
