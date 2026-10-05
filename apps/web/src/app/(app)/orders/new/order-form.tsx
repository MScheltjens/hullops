"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  PROTECTION_KINDS,
  PROTECTION_MATERIALS,
  SERVICE_TYPES,
} from "@/lib/order-input";
import { createOrder, type CreateOrderState } from "./actions";

export interface VesselOption {
  id: string;
  name: string;
  imoNumber: string | null;
}

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function OrderForm({ vessels }: { vessels: VesselOption[] }) {
  const t = useTranslations("orderForm");
  const [state, formAction, pending] = useActionState<
    CreateOrderState,
    FormData
  >(createOrder, {});

  // After an error React empties the form, so every field refills itself from
  // the values the action sent back.
  const value = (name: string) => {
    const v = state.values?.[name];
    return typeof v === "string" ? v : undefined;
  };
  const chosenMaterials = new Set(state.values?.materials ?? []);

  // These two choices decide which fields are shown below.
  const [serviceType, setServiceType] = useState(
    value("serviceType") ?? "CLEANING",
  );
  const [kind, setKind] = useState(value("kind") ?? "ENCLOSURE");

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <Field label={t("title")}>
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={value("title")}
          className={inputClass}
        />
      </Field>

      <Field label={t("description")}>
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={value("description")}
          className={inputClass}
        />
      </Field>

      <Field label={t("vessel")}>
        <select
          name="vesselId"
          required
          defaultValue={value("vesselId") ?? ""}
          className={inputClass}
        >
          <option value="" disabled>
            {t("chooseVessel")}
          </option>
          {vessels.map((vessel) => (
            <option key={vessel.id} value={vessel.id}>
              {vessel.name}
              {vessel.imoNumber ? ` (IMO ${vessel.imoNumber})` : ""}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("shipyard")}>
          <input
            name="shipyard"
            required
            maxLength={100}
            defaultValue={value("shipyard")}
            className={inputClass}
          />
        </Field>
        <Field label={t("berth")}>
          <input
            name="berth"
            maxLength={100}
            defaultValue={value("berth")}
            className={inputClass}
          />
        </Field>
        <Field label={t("startDate")}>
          <input
            name="startDate"
            type="date"
            required
            defaultValue={value("startDate")}
            className={inputClass}
          />
        </Field>
        <Field label={t("dueDate")}>
          <input
            name="dueDate"
            type="date"
            required
            defaultValue={value("dueDate")}
            className={inputClass}
          />
        </Field>
        <Field label={t("areaSqm")}>
          <input
            name="areaSqm"
            type="number"
            min={0}
            step="any"
            defaultValue={value("areaSqm")}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label={t("serviceType")}>
        <select
          name="serviceType"
          value={serviceType}
          onChange={(event) => setServiceType(event.target.value)}
          className={inputClass}
        >
          {SERVICE_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`serviceTypes.${type}`)}
            </option>
          ))}
        </select>
      </Field>

      {/*
        Only the fields of the chosen service type are rendered, so only
        those are submitted (see buildCreateOrderInput).
      */}
      {serviceType === "CLEANING" ? (
        <Section title={t("cleaningDetails")}>
          <Field label={t("method")} hint={t("methodHint")}>
            <input
              name="method"
              required
              maxLength={100}
              defaultValue={value("method")}
              className={inputClass}
            />
          </Field>
          <Field label={t("surface")} hint={t("surfaceHint")}>
            <input
              name="surface"
              required
              maxLength={100}
              defaultValue={value("surface")}
              className={inputClass}
            />
          </Field>
        </Section>
      ) : (
        <Section title={t("protectionDetails")}>
          <Field label={t("kind")}>
            <select
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className={inputClass}
            >
              {PROTECTION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`kinds.${k}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("protectedItem")} hint={t("protectedItemHint")}>
            <input
              name="protectedItem"
              maxLength={200}
              defaultValue={value("protectedItem")}
              className={inputClass}
            />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              {t("materials")}
            </legend>
            {PROTECTION_MATERIALS.map((material) => (
              <label key={material} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="materials"
                  value={material}
                  defaultChecked={chosenMaterials.has(material)}
                />
                {t(`materialNames.${material}`)}
              </label>
            ))}
          </fieldset>

          {kind === "COATING" && (
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label={t("coatingProduct")}>
                <input
                  name="coatingProduct"
                  maxLength={100}
                  defaultValue={value("coatingProduct")}
                  className={inputClass}
                />
              </Field>
              <Field label={t("layers")}>
                <input
                  name="layers"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={value("layers")}
                  className={inputClass}
                />
              </Field>
              <Field label={t("targetThicknessUm")}>
                <input
                  name="targetThicknessUm"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={value("targetThicknessUm")}
                  className={inputClass}
                />
              </Field>
            </div>
          )}
        </Section>
      )}

      {state.error && (
        <div
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          <p>{t(`errors.${state.error}`)}</p>
          {state.messages && (
            // The API's messages are in English: the API stays
            // language-neutral, so they're shown as they come.
            <ul className="mt-1 list-disc pl-5">
              {state.messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sky-700 px-4 py-2 font-medium text-white hover:bg-sky-800 disabled:opacity-60"
        >
          {pending ? t("submitting") : t("submit")}
        </button>
        <Link
          href="/orders"
          className="text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
        >
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
      {hint && (
        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
          {hint}
        </span>
      )}
    </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
