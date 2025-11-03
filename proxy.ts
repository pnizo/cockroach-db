import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Skip authentication for cron job endpoint
  if (request.nextUrl.pathname === '/api/cron') {
    return NextResponse.next();
  }

  // Get authentication credentials from environment variables
  const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || 'admin';
  const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD || 'password';

  // Get the Authorization header
  const authHeader = request.headers.get('authorization');

  // If no Authorization header is present, request authentication
  if (!authHeader) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  // Parse the Authorization header
  const auth = authHeader.split(' ')[1];
  const [user, password] = Buffer.from(auth, 'base64').toString().split(':');

  // Validate credentials
  if (user !== BASIC_AUTH_USER || password !== BASIC_AUTH_PASSWORD) {
    return new NextResponse('Invalid credentials', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  // Authentication successful, continue to the requested page
  return NextResponse.next();
}

// Configure which routes to protect with basic auth
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
