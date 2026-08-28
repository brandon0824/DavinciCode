import { pgPool } from './postgres';
import crypto from 'crypto';
import { initGame, GameData, repositionJokerCard, sortCards } from './gameLogic';
import { publishRoomEvent } from './roomEvents';

export interface Room {
  id: string;
  name: string;
  hostUsername?: string;
  isPasswordProtected?: boolean;
  status: 'waiting' | 'playing' | 'settling' | 'finished' | 'closed';
  maxPlayers: number;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
}

export interface RoomPlayer {
  id: string;
  roomId: string;
  username: string;
  joinedAt: Date;
  isHost: boolean;
}

export interface CreateRoomData {
  name: string;
  username: string;
  password?: string;
  maxPlayers?: number;
  customRoomId?: string;
}

export interface JoinRoomData {
  roomId: string;
  username: string;
  password?: string;
}

// Generate a random 6-character room ID
export function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 自动清理超过 24 小时的旧房间与完结满 1 小时的历史对局房间
export async function cleanupExpiredRooms(): Promise<number> {
  try {
    const res = await pgPool.query(
      "DELETE FROM rooms WHERE created_at < NOW() - INTERVAL '24 hours' OR (status = 'finished' AND ended_at < NOW() - INTERVAL '1 hour')"
    );
    if (res.rowCount && res.rowCount > 0) {
      console.log(`🧹 自动清理了 ${res.rowCount} 个过期或完结满 1 小时的旧房间`);
    }
    return res.rowCount || 0;
  } catch (err) {
    console.error('清理过期房间失败:', err);
    return 0;
  }
}

// Cleanup runs out of the request path so listing rooms does not perform deletes.
const cleanupGlobal = globalThis as typeof globalThis & { __davinciRoomCleanup?: ReturnType<typeof setInterval> };
if (!cleanupGlobal.__davinciRoomCleanup) {
  cleanupGlobal.__davinciRoomCleanup = setInterval(() => { cleanupExpiredRooms().catch(() => {}); }, 10 * 60 * 1000);
  cleanupGlobal.__davinciRoomCleanup.unref?.();
}

// Create a room
export async function createRoom(data: CreateRoomData): Promise<string> {
  // 1. 验证创建者是否为已注册用户
  const { name, username, password, maxPlayers = 4, customRoomId } = data;
  if (!username || !username.trim()) {
    throw new Error('未检测到账号，请先注册或登录账号！');
  }

  if (username.trim() === 'admin') {
    throw new Error('管理员账号 (admin) 专用于全服数据管理，无建房与切局对战权限！');
  }

  const userCheck = await pgPool.query('SELECT 1 FROM users WHERE username = $1', [username.trim()]);
  if (userCheck.rows.length === 0) {
    throw new Error('未注册的用户账号，请先注册或登录账号后再创建房间！');
  }

  // 创建新房间前自动清理 24 小时前创建的过期房间
  await cleanupExpiredRooms();
  
  let roomId: string;
  if (customRoomId && customRoomId.trim()) {
    const existingRoom = await getRoom(customRoomId.trim());
    if (existingRoom) {
      throw new Error('该房间号已被使用，请选择其他房间号');
    }
    roomId = customRoomId.trim();
  } else {
    let attempts = 0;
    do {
      roomId = generateRoomId();
      attempts++;
      if (attempts > 10) {
        throw new Error('无法生成唯一房间号，请重试');
      }
    } while (await getRoom(roomId));
  }
  
  const roomPassword = password && password.trim() ? password.trim() : null;

  await pgPool.query(
    'INSERT INTO rooms (id, name, password, status, max_players) VALUES ($1, $2, $3, $4, $5)',
    [roomId, name, roomPassword, 'waiting', maxPlayers]
  );
  
  console.log(`✅ 房间创建成功: ${roomId} - ${name} (有密码: ${Boolean(roomPassword)})`);
  publishRoomEvent({ roomId, kind: 'room' });
  return roomId;
}

