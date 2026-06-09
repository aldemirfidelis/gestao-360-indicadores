import { NextResponse, type NextRequest } from 'next/server';
import { privateRoutePrefixes } from '@/lib/public-site';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host') ?? '';

  if (host === 'www.gestao360.org') {
    url.hostname = 'gestao360.org';
    return NextResponse.redirect(url, 301);
  }

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
    return NextResponse.redirect(url, 301);
  }

  const response = NextResponse.next();
  if (privateRoutePrefixes.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) {
    response.headers.set('x-robots-tag', 'noindex, nofollow');
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/).*)'],
};
