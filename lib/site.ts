/**
 * File: lib/site.ts
 * Purpose: Centralized accessors for site-wide branding and URLs.
 */

export function getSiteName(): string {
  return process.env.NEXT_PUBLIC_SITE_NAME || 'Job Enlist';
}

export function getSiteUrl(): URL {
  const urlFromEnv = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  try {
    return new URL(urlFromEnv);
  } catch {
    return new URL('http://localhost:3000');
  }
}

export function getAbsoluteUrl(pathname: string = '/'):
  | string {
  const base = getSiteUrl();
  const url = new URL(pathname, base);
  return url.toString();
}


