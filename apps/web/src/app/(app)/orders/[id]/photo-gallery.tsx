"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

/**
 * The photos of one history entry as thumbnails; a tap opens one full size.
 *
 * Plain <img> instead of next/image: the URLs are signed and expire after a
 * few minutes, so the image optimizer would cache (and keep serving) links
 * that no longer work, and fetch every photo through this server. The page
 * signs fresh URLs on every load, which is when they're shown.
 */
export function PhotoGallery({
  photos,
}: {
  photos: { id: string; url: string }[];
}) {
  const t = useTranslations("photoGallery");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<number | null>(null);

  const show = (index: number) => {
    setOpen(index);
    dialogRef.current?.showModal();
  };

  return (
    <>
      <ul className="flex w-full flex-wrap gap-2">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => show(index)}
              aria-label={t("open", { number: index + 1 })}
              className="block h-20 w-20 overflow-hidden rounded-md bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-600 dark:bg-zinc-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- see the comment above */}
              <img
                src={photo.url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      {/*
        A native modal dialog: it traps focus, closes on Escape and sits
        above everything without a library. A tap on the backdrop closes it
        too (the click lands on the dialog itself, not on its content).
      */}
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/85"
      >
        {open !== null && (
          <div className="flex flex-col items-end gap-2 p-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="min-h-11 rounded-md bg-white/90 px-4 font-medium text-zinc-900"
            >
              {t("close")}
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- see the comment above */}
            <img
              src={photos[open].url}
              alt={t("photo", { number: open + 1, total: photos.length })}
              className="max-h-[85dvh] max-w-[95vw] rounded-md object-contain"
            />
          </div>
        )}
      </dialog>
    </>
  );
}
