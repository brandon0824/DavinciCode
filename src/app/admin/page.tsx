'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  Users, 
  Activity, 
  RefreshCw, 
  ArrowLeft, 
  LogOut,
  Calendar,
  Clock,
  BarChart2,
  Sparkles,
  Sun,
  Moon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useTheme } from '@/lib/useTheme';
import Footer from '@/components/Footer';

interface AdminUserItem {
  id: number;
  username: string;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  isOnline: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState<{ username: string } | null>(null);
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Session check & Admin guard
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUserStr = sessionStorage.getItem('davinci_user');
      if (savedUserStr) {
        try {
          const parsed = JSON.parse(savedUserStr);
          if (parsed?.username) {
            setCurrentUser(parsed);
            if (parsed.username !== 'admin') {
              setError('权限不足：当前账号不是管理员 (admin)，无法浏览管理台。');
              setIsLoading(false);
              return;
            }
          } else {
            router.push('/');
            return;
          }
        } catch (e) {
          router.push('/');
          return;
        }
      } else {
        router.push('/');
        return;
      }
    }
    fetchAdminData();
  }, []);

  // 2. Fetch admin user data
  const fetchAdminData = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/users?adminUsername=admin');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
        setError(null);
      } else {
        const errData = await res.json();
        setError(errData.error || '获取全服用户数据失败');
      }
    } catch (e) {
      console.error(e);
      setError('网络连接故障，获取管理台数据失败');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('davinci_user');
    }
    router.push('/');
  };

  // Format date helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '暂无记录';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '暂无记录';
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Summary Metrics
  const totalUsers = usersList.length;
  const onlineUsers = usersList.filter(u => u.isOnline).length;
  const totalGamesPlayed = usersList.reduce((sum, u) => sum + u.totalGames, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="flex items-center space-x-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xl">
          <RefreshCw className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
          <span className="font-bold text-sm">加载管理员全服数据中...</span>
        </div>
      </div>
    );
  }

  if (error && currentUser?.username !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 p-8 rounded-3xl max-w-md w-full text-center shadow-xl space-y-4">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-950/60 rounded-2xl flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">访问未授权</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{error}</p>
          <Button onClick={() => router.push('/')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl py-2.5">
            返回游戏大厅
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Top Header */}
      <header className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 py-3.5 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => router.push('/')}
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 space-x-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden xs:inline">返回大厅</span>
            </Button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-base sm:text-xl font-black bg-gradient-to-r from-amber-600 to-yellow-600 dark:from-amber-400 dark:to-yellow-400 bg-clip-text text-transparent">
                全服管理员控制台
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <Button
              onClick={toggleTheme}
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-yellow-500" />}
            </Button>
            <Button
              onClick={fetchAdminData}
              disabled={isRefreshing}
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">刷新数据</span>
            </Button>
            <Button
              onClick={handleLogout}
              variant="destructive"
              size="sm"
              className="rounded-xl font-bold space-x-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">退出系统</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Banner Alert */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300 dark:border-amber-700/60 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                <span>当前管理员：<strong className="text-amber-600 dark:text-amber-400 font-black">admin</strong></span>
                <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700 font-bold">
                  超级权限
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                此页面为系统管理员专享控制台，实时监控全服所有用户的对战统计、在线状态、注册与最后活跃时间。
              </p>
            </div>
          </div>
        </motion.div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <Card className="bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-sm backdrop-blur-md">
            <CardContent className="p-5 flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">全服注册用户</p>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                  {totalUsers} <span className="text-xs font-normal text-slate-400">人</span>
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-sm backdrop-blur-md">
            <CardContent className="p-5 flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">实时在线用户 (15s心跳)</p>
                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center space-x-2">
                  <span>{onlineUsers}</span>
                  <span className="text-xs font-normal text-slate-400">人在线</span>
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-sm backdrop-blur-md">
            <CardContent className="p-5 flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <BarChart2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">全服累计对局场次</p>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                  {totalGamesPlayed} <span className="text-xs font-normal text-slate-400">人次</span>
                </h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Table & Mobile Card View */}
        <Card className="bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-lg backdrop-blur-md overflow-hidden">
          <CardHeader className="border-b border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 flex flex-row items-center justify-between">
            <CardTitle className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>全服所有用户明细表 ({usersList.length} 人)</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400">
                    <th className="py-3.5 px-6">序号</th>
                    <th className="py-3.5 px-6">用户名</th>
                    <th className="py-3.5 px-6">在线状态 (15s心跳)</th>
                    <th className="py-3.5 px-6">战绩 (胜/负/总)</th>
                    <th className="py-3.5 px-6">胜率</th>
                    <th className="py-3.5 px-6">注册时间</th>
                    <th className="py-3.5 px-6">最后在线时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs sm:text-sm">
                  {usersList.map((user, idx) => {
                    const isAdmin = user.username === 'admin';
                    return (
                      <tr key={user.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-6 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-4 px-6 font-bold text-slate-800 dark:text-slate-100">
                          <div className="flex items-center space-x-2">
                            <span>{user.username}</span>
                            {isAdmin && (
                              <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700 font-extrabold">
                                管理员
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          {user.isOnline ? (
                            <span className="inline-flex items-center space-x-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs px-2.5 py-1 rounded-full font-bold border border-emerald-300 dark:border-emerald-800">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span>在线</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs px-2.5 py-1 rounded-full font-medium border border-slate-200 dark:border-slate-800">
                              <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                              <span>离线</span>
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-mono">
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{user.totalWins}胜</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-red-500 font-bold">{user.totalLosses}负</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-slate-500 font-semibold">{user.totalGames}局</span>
                        </td>
                        <td className="py-4 px-6 font-extrabold">
                          <div className="flex items-center space-x-2">
                            <span className={user.winRate >= 50 ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-slate-600 dark:text-slate-300'}>
                              {user.winRate}%
                            </span>
                            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-amber-500"
                                style={{ width: `${Math.min(user.winRate, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(user.lastLoginAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Grid View (Responsive) */}
            <div className="block md:hidden p-4 space-y-4">
              {usersList.map((user, idx) => {
                const isAdmin = user.username === 'admin';
                return (
                  <div
                    key={user.id}
                    className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 space-y-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs text-slate-400 font-bold">#{idx + 1}</span>
                        <span className="font-extrabold text-base text-slate-800 dark:text-slate-100">{user.username}</span>
                        {isAdmin && (
                          <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 text-[9px] px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700 font-extrabold">
                            管理员
                          </span>
                        )}
                      </div>
                      {user.isOnline ? (
                        <span className="inline-flex items-center space-x-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-300 dark:border-emerald-800">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span>在线</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 bg-slate-200/60 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs px-2.5 py-0.5 rounded-full font-medium border border-slate-200 dark:border-slate-800">
                          <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                          <span>离线</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                        <span className="text-slate-400 block mb-0.5">对战统计</span>
                        <span className="font-extrabold text-slate-700 dark:text-slate-200">
                          {user.totalWins}胜 / {user.totalLosses}负 / {user.totalGames}局
                        </span>
                      </div>
                      <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                        <span className="text-slate-400 block mb-0.5">综合胜率</span>
                        <span className="font-extrabold text-amber-600 dark:text-amber-400 text-sm">
                          {user.winRate}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 pt-1 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>注册时间:</span>
                        </span>
                        <span>{formatDate(user.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>最后活跃:</span>
                        </span>
                        <span>{formatDate(user.lastLoginAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
