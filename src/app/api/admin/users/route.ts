import { NextRequest, NextResponse } from 'next/server';
import { getAdminAllUsers } from '@/lib/authService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const adminUsername = url.searchParams.get('adminUsername');

    // 仅限管理员账号访问
    if (!adminUsername || adminUsername.trim() !== 'admin') {
      return NextResponse.json({ error: '权限不足，仅管理员账号 (admin) 拥有此接口访问权限' }, { status: 403 });
    }

    const users = await getAdminAllUsers();
    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('获取管理员全服用户数据失败:', error);
    return NextResponse.json({ error: error.message || '获取用户数据失败' }, { status: 500 });
  }
}
