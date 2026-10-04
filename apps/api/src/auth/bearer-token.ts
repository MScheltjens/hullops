/**
 * Reads the token from an `Authorization: Bearer <token>` header.
 *
 * Returns null when there's no header, when it uses another scheme (e.g.
 * `Basic`), or when the token is missing. The scheme name is
 * case-insensitive (RFC 7235), so `bearer abc` is accepted too.
 */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (scheme.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
    return null;
  }
  return token;
}
