import { NextRequest } from 'next/server';
import { getRoomList } from '@/lib/roomService';
import { getSessionUser } from '@/lib/session';
import { subscribeRoomEvents } from '@/lib/roomEvents';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (!await getSessionUser(request)) return new Response('Unauthorized', { status: 401 });
  const encoder = new TextEncoder(); let heartbeat: ReturnType<typeof setInterval> | undefined; let timeout: ReturnType<typeof setTimeout> | undefined; let last = ''; let unsubscribe: (() => void) | undefined;
  const stream = new ReadableStream({
    async start(controller) {
      const push = async () => { try { const payload = JSON.stringify({ rooms: await getRoomList() }); if (payload !== last) { last = payload; controller.enqueue(encoder.encode(`event: rooms\ndata: ${payload}\n\n`)); } else controller.enqueue(encoder.encode(': heartbeat\n\n')); } catch { controller.enqueue(encoder.encode(': heartbeat\n\n')); } };
      await push(); unsubscribe = subscribeRoomEvents((event) => { if (!event.roomId || event.kind === 'room') void push(); }); heartbeat = setInterval(() => controller.enqueue(encoder.encode(': heartbeat\n\n')), 15000); timeout = setTimeout(() => controller.close(), 25000);
    },
    cancel() { if (heartbeat) clearInterval(heartbeat); if (timeout) clearTimeout(timeout); unsubscribe?.(); }
  });
  request.signal.addEventListener('abort', () => { if (heartbeat) clearInterval(heartbeat); if (timeout) clearTimeout(timeout); unsubscribe?.(); });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
