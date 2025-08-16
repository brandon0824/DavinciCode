import { NextRequest, NextResponse } from 'next/server'
import { getPlayers, addPlayer, removePlayer } from '@/lib/roomStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GET(_req: NextRequest, context: any) {
  const { roomId } = context.params as { roomId: string }
  const players = getPlayers(roomId)
  return NextResponse.json({ players })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function POST(req: NextRequest, context: any) {
  const { roomId } = context.params as { roomId: string }
  const { name } = await req.json()
  const result = addPlayer(roomId, name)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ players: getPlayers(roomId) })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function DELETE(req: NextRequest, context: any) {
  const { roomId } = context.params as { roomId: string }
  const name = req.nextUrl.searchParams.get('name')
  if (name) {
    removePlayer(roomId, name)
  }
  return NextResponse.json({ ok: true })
}
