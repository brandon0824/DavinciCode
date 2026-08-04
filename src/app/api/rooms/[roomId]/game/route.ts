import { NextRequest, NextResponse } from 'next/server';
import { getGameState, updateGameState, endGame, repositionJoker } from '@/lib/roomService';

// Fetch the current game state
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const gameState = await getGameState(roomId);
    
    return NextResponse.json({ gameState });
  } catch (error) {
    console.error('获取游戏状态失败:', error);
    return NextResponse.json(
      { error: '获取游戏状态失败' },
      { status: 500 }
    );
  }
}

// Update the game state or perform specific game actions
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const body = await request.json();
    const { action, username, cardId, targetSlotIndex, gameState } = body;

    // 自定义调整百搭牌 (-) 放置位置
    if (action === 'reposition_joker') {
      if (!username || !cardId || typeof targetSlotIndex !== 'number') {
        return NextResponse.json({ error: '调整百搭牌位置参数不完整' }, { status: 400 });
      }
      const updatedState = await repositionJoker(roomId, username, cardId, targetSlotIndex);
      return NextResponse.json({ success: true, gameState: updatedState });
    }

    if (!gameState) {
      return NextResponse.json(
        { error: '游戏状态不能为空' },
        { status: 400 }
      );
    }

    // Save the new state
    await updateGameState(roomId, gameState.currentTurn, gameState);

    // If game ended, trigger endGame
    if (gameState.winner) {
      await endGame(roomId, gameState.winner);
    }

    return NextResponse.json({ success: true, message: '游戏状态更新成功' });
  } catch (error: any) {
    console.error('更新游戏状态失败:', error);
    return NextResponse.json(
      { error: error.message || '更新游戏状态失败' },
      { status: 500 }
    );
  }
}
