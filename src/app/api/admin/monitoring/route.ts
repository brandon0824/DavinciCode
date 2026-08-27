import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getMonitoringSnapshot } from '@/lib/monitoringService';
import { reportError } from '@/lib/errorReporter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: '权限不足，仅管理员可访问' }, { status: 403 });
  try {
    return NextResponse.json(await getMonitoringSnapshot(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    reportError('admin-monitoring', error);
    return NextResponse.json({ error: '监控数据暂时不可用' }, { status: 503 });
  }
}
