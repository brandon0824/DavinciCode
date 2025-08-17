import { NextRequest, NextResponse } from 'next/server';
import { joinRoom, getRoom, getRoomPlayers } from '@/lib/roomService';

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json(
        { error: '用户名不能为空' },
        { status: 400 }
      );
    }

    // 检查房间是否存在
    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json(
        { error: '房间不存在' },
        { status: 404 }
      );
    }

    // 加入房间
    await joinRoom({ roomId, username });

    // 获取更新后的玩家列表
    const players = await getRoomPlayers(roomId);

    return NextResponse.json({
      message: '加入房间成功',
      room,
      players,
    });
  } catch (error) {
    console.error('加入房间失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '加入房间失败' },
      { status: 500 }
    );
  }
}
