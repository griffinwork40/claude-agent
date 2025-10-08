import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Initialize a Supabase client bound to this request/response.
  // Calling getSession here keeps auth cookies fresh during navigation.
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Gate protected routes
  const url = req.nextUrl;
  const protectedPath = url.pathname.startsWith('/agent') || url.pathname === '/settings';
  if (protectedPath && !session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ['/agent/:path*', '/settings'],
};


