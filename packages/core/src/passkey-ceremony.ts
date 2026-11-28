/**
 * The browser's half of a passkey ceremony, with its own WebAuthn JSON methods (no package): the gateway hands the
 * options as JSON, the credential goes back as `toJSON()` gives it. React-free, for both applications.
 */

/** Whether this browser can create and use passkeys with the JSON methods (Chrome 129+, Safari 18+, Firefox 119+). */
export function passkeysSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function' &&
    typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function'
  );
}

/** The person closed the browser's window, or did not confirm in time: nothing to report. */
export class PasskeyCancelled extends Error {
  constructor() {
    super('The passkey ceremony was cancelled.');
    this.name = 'PasskeyCancelled';
  }
}

/** The authenticator already holds a passkey of this account (the options exclude the ones the account has). */
export class PasskeyAlreadyRegistered extends Error {
  constructor() {
    super('This authenticator already has a passkey of this account.');
    this.name = 'PasskeyAlreadyRegistered';
  }
}

function rethrow(error: unknown): never {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
      throw new PasskeyCancelled();
    }
    if (error.name === 'InvalidStateError') {
      throw new PasskeyAlreadyRegistered();
    }
  }
  throw error;
}

/** Makes a new passkey from the gateway's creation options; the answer to send back. */
export async function createPasskey(options: unknown): Promise<unknown> {
  const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(
    options as PublicKeyCredentialCreationOptionsJSON,
  );
  try {
    const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
    if (!credential) {
      throw new PasskeyCancelled();
    }
    return credential.toJSON();
  } catch (error) {
    return rethrow(error);
  }
}

/** Signs the gateway's sign-in options with a passkey the person chooses; the answer to send back. */
export async function signWithPasskey(options: unknown): Promise<unknown> {
  const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(
    options as PublicKeyCredentialRequestOptionsJSON,
  );
  try {
    const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
    if (!credential) {
      throw new PasskeyCancelled();
    }
    return credential.toJSON();
  } catch (error) {
    return rethrow(error);
  }
}
