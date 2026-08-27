import { NextRequest, NextResponse } from 'next/server';
import { resetUserPassword } from '@/lib/authService';
import { getSessionUser } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: '权限不足' }, { status: 403 });
  try {
    const { username } = await request.json();
    if (!username) return NextResponse.json({ error: '用户名不能为空' }, { status: 400 });
    const sourceIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const temporaryPassword = await resetUserPassword(username, session.username, sourceIp || undefined);
    return NextResponse.json({ username, temporaryPassword, expiresInMinutes: 30 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '重置密码失败' }, { status: 400 });
  }
}
