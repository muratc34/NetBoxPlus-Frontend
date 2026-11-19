import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { navigation, server } from './render';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  navigation.replace.mockReset();
  navigation.push.mockReset();
  navigation.search = new URLSearchParams();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
