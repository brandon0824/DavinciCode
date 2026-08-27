import { NextRequest, NextResponse } from 'next/server';
import { leaveRoom } from '@/lib/roomService';
import { getSessionUser } from '@/lib/session';

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const session = await getSessionUser(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const { roomId } = params;
    const body = await request.json();
    const { username } = body;

    if (!username || username !== session.username) {
      return NextResponse.json(
        { error: '用户名不能为空' },
        { status: 400 }
      );
    }

    // 离开房间
    await leaveRoom(roomId, username);

    return NextResponse.json({
      message: '离开房间成功',
    });
  } catch (error) {
    console.error('离开房间失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '离开房间失败' },
      { status: 500 }
    );
  }
}
