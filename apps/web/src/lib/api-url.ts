/** Where the API runs during local development. */
export const DEFAULT_API_URL = "http://localhost:4000/graphql";

/**
 * Reads the API's address from the `API_URL` setting and checks that it is a
 * full http(s) URL. A common slip is leaving out "https://": `fetch` then
 * fails with "Invalid URL", which the login page can only report as "server
 * can't be reached". Failing here names the setting and the fix instead.
 *
 * A missing value falls back to the local development address, so builds and
 * tests don't need the setting.
 */
export function parseApiUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_API_URL;

  const invalid = () =>
    new Error(
      `API_URL must be a full URL such as https://api.example.com/graphql, ` +
        `but it is "${trimmed}". Did you leave out "https://"?`,
    );

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw invalid();
  }
  // "localhost:4000/graphql" parses, as a URL with the scheme "localhost:".
  if (url.protocol !== "http:" && url.protocol !== "https:") throw invalid();
  return trimmed;
}
