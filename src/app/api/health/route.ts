import { NextResponse } from 'next/server';
import { pgPool } from '@/lib/postgres';
import { reportError } from '@/lib/errorReporter';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await pgPool.query('SELECT 1');
    return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    reportError('health-check', error);
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
