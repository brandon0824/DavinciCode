import { NextRequest, NextResponse } from 'next/server';
import { destroySession } from '@/lib/session';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  await destroySession(request, response);
  return response;
}
