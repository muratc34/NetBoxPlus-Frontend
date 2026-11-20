import { unwrap, type AdminClients } from '@netboxplus/api';

/** The image types Catalog takes. */
export const imageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

export class ImageRejected extends Error {
  constructor(readonly reason: 'type' | 'size') {
    super(`The image was refused before uploading: ${reason}.`);
  }
}

/** Sends `body` with `PUT` to a storage address, saying how far it got. A failed upload rejects. */
export type BlobUpload = (
  address: string,
  file: Blob,
  onProgress: (fraction: number) => void,
) => Promise<void>;

/** The browser's upload: XMLHttpRequest, because fetch cannot tell how much has been sent. */
export const putBlob: BlobUpload = (address, file, onProgress) =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', address);
    request.setRequestHeader('x-ms-blob-type', 'BlockBlob');
    request.setRequestHeader('Content-Type', file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new Error(`The upload failed with ${String(request.status)}.`));
      }
    };
    request.onerror = () => {
      reject(new Error('The upload could not reach the storage.'));
    };
    request.send(file);
  });

/**
 * Puts an image where Catalog can take it: asks for an upload (a signed storage address that takes one
 * PUT), sends the file there and resolves to the upload's id, which attaching the image names. The type
 * and size are checked first; Catalog checks the rest (pixels, shape) when the image is attached.
 */
export async function uploadImage(
  catalog: AdminClients['catalog'],
  file: File,
  onProgress: (fraction: number) => void = () => undefined,
  upload: BlobUpload = putBlob,
): Promise<string> {
  if (!(imageTypes as readonly string[]).includes(file.type)) {
    throw new ImageRejected('type');
  }
  const ticket = await unwrap(catalog.POST('/images/uploads'));
  if (file.size > ticket.maxBytes) {
    throw new ImageRejected('size');
  }
  await upload(ticket.uploadAddress, file, onProgress);
  return ticket.uploadId;
}