// Get room details
export async function getRoom(roomId: string): Promise<Room | null> {
  const res = await pgPool.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
  if (res.rows.length === 0) {
    return null;
  }
  const row = res.rows[0];
  return {
    id: row.id,
    name: row.name,
    isPasswordProtected: Boolean(row.password && row.password.trim().length > 0),
    status: row.status,
    maxPlayers: row.max_players,
    createdAt: new Date(row.created_at),
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    endedAt: row.ended_at ? new Date(row.ended_at) : undefined
  };
}

// Get room list (waiting only)
export async function getRoomList(): Promise<Room[]> {
  const res = await pgPool.query(
    `SELECT r.*, rp.username as host_username 
     FROM rooms r 
     LEFT JOIN room_players rp ON r.id = rp.room_id AND rp.is_host = true 
     WHERE r.status = $1 
     ORDER BY r.created_at DESC`,
    ['waiting']
  );
  
  return res.rows.map(row => ({
    id: row.id,
    name: row.name,
    hostUsername: row.host_username || undefined,
    isPasswordProtected: Boolean(row.password && row.password.trim().length > 0),
    status: row.status,
    maxPlayers: row.max_players,
    createdAt: new Date(row.created_at),
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    endedAt: row.ended_at ? new Date(row.ended_at) : undefined
  }));
}

// Join a room (or Rejoin ongoing room)
export async function joinRoom(data: JoinRoomData): Promise<boolean> {
  const { roomId, username, password } = data;
  
  if (!username || !username.trim()) {
    throw new Error('未检测到账号，请先注册或登录账号！');
  }

  if (username.trim() === 'admin') {
    throw new Error('管理员账号 (admin) 专用于全服数据管理，无加入房间与切局对战权限！');
  }

  // 0. 验证加入者是否为已注册用户
  const userCheck = await pgPool.query('SELECT 1 FROM users WHERE username = $1', [username.trim()]);
  if (userCheck.rows.length === 0) {
    throw new Error('未注册的用户账号，请先在主页注册或登录账号后再进入房间！');
  }

  // 1. Fetch room row including raw password for verification
  const res = await pgPool.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
  if (res.rows.length === 0) {
    throw new Error('房间不存在');
  }
  
  const roomRow = res.rows[0];

  const players = await getRoomPlayers(roomId);
  const existingPlayer = players.find(p => p.username === username);
  const isHostOrMember = Boolean(existingPlayer);

  // 2. Check password if set (如果用户是房主或已加入的房间成员重返，免密码直接放行)
  if (roomRow.password && roomRow.password.trim().length > 0) {
    if (!isHostOrMember && (!password || password.trim() !== roomRow.password.trim())) {
      throw new Error('房间密码错误，无法加入');
    }
  }
  
  // 3. 无论是房主还是普通玩家，只要在玩家列表中（断线/误关/重新进入），许可重返房间或对局
  if (existingPlayer) {
    console.log(`ℹ️ 玩家/房主 ${username} 已在房间 ${roomId} 中，许可重返房间/对局 (房间状态: ${roomRow.status})`);
    return true;
  }

  // 4. 新玩家加入限制：如果游戏已经开始，新玩家无法加入
  if (roomRow.status !== 'waiting') {
    throw new Error('游戏已经开始，新玩家无法加入');
  }

  // 5. 新玩家加入限制：人数不能超限
  if (players.length >= roomRow.max_players) {
    throw new Error('房间已满');
  }
  
  const isHost = players.length === 0;
  
  await pgPool.query(
    'INSERT INTO room_players (room_id, username, is_host) VALUES ($1, $2, $3)',
    [roomId, username, isHost]
  );
  
  await appendRoomLog(roomId, `📢 玩家【${username}】加入了房间`);

  console.log(`✅ 新用户 ${username} 成功加入房间 ${roomId}`);
  publishRoomEvent({ roomId, kind: 'room' });
  return true;
}

