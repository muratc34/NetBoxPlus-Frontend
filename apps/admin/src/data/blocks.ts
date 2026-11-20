/** How much of a file one block carries. */
export const blockBytes = 8 * 1024 * 1024;

/** How many times a block is sent before the upload gives up. */
export const blockAttempts = 3;

/** Sends one request with XMLHttpRequest, saying how much of its body has gone. */
export type BlockRequest = (
  method: 'PUT',
  address: string,
  body: Blob | string,
  headers: Readonly<Record<string, string>>,
  onProgress: (loaded: number) => void,
) => Promise<void>;

export const sendRequest: BlockRequest = (method, address, body, headers, onProgress) =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, address);
    for (const [name, value] of Object.entries(headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded);
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(new Error(`The storage answered ${String(request.status)}.`));
      }
    };
    request.onerror = () => {
      reject(new Error('The upload could not reach the storage.'));
    };
    request.send(body);
  });

/** The id of the block at `index`: the same length for every block, as the storage asks. */
export function blockId(index: number): string {
  return btoa(`block-${String(index).padStart(6, '0')}`);
}

/** The address with one more query parameter, keeping the signature's. */
function withQuery(address: string, query: string): string {
  return `${address}${address.includes('?') ? '&' : '?'}${query}`;
}

/**
 * Puts a large file at a signed storage address in blocks (Put Block, then Put Block List), as one request
 * cannot carry more than the storage takes at once. The file is not empty (the caller checks). Each block is tried up to `blockAttempts` times;
 * `onProgress` hears the share of the file sent.
 */
export async function putInBlocks(
  address: string,
  file: Blob,
  onProgress: (fraction: number) => void,
  send: BlockRequest = sendRequest,
): Promise<void> {
  const ids: string[] = [];
  let sent = 0;
  for (let start = 0, index = 0; start < file.size; start += blockBytes, index += 1) {
    const block = file.slice(start, Math.min(start + blockBytes, file.size));
    const id = blockId(index);
    for (let attempt = 1; ; attempt += 1) {
      try {
        await send(
          'PUT',
          withQuery(address, `comp=block&blockid=${encodeURIComponent(id)}`),
          block,
          {},
          (loaded) => {
            onProgress(Math.min(sent + loaded, file.size) / file.size);
          },
        );
        break;
      } catch (error) {
        if (attempt >= blockAttempts) {
          throw error;
        }
      }
    }
    sent += block.size;
    ids.push(id);
    onProgress(sent / file.size);
  }
  const list = `<?xml version="1.0" encoding="utf-8"?><BlockList>${ids.map((id) => `<Latest>${id}</Latest>`).join('')}</BlockList>`;
  await send(
    'PUT',
    withQuery(address, 'comp=blocklist'),
    list,
    { 'Content-Type': 'application/xml' },
    () => undefined,
  );
  onProgress(1);
}
