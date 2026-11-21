import { fitWithin, RESIZED_LONG_SIDE } from "./photos";

/**
 * Browser-only helpers for photo uploads: shrinking a photo before it's sent,
 * and the upload itself with progress. They use canvas and XMLHttpRequest,
 * so they're not unit-tested; the arithmetic is in photos.ts.
 */

/** JPEG quality after resizing: no visible loss on a phone screen. */
const JPEG_QUALITY = 0.8;

/**
 * A phone photo of 3–6 MB becomes a JPEG of a few hundred KB, which matters
 * on a yard's mobile network. Returns the original file when the browser
 * can't decode it (e.g. HEIC outside Safari) or when resizing doesn't make it
 * smaller; the size and type rules still apply to it.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    // "from-image" applies the EXIF rotation, so portrait shots stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const { width, height } = fitWithin(
      bitmap.width,
      bitmap.height,
      RESIZED_LONG_SIDE,
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]*$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export interface UploadTarget {
  url: string;
  headers: { name: string; value: string }[];
}

/**
 * PUTs one file to its signed URL. XMLHttpRequest rather than fetch, because
 * fetch can't report upload progress. `onProgress` gets 0–1.
 */
export function uploadPhoto(
  target: UploadTarget,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", target.url);
    // Exactly the headers the URL was signed with, or the storage refuses it.
    for (const { name, value } of target.headers) {
      request.setRequestHeader(name, value);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${request.status}`));
      }
    };
    // A network error, or the storage refusing CORS.
    request.onerror = () => reject(new Error("Upload failed"));
    request.send(file);
  });
}
