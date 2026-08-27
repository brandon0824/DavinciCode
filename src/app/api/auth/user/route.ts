import { NextRequest, NextResponse } from 'next/server';
import { getUserByUsername } from '@/lib/authService';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const session = await getSessionUser(request);

    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (username && username.trim() !== session.username) return NextResponse.json({ error: '无权访问其他用户信息' }, { status: 403 });

    const effectiveUsername = session.username;

    const user = await getUserByUsername(effectiveUsername);
    if (!user) {
      return NextResponse.json(
        { error: '未找到该用户' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        totalGames: user.totalGames,
        totalWins: user.totalWins,
        totalLosses: user.totalLosses,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }
    });
  } catch (error) {
    console.error('获取用户实时战绩数据失败:', error);
    return NextResponse.json(
      { error: '获取用户战绩数据失败' },
      { status: 500 }
    );
  }
}
