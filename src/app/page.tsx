'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, ArrowRight, Lock, Key, Sun, Moon, ShieldCheck, Sparkles, UserCheck, LogOut, User, Trophy, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { validateUsername, validateRoomName } from '@/lib/utils';
import { useTheme } from '@/lib/useTheme';
import Footer from '@/components/Footer';

interface Room {
  id: string;
  name: string;
  hostUsername?: string;
  isPasswordProtected?: boolean;
  status: string;
  maxPlayers: number;
  createdAt: Date;
}

interface UserSession {
  id?: string | number;
  username: string;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
}

export default function HomePage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [useRoomPassword, setUseRoomPassword] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [customRoomId, setCustomRoomId] = useState('');
  const [useCustomRoomId, setUseCustomRoomId] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  // 实时从后端数据库获取最新战绩与胜率
  const refreshUserData = async (uname: string) => {
    if (!uname) return;
    try {
      const response = await fetch(`/api/auth/user?username=${encodeURIComponent(uname)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          const freshSession: UserSession = {
            id: data.user.id,
            username: data.user.username,
            totalGames: data.user.totalGames || 0,
            totalWins: data.user.totalWins || 0,
            totalLosses: data.user.totalLosses || 0,
          };
          setCurrentUser(freshSession);
          sessionStorage.setItem('davinci_user', JSON.stringify(freshSession));
        }
      }
    } catch (err) {
      console.error('从数据库实时同步用户战绩失败:', err);
    }
  };

  // Read saved user session and immediately refresh from DB on mount & window focus
  useEffect(() => {
    try {
      const savedUserStr = sessionStorage.getItem('davinci_user');
      if (savedUserStr) {
        const parsed: UserSession = JSON.parse(savedUserStr);
        if (parsed && parsed.username) {
          setCurrentUser(parsed);
          setName(parsed.username);
          refreshUserData(parsed.username);
        }
      }
    } catch (e) {
      console.error('读取用户缓存失败:', e);
    }

    const handleFocus = () => {
      const savedUserStr = sessionStorage.getItem('davinci_user');
      if (savedUserStr) {
        try {
          const parsed: UserSession = JSON.parse(savedUserStr);
          if (parsed && parsed.username) {
            refreshUserData(parsed.username);
          }
        } catch (e) {}
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Password Prompt Modal State
  const [selectedRoomForPassword, setSelectedRoomForPassword] = useState<Room | null>(null);
  const [modalPasswordInput, setModalPasswordInput] = useState('');

  // Handle Login / Registration
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUsername.trim() || !authPassword.trim()) {
      setError('用户名和密码不能为空');
      return;
    }
    if (authPassword.trim().length < 4) {
      setError('密码长度至少需要4个字符');
      return;
    }

    setIsAuthSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const endpoint = authTab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authUsername.trim(),
          password: authPassword.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        const userSession: UserSession = {
          id: data.user.id,
          username: data.user.username,
          totalGames: data.user.totalGames || 0,
          totalWins: data.user.totalWins || 0,
          totalLosses: data.user.totalLosses || 0,
        };
        setCurrentUser(userSession);
        setName(userSession.username);
        sessionStorage.setItem('davinci_user', JSON.stringify(userSession));
        setSuccess(authTab === 'login' ? `欢迎回来，${userSession.username}！` : `注册成功！欢迎加入，${userSession.username}！`);
        setAuthPassword('');
      } else {
        setError(data.error || '认证失败');
      }
    } catch (err) {
      console.error('认证错误:', err);
      setError('网络通信错误，请稍后重试');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('davinci_user');
    setCurrentUser(null);
    setName('');
    setSuccess('已成功退出登录');
  };

  // Fetch active rooms list & refresh user battle stats (supports silent background polling)
  const fetchAvailableRooms = async (isSilent = false) => {
    if (!isSilent && availableRooms.length === 0) {
      setIsLoadingRooms(true);
    }
    try {
      const response = await fetch('/api/rooms');
      if (response.ok) {
        const data = await response.json();
        setAvailableRooms(data.rooms || []);
      }

      // 循环同步刷新当前登录用户的最新战绩数据
      const savedUserStr = sessionStorage.getItem('davinci_user');
      if (savedUserStr) {
        try {
          const parsed = JSON.parse(savedUserStr);
          if (parsed?.username) {
            refreshUserData(parsed.username);
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error('获取房间列表失败:', err);
    } finally {
      if (!isSilent) {
        setIsLoadingRooms(false);
      }
    }
  };

  useEffect(() => {
    fetchAvailableRooms(false);
    const interval = setInterval(() => fetchAvailableRooms(true), 3000);
    return () => clearInterval(interval);
  }, []);

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

  // Handle Room Creation
  const handleCreateRoom = async () => {
    if (!currentUser || !currentUser.username) {
      setError('请先在上方注册或登录账号，登录后方可创建房间！');
      return;
    }

    if (!validateUsername(name)) {
      setError('用户名格式不正确（1-20个字符，支持中文、英文、数字、下划线）');
      return;
    }
    if (!validateRoomName(roomName)) {
      setError('房间名格式不正确（1-50个字符）');
      return;
    }

    if (useRoomPassword && !roomPassword.trim()) {
      setError('请输入房间密码或取消勾选密码设定');
      return;
    }

    if (useCustomRoomId && customRoomId.trim()) {
      if (customRoomId.length < 4 || customRoomId.length > 10) {
        setError('自定义房间号长度应为4-10个字符');
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
          username: currentUser.username,
          password: useRoomPassword ? roomPassword.trim() : undefined,
          customRoomId: useCustomRoomId ? customRoomId.trim() : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`房间创建成功！房间号: ${data.roomId}`);
        setRoomId(data.roomId);
        fetchAvailableRooms();
        setTimeout(() => {
          router.push(`/room/${data.roomId}?name=${encodeURIComponent(currentUser.username)}`);
        }, 1000);
      } else {
        setError(data.error || '创建房间失败');
      }
    } catch (err) {
      console.error('创建房间错误:', err);
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Direct Join by Room ID
  const handleJoinRoom = async (directPassword?: string) => {
    if (!currentUser || !currentUser.username) {
      setError('请先在上方注册或登录账号，登录后方可加入房间！');
      return;
    }

    if (!validateUsername(name)) {
      setError('用户名格式不正确（1-20个字符，支持中文、英文、数字、下划线）');
      return;
    }
    if (!roomId.trim() || roomId.trim().length < 4) {
      setError('房间号格式不正确（至少需要4个字符）');
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
          username: currentUser.username,
          password: directPassword || joinPassword || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('加入房间成功！');
        setTimeout(() => {
          router.push(`/room/${roomId}?name=${encodeURIComponent(currentUser.username)}`);
        }, 800);
      } else {
        setError(data.error || '加入房间失败，请检查房间号与密码');
      }
    } catch (err) {
      console.error('加入房间错误:', err);
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // Click Join on Available Rooms List Item
  const handleJoinAvailableRoomClick = (roomItem: Room) => {
    if (!currentUser || !currentUser.username) {
      setError('请先在上方注册或登录账号，登录后方可进入房间！');
      return;
    }

    const isHost = roomItem.hostUsername === currentUser.username;

    // 如果该房间是当前用户创建的（房主），免密码直接重返房间！
    if (roomItem.isPasswordProtected && !isHost) {
      setSelectedRoomForPassword(roomItem);
      setModalPasswordInput('');
    } else {
      executeJoinRoom(roomItem.id);
    }
  };

  // Submit Password in Modal
  const handleModalPasswordSubmit = async () => {
    if (!currentUser || !currentUser.username) {
      setError('请先在上方注册或登录账号，登录后方可进入房间！');
      return;
    }

    if (!selectedRoomForPassword) return;
    if (!modalPasswordInput.trim()) {
      setError('请输入房间密码');
      return;
    }

    await executeJoinRoom(selectedRoomForPassword.id, modalPasswordInput.trim());
    setSelectedRoomForPassword(null);
  };

  // Perform Join Request
  const executeJoinRoom = async (targetRoomId: string, pass?: string) => {
    if (!currentUser || !currentUser.username) {
      setError('请先在上方注册或登录账号，登录后方可进入房间！');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/rooms/${targetRoomId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: currentUser.username,
          password: pass || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('加入房间成功！');
        setTimeout(() => {
          router.push(`/room/${targetRoomId}?name=${encodeURIComponent(currentUser.username)}`);
        }, 800);
      } else {
        setError(data.error || '加入房间失败');
      }
    } catch (err) {
      console.error('加入房间错误:', err);
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200 p-4 sm:p-6 md:p-8 flex items-center">
      <div className="max-w-6xl mx-auto w-full">
        
        {/* Header Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-8">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-pulse" strokeWidth={2} />
            <h1 className="text-xl sm:text-3xl font-extrabold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              达芬奇密码 Davinci Code
            </h1>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto">
            {currentUser && (
              <div className="flex items-center space-x-2 sm:space-x-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 sm:px-3 py-1.5 rounded-xl shadow-sm max-w-full overflow-hidden">
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[70px] xs:max-w-[100px] sm:max-w-none">
                    {currentUser.username}
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1 whitespace-nowrap">
                    <span>{currentUser.totalGames}场对局</span>
                    <span>•</span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      胜率 {currentUser.totalGames > 0 ? Math.round((currentUser.totalWins / currentUser.totalGames) * 100) : 0}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1 border-l border-slate-200 dark:border-slate-800 pl-1.5 ml-1 shrink-0">
                  <Button
                    onClick={() => router.push('/stats')}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 h-7 px-1.5 font-semibold flex items-center shrink-0"
                    title="查看战绩明细与胜率排行榜"
                  >
                    <Trophy className="w-3.5 h-3.5 mr-1 text-amber-500" />
                    <span>战绩榜</span>
                  </Button>

                  <Button
                    onClick={handleLogout}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400 h-7 px-1.5 shrink-0"
                    title="退出登录"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <Button
              onClick={toggleTheme}
              variant="outline"
              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-sm rounded-xl active:scale-[0.96] transition-transform duration-100"
            >
              {theme === 'light' ? (
                <span className="flex items-center"><Moon className="w-4 h-4 mr-1.5" strokeWidth={2} /> 深色模式</span>
              ) : (
                <span className="flex items-center"><Sun className="w-4 h-4 mr-1.5 text-yellow-500" strokeWidth={2} /> 浅色模式</span>
              )}
            </Button>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="flex flex-col lg:flex-row gap-8 w-full">
          
          {/* Left Column (Auth or Create & Join Cards) */}
          <div className="flex-1 space-y-8">
            
            {!currentUser ? (
              <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 shadow-lg rounded-2xl p-2 sm:p-4">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center">
                      <ShieldCheck className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                      {authTab === 'login' ? '玩家账号登录' : '注册新玩家账号'}
                    </CardTitle>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                    {authTab === 'login' ? '输入您的用户名和密码登录游戏，永久保存您的个人战绩' : '创建新玩家账号，密码将加密安全保存'}
                  </p>
                  
                  {/* Auth Mode Toggle Tabs */}
                  <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl mt-4">
                    <button
                      type="button"
                      onClick={() => { setAuthTab('login'); setError(''); setSuccess(''); }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                        authTab === 'login'
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                      }`}
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>登录账号</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthTab('register'); setError(''); setSuccess(''); }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                        authTab === 'register'
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>注册账号</span>
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAuthSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                        用户名
                      </label>
                      <Input
                        type="text"
                        placeholder="1-20个字符 (支持中文/英文/数字/_)"
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                        密码 (加密保存)
                      </label>
                      <Input
                        type="password"
                        placeholder="至少4个字符"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isAuthSubmitting || !authUsername.trim() || !authPassword.trim()}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl active:scale-[0.96] transition-transform duration-100 shadow-md shadow-blue-500/10"
                    >
                      {isAuthSubmitting ? (authTab === 'login' ? '登录中...' : '注册中...') : (authTab === 'login' ? '立即登录' : '创建并登录账号')}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Create Room Card */}
                <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 shadow-md shadow-slate-200/50 dark:shadow-none rounded-2xl p-2 sm:p-4">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center">
                      <Plus className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                      创建新房间
                    </CardTitle>
                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                      创建一个全新的游戏房间，可设置房间密码防打扰
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                        你的名字
                      </label>
                      <Input
                        type="text"
                        value={name}
                        disabled
                        className="w-full bg-slate-100 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl cursor-not-allowed font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                        房间名称
                      </label>
                      <Input
                        type="text"
                        placeholder="输入房间名称"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl"
                      />
                    </div>
                    
                    {/* Room Password Checkbox & Option */}
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="useRoomPassword"
                          checked={useRoomPassword}
                          onChange={(e) => setUseRoomPassword(e.target.checked)}
                          className="w-4 h-4 text-blue-600 dark:text-blue-500 bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-800 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="useRoomPassword" className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center">
                          <Lock className="w-3.5 h-3.5 mr-1.5 text-amber-500" strokeWidth={2} />
                          加密房间 (需要密码才能进入)
                        </label>
                      </div>

                      <AnimatePresence initial={false}>
                        {useRoomPassword && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                            className="overflow-hidden p-1"
                          >
                            <div className="py-1">
                              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                                设置房间密码
                              </label>
                              <Input
                                type="password"
                                placeholder="设置进入密码"
                                value={roomPassword}
                                onChange={(e) => setRoomPassword(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Custom Room ID Toggle */}
                      <div className="flex items-center space-x-2 pt-2">
                        <input
                          type="checkbox"
                          id="useCustomRoomId"
                          checked={useCustomRoomId}
                          onChange={(e) => setUseCustomRoomId(e.target.checked)}
                          className="w-4 h-4 text-blue-600 dark:text-blue-500 bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-800 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="useCustomRoomId" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                          使用自定义房间号
                        </label>
                      </div>
                      
                      <AnimatePresence initial={false}>
                        {useCustomRoomId && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                            className="overflow-hidden p-1"
                          >
                            <div className="py-1">
                              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                                自定义房间号
                              </label>
                              <Input
                                type="text"
                                placeholder="输入4-10位字母数字组合"
                                value={customRoomId}
                                onChange={(e) => setCustomRoomId(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl"
                                maxLength={10}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <Button
                      onClick={handleCreateRoom}
                      disabled={isLoading || !name.trim() || !roomName.trim()}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl active:scale-[0.96] transition-transform duration-100 shadow-md shadow-blue-500/10"
                    >
                      {isLoading ? '创建中...' : '创建房间'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Join Room Card */}
                <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 shadow-md shadow-slate-200/50 dark:shadow-none rounded-2xl p-2 sm:p-4">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center">
                      <ArrowRight className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" strokeWidth={2.5} />
                      加入现有房间
                    </CardTitle>
                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                      直接输入朋友创建房间后获得的房间码加入对局
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                          房间号
                        </label>
                        <Input
                          type="text"
                          placeholder="输入房间号 (至少4位)"
                          value={roomId}
                          onChange={(e) => setRoomId(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-mono text-center tracking-wider rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                          密码 (如有)
                        </label>
                        <Input
                          type="password"
                          placeholder="无密码可留空"
                          value={joinPassword}
                          onChange={(e) => setJoinPassword(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-mono rounded-xl"
                        />
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => handleJoinRoom()}
                      disabled={isLoading || !name.trim() || !roomId.trim()}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl active:scale-[0.96] transition-transform duration-100 shadow-md shadow-indigo-500/10"
                    >
                      {isLoading ? '加入中...' : '加入房间'}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Right Column (Available Rooms List) */}
          <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 shadow-md shadow-slate-200/50 dark:shadow-none rounded-2xl p-2 sm:p-4 h-fit lg:w-96">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center">
                <Users className="w-5 h-5 mr-2 text-slate-600 dark:text-slate-400" strokeWidth={2} />
                可用房间
              </CardTitle>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                当前等待中、可直接加入的游戏房间
              </p>
            </CardHeader>
            <CardContent>
              {isLoadingRooms ? (
                <div className="text-center py-10">
                  <div className="w-8 h-8 border-2 border-slate-300 dark:border-slate-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-400 dark:text-slate-500 text-xs">加载列表数据中...</p>
                </div>
              ) : availableRooms.length > 0 ? (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {availableRooms.map((roomItem) => (
                    <div
                      key={roomItem.id}
                      className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800/80 hover:shadow-md transition-shadow duration-200"
                    >
                      <div className="pr-2 truncate">
                        <div className="flex items-center space-x-1.5">
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{roomItem.name}</h4>
                          {roomItem.isPasswordProtected && (
                            <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 p-1 rounded-md text-[10px] flex items-center" title="加密房间">
                              <Lock className="w-3 h-3" strokeWidth={2.5} />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">ID: #{roomItem.id}</p>
                      </div>
                      
                      <Button
                        onClick={() => handleJoinAvailableRoomClick(roomItem)}
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl active:scale-[0.96] transition-transform duration-100 flex items-center space-x-1"
                      >
                        {roomItem.isPasswordProtected ? <Key className="w-3.5 h-3.5 mr-1" strokeWidth={2} /> : null}
                        <span>加入</span>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" strokeWidth={1.5} />
                  <p className="text-slate-400 dark:text-slate-500 font-bold mb-1 text-sm">暂无活跃房间</p>
                  <p className="text-xs text-slate-400 dark:text-slate-600">填入昵称，创建一个新房间开始对局吧！</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Modal: Password Verification for Protected Rooms */}
        <AnimatePresence>
          {selectedRoomForPassword && (
            <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
              >
                <div className="flex items-center space-x-2 text-amber-500">
                  <ShieldCheck className="w-6 h-6" strokeWidth={2} />
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    该房间受到密码保护
                  </h3>
                </div>
                
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  您正在尝试加入房间 <span className="font-bold text-slate-800 dark:text-slate-200">“{selectedRoomForPassword.name}”</span> (# {selectedRoomForPassword.id})，请输入房主设置的进入密码：
                </p>

                <div>
                  <Input
                    type="password"
                    placeholder="输入房间密码"
                    value={modalPasswordInput}
                    onChange={(e) => setModalPasswordInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-mono rounded-xl"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleModalPasswordSubmit();
                      }
                    }}
                  />
                </div>

                <div className="flex space-x-3 pt-2">
                  <Button
                    onClick={() => setSelectedRoomForPassword(null)}
                    variant="outline"
                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl active:scale-[0.96] transition-transform duration-100"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleModalPasswordSubmit}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl active:scale-[0.96] transition-transform duration-100 shadow-md shadow-indigo-500/10"
                  >
                    确认验证加入
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Floating Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-4 right-4 bg-red-500 text-white px-4 py-3 rounded-xl shadow-2xl z-50 max-w-sm flex items-center space-x-2"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse flex-shrink-0"></div>
              <span className="text-xs sm:text-sm font-semibold">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Success Alert */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-4 right-4 bg-green-500 text-white px-4 py-3 rounded-xl shadow-2xl z-50 max-w-sm flex items-center space-x-2"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse flex-shrink-0"></div>
              <span className="text-xs sm:text-sm font-semibold">{success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Footer with Real-time Online Counter */}
        <Footer />

      </div>
    </div>
  );
}
