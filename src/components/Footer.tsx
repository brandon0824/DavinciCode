'use client';

import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';

interface FooterProps {
  initialCount?: number;
}

export default function Footer({ initialCount }: FooterProps) {
  const [onlineCount, setOnlineCount] = useState<number>(initialCount ?? 0);

  const fetchOnlineCount = async () => {
    try {
      let usernameQuery = '';
      if (typeof window !== 'undefined') {
        const savedUserStr = sessionStorage.getItem('davinci_user');
        if (savedUserStr) {
          try {
            const parsed = JSON.parse(savedUserStr);
            if (parsed?.username) {
              usernameQuery = `?username=${encodeURIComponent(parsed.username)}`;
            }
          } catch (e) {}
        }
      }

      const res = await fetch(`/api/online-count${usernameQuery}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.onlineCount === 'number') {
          setOnlineCount(data.onlineCount);
        }
      }
    } catch (e) {
      // silent fallback
    }
  };

  useEffect(() => {
    fetchOnlineCount();
    const interval = setInterval(fetchOnlineCount, 4000); // refresh count & heartbeat every 4s silently
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="w-full py-4 text-center text-xs text-slate-500 dark:text-slate-400 font-medium border-t border-slate-200/60 dark:border-slate-800/60 mt-auto bg-white/40 dark:bg-slate-950/40 backdrop-blur-sm shrink-0">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-2">
        <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 rounded-full shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            当前在线玩家：<strong className="text-blue-600 dark:text-blue-400 font-extrabold">{onlineCount}</strong> 人
          </span>
        </div>
        <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">•</span>
        <span className="text-slate-400 dark:text-slate-500">达芬奇密码 (DaVinci Code) 在线桌游</span>
      </div>
    </footer>
  );
}