// 追加房间实时系统日志
export async function appendRoomLog(roomId: string, message: string): Promise<void> {
  try {
    const res = await pgPool.query('SELECT game_data FROM game_states WHERE room_id = $1', [roomId]);
    let gameData: any = {};
    if (res.rows.length > 0 && res.rows[0].game_data) {
      gameData = res.rows[0].game_data;
    }
    if (!gameData.logs) gameData.logs = [];

    // 避免重复追加相同最新日志
    if (gameData.logs.length === 0 || gameData.logs[gameData.logs.length - 1] !== message) {
      gameData.logs.push(message);
      if (gameData.logs.length > 50) {
        gameData.logs = gameData.logs.slice(-50);
      }
      await pgPool.query(
        `INSERT INTO game_states (room_id, current_turn_username, game_data)
         VALUES ($1, $2, $3)
         ON CONFLICT (room_id)
         DO UPDATE SET game_data = EXCLUDED.game_data`,
        [roomId, gameData.currentTurn || '', JSON.stringify(gameData)]
      );
    }
  } catch (e) {
    console.error('追加房间系统日志失败:', e);
  }
}

// 原始获取房间成员列表（防递归）
export async function getRoomPlayersRaw(roomId: string): Promise<RoomPlayer[]> {
  const res = await pgPool.query(
    'SELECT * FROM room_players WHERE room_id = $1 ORDER BY joined_at ASC',
    [roomId]
  );
  
  return res.rows.map(row => ({
    id: String(row.id),
    roomId: row.room_id,
    username: row.username,
    joinedAt: new Date(row.joined_at),
    isHost: row.is_host
  }));
}

// Leave a room (支持主动离开与掉线超时自动踢出)
export async function leaveRoom(roomId: string, username: string, isOfflineTimeout = false): Promise<boolean> {
  const room = await getRoom(roomId);
  const players = await getRoomPlayersRaw(roomId);
  const playerLeaving = players.find(p => p.username === username);
  if (!playerLeaving) return false;
  
  await pgPool.query(
    'DELETE FROM room_players WHERE room_id = $1 AND username = $2',
    [roomId, username]
  );
  
  const remainingPlayers = players.filter(p => p.username !== username);
  if (remainingPlayers.length === 0) {
    await deleteRoom(roomId);
    return true;
  }
  
  if (playerLeaving.isHost) {
    const nextHost = remainingPlayers[0];
    await pgPool.query(
      'UPDATE room_players SET is_host = true WHERE room_id = $1 AND username = $2',
      [roomId, nextHost.username]
    );
  }

  // 记录房间系统提示日志
  const logMsg = isOfflineTimeout 
    ? `⚠️ 玩家【${username}】因断开连接/关闭页面已离线，已自动移出房间`
    : `🚪 玩家【${username}】已主动离开房间`;
  
  await appendRoomLog(roomId, logMsg);
  publishRoomEvent({ roomId, kind: 'room' });

  // 若退出时房间正在进行游戏，自动更新局内状态并检查胜负
  if (room && room.status === 'playing') {
    const gameData = await getGameState(roomId);
    if (gameData && gameData.hands) {
      // 强制公开退出玩家的所有手牌
      const userHand = gameData.hands[username] || [];
      userHand.forEach((card: any) => { card.isRevealed = true; });
      gameData.hands[username] = userHand;

      if (!gameData.logs) gameData.logs = [];
      gameData.logs.push(logMsg);

      // 统计剩余在线且手牌未全部被猜出的活牌玩家
      const remainingUsernames = remainingPlayers.map(p => p.username);
      const activeSurvivors = remainingUsernames.filter(user => {
        const h = gameData.hands[user] || [];
        return h.some((c: any) => !c.isRevealed);
      });

      if (activeSurvivors.length === 1) {
        const winner = activeSurvivors[0];
        gameData.winner = winner;
        gameData.turnStatus = 'ended';
        gameData.logs.push(`🎉 由于其他玩家已全部退出或出局，恭喜 ${winner} 获得了最后的胜利！`);
        await updateGameState(roomId, gameData.currentTurn, gameData);
        await endGame(roomId, winner);
      } else if (gameData.currentTurn === username && remainingUsernames.length > 0) {
        const nextUser = activeSurvivors[0] || remainingUsernames[0];
        gameData.currentTurn = nextUser;
        gameData.turnStatus = 'drawing';
        gameData.lastDrawnCard = null;
        gameData.logs.push(`由于 ${username} 退出，回合自动切换至 ${nextUser}。`);
        await updateGameState(roomId, gameData.currentTurn, gameData);
      } else {
        await updateGameState(roomId, gameData.currentTurn, gameData);
      }
    }
  }
  
  console.log(`✅ 用户 ${username} 离开房间 ${roomId} (是否掉线超时: ${isOfflineTimeout})`);
  return true;
}

