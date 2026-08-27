import { NextRequest } from 'next/server';
import { getRoom, getRoomPlayers, getGameState } from '@/lib/roomService';
import { getUserByUsername } from '@/lib/authService';
import { getSessionUser } from '@/lib/session';
import { subscribeRoomEvents } from '@/lib/roomEvents';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { roomId: string } }) {
  const session = await getSessionUser(request);
  if (!session) return new Response('Unauthorized', { status: 401 });
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  let lastPayload = '';
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (value: Uint8Array) => {
        if (closed) return;
        try { controller.enqueue(value); } catch { closed = true; }
      };
      const push = async () => {
        if (closed) return;
        try {
          const [room, players, gameState, user] = await Promise.all([
            getRoom(params.roomId), getRoomPlayers(params.roomId), getGameState(params.roomId, session.username), getUserByUsername(session.username)
          ]);
          const payload = JSON.stringify({ room, players, gameState, user });
          if (payload !== lastPayload) {
            lastPayload = payload;
            enqueue(encoder.encode(`event: snapshot\ndata: ${payload}\n\n`));
          } else enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (error) {
          enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: '同步失败' })}\n\n`));
        }
      };
      await push();
      unsubscribe = subscribeRoomEvents((event) => { if (!event.roomId || event.roomId === params.roomId) void push(); });
      heartbeat = setInterval(() => enqueue(encoder.encode(': heartbeat\n\n')), 15000);
      timeout = setTimeout(() => {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed by client */ }
      }, 25000);
      request.signal.addEventListener('abort', () => { closed = true; unsubscribe?.(); }, { once: true });
    },
    cancel() { closed = true; if (heartbeat) clearInterval(heartbeat); if (timeout) clearTimeout(timeout); unsubscribe?.(); }
  });
  request.signal.addEventListener('abort', () => { closed = true; if (heartbeat) clearInterval(heartbeat); if (timeout) clearTimeout(timeout); });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
