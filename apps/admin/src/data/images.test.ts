import { afterEach, describe, expect, it, vi } from 'vitest';
import { putBlob } from './images';

/** A stand-in XMLHttpRequest that records what it was asked and lets the test answer. */
class FakeRequest {
  static last: FakeRequest | undefined;
  method = '';
  address = '';
  headers: Record<string, string> = {};
  body: unknown;
  status = 0;
  upload: { onprogress: ((event: Partial<ProgressEvent>) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    FakeRequest.last = this;
  }

  open(method: string, address: string) {
    this.method = method;
    this.address = address;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: unknown) {
    this.body = body;
  }

  answer(status: number) {
    this.status = status;
    this.onload?.();
  }
}

function sent(): FakeRequest {
  const request = FakeRequest.last;
  if (!request) {
    throw new Error('Nothing was sent.');
  }
  return request;
}

describe('putBlob', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeRequest.last = undefined;
  });

  it('puts the file as a block blob of its type and says how far it got', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeRequest);
    const file = new Blob(['abc'], { type: 'image/png' });
    const progress: number[] = [];

    const done = putBlob('https://storage.test/a?sig=x', file, (fraction) => progress.push(fraction));
    const request = sent();
    request.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 });
    request.upload.onprogress?.({ lengthComputable: false, loaded: 2, total: 4 });
    request.upload.onprogress?.({ lengthComputable: true, loaded: 0, total: 0 });
    request.answer(201);
    await done;

    expect(request.method).toBe('PUT');
    expect(request.address).toBe('https://storage.test/a?sig=x');
    expect(request.headers).toEqual({ 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'image/png' });
    expect(request.body).toBe(file);
    expect(progress).toEqual([0.25, 1]);
  });

  it('takes any success status and fails on the others', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeRequest);
    const file = new Blob(['abc'], { type: 'image/png' });

    const ok = putBlob('https://storage.test/a', file, () => undefined);
    sent().answer(299);
    await expect(ok).resolves.toBeUndefined();

    const forbidden = putBlob('https://storage.test/a', file, () => undefined);
    sent().answer(403);
    await expect(forbidden).rejects.toThrow('The upload failed with 403.');

    const below = putBlob('https://storage.test/a', file, () => undefined);
    sent().answer(199);
    await expect(below).rejects.toThrow('The upload failed with 199.');

    const lost = putBlob('https://storage.test/a', file, () => undefined);
    sent().onerror?.();
    await expect(lost).rejects.toThrow('The upload could not reach the storage.');
  });
});