// Get players in a room (自动检测并清理超过 20 秒无心跳的断线/关窗口离线玩家)
export async function getRoomPlayers(roomId: string): Promise<RoomPlayer[]> {
  try {
    const offlineRes = await pgPool.query(
      `SELECT rp.username
       FROM room_players rp
       JOIN user_presence p ON rp.username = p.username
       WHERE rp.room_id = $1 AND p.last_seen_at < NOW() - INTERVAL '20 seconds'`,
      [roomId]
    );

    for (const row of offlineRes.rows) {
      const offlineUsername = row.username;
      console.log(`⚠️ 检测到房间 ${roomId} 中玩家 ${offlineUsername} 已离线/断开连接，正在执行自动移出房间...`);
      await leaveRoom(roomId, offlineUsername, true);
    }
  } catch (e) {
    console.error('检测离线房间玩家失败:', e);
  }

  return getRoomPlayersRaw(roomId);
}

// Start game
export async function startGame(roomId: string): Promise<boolean> {
  const room = await getRoom(roomId);
  if (!room || !['waiting', 'finished'].includes(room.status)) {
    throw new Error('房间状态不允许开始游戏');
  }
  
  const players = await getRoomPlayers(roomId);
  if (players.length < 2) {
    throw new Error('至少需要2名玩家才能开始游戏');
  }
  
  const transition = await pgPool.query(
    "UPDATE rooms SET status = $1, started_at = CURRENT_TIMESTAMP, match_id = $3 WHERE id = $2 AND status IN ('waiting','finished')",
    ['playing', roomId, crypto.randomUUID()]
  );
  if (!transition.rowCount) throw new Error('房间状态已发生变化，请刷新后重试');
  
  const existingState = await getGameState(roomId);
  const existingLogs = (existingState && Array.isArray(existingState.logs)) ? existingState.logs : [];
  const existingChat = (existingState && Array.isArray(existingState.chat)) ? existingState.chat : [];

  const newGameData = initGame(players.map(p => p.username));
  // Every player participates in the private setup phase. This prevents
  // observers from inferring who received a joker from readiness timing.
  const setupPending = players.map(p => p.username);
  const initialGameData = {
    ...newGameData,
    // All players privately confirm/arrange their initial hand before anyone
    // can see another player's cards.
    turnStatus: 'setup' as const,
    setupPending,
    logs: [...existingLogs, ...newGameData.logs],
    chat: existingChat
  };
  
  await pgPool.query(
    `INSERT INTO game_states (room_id, current_turn_username, game_data, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (room_id)
     DO UPDATE SET current_turn_username = EXCLUDED.current_turn_username, game_data = EXCLUDED.game_data, updated_at = CURRENT_TIMESTAMP`,
    [roomId, initialGameData.currentTurn, JSON.stringify(initialGameData)]
  );
  
  console.log(`✅ 房间 ${roomId} 游戏开始`);
  publishRoomEvent({ roomId, kind: 'game' });
  return true;
}

