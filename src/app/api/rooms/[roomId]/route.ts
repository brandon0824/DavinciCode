import { NextRequest, NextResponse } from 'next/server';
import { getRoom, getRoomPlayers } from '@/lib/roomService';

// 获取房间信息
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
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
