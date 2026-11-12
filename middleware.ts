import { NextResponse, type NextRequest } from 'next/server';

/**
 * Visitors who land on the live site's vercel.app address are sent to
 * tastefuldelightsbites.com, so customers only ever see the bakery's own address.
 * Only on the live (production) site, and only for page visits (never for
 * form submissions, so nothing in progress is ever lost). Test (preview)
 * versions on vercel.app keep working as they are.
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  if (
    process.env.VERCEL_ENV === 'production' &&
    process.env.REDIRECT_TO_DOMAIN !== 'off' &&
    host.endsWith('.vercel.app') &&
    (req.method === 'GET' || req.method === 'HEAD')
  ) {
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, 'https://tastefuldelightsbites.com');
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|api/|favicon|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml)$).*)'],
};
