import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { installMatchMedia, installObservers } from './observers';
import { navigation, server, signedOut } from './render';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  // Signed out unless a test says otherwise (its handlers come first).
  server.use(signedOut);
  navigation.replace.mockReset();
  navigation.push.mockReset();
  navigation.search = new URLSearchParams();
  navigation.pathname = '/tr';
  // Node-environment tests (the proxy, the server-side client) have no document.
  if (typeof document !== 'undefined') {
    document.cookie = 'nbp-profile=; Path=/; Max-Age=0';
    installObservers();
    installMatchMedia();
  }
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