// Get Game State
export async function getGameState(roomId: string, viewerUsername?: string): Promise<any | null> {
  const res = await pgPool.query(
    'SELECT game_data, version FROM game_states WHERE room_id = $1',
    [roomId]
  );
  if (res.rows.length === 0) return null;
  const data = res.rows[0].game_data;
  if (data && typeof data === 'object') data.version = res.rows[0].version || 0;
  try {
    const messages = await pgPool.query('SELECT username, message, created_at FROM room_messages WHERE room_id = $1 ORDER BY created_at DESC LIMIT 200', [roomId]);
    if (messages.rows.length) data.chat = messages.rows.reverse().map(row => ({ username: row.username, message: row.message, timestamp: new Date(row.created_at).toISOString() }));
  } catch { /* migration may not have run yet; retain legacy JSONB chat */ }
  if (!viewerUsername || data?.turnStatus === 'ended' || data?.winner) return data;
  const view = JSON.parse(JSON.stringify(data));
  const concealCards = (cards: any[], prefix: string) => cards.map((card, index) => ({
    id: `${prefix}:${index}`,
    color: card.color,
    value: card.isRevealed ? card.value : null,
    isRevealed: Boolean(card.isRevealed),
  }));
  // The deck's card ids and values are never useful to clients and would leak
  // information about the remaining jokers.
  if (view.deck) view.deck = concealCards(view.deck, 'deck');
  if (view.hands) {
    for (const [username, hand] of Object.entries(view.hands as Record<string, any[]>)) {
      if (username !== viewerUsername) {
        // During private initial arrangement, opponents are not sent a hand at
        // all. Afterwards they receive only color, revealed value and an opaque
        // per-slot token—never internal card ids or joker metadata.
        view.hands[username] = view.turnStatus === 'setup' ? [] : concealCards(hand as any[], `slot:${username}`);
      }
    }
  }
  if (view.lastDrawnCard && view.lastDrawnCard.owner !== viewerUsername && !view.lastDrawnCard.isRevealed) {
    view.lastDrawnCard = { id: 'drawn', color: view.lastDrawnCard.color, value: null, isRevealed: false };
  }
  return view;
}

// Update Game State
export async function updateGameState(roomId: string, currentTurnUsername: string, gameData: any, expectedVersion?: number): Promise<boolean> {
  const allowedKeys = new Set(['deck', 'hands', 'currentTurn', 'turnStatus', 'lastDrawnCard', 'winner', 'logs', 'chat', 'lastActionId', 'setupPending']);
  if (!gameData || typeof gameData !== 'object' || Object.keys(gameData).some((key) => !allowedKeys.has(key) && key !== 'version')) {
    throw new Error('对局状态字段不合法');
  }
  if (gameData?.logs?.length > 100) gameData.logs = gameData.logs.slice(-100);
  if (gameData?.chat?.length > 200) gameData.chat = gameData.chat.slice(-200);
  if (Buffer.byteLength(JSON.stringify(gameData), 'utf8') > 1024 * 1024) throw new Error('对局状态超过大小限制');
  const res = await pgPool.query(
    `UPDATE game_states
     SET current_turn_username = $1, game_data = $2, updated_at = CURRENT_TIMESTAMP, version = version + 1,
         updated_by = $4
     WHERE room_id = $3 AND ($5::int IS NULL OR version = $5)`,
    [currentTurnUsername, JSON.stringify(gameData), roomId, currentTurnUsername, expectedVersion ?? null]
  );
  const updated = (res.rowCount || 0) > 0;
  if (updated) publishRoomEvent({ roomId, kind: 'game' });
  return updated;
}

function activePlayers(hands: Record<string, any[]>) {
  return Object.keys(hands).filter(user => (hands[user] || []).some(card => !card.isRevealed));
}

function nextActivePlayer(usernames: string[], current: string, hands: Record<string, any[]>) {
  const active = activePlayers(hands);
  if (active.length <= 1) return current;
  const start = usernames.indexOf(current);
  for (let i = 1; i <= usernames.length; i++) {
    const candidate = usernames[(start + i) % usernames.length];
    if (active.includes(candidate)) return candidate;
  }
  return current;
}

