
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/server/session';

const protectedRoutes = ['/overview', '/settings'];
const publicRoutes = ['/login'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Determine if the current path is a protected route.
  // The root path needs to be checked for an exact match.
  const isProtectedRoute = path === '/overview' || protectedRoutes.some(p => p !== '/overview' && path.startsWith(p));

  // 1. Get and decrypt the session
  const session = await getSession();

  // 2. Redirect to login if user is not authenticated and trying to access a protected route
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.nextUrl));
  }

  // 3. Redirect to dashboard if user is authenticated and trying to access the login page
  if (path === '/login' && session) {
     return NextResponse.redirect(new URL('/overview', request.nextUrl));
  }
  
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/((?!api/report|_next/static|_next/image|favicon.ico).*)'],
}
