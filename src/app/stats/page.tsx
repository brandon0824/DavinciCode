'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Sun, Moon, Sparkles, User, Medal, Clock, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useTheme } from '@/lib/useTheme';

interface MatchHistoryItem {
  id: number;
  matchNumber: number;
  roomId: string;
  isWinner: boolean;
  winRateAtTime: number;
  startedAt: string;
  endedAt: string;
}

interface LeaderboardItem {
  username: string;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  rank: number;
}

export default function StatsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Read saved user session on mount
  useEffect(() => {
    let uname = '';
    try {
      const savedUserStr = sessionStorage.getItem('davinci_user');
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        if (parsed?.username) {
          uname = parsed.username;
          setCurrentUsername(parsed.username);
        }
      }
    } catch (e) {
      console.error('读取用户 session 失败:', e);
    }

    fetchStatsData(uname);
  }, []);

  const fetchStatsData = async (uname: string) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/stats?username=${encodeURIComponent(uname)}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
        setLeaderboard(data.leaderboard || []);
      } else {
        setError('获取战绩与排行榜失败');
      }
    } catch (err) {
      console.error('获取战绩出错:', err);
      setError('网络通信失败');
    } finally {
      setIsLoading(false);
    }
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200 p-4 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        
        {/* Header Toolbar */}
        <div className="flex flex-wrap gap-4 justify-between items-center">
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => router.push('/')}
              variant="outline"
              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-sm rounded-xl active:scale-[0.96] transition-transform duration-100"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              <span>返回大厅</span>
            </Button>
            <div className="flex items-center space-x-2">
              <Trophy className="w-6 h-6 text-amber-500 animate-bounce" strokeWidth={2} />
              <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 dark:from-amber-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                战绩数据与胜率排行榜
              </h1>
            </div>
          </div>

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

        {/* Content Section */}
        {isLoading ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">正在载入实时战绩与全服排行榜数据...</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Top Table: Personal Match History */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/60 pb-4">
                <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                    <span>个人对战历史明细</span>
                  </div>
                  {currentUsername && (
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                      当前玩家: <strong className="text-slate-800 dark:text-slate-200">{currentUsername}</strong>
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!currentUsername ? (
                  <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                    未检测到登录账号，登录后即可记录并展示个人每局历史对战数据。
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                    暂无已完成的对局记录，快去创建一个房间发起第一局比赛吧！
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="py-3.5 px-6 font-bold whitespace-nowrap">对战场次</th>
                          <th className="py-3.5 px-6 font-bold whitespace-nowrap">对战胜负</th>
                          <th className="py-3.5 px-6 font-bold whitespace-nowrap">对战胜率</th>
                          <th className="py-3.5 px-6 font-bold whitespace-nowrap">对战时间 (开赛时间)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300">
                        {history.map((item) => (
                          <motion.tr
                            key={item.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-4 px-6 font-mono font-bold text-slate-800 dark:text-slate-200">
                              第 {item.matchNumber} 场
                            </td>
                            <td className="py-4 px-6">
                              {item.isWinner ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                  胜利
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                                  <XCircle className="w-3.5 h-3.5 mr-1" />
                                  失败
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 font-mono font-bold text-amber-600 dark:text-amber-400">
                              {item.winRateAtTime}%
                            </td>
                            <td className="py-4 px-6 font-mono text-slate-500 dark:text-slate-400 text-xs">
                              {formatDate(item.startedAt)}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bottom Table: Global Leaderboard */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/60 pb-4">
                <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-amber-500" strokeWidth={2.5} />
                  <span>全服胜率排行榜</span>
                </CardTitle>
                <p className="text-slate-500 dark:text-slate-400 text-xs">
                  全服玩家按对战胜率从高到低进行排列，第一名独享金色尊贵外观
                </p>
              </CardHeader>
              <CardContent className="p-0">
                {leaderboard.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                    暂无玩家数据，成为全服第一个完成对局的大神吧！
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="py-3.5 px-6 font-bold w-16 whitespace-nowrap">排名</th>
                          <th className="py-3.5 px-6 font-bold whitespace-nowrap">用户名</th>
                          <th className="py-3.5 px-6 font-bold whitespace-nowrap">用户对战胜场次</th>
                          <th className="py-3.5 px-6 font-bold whitespace-nowrap">用户对战场次</th>
                          <th className="py-3.5 px-6 font-bold whitespace-nowrap">用户对战胜率</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {leaderboard.map((item) => {
                          const isRank1 = item.rank === 1;
                          const isSelf = currentUsername && item.username === currentUsername;

                          return (
                            <tr
                              key={item.username}
                              className={`transition-colors ${
                                isRank1
                                  ? 'bg-amber-100/90 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100 font-bold border-y-2 border-amber-300 dark:border-amber-700/80 shadow-inner'
                                  : isSelf
                                  ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-extrabold'
                                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <td className="py-4 px-6 font-mono font-bold">
                                {isRank1 ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-amber-950 font-black shadow-md">
                                    🥇 1
                                  </span>
                                ) : item.rank === 2 ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-800 font-black">
                                    🥈 2
                                  </span>
                                ) : item.rank === 3 ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-amber-100 font-black">
                                    🥉 3
                                  </span>
                                ) : (
                                  <span className="text-slate-500 dark:text-slate-400 ml-2">
                                    {item.rank}
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-6">
                                <span className={`flex items-center space-x-2 ${isSelf ? 'font-black text-blue-600 dark:text-blue-400 underline decoration-2 underline-offset-4' : ''}`}>
                                  <User className="w-4 h-4 text-slate-400" />
                                  <span>{item.username}</span>
                                  {isSelf && (
                                    <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">
                                      你自己
                                    </span>
                                  )}
                                  {isRank1 && (
                                    <span className="text-[10px] bg-amber-500 text-amber-950 px-2 py-0.5 rounded-full font-black shadow-sm">
                                      榜首领跑者 👑
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="py-4 px-6 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {item.totalWins} 胜
                              </td>
                              <td className="py-4 px-6 font-mono font-bold text-slate-600 dark:text-slate-400">
                                {item.totalGames} 场
                              </td>
                              <td className="py-4 px-6 font-mono font-extrabold text-amber-600 dark:text-amber-400 text-base">
                                {item.winRate}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}

      </div>
    </div>
  );
}
