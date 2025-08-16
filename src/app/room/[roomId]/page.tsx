'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RoomPage({ params }: { params: any }) {
  const { roomId } = params as { roomId: string }
  const searchParams = useSearchParams()
  const name = searchParams.get('name') ?? ''
  const [players, setPlayers] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!name) return

    const join = async () => {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        const data = await res.json()
        setPlayers(data.players)
      } else {
        const data = await res.json()
        setError(data.error ?? '加入房间失败')
      }
    }
    join()

    const interval = setInterval(async () => {
      const res = await fetch(`/api/rooms/${roomId}`)
      const data = await res.json()
      setPlayers(data.players)
    }, 1000)

    return () => {
      clearInterval(interval)
      fetch(`/api/rooms/${roomId}?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
    }
  }, [name, roomId])

  if (!name) {
    return <p className="p-4">需要提供名字</p>
  }
  if (error) {
    return <p className="p-4 text-red-500">{error}</p>
  }

  return (
    <main className="p-4">
      <h1 className="text-xl mb-4">房间 {roomId}</h1>
      <h2 className="mb-2">玩家 ({players.length}/4)</h2>
      <ul className="mb-4 list-disc list-inside">
        {players.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {players.length >= 4 && !players.includes(name) && (
        <p className="text-red-500">房间已满</p>
      )}
      <p className="text-sm text-gray-500">游戏逻辑 TODO</p>
    </main>
  )
}
