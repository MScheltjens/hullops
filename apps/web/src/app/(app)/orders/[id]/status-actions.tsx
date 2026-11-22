"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ForwardStatus, Status } from "@/lib/order-status";
import { shrinkPhoto, uploadPhoto } from "@/lib/photo-upload";
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  photoProblem,
  type PhotoProblem,
} from "@/lib/photos";
import {
  requestPhotoUploads,
  updateStatus,
  type UpdateStatusState,
} from "./actions";

const inputClass =
  "min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const secondaryButtonClass =
  "min-h-12 rounded-md border border-zinc-300 px-5 font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900";

/** A photo picked for the coming update, already shrunk. */
interface PickedPhoto {
  id: string;
  file: File;
  /** An object URL for the preview; revoked when the photo is dropped. */
  previewUrl: string;
  /** 0–1 while uploading, undefined before. */
  progress?: number;
}

/** Errors that happen in the browser, before the server is asked. */
type FormState = Omit<UpdateStatusState, "error"> & {
  error?: UpdateStatusState["error"] | "uploadFailed" | "photosForbidden";
};

/** A picked file that can't be added, shown until the next pick. */
type PickProblem =
  | { kind: PhotoProblem; name: string }
  | { kind: "tooMany" };

/**
 * The buttons a team member uses on site: move the order one step forward,
 * or leave a note, with up to five photos either way. `next` is undefined
 * once the order is done.
 */
