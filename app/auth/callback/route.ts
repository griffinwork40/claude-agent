// app/auth/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  // auth-helpers middleware already updates cookies; just redirect to settings or redirect param
  const redirectParam = req.nextUrl.searchParams.get('redirect');
  const url = req.nextUrl.clone();
  url.pathname = redirectParam || '/dashboard';
  url.search = '';
  return NextResponse.redirect(url);
}


