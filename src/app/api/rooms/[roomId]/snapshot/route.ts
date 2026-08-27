import { NextRequest, NextResponse } from 'next/server';
import { getRoom, getRoomPlayers, getGameState } from '@/lib/roomService';
import { getUserByUsername } from '@/lib/authService';
import { getSessionUser } from '@/lib/session';
import crypto from 'crypto';

export async function GET(request: NextRequest, { params }: { params: { roomId: string } }) {
  const session = await getSessionUser(request);
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  try {
    const [room, players, gameState, user] = await Promise.all([
      getRoom(params.roomId), getRoomPlayers(params.roomId), getGameState(params.roomId, session.username), getUserByUsername(session.username)
    ]);
    if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
    const payload = { room, players, gameState, user };
    const etag = `"${crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex')}"`;
    if (request.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    return NextResponse.json(payload, { headers: { ETag: etag, 'Cache-Control': 'private, max-age=0, must-revalidate' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '同步房间状态失败' }, { status: 500 });
  }
}
