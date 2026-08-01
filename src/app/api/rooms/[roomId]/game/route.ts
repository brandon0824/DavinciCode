import { NextRequest, NextResponse } from 'next/server';
import { getGameState, updateGameState, endGame } from '@/lib/roomService';

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

// Update the game state
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const body = await request.json();
    const { gameState } = body;

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
  } catch (error) {
    console.error('更新游戏状态失败:', error);
    return NextResponse.json(
      { error: '更新游戏状态失败' },
      { status: 500 }
    );
  }
}
