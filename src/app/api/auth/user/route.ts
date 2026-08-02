import { NextRequest, NextResponse } from 'next/server';
import { getUserByUsername } from '@/lib/authService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username || !username.trim()) {
      return NextResponse.json(
        { error: '用户名参数不能为空' },
        { status: 400 }
      );
    }

    const user = await getUserByUsername(username.trim());
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
