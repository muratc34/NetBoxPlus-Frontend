import { afterEach, describe, expect, it, vi } from 'vitest';
import { blockAttempts, blockBytes, blockId, putInBlocks, sendRequest, type BlockRequest } from './blocks';

interface Sent {
  readonly address: string;
  readonly body: Blob | string;
  readonly headers: Readonly<Record<string, string>>;
}

/** Records each request; `fail` says which attempts fail (by their place among all requests). */
function recorder(fail: (index: number) => boolean = () => false) {
  const sent: Sent[] = [];
  const send: BlockRequest = (_method, address, body, headers, onProgress) => {
    const index = sent.length;
    sent.push({ address, body, headers });
    if (fail(index)) {
      return Promise.reject(new Error(`failed ${String(index)}`));
    }
    onProgress(typeof body === 'string' ? body.length : body.size / 2);
    return Promise.resolve();
  };
  return { sent, send };
}

describe('blockId', () => {
  it('gives every block an id of the same length', () => {
    expect(atob(blockId(0))).toBe('block-000000');
    expect(atob(blockId(12))).toBe('block-000012');
    expect(blockId(0)).toHaveLength(blockId(999999).length);
  });
});

describe('putInBlocks', () => {
  const address = 'https://storage.test/uploads/v1?sv=1&sig=x';

  it('sends the file in blocks, then the list of them, saying how far it got', async () => {
    const file = new Blob([new Uint8Array(blockBytes * 2 + 10)]);
    const { sent, send } = recorder();
    const progress: number[] = [];

    await putInBlocks(address, file, (fraction) => progress.push(fraction), send);

    expect(sent.map((request) => request.address)).toEqual([
      `${address}&comp=block&blockid=${encodeURIComponent(blockId(0))}`,
      `${address}&comp=block&blockid=${encodeURIComponent(blockId(1))}`,
      `${address}&comp=block&blockid=${encodeURIComponent(blockId(2))}`,
      `${address}&comp=blocklist`,
    ]);
    expect(sent.slice(0, 3).map((request) => (request.body as Blob).size)).toEqual([
      blockBytes,
      blockBytes,
      10,
    ]);
    expect(sent.slice(0, 3).every((request) => Object.keys(request.headers).length === 0)).toBe(true);
    expect(sent[3]?.headers).toEqual({ 'Content-Type': 'application/xml' });
    expect(sent[3]?.body).toBe(
      `<?xml version="1.0" encoding="utf-8"?><BlockList><Latest>${blockId(0)}</Latest><Latest>${blockId(1)}</Latest><Latest>${blockId(2)}</Latest></BlockList>`,
    );
    const total = file.size;
    expect(progress).toEqual([
      blockBytes / 2 / total,
      blockBytes / total,
      (blockBytes * 1.5) / total,
      (blockBytes * 2) / total,
      (blockBytes * 2 + 5) / total,
      1,
      1,
    ]);
  });

  it('sends no empty block when the file fills its last one', async () => {
    const { sent, send } = recorder();

    await putInBlocks(address, new Blob([new Uint8Array(blockBytes)]), () => undefined, send);

    expect(sent).toHaveLength(2);
    expect((sent[0]?.body as Blob).size).toBe(blockBytes);
  });

  it('adds its query to an address without one', async () => {
    const { sent, send } = recorder();

    await putInBlocks('https://storage.test/uploads/v1', new Blob(['abc']), () => undefined, send);

    expect(sent.map((request) => request.address)).toEqual([
      `https://storage.test/uploads/v1?comp=block&blockid=${encodeURIComponent(blockId(0))}`,
      'https://storage.test/uploads/v1?comp=blocklist',
    ]);
  });

  it('tries a block again and gives up after the last attempt', async () => {
    const retried = recorder((index) => index < blockAttempts - 1);
    await putInBlocks(address, new Blob(['abc']), () => undefined, retried.send);
    expect(retried.sent).toHaveLength(blockAttempts + 1);

    const lost = recorder((index) => index < blockAttempts);
    await expect(putInBlocks(address, new Blob(['abc']), () => undefined, lost.send)).rejects.toThrow(
      `failed ${String(blockAttempts - 1)}`,
    );
    expect(lost.sent).toHaveLength(blockAttempts);
  });

  it('keeps the progress within the file while a block is on its way', async () => {
    const progress: number[] = [];
    const send: BlockRequest = (_method, _address, body, _headers, onProgress) => {
      onProgress(typeof body === 'string' ? 0 : body.size * 2);
      return Promise.resolve();
    };

    await putInBlocks(address, new Blob(['abcd']), (fraction) => progress.push(fraction), send);

    expect(progress.every((fraction) => fraction <= 1)).toBe(true);
  });
});

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
}

function last(): FakeRequest {
  if (!FakeRequest.last) {
    throw new Error('Nothing was sent.');
  }
  return FakeRequest.last;
}

describe('sendRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeRequest.last = undefined;
  });

  it('sends with the headers, says how much went and takes any success status', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeRequest);
    const loaded: number[] = [];

    const done = sendRequest(
      'PUT',
      'https://storage.test/a',
      'body',
      { 'Content-Type': 'application/xml' },
      (value) => loaded.push(value),
    );
    const request = last();
    request.upload.onprogress?.({ lengthComputable: true, loaded: 3 });
    request.upload.onprogress?.({ lengthComputable: false, loaded: 4 });
    request.status = 201;
    request.onload?.();
    await done;

    expect(request.method).toBe('PUT');
    expect(request.address).toBe('https://storage.test/a');
    expect(request.headers).toEqual({ 'Content-Type': 'application/xml' });
    expect(request.body).toBe('body');
    expect(loaded).toEqual([3]);

    const edge = sendRequest('PUT', 'https://storage.test/a', 'x', {}, () => undefined);
    last().status = 299;
    last().onload?.();
    await expect(edge).resolves.toBeUndefined();
  });

  it('fails on another status and when the storage cannot be reached', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeRequest);

    const refused = sendRequest('PUT', 'https://storage.test/a', 'x', {}, () => undefined);
    last().status = 403;
    last().onload?.();
    await expect(refused).rejects.toThrow('The storage answered 403.');

    const below = sendRequest('PUT', 'https://storage.test/a', 'x', {}, () => undefined);
    last().status = 199;
    last().onload?.();
    await expect(below).rejects.toThrow('The storage answered 199.');

    const lost = sendRequest('PUT', 'https://storage.test/a', 'x', {}, () => undefined);
    last().onerror?.();
    await expect(lost).rejects.toThrow('The upload could not reach the storage.');
  });
});
