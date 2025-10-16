import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Check if Supabase environment variables are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // If environment variables are not set, skip auth checks
    return res;
  }

  try {
    // Initialize a Supabase client bound to this request/response.
    // Calling getSession here keeps auth cookies fresh during navigation.
    const supabase = createMiddlewareClient({ req, res });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Gate protected routes
    const url = req.nextUrl;
    const protectedPath = url.pathname.startsWith('/agent') || url.pathname === '/dashboard';
    const isOnboardingPath = url.pathname.startsWith('/onboarding');
    
    if (protectedPath && !session) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('redirect', req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
    
    // Check onboarding status for authenticated users accessing protected routes
    if (session && protectedPath && !isOnboardingPath) {
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('onboarding_completed')
          .eq('user_id', session.user.id)
          .single();
        
        // Redirect to onboarding if not completed
        if (!profile || !profile.onboarding_completed) {
          const onboardingUrl = req.nextUrl.clone();
          onboardingUrl.pathname = '/onboarding';
          return NextResponse.redirect(onboardingUrl);
        }
      } catch (error) {
        console.warn('Failed to check onboarding status:', error);
        // If we can't check onboarding status, redirect to onboarding to be safe
        const onboardingUrl = req.nextUrl.clone();
        onboardingUrl.pathname = '/onboarding';
        return NextResponse.redirect(onboardingUrl);
      }
    }
  } catch (error) {
    console.warn('Middleware auth check failed:', error);
    // Continue without auth checks if there's an error
  }

  return res;
}

export const config = {
  matcher: ['/agent/:path*', '/dashboard', '/onboarding'],
};


