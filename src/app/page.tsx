'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [name, setName] = useState('')
  const [room, setRoom] = useState('')
  const router = useRouter()

  const createRoom = () => {
    if (!name) return
    const id = Math.random().toString(36).slice(2, 8)
    router.push(`/room/${id}?name=${encodeURIComponent(name)}`)
  }

  const joinRoom = () => {
    if (!name || !room) return
    router.push(`/room/${room}?name=${encodeURIComponent(name)}`)
  }

  return (
    <main className="flex flex-col items-center gap-4 mt-20">
      <input
        className="border p-2 rounded w-64"
        placeholder="你的名字"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <input
        className="border p-2 rounded w-64"
        placeholder="房间号（加入时填写）"
        value={room}
        onChange={e => setRoom(e.target.value)}
      />
      <div className="flex gap-4">
        <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={createRoom}>
          创建房间
        </button>
        <button className="bg-green-500 text-white px-4 py-2 rounded" onClick={joinRoom}>
          加入房间
        </button>
      </div>
    </main>
  )
}
