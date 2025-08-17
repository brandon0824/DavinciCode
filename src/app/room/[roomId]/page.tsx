'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, LogOut, Users, Crown, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Player {
  id: string;
  username: string;
  isHost: boolean;
  isCurrentTurn: boolean;
}

interface Room {
  id: string;
  name: string;
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
}

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const playerName = searchParams.get('name');
  const { roomId } = params;

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // 初始化房间数据
  useEffect(() => {
    if (!playerName) {
      setError('用户名不能为空');
      setIsLoading(false);
      return;
    }

    // 获取房间信息
    fetchRoomInfo();
    
    // 设置定时器定期刷新房间信息
    const interval = setInterval(fetchRoomInfo, 3000);
    
    return () => clearInterval(interval);
  }, [roomId, playerName]);

  // 获取房间信息
  const fetchRoomInfo = async () => {
    try {
      // 获取房间信息
      const roomResponse = await fetch(`/api/rooms/${roomId}`);
      if (roomResponse.ok) {
        const roomData = await roomResponse.json();
        setRoom(roomData.room);
        setPlayers(roomData.players || []);
        
        // 查找当前玩家
        const foundPlayer = roomData.players?.find((p: Player) => p.username === playerName);
        if (foundPlayer) {
          setCurrentPlayer(foundPlayer);
        }
        
        setIsLoading(false);
      } else {
        setError('获取房间信息失败');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('获取房间信息失败:', error);
      setError('网络错误，请重试');
      setIsLoading(false);
    }
  };

  // 离开房间
  const handleLeaveRoom = async () => {
    try {
      await fetch(`/api/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: playerName,
        }),
      });
    } catch (error) {
      console.error('离开房间失败:', error);
    }
    
    router.push('/');
  };

  // 开始游戏
  const handleStartGame = async () => {
    if (!currentPlayer?.isHost) return;
    
    try {
      const response = await fetch(`/api/rooms/${roomId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: playerName,
        }),
      });
      
      if (response.ok) {
        // 刷新房间信息
        fetchRoomInfo();
      } else {
        setError('开始游戏失败');
      }
    } catch (error) {
      console.error('开始游戏失败:', error);
      setError('开始游戏失败');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">正在加载房间信息...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">错误</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => router.push('/')} className="w-full">
              返回首页
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* 左侧：返回按钮和房间信息 */}
            <div className="flex items-center space-x-6">
              <Button
                variant="ghost"
                onClick={() => router.push('/')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>返回首页</span>
              </Button>
              
              <div className="w-px h-6 bg-gray-300"></div>
              
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-semibold text-gray-800">
                  {room?.name}
                </h1>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full font-mono">
                  #{roomId}
                </span>
              </div>
            </div>

            {/* 右侧：玩家数量和操作按钮 */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-gray-600">
                <Users className="w-5 h-5" />
                <span className="font-medium">{players.length}/{room?.maxPlayers}</span>
              </div>
              
              <div className="flex items-center space-x-3">
                {currentPlayer?.isHost && room?.status === 'waiting' && players.length >= 2 && (
                  <Button
                    onClick={handleStartGame}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    开始游戏
                  </Button>
                )}
                
                <Button
                  onClick={handleLeaveRoom}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  离开房间
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* 中央白色卡片 */}
        <Card className="bg-white shadow-sm border border-gray-200 max-w-4xl mx-auto">
          <CardContent className="p-8">
            {/* 标题和状态 */}
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-blue-600 mb-4">
                等待游戏开始
              </h2>
              <p className="text-lg text-gray-600">
                房间已创建，等待玩家加入并开始游戏
              </p>
            </div>

            {/* 玩家槽位 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {Array.from({ length: room?.maxPlayers || 4 }, (_, index) => {
                const player = players[index];
                const isEmpty = !player;
                
                return (
                  <div
                    key={index}
                    className={`relative p-6 rounded-xl border-2 transition-all duration-200 ${
                      isEmpty
                        ? 'bg-white border-gray-200'
                        : 'bg-green-50 border-green-300'
                    }`}
                  >
                    {/* 玩家头像 */}
                    <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
                      isEmpty ? 'bg-gray-200' : 'bg-green-500'
                    }`}>
                      {isEmpty ? (
                        <span className="text-2xl text-gray-400">?</span>
                      ) : (
                        <span className="text-2xl text-white font-bold">
                          {player.username.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* 玩家信息 */}
                    <div className="text-center">
                      {isEmpty ? (
                        <p className="text-gray-500">等待玩家</p>
                      ) : (
                        <>
                          <p className="text-gray-800 font-semibold mb-1">
                            {player.username}
                          </p>
                          <p className="text-sm text-green-600">已加入</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 游戏开始提示 */}
            <div className="text-center">
              <p className="text-gray-500">
                需要至少2名玩家才能开始游戏
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
