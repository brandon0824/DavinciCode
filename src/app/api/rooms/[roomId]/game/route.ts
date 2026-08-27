import { NextRequest, NextResponse } from 'next/server';
import { getGameState, updateGameState, endGame, repositionJoker, performGameAction } from '@/lib/roomService';
import { getSessionUser } from '@/lib/session';

// Fetch the current game state
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const session = await getSessionUser(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const gameState = await getGameState(roomId, session.username);
    
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
    const session = await getSessionUser(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const body = await request.json();
    const { action, username, cardId, targetSlotIndex } = body;
    if (username && username !== session.username) return NextResponse.json({ error: '身份校验失败' }, { status: 403 });

    // 自定义调整百搭牌 (-) 放置位置
    if (action === 'reposition_joker') {
      if (!username || !cardId || typeof targetSlotIndex !== 'number') {
        return NextResponse.json({ error: '调整百搭牌位置参数不完整' }, { status: 400 });
      }
      try {
        const updatedState = await repositionJoker(roomId, username, cardId, targetSlotIndex);
        return NextResponse.json({ success: true, gameState: updatedState, version: updatedState?.version });
      } catch (error: any) {
        return NextResponse.json({ error: error.message || '调整百搭牌位置失败', code: error.code }, { status: error.code === 'VERSION_CONFLICT' ? 409 : 400 });
      }
    }

    if (['draw', 'guess', 'pass', 'surrender', 'chat'].includes(action)) {
      try {
        const gameState = await performGameAction(roomId, session.username, action, body);
        return NextResponse.json({ success: true, gameState, version: gameState?.version });
      } catch (error: any) {
        return NextResponse.json({ error: error.message || '非法游戏动作', code: error.code }, { status: error.code === 'VERSION_CONFLICT' ? 409 : 400 });
      }
    }

    return NextResponse.json({ error: '不允许提交完整对局状态，请使用动作接口' }, { status: 400 });
  } catch (error: any) {
    console.error('更新游戏状态失败:', error);
    return NextResponse.json(
      { error: error.message || '更新游戏状态失败' },
      { status: 500 }
    );
  }
}
