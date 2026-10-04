import { headers } from 'next/headers';

/**
 * This site's origin for links that leave the app and come back (auth email
 * redirects). Prefers the request's own Origin so local dev and preview
 * deploys link back to themselves; falls back to NEXT_PUBLIC_SITE_URL.
 */
export function siteOrigin(): string {
  const h = headers();
  return (
    h.get('origin') ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`
  );
}
