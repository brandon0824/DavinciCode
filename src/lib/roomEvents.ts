type RoomEvent = { roomId?: string; kind: 'room' | 'game' };
type Listener = (event: RoomEvent) => void;
import { pgPool } from './postgres';

const registry = globalThis as typeof globalThis & { __davinciRoomListeners?: Set<Listener> };
const listeners = registry.__davinciRoomListeners || new Set<Listener>();
registry.__davinciRoomListeners = listeners;
const listenerState = globalThis as typeof globalThis & { __davinciPgEventListener?: Promise<void> };

function ensurePgListener() {
  if (!listenerState.__davinciPgEventListener) {
    listenerState.__davinciPgEventListener = pgPool.connect().then((client) => {
      client.on('notification', (message) => {
        if (!message.payload) return;
        try { const event = JSON.parse(message.payload) as RoomEvent; listeners.forEach((listener) => listener(event)); } catch { /* ignore malformed notifications */ }
      });
      return client.query('LISTEN davinci_room_events').then(() => undefined);
    }).catch(() => undefined);
  }
  return listenerState.__davinciPgEventListener;
}

export function publishRoomEvent(event: RoomEvent) {
  listeners.forEach((listener) => {
    try { listener(event); } catch { /* isolate subscribers */ }
  });
  void pgPool.query('SELECT pg_notify($1, $2)', ['davinci_room_events', JSON.stringify(event)]).catch(() => {});
}

export function subscribeRoomEvents(listener: Listener) {
  void ensurePgListener();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
