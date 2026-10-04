import type de from "../../messages/de.json";
import type en from "../../messages/en.json";

/**
 * Compile-time check that the German translations have every key the English
 * ones have. A missing key fails `next build` here, instead of showing up as
 * a raw key like "orders.title" in the German UI.
 */
type HasAllKeysOf<Reference, Candidate extends Reference> = Candidate;
export type GermanIsComplete = HasAllKeysOf<typeof en, typeof de>;
