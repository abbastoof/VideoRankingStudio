import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware that gates protected route groups using a presence-only
 * check on the session cookie. Real authorization is enforced server-side
 * on every API call and again in layouts via `requireSession()`. This is
 * just a fast first-pass redirect to the sign-in page.
 */

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/projects',
  '/rankings',
  '/templates',
  '/voices',
  '/insights',
  '/settings',
  '/billing',
  '/support',
  '/publish',
  '/notifications',
  '/admin',
];
const AUTH_PREFIXES = ['/signin', '/verify'];
const SESSION_COOKIE = process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME ?? 'vrs_session';

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};
