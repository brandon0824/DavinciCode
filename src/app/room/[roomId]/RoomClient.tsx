'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, LogOut, Users, Crown, User, Send, AlertCircle, HelpCircle, Sun, Moon, Lock, Flag, Sparkles, Clock, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { GameData, Card as GameCard, sortCards, getCardDisplayValue } from '@/lib/gameLogic';
import { useTheme } from '@/lib/useTheme';
import Footer from '@/components/Footer';

interface Player {
  id: string;
  username: string;
  isHost: boolean;
}

interface Room {
  id: string;
  name: string;
  isPasswordProtected?: boolean;
  status: 'waiting' | 'playing' | 'settling' | 'finished' | 'closed';
  maxPlayers: number;
}

interface ChatMessage {
  username: string;
  message: string;
  timestamp: string;
}

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  let playerName = searchParams.get('name');
  if (!playerName && typeof window !== 'undefined') {
    try {
      const savedUserStr = sessionStorage.getItem('davinci_user');
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        if (parsed?.username) {
          playerName = parsed.username;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  const { roomId } = params;
  const { theme, toggleTheme } = useTheme();

  // Wait / Connection States
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [error, setError] = useState('');

  // Game Play States
  const [gameState, setGameState] = useState<(GameData & { chat?: ChatMessage[] }) | null>(null);
  const [guessTarget, setGuessTarget] = useState<{ username: string; cardId: string; cardIndex: number; color: 'black' | 'white' } | null>(null);
  const [guessValue, setGuessValue] = useState<string>('');
  const [surrenderModalOpen, setSurrenderModalOpen] = useState(false);
  const [hasAcknowledgedGameOver, setHasAcknowledgedGameOver] = useState(false);

  // Reset acknowledgment when a fresh game is playing
  useEffect(() => {
    if (room?.status === 'playing' && gameState && !gameState.winner && gameState.turnStatus !== 'ended') {
      setHasAcknowledgedGameOver(false);
    }
  }, [room?.status, gameState?.winner, gameState?.turnStatus]);
  
  // User Stats State
  const [userStats, setUserStats] = useState<{ totalGames: number; totalWins: number; totalLosses: number } | null>(null);

  // 30-second Turn Inaction Reminder States (Multiples of 30s: 30s, 60s, 90s...)
  const [turnSeconds, setTurnSeconds] = useState<number>(0);
  const [turnWarningMsg, setTurnWarningMsg] = useState<string>('');
  const lastTurnKeyRef = useRef<string>('');

  // Wildcard Joker (-) Repositioning State
  const [selectedJokerCard, setSelectedJokerCard] = useState<GameCard | null>(null);

  useEffect(() => {
    if (!guessTarget && !surrenderModalOpen && !selectedJokerCard) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setGuessTarget(null);
      setSurrenderModalOpen(false);
      setSelectedJokerCard(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [guessTarget, surrenderModalOpen, selectedJokerCard]);

  const submitJokerReposition = async (cardId: string, slotIndex: number) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reposition_joker',
          username: playerName,
          cardId,
          targetSlotIndex: slotIndex
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.gameState) {
          setGameState(data.gameState);
        }
      }
    } catch (e) {
      console.error('调整百搭牌位置失败:', e);
    } finally {
      setSelectedJokerCard(null);
    }
  };

  // Monitor current turn and trigger 30s / 60s / 90s warning notifications
  useEffect(() => {
    if (!gameState || room?.status !== 'playing') {
      setTurnSeconds(0);
      setTurnWarningMsg('');
      lastTurnKeyRef.current = '';
      return;
    }

    const isMyTurn = gameState.currentTurn === playerName;
    const currentTurnKey = `${gameState.currentTurn}_${gameState.turnStatus}_${gameState.winner || ''}`;

    // Reset timer when turn or turn status changes
    if (lastTurnKeyRef.current !== currentTurnKey) {
      lastTurnKeyRef.current = currentTurnKey;
      setTurnSeconds(0);
      setTurnWarningMsg('');
    }

    if (!isMyTurn || gameState.winner) {
      setTurnSeconds(0);
      setTurnWarningMsg('');
      return;
    }

    // 1-second interval timer when it's my turn
    const timer = setInterval(() => {
      setTurnSeconds(prev => {
        const next = prev + 1;
        // Trigger notification every 30 seconds (30s, 60s, 90s, 120s...)
        if (next > 0 && next % 30 === 0) {
          setTurnWarningMsg(`⏰ 您已思考超过 ${next} 秒，请尽快做出选择！`);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState?.currentTurn, gameState?.turnStatus, gameState?.winner, room?.status, playerName]);

  // Chat States
  const [chatMessage, setChatMessage] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Fetch current user battle stats for header display
  const fetchUserStats = async () => {
    if (!playerName) return;
    try {
      const res = await fetch(`/api/auth/user?username=${encodeURIComponent(playerName)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUserStats({
            totalGames: data.user.totalGames || 0,
            totalWins: data.user.totalWins || 0,
            totalLosses: data.user.totalLosses || 0,
          });
        }
      }
    } catch (e) {
      console.error('获取房间内用户战绩失败:', e);
    }
  };

  // Auto scroll inner chat container to bottom (without scrolling window)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [gameState?.chat?.length, gameState?.logs?.length]);

  // Main Data Polling Hook (1.5s interval to sync state with PostgreSQL db)
  useEffect(() => {
    if (!playerName) {
      setError('用户名不能为空');
      setIsLoading(false);
      return;
    }

    if (playerName === 'admin') {
      setError('管理员账号 (admin) 专用于全服数据管理，无加入房间与切局对战权限！');
      setIsLoading(false);
      return;
    }

    fetchSnapshot();
    let source: EventSource | undefined;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (document.hidden || source) return;
      source = new EventSource(`/api/rooms/${roomId}/events`);
      setIsLiveConnected(true);
      source.addEventListener('snapshot', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        setRoom(data.room); setPlayers(data.players || []);
        setCurrentPlayer((data.players || []).find((p: Player) => p.username === playerName) || null);
        setGameState(data.gameState || null);
        if (data.user) setUserStats({ totalGames: data.user.totalGames || 0, totalWins: data.user.totalWins || 0, totalLosses: data.user.totalLosses || 0 });
        setIsLoading(false);
      });
      source.onerror = () => { setIsLiveConnected(false); source?.close(); source = undefined; if (!document.hidden) reconnect = setTimeout(connect, 2000); };
    };
    const disconnect = () => { setIsLiveConnected(false); if (source) { source.close(); source = undefined; } if (reconnect) { clearTimeout(reconnect); reconnect = undefined; } };
    const onVisibility = () => document.hidden ? disconnect() : connect();
    document.addEventListener('visibilitychange', onVisibility);
    connect();
    return () => { disconnect(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [roomId, playerName]);

  // Fetch Room details and Players list
  const fetchRoomAndPlayers = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`);
      if (response.ok) {
        const data = await response.json();
        setRoom(data.room);
        setPlayers(data.players || []);
        
        const found = data.players?.find((p: Player) => p.username === playerName);
        if (found) {
          setCurrentPlayer(found);
        }
        setIsLoading(false);
      } else {
        setError('获取房间或玩家信息失败');
        setIsLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('连接服务器失败，请重试');
      setIsLoading(false);
    }
  };

  // Fetch current Game State
  const fetchGameState = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/game`);
      if (response.ok) {
        const data = await response.json();
        setGameState(data.gameState);
      }
    } catch (err) {
      console.error('获取游戏状态失败:', err);
    }
  };

  const fetchSnapshot = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/snapshot`);
      if (!response.ok) return;
      const data = await response.json();
      setRoom(data.room); setPlayers(data.players || []);
      setCurrentPlayer((data.players || []).find((p: Player) => p.username === playerName) || null);
      setGameState(data.gameState || null);
      if (data.user) setUserStats({ totalGames: data.user.totalGames || 0, totalWins: data.user.totalWins || 0, totalLosses: data.user.totalLosses || 0 });
      setIsLoading(false);
    } catch (error) { console.error('同步房间快照失败:', error); }
  };

  // HTTP API Call to Start Game
  const handleStartGame = async () => {
    if (!currentPlayer?.isHost) return;
    try {
      const response = await fetch(`/api/rooms/${roomId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: playerName }),
      });
      if (response.ok) {
        fetchRoomAndPlayers();
        fetchGameState();
      } else {
        setError('启动游戏失败');
      }
    } catch (err) {
      console.error(err);
      setError('网络故障，启动游戏失败');
    }
  };

  // HTTP API Call to Leave Room
  const handleLeaveRoom = async () => {
    try {
      await fetch(`/api/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: playerName }),
      });
    } catch (err) {
      console.error(err);
    }
    router.push('/');
  };

  // Post Game State updates to server
  const saveGameState = async (updatedState: any) => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: playerName, gameState: updatedState }),
      });
      if (response.ok) {
        const result = await response.json();
        setGameState({ ...updatedState, version: result.version ?? updatedState.version });
      } else {
        console.error('保存游戏状态失败');
      }
    } catch (err) {
      console.error('保存游戏状态发生网络错误:', err);
    }
  };

  const sendGameAction = async (action: string, payload: Record<string, unknown> = {}) => {
    const response = await fetch(`/api/rooms/${roomId}/game`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, username: playerName, actionId: crypto.randomUUID(), ...payload })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '游戏动作失败');
    if (result.gameState) setGameState(result.gameState);
    return result.gameState;
  };

  // Send Chat Message
  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !playerName || !gameState) return;

    setChatMessage('');
    try { await sendGameAction('chat', { message: chatMessage.trim() }); }
    catch (error) { setError(error instanceof Error ? error.message : '发送消息失败'); }
  };

  // --- GAME ACTIONS IMPLEMENTATION ---

  const getActivePlayers = (hands: { [username: string]: GameCard[] }) => {
    return Object.keys(hands).filter(user => 
      hands[user].some(card => !card.isRevealed)
    );
  };

  const getNextPlayer = (usernames: string[], current: string, hands: { [username: string]: GameCard[] }) => {
    const active = getActivePlayers(hands);
    if (active.length <= 1) return current;
    const index = usernames.indexOf(current);
    for (let i = 1; i <= usernames.length; i++) {
      const nextUser = usernames[(index + i) % usernames.length];
      if (active.includes(nextUser)) {
        return nextUser;
      }
    }
    return current;
  };

  // 1. Draw a Card
  const drawCard = async (color: 'black' | 'white') => {
    if (!gameState || !playerName || gameState.currentTurn !== playerName || gameState.turnStatus !== 'drawing') return;
    try {
      const updated = await sendGameAction('draw', { color });
      const card = updated?.lastDrawnCard;
      if (card?.value === -1) setSelectedJokerCard(card);
    } catch (error) { setError(error instanceof Error ? error.message : '摸牌失败'); }
  };

  // 2. Submit Guess
  const submitGuess = async () => {
    if (!gameState || !playerName || !guessTarget || guessValue === '') return;

    const serverGuess = guessValue === '-' ? -1 : parseInt(guessValue, 10);
    try {
      await sendGameAction('guess', { targetUsername: guessTarget.username, cardId: guessTarget.cardId, guessValue: serverGuess });
      setGuessTarget(null); setGuessValue('');
    } catch (error) { setError(error instanceof Error ? error.message : '猜牌失败'); }
    return;

    /* Legacy client-side guess calculation retained only as historical reference; server is authoritative.
    const targetUser = guessTarget!.username;
    const cardIdx = guessTarget!.cardIndex;
    const guessVal = guessValue === '-' ? -1 : parseInt(guessValue, 10);

    const updatedHands = JSON.parse(JSON.stringify(gameState.hands));
    const targetCard: GameCard = updatedHands[targetUser][cardIdx];

    const isCorrect = targetCard.value === guessVal;
    let newLogs = [...gameState.logs];

    let nextTurn = gameState.currentTurn;
    let nextStatus = gameState.turnStatus;
    let winner = gameState.winner;
    let lastDrawn = gameState.lastDrawnCard;

    const displayValStr = guessVal === -1 ? '任意百搭牌 [-]' : `[${guessVal}]`;

    if (isCorrect) {
      targetCard.isRevealed = true;
      updatedHands[targetUser][cardIdx] = targetCard;
      newLogs.push(`${playerName} 猜对了 ${targetUser} 的第 ${cardIdx + 1} 张牌，数值确实是 ${displayValStr}！`);

      const activePlayers = getActivePlayers(updatedHands);
      if (activePlayers.length === 1) {
        winner = playerName;
        nextStatus = 'ended';
        newLogs.push(`🎉 恭喜 ${playerName} 击败了所有对手，获得了最后的胜利！`);
      } else {
        nextStatus = 'guessing_again';
        lastDrawn = null; 
      }
    } else {
      newLogs.push(`${playerName} 猜测 ${targetUser} 的牌是 ${displayValStr}，但是猜错了！`);
      
      if (lastDrawn) {
        const myHand: GameCard[] = updatedHands[playerName];
        const drawnInHandIdx = myHand.findIndex(c => c.id === lastDrawn!.id);
        if (drawnInHandIdx !== -1) {
          myHand[drawnInHandIdx].isRevealed = true;
          const drawnValStr = lastDrawn.value === -1 ? '任意百搭牌 [-]' : `[${lastDrawn.value}]`;
          newLogs.push(`${playerName} 必须公开自己本轮摸的牌 ${drawnValStr}。`);
        }
      } else {
        const myHand: GameCard[] = updatedHands[playerName];
        const unrevealedIdx = myHand.findIndex(c => !c.isRevealed);
        if (unrevealedIdx !== -1) {
          myHand[unrevealedIdx].isRevealed = true;
          const penaltyValStr = myHand[unrevealedIdx].value === -1 ? '任意百搭牌 [-]' : `[${myHand[unrevealedIdx].value}]`;
          newLogs.push(`${playerName} 惩罚性公开了自己的第 ${unrevealedIdx + 1} 张牌：${penaltyValStr}。`);
        }
      }

      const activePlayers = getActivePlayers(updatedHands);
      if (activePlayers.length === 1) {
        winner = activePlayers[0];
        nextStatus = 'ended';
        newLogs.push(`🎉 ${playerName} 在猜测失败后所有手牌被公开，出局！胜利者为 ${winner}`);
      } else {
        nextTurn = getNextPlayer(players.map(p => p.username), playerName, updatedHands);
        nextStatus = 'drawing';
        lastDrawn = null;
        newLogs.push(`回合结束。现在是 ${nextTurn} 的回合。`);
      }
    }

    const updatedGameState = {
      ...gameState,
      hands: updatedHands,
      currentTurn: nextTurn,
      turnStatus: nextStatus,
      lastDrawnCard: lastDrawn,
      winner,
      logs: newLogs
    };

    setGuessTarget(null);
    setGuessValue('');

    await saveGameState(updatedGameState);
  };

    */
  };
  // 3. Pass Turn
  const passTurn = async () => {
    if (!gameState || !playerName || gameState.currentTurn !== playerName || gameState.turnStatus !== 'guessing_again') return;

    try { await sendGameAction('pass'); } catch (error) { setError(error instanceof Error ? error.message : '跳过回合失败'); }
    return;

    /* Legacy client-side pass calculation retained only as historical reference.
    const nextPlayer = getNextPlayer(players.map(p => p.username), playerName, gameState.hands);
    const newLogs = [...gameState.logs, `${playerName} 选择结束猜测，跳过回合。现在是 ${nextPlayer} 的回合。`];

    const updatedGameState = {
      ...gameState,
      currentTurn: nextPlayer,
      turnStatus: 'drawing' as const,
      lastDrawnCard: null,
      logs: newLogs
    };

    await saveGameState(updatedGameState);
  };

    */
  };
  // 4. Surrender Match
  const handleSurrender = async () => {
    if (!gameState || !playerName || room?.status !== 'playing') return;

    try { await sendGameAction('surrender'); setSurrenderModalOpen(false); } catch (error) { setError(error instanceof Error ? error.message : '认输失败'); }
    return;

    /* Legacy client-side surrender calculation retained only as historical reference.
    const updatedHands = JSON.parse(JSON.stringify(gameState.hands));
    const myHand: GameCard[] = updatedHands[playerName] || [];

    // Reveal all cards of the surrendering player
    myHand.forEach(card => {
      card.isRevealed = true;
    });

    let newLogs = [...gameState.logs, `🏳️ 玩家 ${playerName} 选择主动认输，手牌已全部公开！`];
    let nextTurn = gameState.currentTurn;
    let nextStatus = gameState.turnStatus;
    let winner = gameState.winner;
    let lastDrawn = gameState.lastDrawnCard;

    const activePlayers = getActivePlayers(updatedHands);
    if (activePlayers.length === 1) {
      winner = activePlayers[0];
      nextStatus = 'ended';
      newLogs.push(`🎉 恭喜 ${winner} 获得了最后的胜利！`);
    } else if (gameState.currentTurn === playerName) {
      nextTurn = getNextPlayer(players.map(p => p.username), playerName, updatedHands);
      nextStatus = 'drawing';
      lastDrawn = null;
      newLogs.push(`由于 ${playerName} 认输，回合切换至 ${nextTurn}。`);
    }

    const updatedGameState = {
      ...gameState,
      hands: updatedHands,
      currentTurn: nextTurn,
      turnStatus: nextStatus,
      lastDrawnCard: lastDrawn,
      winner,
      logs: newLogs
    };

    setSurrenderModalOpen(false);
    await saveGameState(updatedGameState);
    */
  };

  // --- RENDER PARTS ---

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-800 dark:text-slate-200">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-medium">正在加载房间与对局状态...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-4">
          <CardHeader>
            <CardTitle className="text-red-500 flex items-center">
              <AlertCircle className="w-6 h-6 mr-2" strokeWidth={2} /> 发生错误
            </CardTitle>
          </CardHeader>
          <CardContent>
          <p role="alert" aria-live="assertive" className="text-slate-600 dark:text-slate-300 mb-6">{error}</p>
            <div className="flex gap-3">
              <Button onClick={() => router.push('/')} className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl active:scale-[0.96] transition-transform duration-100">返回大厅</Button>
              <Button variant="outline" onClick={() => window.location.reload()} className="flex-1 rounded-xl active:scale-[0.96] transition-transform duration-100">重试</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // GAME BOARD COMPONENT (Renders during active play OR when game over modal is active prior to acknowledgment)
  const isGameOver = Boolean(gameState && (gameState.winner || gameState.turnStatus === 'ended'));
  const shouldShowGameBoard = Boolean(gameState && gameState.hands && (room?.status === 'playing' || (isGameOver && !hasAcknowledgedGameOver)));

  if (shouldShowGameBoard && gameState && gameState.hands) {
    const isMyTurn = gameState.currentTurn === playerName;
    const myHand = gameState.hands[playerName!] || [];
    const opponents = players.filter(p => p.username !== playerName);

    const blackLeft = gameState.deck.filter(c => c.color === 'black').length;
    const whiteLeft = gameState.deck.filter(c => c.color === 'white').length;

    const isEliminated = (user: string) => {
      const hand = gameState.hands[user] || [];
      return hand.length > 0 && hand.every(card => card.isRevealed);
    };

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-200">
        
        {/* Game Header */}
        <header className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 py-2.5 sm:py-3.5 px-3 sm:px-6 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            
            {/* Left: Title & Room Code */}
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              <div aria-live="polite" className={`text-[11px] px-2 py-1 rounded-lg border ${isLiveConnected ? 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30' : 'text-amber-700 border-amber-200 bg-amber-50 dark:bg-amber-950/30'}`}>
                {isLiveConnected ? '实时同步' : '正在重连'}
              </div>
              <span className="text-base sm:text-xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-500 bg-clip-text text-transparent">
                达芬奇密码 <span className="hidden xs:inline">Davinci Code</span>
              </span>
              <div className="flex items-center space-x-1">
                <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-xs font-mono border border-slate-300 dark:border-slate-700 whitespace-nowrap">
                  #{roomId}
                </span>
                {room?.isPasswordProtected && (
                  <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 p-1 rounded-full text-[10px]" title="加密房间">
                    <Lock className="w-3 h-3" strokeWidth={2.5} />
                  </span>
                )}
              </div>
            </div>
            
            {/* Right: Actions & Current Turn */}
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              {/* User Battle Stats Display (Read-Only) */}
              {userStats && (
                <div className="hidden md:flex items-center space-x-1.5 whitespace-nowrap bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-xl text-xs shadow-sm">
                  <span className="text-slate-600 dark:text-slate-300 font-semibold">{userStats.totalGames}场</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                    胜率{userStats.totalGames > 0 ? Math.round((userStats.totalWins / userStats.totalGames) * 100) : 0}%
                  </span>
                </div>
              )}

              <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap bg-slate-100 dark:bg-slate-800/60 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700/80">
                回合: <span className="font-extrabold text-blue-600 dark:text-blue-400">{gameState.currentTurn}</span>
              </div>
              
              {/* Theme Toggle Button */}
              <Button
                onClick={toggleTheme}
                variant="outline"
                size="icon"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 h-8 w-8 rounded-xl active:scale-[0.96] transition-transform duration-100 shrink-0"
              >
                {theme === 'light' ? <Moon className="w-4 h-4" strokeWidth={2} /> : <Sun className="w-4 h-4 text-yellow-500" strokeWidth={2} />}
              </Button>

              <Button
                size="sm"
                onClick={() => setSurrenderModalOpen(true)}
                disabled={isEliminated(playerName!)}
                className="bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900/50 dark:hover:bg-amber-900/40 text-xs px-2.5 py-1 sm:px-3 rounded-xl active:scale-[0.96] transition-transform duration-100 disabled:opacity-50 shrink-0"
              >
                <Flag className="w-3.5 h-3.5 mr-1" strokeWidth={2} /> 认输
              </Button>

              <Button
                size="sm"
                onClick={handleLeaveRoom}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs px-2.5 py-1 sm:px-3 rounded-xl active:scale-[0.96] transition-transform duration-100 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" strokeWidth={2} /> 退出
              </Button>
            </div>
          </div>
        </header>

        {/* 30s Multiples Timeout Warning Toast Banner */}
        <AnimatePresence>
          {turnWarningMsg && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-amber-950 font-black text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-2xl border-2 border-amber-300 flex items-center space-x-2"
            >
              <Clock className="w-4 h-4 fill-amber-950/20" strokeWidth={2.5} />
              <span>{turnWarningMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Board Main Area */}
        <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Game Play Area (Left 3 columns) */}
          <div className="lg:col-span-3 flex flex-col space-y-6">
            
            {/* Status Warning Banner */}
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
              isMyTurn 
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-200' 
                : 'bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${isMyTurn ? 'bg-blue-500 dark:bg-blue-400 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'}`}></div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    {isMyTurn ? '您的回合！' : `正在等待玩家 ${gameState.currentTurn}...`}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {gameState.turnStatus === 'drawing' && '请从中间摸取一张黑牌或白牌开始你的回合。'}
                    {gameState.turnStatus === 'guessing' && '点击下方任意对手的一张暗牌，猜它上面的数字。'}
                    {gameState.turnStatus === 'guessing_again' && '刚才猜测正确！你可以继续点对手的牌进行猜测，或者跳过回合。'}
                    {gameState.turnStatus === 'ended' && `对局已结束，获胜者为 ${gameState.winner}！`}
                  </p>
                  {isMyTurn && turnSeconds >= 30 && (
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      您已思考超过 {Math.floor(turnSeconds / 30) * 30} 秒，请尽快做出选择！
                    </div>
                  )}
                </div>
              </div>
              {isMyTurn && gameState.turnStatus === 'guessing_again' && (
                <Button onClick={passTurn} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-1.5 px-4 font-bold rounded-xl active:scale-[0.96] transition-transform duration-100 self-end sm:self-auto">
                  结束并跳过回合
                </Button>
              )}
            </div>

            {/* Opponents Area */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">对手的手牌</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {opponents.map((opponent) => {
                  const oppHand = gameState.hands[opponent.username] || [];
                  const oppEliminated = isEliminated(opponent.username);
                  
                  return (
                    <Card key={opponent.username} className={`bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm ${
                      oppEliminated ? 'opacity-50 grayscale' : ''
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-bold text-sm flex items-center text-slate-700 dark:text-slate-200">
                            <User className="w-4 h-4 mr-1 text-slate-400" strokeWidth={2} />
                            {opponent.username}
                          </span>
                          {oppEliminated ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-full">
                              已出局
                            </span>
                          ) : opponent.username === gameState.currentTurn ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 rounded-full">
                              思考中
                            </span>
                          ) : null}
                        </div>

                        {/* Cards Row */}
                        <div className="flex flex-wrap gap-2 sm:gap-2.5">
                          {oppHand.map((card, idx) => {
                            const showGuessAction = isMyTurn && !oppEliminated && !card.isRevealed && 
                              (gameState.turnStatus === 'guessing' || gameState.turnStatus === 'guessing_again');
                              
                            return (
                              <div
                                key={card.id}
                                role="button"
                                tabIndex={showGuessAction ? 0 : -1}
                                aria-label={`${opponent.username} 的${idx + 1}号牌${card.isRevealed ? `，${getCardDisplayValue(card.value)}` : '，暗牌'}`}
                                onClick={() => {
                                  if (showGuessAction) {
                                    setGuessTarget({
                                      username: opponent.username,
                                      cardId: card.id,
                                      cardIndex: idx,
                                      color: card.color
                                    });
                                  }
                                }}
                                onKeyDown={(event) => {
                                  if (showGuessAction && (event.key === 'Enter' || event.key === ' ')) {
                                    event.preventDefault();
                                    setGuessTarget({ username: opponent.username, cardId: card.id, cardIndex: idx, color: card.color });
                                  }
                                }}
                                className={`relative w-14 h-20 sm:w-16 sm:h-24 rounded-xl flex flex-col items-center justify-center font-extrabold cursor-pointer border transition-transform duration-100 active:scale-[0.96] shadow-sm ${
                                  card.isRevealed
                                    ? card.color === 'black'
                                      ? 'bg-slate-950 border-slate-800 text-white'
                                      : 'bg-white border-slate-300 text-slate-900'
                                    : card.color === 'black'
                                      ? 'bg-slate-950 border-2 border-slate-800 text-white shadow-md'
                                      : 'bg-white border-2 border-slate-300 text-slate-950 shadow-md'
                                } ${showGuessAction ? 'hover:scale-105 hover:border-cyan-500 shadow-md ring-2 ring-cyan-500/50' : ''}`}
                              >
                                {card.isRevealed ? (
                                  <span className={`text-2xl sm:text-3xl font-black ${card.value === -1 ? 'text-amber-400 dark:text-amber-300' : ''}`}>
                                    {getCardDisplayValue(card.value)}
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-center justify-center p-1 text-center">
                                    <HelpCircle className={`w-5 h-5 sm:w-6 sm:h-6 ${card.color === 'black' ? 'text-slate-400' : 'text-slate-500'}`} strokeWidth={2.5} />
                                    {showGuessAction && (
                                      <span className="text-[9px] text-cyan-500 font-black tracking-wider mt-0.5 leading-none">
                                        猜测
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Draw Decks */}
            <div className="bg-slate-100/50 dark:bg-slate-900/25 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-3">摸牌面板</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Black Deck */}
                <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="block text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">黑色牌堆</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-white mt-0.5 block">剩余 {blackLeft} 张</span>
                  </div>
                  <Button
                    onClick={() => drawCard('black')}
                    disabled={!isMyTurn || gameState.turnStatus !== 'drawing' || blackLeft === 0}
                    className="bg-slate-950 hover:bg-slate-900 text-white border border-slate-800 px-4 font-bold rounded-xl active:scale-[0.96] transition-transform duration-100"
                  >
                    摸取
                  </Button>
                </div>

                {/* White Deck */}
                <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="block text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">白色牌堆</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-white mt-0.5 block">剩余 {whiteLeft} 张</span>
                  </div>
                  <Button
                    onClick={() => drawCard('white')}
                    disabled={!isMyTurn || gameState.turnStatus !== 'drawing' || whiteLeft === 0}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-white dark:hover:bg-slate-100 text-slate-950 px-4 font-bold border border-slate-200 rounded-xl active:scale-[0.96] transition-transform duration-100"
                  >
                    摸取
                  </Button>
                </div>
              </div>
            </div>

            {/* My Hand */}
            <div className={`p-4 sm:p-5 rounded-2xl border transition-colors duration-200 shadow-sm ${
              isEliminated(playerName!)
                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30'
                : 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
            }`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase flex items-center">
                  <User className="w-4 h-4 mr-1.5 text-blue-600 dark:text-blue-400" strokeWidth={2} />
                  我的手牌 ({playerName})
                </h3>
                {isEliminated(playerName!) && (
                  <span className="text-red-600 dark:text-red-400 text-[10px] font-bold bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 px-3 py-0.5 rounded-full">
                    您已出局（手牌已被强制公开）
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {myHand.map((card) => {
                  const isNew = gameState.lastDrawnCard?.id === card.id;
                  
                  return (
                    <div
                      key={card.id}
                      className={`relative w-14 h-20 sm:w-16 sm:h-24 rounded-xl flex flex-col items-center justify-center font-black border transition-transform duration-100 shadow-sm ${
                        card.isRevealed
                          ? 'opacity-65 scale-95 line-through'
                          : ''
                      } ${
                        card.color === 'black'
                          ? 'bg-slate-950 border-slate-800 text-white'
                          : 'bg-white border-slate-300 text-slate-950'
                      } ${isNew ? 'ring-4 ring-cyan-500 scale-105 shadow-md shadow-cyan-500/20' : ''}`}
                    >
                      {isNew && (
                        <span className="absolute -top-2 bg-cyan-500 text-slate-950 text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          新摸
                        </span>
                      )}
                      
                      {card.value === -1 && !isNew && (
                        <span className="absolute -top-2 bg-amber-400 text-amber-950 text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider shadow-sm">
                          百搭
                        </span>
                      )}

                      <span className={`text-2xl sm:text-3xl font-black ${card.value === -1 ? 'text-amber-400 dark:text-amber-300' : ''}`}>
                        {getCardDisplayValue(card.value)}
                      </span>
                      
                      {card.isRevealed ? (
                        <div className="absolute -bottom-2 bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 text-[8px] px-1.5 py-0.5 rounded-full font-bold border border-red-200 dark:border-red-900/50">
                          公开
                        </div>
                      ) : card.value === -1 && (
                        <button
                          type="button"
                          onClick={() => setSelectedJokerCard(card)}
                          className="absolute -bottom-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider shadow-sm flex items-center space-x-0.5 active:scale-[0.96] transition-transform z-10"
                          title="点击微调此百搭牌在手牌中的插入位置"
                        >
                          <span>⇄ 位置</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Activity Logs & Chat Panel */}
          <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-4 flex flex-col h-[480px] lg:h-auto overflow-hidden shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-300 mb-3 tracking-wider uppercase pb-2 border-b border-slate-200 dark:border-slate-800">
              战局日志 & 房间聊天
            </h3>

            {/* Logs & Messages Box */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4 scrollbar-thin">
              {gameState.logs.map((log, index) => (
                <div key={`log-${index}`} className="text-[11px] bg-slate-100 dark:bg-slate-950/50 text-slate-600 dark:text-slate-300 border-l-2 border-indigo-500 p-2 rounded-r-lg font-mono">
                  {log}
                </div>
              ))}

              {(gameState.chat || []).map((chat, idx) => (
                <div key={`chat-${idx}`} className={`text-xs p-2.5 rounded-xl max-w-[85%] shadow-sm ${
                  chat.username === playerName
                    ? 'bg-blue-600 text-white ml-auto'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300'
                }`}>
                  <span className={`block text-[9px] mb-0.5 font-bold ${
                    chat.username === playerName ? 'text-blue-200' : 'text-slate-400'
                  }`}>
                    {chat.username}
                  </span>
                  <p className="break-all">{chat.message}</p>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={sendChatMessage} className="flex space-x-2">
              <Input
                type="text"
                placeholder="在此输入聊天..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-xl"
              />
              <Button type="submit" size="icon" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-9 w-9 active:scale-[0.96] transition-transform duration-100">
                <Send className="w-3.5 h-3.5" strokeWidth={2} />
              </Button>
            </form>
          </div>

        </div>

        {/* Modal Guessing Dialog */}
        <AnimatePresence>
          {guessTarget && (
            <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
              >
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 mr-2 animate-ping"></span>
                  猜测 {guessTarget.username} 的牌
                </h3>
                {turnSeconds >= 30 && (
                  <div className="mb-3 p-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/80 rounded-2xl text-xs font-extrabold text-amber-900 dark:text-amber-200 flex items-center justify-center space-x-1.5">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span>⏰ 您已思考超过 {Math.floor(turnSeconds / 30) * 30} 秒，请尽快做出选择！</span>
                  </div>
                )}
                <p className="text-slate-500 dark:text-slate-400 mb-4 text-xs leading-relaxed">
                  猜测其从左数第 <span className="text-cyan-600 dark:text-cyan-400 font-extrabold">{guessTarget.cardIndex + 1}</span> 张 {guessTarget.color === 'black' ? '黑色' : '白色'} 牌的数值（数字 0-11 或任意百搭牌 [-]）：
                </p>
                
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-6">
                  {Array.from({ length: 12 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setGuessValue(i.toString())}
                      className={`py-2.5 rounded-xl font-black border transition-transform duration-100 active:scale-[0.96] text-base ${
                        guessValue === i.toString()
                          ? 'bg-cyan-500 text-slate-950 border-cyan-500 shadow-md scale-105 font-black'
                          : 'bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {i}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setGuessValue('-')}
                    className={`py-2.5 rounded-xl font-black border transition-transform duration-100 active:scale-[0.96] text-sm col-span-4 sm:col-span-3 ${
                      guessValue === '-'
                        ? 'bg-amber-400 text-amber-950 border-amber-400 shadow-md scale-105 font-black'
                        : 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-200'
                    }`}
                  >
                    - (任意百搭牌)
                  </button>
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    onClick={() => {
                      setGuessTarget(null);
                      setGuessValue('');
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 border dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl active:scale-[0.96] transition-transform duration-100"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={submitGuess}
                    disabled={guessValue === ''}
                    className="flex-1 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-black disabled:opacity-50 rounded-xl active:scale-[0.96] transition-transform duration-100 shadow-md shadow-cyan-500/10"
                  >
                    确认猜测
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Surrender Confirmation */}
        <AnimatePresence>
          {surrenderModalOpen && (
            <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
              >
                <div className="flex items-center space-x-2 text-amber-500">
                  <Flag className="w-6 h-6" strokeWidth={2} />
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    确认认输？
                  </h3>
                </div>
                
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  选择认输后，您的所有手牌将被强制公开，本局游戏您将被判定出局，但您可以继续留在房间内观战。
                </p>

                <div className="flex space-x-3 pt-2">
                  <Button
                    onClick={() => setSurrenderModalOpen(false)}
                    variant="outline"
                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl active:scale-[0.96] transition-transform duration-100"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleSurrender}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl active:scale-[0.96] transition-transform duration-100 shadow-md shadow-amber-500/10"
                  >
                    确认认输
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Game Over Victory / Settlement Dialog */}
        <AnimatePresence>
          {isGameOver && !hasAcknowledgedGameOver && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 20 }}
                transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
                className="bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-500/60 text-slate-800 dark:text-white rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl text-center space-y-4"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-amber-950 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
                  <Trophy className="w-8 h-8" strokeWidth={2.5} />
                </div>
                
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                    {gameState.winner === playerName ? '🎉 恭喜您获得最终胜利！' : '🎉 游戏对局已结束！'}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 font-medium">
                    {gameState.winner === playerName 
                      ? '您成功击败或等候其他所有对手出局，独占鳌头！'
                      : `本局最终获胜玩家为：【${gameState.winner || '未知'}】`}
                  </p>
                </div>

                {/* All Players Final Hands Display */}
                <div className="bg-slate-50 dark:bg-slate-950/80 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-left space-y-2.5">
                  <div className="font-bold text-slate-700 dark:text-slate-300 text-xs flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span>📋 各玩家手牌明细 (已全量公开)</span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {Object.entries(gameState.hands).map(([uname, hand]) => {
                      const isWinnerPlayer = uname === gameState.winner;
                      return (
                        <div key={uname} className="flex flex-wrap items-center justify-between gap-1.5 py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                            <span>{uname}</span>
                            {isWinnerPlayer && (
                              <span className="text-amber-600 dark:text-amber-400 font-black text-[10px] bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-md">
                                🏆 获胜
                              </span>
                            )}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {hand.map((card, idx) => (
                              <div
                                key={card.id || idx}
                                className={`w-7 h-9 rounded-md flex items-center justify-center font-black text-xs border shadow-sm ${
                                  card.color === 'black'
                                    ? 'bg-slate-950 text-white border-slate-800'
                                    : 'bg-white text-slate-950 border-slate-300'
                                } ${card.value === -1 ? 'text-amber-400 dark:text-amber-300' : ''}`}
                              >
                                {getCardDisplayValue(card.value)}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Log summary */}
                <div className="bg-slate-100 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-mono text-left max-h-24 overflow-y-auto">
                  {gameState.logs.slice(-3).map((log, i) => (
                    <div key={i} className="text-slate-600 dark:text-slate-300 py-0.5">• {log}</div>
                  ))}
                </div>

                <Button
                  onClick={() => {
                    setHasAcknowledgedGameOver(true);
                    fetchRoomAndPlayers();
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-extrabold text-sm sm:text-base py-3 rounded-2xl shadow-lg shadow-amber-500/20 active:scale-[0.96] transition-transform duration-100"
                >
                  返回房间待命 (准备下一局)
                </Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Joker Reposition Dialog */}
        <AnimatePresence>
          {selectedJokerCard && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                className="bg-white dark:bg-slate-900 border-2 border-amber-400/80 dark:border-amber-500/80 text-slate-800 dark:text-slate-100 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
              >
                <div className="flex items-center space-x-3 text-amber-500">
                  <Sparkles className="w-6 h-6" />
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                    任意百搭牌【-】插牌位置设定
                  </h3>
                </div>
                
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  按照《达芬奇密码》官方规则，抽到或持有的百搭牌可以插入到您手牌中的<strong className="text-amber-600 dark:text-amber-400 font-black">任意位置</strong>（以此混淆对手猜测）：
                </p>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {Array.from({ length: (gameState?.hands[playerName!] || []).length }, (_, slotIdx) => (
                    <button
                      key={slotIdx}
                      type="button"
                      onClick={() => submitJokerReposition(selectedJokerCard.id, slotIdx)}
                      className="p-3 rounded-2xl border-2 font-bold text-xs flex flex-col items-center justify-center space-y-1 bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 active:scale-[0.96] transition-transform shadow-sm"
                    >
                      <span className="text-amber-700 dark:text-amber-300 font-extrabold text-sm">
                        第 {slotIdx + 1} 个位置
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {slotIdx === 0 
                          ? '(最左侧)' 
                          : slotIdx === (gameState?.hands[playerName!] || []).length - 1 
                            ? '(最右侧)' 
                            : `(第 ${slotIdx} 与 ${slotIdx + 1} 张牌之间)`}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => setSelectedJokerCard(null)}
                    variant="outline"
                    className="w-full rounded-xl text-xs bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                  >
                    取消
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Global Footer with Real-time Online Counter */}
        <Footer />
      </div>
    );
  }

  // LOBBY WAITING ROOM COMPONENT
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white flex flex-col transition-colors duration-200">
      
      {/* Top Navigation */}
      <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 sm:space-x-6">
              <Button
                onClick={handleLeaveRoom}
                className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 h-9 px-3 rounded-xl active:scale-[0.96] transition-transform duration-100"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                <span className="hidden sm:inline">返回大厅</span>
              </Button>
              
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-800"></div>
              
              <div className="flex items-center space-x-2 truncate">
                <h1 className="text-base sm:text-xl font-extrabold text-slate-800 dark:text-slate-100 truncate max-w-[120px] sm:max-w-none">
                  {room?.name}
                </h1>
                <div className="flex items-center space-x-1">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs rounded-full font-mono border border-slate-200 dark:border-slate-800">
                    #{roomId}
                  </span>
                  {room?.isPasswordProtected && (
                    <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 p-1 rounded-full text-[10px]" title="加密房间">
                      <Lock className="w-3 h-3" strokeWidth={2.5} />
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* User Battle Stats Display (Read-Only) */}
              {userStats && (
                <div className="hidden sm:flex items-center space-x-1.5 whitespace-nowrap bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1 rounded-xl text-xs shadow-sm">
                  <span className="text-slate-600 dark:text-slate-300 font-semibold">{userStats.totalGames} 场对局</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                    胜率 {userStats.totalGames > 0 ? Math.round((userStats.totalWins / userStats.totalGames) * 100) : 0}%
                  </span>
                </div>
              )}

              <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 text-sm">
                <Users className="w-4 h-4" strokeWidth={2} />
                <span className="font-bold">{players.length}/{room?.maxPlayers}</span>
              </div>
              
              {/* Theme Toggle Button */}
              <Button
                onClick={toggleTheme}
                variant="outline"
                size="icon"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 h-8 w-8 rounded-xl active:scale-[0.96] transition-transform duration-100"
              >
                {theme === 'light' ? <Moon className="w-4 h-4" strokeWidth={2} /> : <Sun className="w-4 h-4 text-yellow-500" strokeWidth={2} />}
              </Button>

              <div className="flex items-center space-x-2">
                {currentPlayer?.isHost && players.length >= 2 && (
                  <Button
                    onClick={handleStartGame}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs h-8 px-3 rounded-xl active:scale-[0.96] transition-transform duration-100 shadow-md shadow-green-500/10"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                    开赛
                  </Button>
                )}
                
                <Button
                  onClick={handleLeaveRoom}
                  className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/60 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-900/40 text-xs h-8 px-3 rounded-xl active:scale-[0.96] transition-transform duration-100"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
                  离开
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Waiting Room Body */}
      <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-12 w-full flex flex-col items-center justify-center">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-w-4xl w-full shadow-xl rounded-3xl p-2 sm:p-4">
          <CardContent className="p-6 sm:p-8">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400 mb-2.5 tracking-wide">
                等待游戏开始
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                分享房间号给朋友，当人数不少于 2 人时，房主即可点击上方“开赛”启动对局
              </p>
            </div>

            {/* Last Game Result Banner */}
            {gameState?.winner && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Trophy className="w-5 h-5" strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                      上一局获胜者：<span className="text-amber-600 dark:text-amber-400 font-black text-base">{gameState.winner}</span> 🏆
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      同房间所有玩家已自动返回房间待命，房主点击【开赛】即可直接开始下一局对决
                    </p>
                  </div>
                </div>
                <span className="text-xs text-amber-700 dark:text-amber-300 font-bold bg-amber-100 dark:bg-amber-950/60 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800/80 whitespace-nowrap shrink-0">
                  战绩已自动记录
                </span>
              </motion.div>
            )}

            {/* Host-Only Full Room (4 Players) Game Ready Notification Banner */}
            {currentPlayer?.isHost && players.length >= (room?.maxPlayers || 4) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-blue-500/15 border-2 border-amber-400/50 dark:border-amber-500/40 rounded-2xl p-4 sm:p-5 mb-8 shadow-lg shadow-amber-500/10 flex flex-col sm:flex-row items-center justify-between gap-4"
              >
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base sm:text-lg text-slate-800 dark:text-slate-100 flex items-center">
                      <span>房间已集齐 4 人，游戏待开始！</span>
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                      全员已就位！请房主点击【立即开赛】启动全新达芬奇密码对决
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleStartGame}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.96] transition-transform duration-100 flex items-center justify-center space-x-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>立即开赛</span>
                </Button>
              </motion.div>
            )}

            {/* Player Slot Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
              {Array.from({ length: room?.maxPlayers || 4 }, (_, index) => {
                const player = players[index];
                const isEmpty = !player;
                
                return (
                  <div
                    key={index}
                    className={`relative p-5 sm:p-6 rounded-2xl border-2 transition-transform duration-100 text-center flex flex-col items-center justify-center min-h-[140px] ${
                      isEmpty
                        ? 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 border-dashed text-slate-400 dark:text-slate-600'
                        : 'bg-blue-50/50 dark:bg-slate-900 border-blue-100 dark:border-blue-900/50 text-slate-800 dark:text-slate-100 shadow-sm shadow-blue-500/5'
                    }`}
                  >
                    {player?.isHost && (
                      <span className="absolute top-3 right-3 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 p-1 rounded-lg border border-yellow-250 dark:border-yellow-500/30">
                        <Crown className="w-3.5 h-3.5 fill-current" />
                      </span>
                    )}
                    
                    <div className={`w-14 h-14 rounded-full mb-3 flex items-center justify-center font-black text-lg shadow-inner ${
                      isEmpty 
                        ? 'bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-700' 
                        : 'bg-blue-600 text-white'
                    }`}>
                      {isEmpty ? '?' : player.username.charAt(0).toUpperCase()}
                    </div>

                    <span className="font-bold text-xs sm:text-sm truncate max-w-full block">
                      {isEmpty ? '等待加入...' : player.username}
                    </span>
                    
                    {!isEmpty && (
                      <span className="text-[9px] text-blue-600 dark:text-blue-400 mt-1 uppercase font-extrabold tracking-wider">
                        已就绪
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Waiting Room Dynamic Event Logs */}
            {gameState?.logs && gameState.logs.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 mb-6 max-w-lg mx-auto text-left shadow-inner">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center space-x-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <span>📢 房间动态提示</span>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto text-xs font-mono text-slate-600 dark:text-slate-300">
                  {gameState.logs.slice(-4).map((log, i) => (
                    <div key={i} className="py-0.5 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                      • {log}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 max-w-xs mx-auto">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                最少需 2 名玩家，当前已加入: {players.length} 人
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal: Joker Reposition Dialog */}
      <AnimatePresence>
        {selectedJokerCard && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
              className="bg-white dark:bg-slate-900 border-2 border-amber-400/80 dark:border-amber-500/80 text-slate-800 dark:text-slate-100 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center space-x-3 text-amber-500">
                <Sparkles className="w-6 h-6" />
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                  任意百搭牌【-】插牌位置设定
                </h3>
              </div>
              
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                按照《达芬奇密码》官方规则，抽到或持有的百搭牌可以插入到您手牌中的<strong className="text-amber-600 dark:text-amber-400 font-black">任意位置</strong>（以此混淆对手猜测）：
              </p>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {Array.from({ length: (gameState?.hands[playerName!] || []).length }, (_, slotIdx) => (
                  <button
                    key={slotIdx}
                    type="button"
                    onClick={() => submitJokerReposition(selectedJokerCard.id, slotIdx)}
                    className="p-3 rounded-2xl border-2 font-bold text-xs flex flex-col items-center justify-center space-y-1 bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 active:scale-[0.96] transition-transform shadow-sm"
                  >
                    <span className="text-amber-700 dark:text-amber-300 font-extrabold text-sm">
                      第 {slotIdx + 1} 个位置
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {slotIdx === 0 
                        ? '(最左侧)' 
                        : slotIdx === (gameState?.hands[playerName!] || []).length - 1 
                          ? '(最右侧)' 
                          : `(第 ${slotIdx} 与 ${slotIdx + 1} 张牌之间)`}
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => setSelectedJokerCard(null)}
                  variant="outline"
                  className="w-full rounded-xl text-xs bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                >
                  取消
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Footer with Real-time Online Counter */}
      <Footer />
    </div>
  );
}
