import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPasskey,
  PasskeyAlreadyRegistered,
  PasskeyCancelled,
  passkeysSupported,
  signWithPasskey,
} from './passkey-ceremony';

function browser(answer: () => Promise<unknown>) {
  vi.stubGlobal('PublicKeyCredential', {
    parseCreationOptionsFromJSON: (json: unknown) => ({ creation: json }),
    parseRequestOptionsFromJSON: (json: unknown) => ({ request: json }),
  });
  const calls: unknown[] = [];
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: {
      create: (options: unknown) => {
        calls.push(options);
        return answer();
      },
      get: (options: unknown) => {
        calls.push(options);
        return answer();
      },
    },
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('passkey ceremony', () => {
  it('is not supported without the JSON methods', () => {
    expect(passkeysSupported()).toBe(false);
    browser(() => Promise.resolve(null));
    expect(passkeysSupported()).toBe(true);
  });

  it('passes the parsed options to the browser and answers with the credential as JSON', async () => {
    const calls = browser(() => Promise.resolve({ toJSON: () => ({ id: 'cred' }) }));

    expect(await createPasskey({ challenge: 'a' })).toEqual({ id: 'cred' });
    expect(await signWithPasskey({ challenge: 'b' })).toEqual({ id: 'cred' });
    expect(calls).toEqual([
      { publicKey: { creation: { challenge: 'a' } } },
      { publicKey: { request: { challenge: 'b' } } },
    ]);
  });

  it('tells a closed window and an authenticator that already has the account apart from other failures', async () => {
    browser(() => Promise.reject(new DOMException('closed', 'NotAllowedError')));
    await expect(signWithPasskey({})).rejects.toBeInstanceOf(PasskeyCancelled);

    browser(() => Promise.reject(new DOMException('known', 'InvalidStateError')));
    await expect(createPasskey({})).rejects.toBeInstanceOf(PasskeyAlreadyRegistered);

    browser(() => Promise.resolve(null));
    await expect(createPasskey({})).rejects.toBeInstanceOf(PasskeyCancelled);

    const broken = new TypeError('bad options');
    browser(() => Promise.reject(broken));
    await expect(createPasskey({})).rejects.toBe(broken);
  });
});
