import { NextRequest, NextResponse } from 'next/server';
import { getUserMatchHistory, getLeaderboard } from '@/lib/authService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') || '';

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
