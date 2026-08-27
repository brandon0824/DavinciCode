import { NextRequest, NextResponse } from 'next/server';
import { getUserMatchHistory, getLeaderboard } from '@/lib/authService';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') || '';
    if (username && username !== session.username) return NextResponse.json({ error: '无权访问其他用户战绩' }, { status: 403 });

    // 获取个人历史记录 (如果提供了 username)
    const history = username ? await getUserMatchHistory(username) : [];
    
    // 获取全服胜率排行榜
    const leaderboard = await getLeaderboard();

    return NextResponse.json({
      history,
      leaderboard
    });
  } catch (error) {
    console.error('获取战绩与排行榜数据失败:', error);
    return NextResponse.json(
      { error: '获取战绩与排行榜数据失败' },
      { status: 500 }
    );
  }
}
