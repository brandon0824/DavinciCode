import { NextRequest, NextResponse } from 'next/server';
import { getAdminAllUsers } from '@/lib/authService';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (!session.isAdmin) return NextResponse.json({ error: '权限不足，仅管理员可访问' }, { status: 403 });

    const users = await getAdminAllUsers();
    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('获取管理员全服用户数据失败:', error);
    return NextResponse.json({ error: error.message || '获取用户数据失败' }, { status: 500 });
  }
}
