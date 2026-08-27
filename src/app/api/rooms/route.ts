import { NextRequest, NextResponse } from 'next/server';
import { createRoom, getRoomList, joinRoom } from '@/lib/roomService';
import { getSessionUser } from '@/lib/session';

// 获取房间列表
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const rooms = await getRoomList();
    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('获取房间列表失败:', error);
    return NextResponse.json(
      { error: '获取房间列表失败' },
      { status: 500 }
    );
  }
}

// 创建房间
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const body = await request.json();
    const { name, username, password, customRoomId } = body;

    if (!name || !username || username !== session.username) {
      return NextResponse.json(
        { error: '房间名称和用户名不能为空' },
        { status: 400 }
      );
    }

    // 如果提供了自定义房间号，验证格式
    if (customRoomId) {
      if (customRoomId.length < 4 || customRoomId.length > 10) {
        return NextResponse.json(
          { error: '自定义房间号长度应为4-10个字符' },
          { status: 400 }
        );
      }
      if (!/^[a-zA-Z0-9]+$/.test(customRoomId)) {
        return NextResponse.json(
          { error: '自定义房间号只能包含字母和数字' },
          { status: 400 }
        );
      }
    }

    const roomId = await createRoom({ name, username, password, customRoomId });
    
    // 创建房间后，立即让创建者加入房间
    await joinRoom({ roomId, username, password });
 
    return NextResponse.json({ 
      roomId,
      message: '房间创建成功' 
    });
  } catch (error) {
    console.error('创建房间失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建房间失败' },
      { status: 500 }
    );
  }
}
