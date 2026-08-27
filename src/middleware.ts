import { NextRequest, NextResponse } from 'next/server';
import { recordRequest, recordRequestDuration } from '@/lib/metrics';

export function middleware(request: NextRequest) {
  const startedAt = Date.now();
  recordRequest(request.method, request.nextUrl.pathname);
  const requestId = crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('referrer-policy', 'same-origin');
  const durationMs = Date.now() - startedAt;
  recordRequestDuration(request.method, request.nextUrl.pathname, durationMs);
  response.headers.set('server-timing', `middleware;dur=${durationMs}`);
  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
