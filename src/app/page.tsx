'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Users, ArrowRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { validateUsername, validateRoomName } from '@/lib/utils';

interface Room {
  id: string;
  name: string;
  status: string;
  maxPlayers: number;
  createdAt: Date;
}

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState('brandon2');
  const [roomName, setRoomName] = useState('');
  const [roomId, setRoomId] = useState('4arfeu');
  const [customRoomId, setCustomRoomId] = useState('');
  const [useCustomRoomId, setUseCustomRoomId] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  // 获取可用房间列表
  const fetchAvailableRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const response = await fetch('/api/rooms');
      if (response.ok) {
        const data = await response.json();
        setAvailableRooms(data.rooms || []);
      }
    } catch (error) {
      console.error('获取房间列表失败:', error);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  // 页面加载时获取房间列表
  useEffect(() => {
    fetchAvailableRooms();
    // 每10秒刷新一次房间列表
    const interval = setInterval(fetchAvailableRooms, 10000);
    return () => clearInterval(interval);
  }, []);

  // 清除错误和成功消息
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // 创建房间
  const handleCreateRoom = async () => {
    if (!validateUsername(name)) {
      setError('用户名格式不正确（2-20个字符，支持中文、英文、数字、下划线）');
      return;
    }
    if (!validateRoomName(roomName)) {
      setError('房间名格式不正确（2-50个字符）');
      return;
    }

    // 如果使用自定义房间号，验证房间号格式
    if (useCustomRoomId && customRoomId.trim()) {
      if (customRoomId.length < 3 || customRoomId.length > 10) {
        setError('自定义房间号长度应为3-10个字符');
        return;
      }
      if (!/^[a-zA-Z0-9]+$/.test(customRoomId)) {
        setError('自定义房间号只能包含字母和数字');
        return;
      }
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: roomName,
          username: name,
          customRoomId: useCustomRoomId ? customRoomId.trim() : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`房间创建成功！房间号: ${data.roomId}`);
        setRoomId(data.roomId);
        // 刷新房间列表
        fetchAvailableRooms();
        // 立即跳转
        setTimeout(() => {
          router.push(`/room/${data.roomId}?name=${encodeURIComponent(name)}`);
        }, 1000);
      } else {
        setError(data.error || '创建房间失败');
      }
    } catch (error) {
      console.error('创建房间错误:', error);
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 加入房间
  const handleJoinRoom = async () => {
    if (!validateUsername(name)) {
      setError('用户名格式不正确（2-20个字符，支持中文、英文、数字、下划线）');
      return;
    }
    if (!roomId.trim()) {
      setError('请输入房间号');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: name,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('加入房间成功！');
        setTimeout(() => {
          router.push(`/room/${roomId}?name=${encodeURIComponent(name)}`);
        }, 800);
      } else {
        setError('加入房间失败，请检查房间号是否正确');
      }
    } catch (error) {
      console.error('加入房间错误:', error);
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 加入可用房间
  const handleJoinAvailableRoom = async (roomId: string) => {
    if (!name.trim()) {
      setError('请先输入你的名字');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: name,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('加入房间成功！');
        setTimeout(() => {
          router.push(`/room/${roomId}?name=${encodeURIComponent(name)}`);
        }, 800);
      } else {
        setError(data.error || '加入房间失败');
      }
    } catch (error) {
      console.error('加入房间错误:', error);
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto px-4 w-full">
        {/* 主要内容区域 - 左右两列布局 */}
        <div className="flex flex-col lg:flex-row gap-8 max-w-6xl mx-auto w-full">
          {/* 左列 */}
          <div className="flex-1 space-y-8">
            {/* 创建新房间 */}
            <Card className="bg-white shadow-sm border border-gray-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold text-gray-800 flex items-center">
                  <Plus className="w-6 h-6 mr-2 text-blue-600" />
                  创建新房间
                </CardTitle>
                <p className="text-gray-600 text-sm">
                  创建一个新的游戏房间，邀请朋友一起游戏
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    你的名字
                  </label>
                  <Input
                    type="text"
                    placeholder="输入你的名字"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    房间名称
                  </label>
                  <Input
                    type="text"
                    placeholder="输入房间名称"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full"
                  />
                </div>
                
                {/* 自定义房间号选项 */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="useCustomRoomId"
                      checked={useCustomRoomId}
                      onChange={(e) => setUseCustomRoomId(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <label htmlFor="useCustomRoomId" className="text-sm font-medium text-gray-700">
                      自定义房间号
                    </label>
                  </div>
                  
                  {useCustomRoomId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        自定义房间号
                      </label>
                      <Input
                        type="text"
                        placeholder="输入3-10位字母数字组合"
                        value={customRoomId}
                        onChange={(e) => setCustomRoomId(e.target.value)}
                        className="w-full"
                        maxLength={10}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        可选，留空将自动生成房间号
                      </p>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleCreateRoom}
                  disabled={isLoading || !name.trim() || !roomName.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? '创建中...' : '创建房间'}
                </Button>
              </CardContent>
            </Card>

            {/* 加入现有房间 */}
            <Card className="bg-white shadow-sm border border-gray-200">
              <CardHeader className="pb-4 bg-green-50 rounded-t-lg">
                <CardTitle className="text-2xl font-bold text-gray-800 flex items-center">
                  <ArrowRight className="w-6 h-6 mr-2 text-green-600" />
                  加入现有房间
                </CardTitle>
                <p className="text-gray-600 text-sm">
                  输入房间号加入朋友的游戏房间
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    房间号
                  </label>
                  <Input
                    type="text"
                    placeholder="输入房间号"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Button
                  onClick={handleJoinRoom}
                  disabled={isLoading || !name.trim() || !roomId.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {isLoading ? '加入中...' : '加入房间'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 右列 - 可用房间 */}
          <Card className="bg-white shadow-sm border border-gray-200 h-fit lg:w-96">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-gray-800 flex items-center">
                <Lock className="w-6 h-6 mr-2 text-gray-600" />
                可用房间
              </CardTitle>
              <p className="text-gray-600 text-sm">
                当前可加入的游戏房间
              </p>
            </CardHeader>
            <CardContent>
              {isLoadingRooms ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500">加载中...</p>
                </div>
              ) : availableRooms.length > 0 ? (
                <div className="space-y-3">
                  {availableRooms.map((room) => (
                    <div
                      key={room.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div>
                        <h4 className="font-medium text-gray-800">{room.name}</h4>
                        <p className="text-sm text-gray-500">房间号: {room.id}</p>
                      </div>
                      <Button
                        onClick={() => handleJoinAvailableRoom(room.id)}
                        disabled={!name.trim()}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        加入
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">暂无可用房间</p>
                  <p className="text-sm text-gray-400">创建一个新房间开始游戏吧!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 错误消息 */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed top-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-sm"
          >
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-white rounded-full"></div>
              <span className="text-sm">{error}</span>
            </div>
          </motion.div>
        )}

        {/* 成功消息 */}
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed top-4 right-4 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-sm"
          >
                          <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-white rounded-full"></div>
              <span className="text-sm">{success}</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
