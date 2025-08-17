import { NextRequest, NextResponse } from 'next/server';
import { startGame, getRoomPlayers } from '@/lib/roomService';

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

    // 检查是否是房主
    const players = await getRoomPlayers(roomId);
    const currentPlayer = players.find(p => p.username === username);
    
    if (!currentPlayer?.isHost) {
      return NextResponse.json(
        { error: '只有房主可以开始游戏' },
        { status: 403 }
      );
    }

    // 开始游戏
    await startGame(roomId);

    return NextResponse.json({
      message: '游戏开始成功',
    });
  } catch (error) {
    console.error('开始游戏失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '开始游戏失败' },
      { status: 500 }
    );
  }
}
