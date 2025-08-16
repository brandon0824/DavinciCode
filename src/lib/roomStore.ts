const rooms: Record<string, Set<string>> = {}

export function getPlayers(roomId: string): string[] {
  return Array.from(rooms[roomId] ?? [])
}

export function addPlayer(roomId: string, name: string): { success: boolean; error?: string } {
  const players = rooms[roomId] ?? (rooms[roomId] = new Set())
  if (players.has(name)) return { success: true }
  if (players.size >= 4) {
    return { success: false, error: '房间已满' }
  }
  players.add(name)
  return { success: true }
}

export function removePlayer(roomId: string, name: string) {
  const players = rooms[roomId]
  if (!players) return
  players.delete(name)
  if (players.size === 0) {
    delete rooms[roomId]
  }
}
