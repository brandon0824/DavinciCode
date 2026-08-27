import { NextRequest, NextResponse } from 'next/server';
import { changePassword } from '@/lib/authService';
import { destroySession, getSessionUser } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  try {
    const { currentPassword, newPassword } = await request.json();
    await changePassword(session.username, currentPassword, newPassword);
    const response = NextResponse.json({ success: true, requiresLogin: true });
    await destroySession(request, response);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '修改密码失败' }, { status: 400 });
  }
}
