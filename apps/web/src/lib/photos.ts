/**
 * Rules for photos on a status update, checked in the browser before
 * anything is uploaded, so a worker on a slow yard network doesn't wait for
 * an upload the API would refuse anyway. The API checks the same rules
 * (validatePhotoUploads in apps/api/src/orders/order-rules.ts); keep the two
 * in step.
 */

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_PHOTO_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

/** Long side of a photo after resizing: sharp on a phone, a fraction of the bytes. */
export const RESIZED_LONG_SIDE = 2000;

export type PhotoProblem = "wrongType" | "tooLarge" | "empty";

/** What's wrong with one file, or null when it may be uploaded. */
export function photoProblem(file: {
  type: string;
  size: number;
}): PhotoProblem | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) return "wrongType";
  if (file.size <= 0) return "empty";
  if (file.size > MAX_PHOTO_BYTES) return "tooLarge";
  return null;
}

/**
 * The size to scale a photo down to, keeping its proportions, so that its
 * long side is at most `maxLongSide`. Smaller photos keep their size: making
 * them bigger adds bytes, not detail.
 */
export function fitWithin(
  width: number,
  height: number,
  maxLongSide: number,
): { width: number; height: number } {
  const longSide = Math.max(width, height);
  if (longSide <= maxLongSide) return { width, height };
  const scale = maxLongSide / longSide;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