export function StatusActions({
  orderId,
  status,
  next,
}: {
  orderId: string;
  status: Status;
  next: ForwardStatus | undefined;
}) {
  const t = useTranslations("statusActions");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [pickProblem, setPickProblem] = useState<PickProblem | null>(null);
  const [preparing, setPreparing] = useState(false);

  const dropPreviews = (dropped: PickedPhoto[]) => {
    for (const photo of dropped) URL.revokeObjectURL(photo.previewUrl);
  };

  // Release the previews' memory when the page is left.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => dropPreviews(photosRef.current), []);

  const setProgress = (id: string, progress: number) =>
    setPhotos((current) =>
      current.map((photo) => (photo.id === id ? { ...photo, progress } : photo)),
    );

  /**
   * Runs in the browser: uploads the photos first, then hands the form,
   * now with their storage keys, to the Server Action. useActionState runs
   * this as a transition, so `pending` covers the whole thing.
   *
   * State set here only shows before the action ends if it's set after an
   * `await` (React batches the rest of a transition until it's done). The
   * progress updates are, which is why "uploading" is derived from them
   * instead of being a state of its own.
   */
  async function submit(
    _previous: FormState,
    formData: FormData,
  ): Promise<FormState> {
    const note = String(formData.get("note") ?? "");
    if (photos.length > 0) {
      try {
        const result = await requestPhotoUploads(
          orderId,
          photos.map((photo) => ({
            mimeType: photo.file.type,
            sizeBytes: photo.file.size,
          })),
        );
        if ("error" in result) {
          return {
            error:
              result.error === "forbidden"
                ? "photosForbidden"
                : result.error === "invalid"
                  ? "photosRejected"
                  : "unavailable",
            note,
          };
        }
        // The API answers in the order the files were sent.
        await Promise.all(
          result.targets.map((target, index) =>
            uploadPhoto(target, photos[index].file, (fraction) =>
              setProgress(photos[index].id, fraction),
            ),
          ),
        );
        for (const target of result.targets) {
          formData.append("photoKey", target.storageKey);
        }
      } catch {
        // A network error or a refused PUT. Nothing is attached yet, so
        // trying again later starts over cleanly.
        setPhotos((current) =>
          current.map((photo) => ({ ...photo, progress: undefined })),
        );
        return { error: "uploadFailed", note };
      }
    }

    // updateStatus doesn't read the previous state; it starts from the form.
    const result = await updateStatus(orderId, status, {}, formData);
    if (!result.error) {
      dropPreviews(photos);
      setPhotos([]);
      setPickProblem(null);
    }
    return result;
  }

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    submit,
    {},
  );

  async function addPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const picked = [...(input.files ?? [])];
    // Picking the same photo again must fire `change` again.
    input.value = "";
    if (picked.length === 0) return;

    setPickProblem(null);
    const room = MAX_PHOTOS - photos.length;
    if (picked.length > room) setPickProblem({ kind: "tooMany" });

    setPreparing(true);
    try {
      const added: PickedPhoto[] = [];
      for (const original of picked.slice(0, Math.max(room, 0))) {
        const file = await shrinkPhoto(original);
        const problem = photoProblem(file);
        if (problem) {
          setPickProblem({ kind: problem, name: original.name });
          continue;
        }
        added.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
      setPhotos((current) => [...current, ...added]);
    } finally {
      setPreparing(false);
    }
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      dropPreviews(current.filter((photo) => photo.id === id));
      return current.filter((photo) => photo.id !== id);
    });
  }

  const busy = pending || preparing;
  // Once every photo is up, the button goes back to "Saving…".
  const uploading = photos.some(
    (photo) => photo.progress !== undefined && photo.progress < 1,
  );
  const canAddMore = photos.length < MAX_PHOTOS && !busy;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("note")}
        <textarea
          name="note"
          rows={3}
          maxLength={2000}
          defaultValue={state.note}
          className={inputClass}
        />
        {next && (
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
            {t("noteHint")}
          </span>
        )}
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">
          {t("photos.title", { count: photos.length, max: MAX_PHOTOS })}
        </legend>

        {photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((photo, index) => (
              <li
                key={photo.id}
                className="relative aspect-square overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800"
              >
                {/* A local blob URL: next/image has nothing to optimize here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt={t("photos.preview", { number: index + 1 })}
                  className="h-full w-full object-cover"
                />
                {photo.progress !== undefined && (
                  <div
                    role="progressbar"
                    aria-label={t("photos.uploading", { number: index + 1 })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(photo.progress * 100)}
                    className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30"
                  >
                    <div
                      className="h-full bg-sky-500 transition-[width]"
                      style={{ width: `${photo.progress * 100}%` }}
                    />
                  </div>
                )}
                {!pending && (
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    aria-label={t("photos.remove", { number: index + 1 })}
                    className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-lg text-white hover:bg-black/80"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/*
          Two buttons instead of one input: with `capture`, Android opens the
          camera straight away but offers no gallery; without it, taking a
          photo is one more tap in a menu. Workers mostly take a photo now.
        */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <PhotoInput
            label={t("photos.take")}
            capture
            disabled={!canAddMore}
            onChange={addPhotos}
          />
          <PhotoInput
            label={t("photos.choose")}
            multiple
            disabled={!canAddMore}
            onChange={addPhotos}
          />
        </div>

        {preparing && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("photos.preparing")}
          </p>
        )}
        {pickProblem && (
          <p
            role="alert"
            className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            {pickProblem.kind === "tooMany"
              ? t("photos.problems.tooMany", { max: MAX_PHOTOS })
              : t(`photos.problems.${pickProblem.kind}`, {
                  name: pickProblem.name,
                  max: MAX_PHOTO_BYTES / (1024 * 1024),
                })}
          </p>
        )}
      </fieldset>

      {state.error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {t(`errors.${state.error}`)}
        </p>
      )}

      {/* Big, full-width buttons on a phone; side by side from sm up. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {next && (
          <button
            type="submit"
            name="intent"
            value="advance"
            disabled={busy}
            onClick={(event) => {
              // Done can't be undone, and a thumb slips: ask first.
              if (next === "DONE" && !confirm(t("confirmDone"))) {
                event.preventDefault();
              }
            }}
            className="min-h-12 rounded-md bg-sky-700 px-5 font-medium text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {pending
              ? t(uploading ? "uploadingPhotos" : "saving")
              : t(`advance.${next}`)}
          </button>
        )}
        <button
          type="submit"
          name="intent"
          value="note"
          disabled={busy}
          className={secondaryButtonClass}
        >
          {photos.length > 0 ? t("addNoteOrPhotos") : t("addNote")}
        </button>
      </div>
    </form>
  );
}

/**
 * A file input dressed as a button. The input itself stays in the label
 * (visually hidden), so it's keyboard- and screen-reader-accessible and a tap
 * on the label opens the picker. It has no `name`: the photos are sent as
 * uploaded storage keys, not as files in the form.
 */
function PhotoInput({
  label,
  capture = false,
  multiple = false,
  disabled,
  onChange,
}: {
  label: string;
  capture?: boolean;
  multiple?: boolean;
  disabled: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      className={`${secondaryButtonClass} flex flex-1 cursor-pointer items-center justify-center has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-600`}
    >
      <input
        type="file"
        accept="image/*"
        // The rear camera: workers photograph the work, not themselves.
        capture={capture ? "environment" : undefined}
        multiple={multiple}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      {label}
    </label>
  );
}
