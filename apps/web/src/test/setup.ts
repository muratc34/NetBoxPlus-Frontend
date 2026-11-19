import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { navigation, server } from './render';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  navigation.replace.mockReset();
  navigation.push.mockReset();
  navigation.search = new URLSearchParams();
  navigation.pathname = '/tr';
  // Node-environment tests (the proxy, the server-side client) have no document.
  if (typeof document !== 'undefined') {
    document.cookie = 'nbp-profile=; Path=/; Max-Age=0';
  }
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
