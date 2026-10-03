import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@/types/database.types';
import type { UserRole } from '@/types/roles';
import type { SupabaseClient } from '@supabase/supabase-js';

function roleDestination(role: UserRole): string {
  switch (role) {
    case 'store':
      return '/dashboard/store';
    case 'rider':
      return '/dashboard/rider';
    case 'admin':
      return '/dashboard/admin';
    default:
      return '/';
  }
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip supabase checks if placeholder credentials are configured
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder-project')) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  }) as unknown as SupabaseClient<Database>;

  // getSession() decodes the cookie locally instead of round-tripping to the
  // Supabase Auth server (getUser() does that on every single request) --
  // this is only a coarse, fast pre-redirect for UX. The actual security
  // boundary stays intact: every role layout independently calls
  // getUserProfile() -> getUser() (verified), and RLS gates all data access
  // regardless of what middleware decides.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  let user = session?.user ?? null;

  const pathname = request.nextUrl.pathname;

  const isStoreRoute = pathname.startsWith('/dashboard/store');
  const isRiderRoute = pathname.startsWith('/dashboard/rider');
  const isAdminRoute = pathname.startsWith('/dashboard/admin');
  const isConsumerProtectedRoute =
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/claims') ||
    pathname.startsWith('/account');
  const isRoleRoute = isStoreRoute || isRiderRoute || isAdminRoute;
  const isProtectedRoute = isRoleRoute || isConsumerProtectedRoute;
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password');
  const isSuspendedPage = pathname === '/suspended';

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = '';
    return NextResponse.redirect(url);
  };

  // Resolve role + suspension once. getSession() above only decodes the
  // cookie, so a stale or invalid one (expired refresh token, deleted user,
  // rotated keys) still "looks" logged in -- the page itself (getUser) then
  // renders as logged out while this middleware bounces /login back to '/',
  // leaving the visitor unable to sign in at all. So when the profile can't
  // be loaded, or the visitor is heading to login/register, confirm with the
  // Auth server and clear an invalid session instead of trusting it.
  let profile: { role: string; suspended: boolean } | null = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, suspended')
      .eq('id', user.id)
      .maybeSingle();
    profile = data;

    if (!profile || isAuthRoute) {
      const {
        data: { user: verified },
      } = await supabase.auth.getUser();
      if (!verified) {
        await supabase.auth.signOut({ scope: 'local' }); // clears the auth cookies
        user = null;
        profile = null;
      }
    }
  }

  // Unauthenticated
  if (!user) {
    if (isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    if (isSuspendedPage) return redirectTo('/login');
    return supabaseResponse;
  }

  // Authenticated
  const role = (profile?.role as UserRole) ?? 'consumer';

  if (profile?.suspended) {
    return isSuspendedPage ? supabaseResponse : redirectTo('/suspended');
  }

  // Not suspended but sitting on the suspended page → bounce home
  if (isSuspendedPage) return redirectTo(roleDestination(role));

  // Already logged in and visiting login/register
  if (isAuthRoute) return redirectTo(roleDestination(role));

  // Role-specific authorization
  if (isStoreRoute && role !== 'store') return redirectTo('/');
  if (isRiderRoute && role !== 'rider') return redirectTo('/');
  if (isAdminRoute && role !== 'admin') return redirectTo('/');

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
