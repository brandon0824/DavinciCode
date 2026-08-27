import { NextRequest, NextResponse } from 'next/server';
import { getRoom, getRoomPlayers, closeRoom } from '@/lib/roomService';
import { getSessionUser } from '@/lib/session';

// 获取房间信息
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    if (!await getSessionUser(request)) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const { roomId } = params;
    
    // 获取房间信息
    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json(
        { error: '房间不存在' },
        { status: 404 }
      );
    }
    
    // 获取房间玩家列表
    const players = await getRoomPlayers(roomId);
    
    return NextResponse.json({
      room,
      players,
    });
  } catch (error) {
    console.error('获取房间信息失败:', error);
    return NextResponse.json(
      { error: '获取房间信息失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { roomId: string } }) {
  const session = await getSessionUser(request);
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const closed = await closeRoom(params.roomId, session.username);
  if (!closed) return NextResponse.json({ error: '只有等待中或已结束房间的房主可以关闭房间' }, { status: 409 });
  return NextResponse.json({ success: true });
}