/** Server-authoritative game actions. The rules mirror the original client gameLogic flow. */
export async function performGameAction(roomId: string, username: string, action: string, payload: any = {}) {
  const players = await getRoomPlayersRaw(roomId);
  if (!players.some(player => player.username === username)) throw new Error('你不是该房间玩家');
  let state = await getGameState(roomId);
  // Chat is also available in the waiting room, where a complete game state
  // (deck/hands/turn) may not exist yet. Create a lightweight state on demand.
  if (!state && action === 'chat') {
    await pgPool.query(
      `INSERT INTO game_states (room_id, current_turn_username, game_data)
       VALUES ($1, NULL, $2)
       ON CONFLICT (room_id) DO NOTHING`,
      [roomId, JSON.stringify({ logs: [], chat: [] })]
    );
    state = await getGameState(roomId);
  }
  if (!state || (action !== 'chat' && !state.hands)) throw new Error('游戏状态不存在');
  const version = typeof state.version === 'number' ? state.version : undefined;
  const actionId = String(payload.actionId || '');
  if (actionId && state.lastActionId === actionId) return getGameState(roomId, username);
  const data = JSON.parse(JSON.stringify(state));
  if (actionId) data.lastActionId = actionId;
  const usernames = players.map(player => player.username);
  const log = (message: string) => { data.logs = [...(data.logs || []), message].slice(-100); };

  // Initial setup is simultaneous; turn order only applies after setup ends.
  if (!['chat', 'surrender', 'confirm_setup'].includes(action) && data.turnStatus !== 'setup' && data.currentTurn !== username) throw new Error('当前不是你的回合');
  if (data.turnStatus === 'setup' && !['chat', 'confirm_setup'].includes(action)) throw new Error('正在私密整理手牌，请等待所有玩家完成');
  if (action === 'draw') {
    if (data.turnStatus !== 'drawing') throw new Error('当前不能摸牌');
    if (payload.color !== 'black' && payload.color !== 'white') throw new Error('牌色参数错误');
    const index = data.deck.findIndex((card: any) => card.color === payload.color);
    if (index < 0) throw new Error('该颜色牌已摸完');
    const [card] = data.deck.splice(index, 1);
    card.owner = username;
    data.hands[username] = sortCards([...(data.hands[username] || []), card]);
    data.lastDrawnCard = card;
    data.turnStatus = 'guessing';
    log(`${username} 摸了一张${payload.color === 'black' ? '黑色' : '白色'}牌。`);
  } else if (action === 'guess') {
    if (!['guessing', 'guessing_again'].includes(data.turnStatus)) throw new Error('当前不能猜牌');
    const target = data.hands[payload.targetUsername];
    const slotMatch = typeof payload.cardId === 'string' && payload.cardId.match(new RegExp(`^slot:${payload.targetUsername}:(\\d+)$`));
    const card = slotMatch ? target?.[Number(slotMatch[1])] : target?.find((item: any) => item.id === payload.cardId);
    const guessValue = Number(payload.guessValue);
    if (payload.targetUsername === username || !card || card.isRevealed || ![-1, ...Array.from({ length: 12 }, (_, i) => i)].includes(guessValue)) throw new Error('猜牌参数不合法');
    const display = guessValue === -1 ? '任意百搭牌 [-]' : `[${guessValue}]`;
    if (card.value === guessValue) {
      card.isRevealed = true;
      log(`${username} 猜对了 ${payload.targetUsername} 的牌，数值确实是 ${display}！`);
      const active = activePlayers(data.hands);
      if (active.length === 1) { data.winner = username; data.turnStatus = 'ended'; log(`🎉 恭喜 ${username} 击败了所有对手，获得了最后的胜利！`); }
      else { data.turnStatus = 'guessing_again'; data.lastDrawnCard = null; }
    } else {
      log(`${username} 猜测 ${payload.targetUsername} 的牌是 ${display}，但是猜错了！`);
      const ownHand = data.hands[username] || [];
      const penalty = data.lastDrawnCard ? ownHand.find((item: any) => item.id === data.lastDrawnCard.id) : ownHand.find((item: any) => !item.isRevealed);
      if (penalty) { penalty.isRevealed = true; log(`${username} 必须公开自己的一张牌。`); }
      const active = activePlayers(data.hands);
      if (active.length === 1) { data.winner = active[0]; data.turnStatus = 'ended'; log(`🎉 猜测失败后胜利者为 ${data.winner}`); }
      else { data.currentTurn = nextActivePlayer(usernames, username, data.hands); data.turnStatus = 'drawing'; data.lastDrawnCard = null; log(`回合结束。现在是 ${data.currentTurn} 的回合。`); }
    }
  } else if (action === 'pass') {
    if (data.turnStatus !== 'guessing_again') throw new Error('当前不能跳过回合');
    data.currentTurn = nextActivePlayer(usernames, username, data.hands); data.turnStatus = 'drawing'; data.lastDrawnCard = null;
    log(`${username} 选择结束猜测，跳过回合。现在是 ${data.currentTurn} 的回合。`);
  } else if (action === 'surrender') {
    (data.hands[username] || []).forEach((card: any) => { card.isRevealed = true; });
    log(`🏳️ 玩家 ${username} 选择主动认输，手牌已全部公开！`);
    const active = activePlayers(data.hands);
    if (active.length === 1) { data.winner = active[0]; data.turnStatus = 'ended'; log(`🎉 恭喜 ${data.winner} 获得了最后的胜利！`); }
    else if (data.currentTurn === username) { data.currentTurn = nextActivePlayer(usernames, username, data.hands); data.turnStatus = 'drawing'; data.lastDrawnCard = null; }
  } else if (action === 'chat') {
    const message = String(payload.message || '').trim();
    if (!message || message.length > 500) throw new Error('聊天内容不能为空且不能超过 500 个字符');
    await pgPool.query('INSERT INTO room_messages(room_id, username, message) VALUES ($1,$2,$3)', [roomId, username, message]).catch(() => {});
    data.chat = [...(data.chat || []), { username, message, timestamp: new Date().toISOString() }].slice(-200);
  } else if (action === 'confirm_setup') {
    if (data.turnStatus !== 'setup' || !data.setupPending?.includes(username)) throw new Error('当前无需确认手牌');
    const hasJoker = (data.hands[username] || []).some((card: any) => card.value === -1);
    if (hasJoker) throw new Error('请先选择任意牌的位置');
    data.setupPending = data.setupPending.filter((name: string) => name !== username);
    if (data.setupPending.length === 0) {
      data.turnStatus = 'drawing';
      data.logs = [...(data.logs || []), '所有玩家已完成私密手牌整理，游戏开始！'];
    }
  } else {
    throw new Error('不支持的游戏动作');
  }

  const updated = await updateGameState(roomId, data.currentTurn, data, version);
  if (!updated) throw Object.assign(new Error('对局状态已更新，请重新同步'), { code: 'VERSION_CONFLICT' });
  if (actionId) {
    // Use target-less conflict handling so older installations without the
    // optional idempotency index can still complete the turn successfully.
    await pgPool.query('INSERT INTO game_actions(room_id, match_id, username, action_id, action, payload) SELECT $1, match_id, $2, $3, $4, $5 FROM rooms WHERE id = $1 ON CONFLICT DO NOTHING', [roomId, username, actionId, action, JSON.stringify(payload)]).catch(() => {});
    const nextVersion = (version || 0) + 1;
    if (nextVersion % 20 === 0 || data.turnStatus === 'ended') await pgPool.query('INSERT INTO game_state_snapshots(room_id, version, game_data) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [roomId, nextVersion, JSON.stringify(data)]).catch(() => {});
  }
  if (data.winner) await endGame(roomId, data.winner);
  return getGameState(roomId, username);
}

// End game (reverts status to 'waiting' so players can view/rejoin the room in lobby list)
export async function endGame(roomId: string, winner?: string): Promise<boolean> {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const roomResult = await client.query(
      `UPDATE rooms SET status = 'settling', ended_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'playing'
       RETURNING match_id, started_at`, [roomId]
    );
    if (!roomResult.rows[0]) { await client.query('ROLLBACK'); return false; }
    const matchId = roomResult.rows[0].match_id || crypto.randomUUID();
    const players = await client.query('SELECT username FROM room_players WHERE room_id = $1', [roomId]);
    await client.query(
      `UPDATE users SET total_games = total_games + 1,
        total_wins = total_wins + CASE WHEN username = $1 THEN 1 ELSE 0 END,
        total_losses = total_losses + CASE WHEN username <> $1 THEN 1 ELSE 0 END
       WHERE username IN (SELECT username FROM room_players WHERE room_id = $2)`,
      [winner || '', roomId]
    );
    for (const row of players.rows) {
      const isWinner = Boolean(winner && row.username === winner);
      await client.query(
        `INSERT INTO match_history(match_id, room_id, username, is_winner, started_at, ended_at)
        VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`,
        [matchId, roomId, row.username, isWinner, roomResult.rows[0].started_at]
      );
    }
    await client.query("UPDATE rooms SET status = 'finished' WHERE id = $1", [roomId]);
    await client.query('COMMIT');
    publishRoomEvent({ roomId, kind: 'game' });
    console.log(`✅ 房间 ${roomId} 游戏结束，获胜者: ${winner || '未知'}`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

// 调整手牌中百搭牌 (-) 的插入摆放位置
export async function repositionJoker(
  roomId: string,
  username: string,
  cardId: string,
  targetIndex: number
): Promise<any> {
  const gameData = await getGameState(roomId);
  if (!gameData || !gameData.hands) {
    throw new Error('游戏状态不存在');
  }

  const hand = gameData.hands[username];
  if (!hand) {
    throw new Error('玩家不在该游戏对局中');
  }

  const targetCard = hand.find((c: any) => c.id === cardId);
  if (!targetCard || targetCard.value !== -1) {
    throw new Error('选中的卡牌不是百搭牌 (-)，无法自定义调整位置');
  }

  // 调整手牌排序（静默无声更新，绝不清空或泄露日志给对手）
  const newHand = repositionJokerCard(hand, cardId, targetIndex);
  gameData.hands[username] = newHand;
  if (gameData.turnStatus === 'setup') {
    if (!Array.isArray(gameData.setupPending) || !gameData.setupPending.includes(username)) {
      throw new Error('你无需整理初始手牌');
    }
    gameData.setupPending = gameData.setupPending.filter((name: string) => name !== username);
    if (gameData.setupPending.length === 0) {
      gameData.turnStatus = 'drawing';
      gameData.logs = [...(gameData.logs || []), '所有玩家已完成私密手牌整理，游戏开始！'];
    }
  }

  const expectedVersion = typeof gameData.version === 'number' ? gameData.version : undefined;
  delete gameData.version;
  const updated = await updateGameState(roomId, gameData.currentTurn, gameData, expectedVersion);
  if (!updated) throw Object.assign(new Error('对局状态已更新，请重新同步'), { code: 'VERSION_CONFLICT' });
  return getGameState(roomId, username);
}

// Delete room
export async function deleteRoom(roomId: string): Promise<boolean> {
  // Whether closed explicitly or emptied by the last player leaving,
  // a room must never retain chat history.
  await pgPool.query('DELETE FROM room_messages WHERE room_id = $1', [roomId]);
  const res = await pgPool.query('DELETE FROM rooms WHERE id = $1', [roomId]);
  console.log(`✅ 房间 ${roomId} 已删除`);
  publishRoomEvent({ roomId, kind: 'room' });
  return (res.rowCount || 0) > 0;
}

export async function closeRoom(roomId: string, username: string): Promise<boolean> {
  const result = await pgPool.query(
    `UPDATE rooms SET status = 'closed', ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP)
     WHERE id = $1 AND status IN ('waiting', 'finished')
       AND EXISTS (SELECT 1 FROM room_players WHERE room_id = $1 AND username = $2 AND is_host = TRUE)`,
    [roomId, username]
  );
  if (result.rowCount) {
    // Closed rooms must not retain chat history.
    await pgPool.query('DELETE FROM room_messages WHERE room_id = $1', [roomId]);
    publishRoomEvent({ roomId, kind: 'room' });
  }
  return Boolean(result.rowCount);
}
