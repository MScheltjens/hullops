import { extractBearerToken } from './bearer-token';

describe('extractBearerToken', () => {
  it.each([
    ['Bearer abc123', 'abc123'],
    ['bearer abc123', 'abc123'], // the scheme name is case-insensitive
    ['  Bearer   abc123  ', 'abc123'], // extra spaces are tolerated
  ])('reads the token from %p', (header, token) => {
    expect(extractBearerToken(header)).toBe(token);
  });

  it.each([
    [undefined], // no header at all
    [''],
    ['Basic dXNlcjpwYXNz'], // a different login scheme
    ['Bearer'], // no token
    ['Bearer abc 123'], // more than one piece after "Bearer"
    ['abc123'], // a token without a scheme
  ])('returns null for %p', (header) => {
    expect(extractBearerToken(header)).toBeNull();
  });
});
