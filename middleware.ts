import { NextResponse, type NextRequest } from 'next/server';
import { updateSession, createServerClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Sync any auth changes to cookies
  await updateSession(req, res);

  // Check session for protected paths
  const url = req.nextUrl;
  const protectedPath = url.pathname.startsWith('/agent') || url.pathname === '/settings';
  if (!protectedPath) return res;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (key: string) => req.cookies.get(key)?.value } }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
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


