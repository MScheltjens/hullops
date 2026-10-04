/** The languages the app is translated into. English is the default. */
export const LOCALES = ["en", "de"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";

const isAppLocale = (value: string): value is AppLocale =>
  (LOCALES as readonly string[]).includes(value);

/**
 * Picks the best supported language from a browser's Accept-Language header,
 * e.g. "de-DE,de;q=0.9,en;q=0.8" → "de". Used before login, when we don't
 * know the user's own setting yet.
 */
export function localeFromAcceptLanguage(
  header: string | null | undefined,
): AppLocale {
  if (!header) return DEFAULT_LOCALE;
  const preferences = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return {
        language: tag.trim().split("-")[0].toLowerCase(),
        weight: q ? Number(q.trim().slice(2)) : 1,
      };
    })
    .filter(({ weight }) => weight > 0)
    .sort((a, b) => b.weight - a.weight);

  const match = preferences.find(({ language }) => isAppLocale(language));
  return match ? (match.language as AppLocale) : DEFAULT_LOCALE;
}
