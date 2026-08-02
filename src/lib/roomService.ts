import { pgPool } from './postgres';
import { initGame, GameData } from './gameLogic';
import { updateUserStats, recordMatchHistory } from './authService';

export interface Room {
  id: string;
  name: string;
  isPasswordProtected?: boolean;
  status: 'waiting' | 'playing' | 'finished';
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

// Create a room
export async function createRoom(data: CreateRoomData): Promise<string> {
  // 1. 验证创建者是否为已注册用户
  const { name, username, password, maxPlayers = 4, customRoomId } = data;
  if (!username || !username.trim()) {
    throw new Error('未检测到账号，请先注册或登录账号！');
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
  // 获取房间列表前自动清理过期旧房间
  await cleanupExpiredRooms();

  const res = await pgPool.query(
    'SELECT * FROM rooms WHERE status = $1 ORDER BY created_at DESC',
    ['waiting']
  );
  
  return res.rows.map(row => ({
    id: row.id,
    name: row.name,
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

  // 2. Check password if set
  if (roomRow.password && roomRow.password.trim().length > 0) {
    if (!password || password.trim() !== roomRow.password.trim()) {
      throw new Error('房间密码错误，无法加入');
    }
  }
  
  const players = await getRoomPlayers(roomId);
  const existingPlayer = players.find(p => p.username === username);
  
  // 3. 无论是房主还是普通玩家，只要在玩家列表中（断线/误关/重新进入），验证密码后均许可重返房间或对局
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
  
  console.log(`✅ 新用户 ${username} 成功加入房间 ${roomId}`);
  return true;
}

// Leave a room
export async function leaveRoom(roomId: string, username: string): Promise<boolean> {
  const room = await getRoom(roomId);
  const players = await getRoomPlayers(roomId);
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

  // 若退出时房间正在进行游戏，自动更新局内状态并检查胜负
  if (room && room.status === 'playing') {
    const gameData = await getGameState(roomId);
    if (gameData && gameData.hands) {
      // 强制公开退出玩家的所有手牌
      const userHand = gameData.hands[username] || [];
      userHand.forEach((card: any) => { card.isRevealed = true; });
      gameData.hands[username] = userHand;

      if (!gameData.logs) gameData.logs = [];
      gameData.logs.push(`🚪 玩家 ${username} 中途退出了房间，手牌已强制公开。`);

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
        // 如果离开者正好是当前轮到的人，切换到下一个存活玩家
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
  
  console.log(`✅ 用户 ${username} 离开房间 ${roomId}`);
  return true;
}

// Get players in a room
export async function getRoomPlayers(roomId: string): Promise<RoomPlayer[]> {
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

// Start game
export async function startGame(roomId: string): Promise<boolean> {
  const room = await getRoom(roomId);
  if (!room || room.status !== 'waiting') {
    throw new Error('房间状态不允许开始游戏');
  }
  
  const players = await getRoomPlayers(roomId);
  if (players.length < 2) {
    throw new Error('至少需要2名玩家才能开始游戏');
  }
  
  await pgPool.query(
    'UPDATE rooms SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2',
    ['playing', roomId]
  );
  
  const initialGameData = {
    ...initGame(players.map(p => p.username)),
    chat: [] as Array<{ username: string; message: string; timestamp: string }>
  };
  
  await pgPool.query(
    `INSERT INTO game_states (room_id, current_turn_username, game_data, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (room_id)
     DO UPDATE SET current_turn_username = EXCLUDED.current_turn_username, game_data = EXCLUDED.game_data, updated_at = CURRENT_TIMESTAMP`,
    [roomId, initialGameData.currentTurn, JSON.stringify(initialGameData)]
  );
  
  console.log(`✅ 房间 ${roomId} 游戏开始`);
  return true;
}

// Get Game State
export async function getGameState(roomId: string): Promise<any | null> {
  const res = await pgPool.query(
    'SELECT game_data FROM game_states WHERE room_id = $1',
    [roomId]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0].game_data;
}

// Update Game State
export async function updateGameState(roomId: string, currentTurnUsername: string, gameData: any): Promise<boolean> {
  const res = await pgPool.query(
    `UPDATE game_states 
     SET current_turn_username = $1, game_data = $2, updated_at = CURRENT_TIMESTAMP 
     WHERE room_id = $3`,
    [currentTurnUsername, JSON.stringify(gameData), roomId]
  );
  return (res.rowCount || 0) > 0;
}

// End game (reverts status to 'waiting' so players can view/rejoin the room in lobby list)
export async function endGame(roomId: string, winner?: string): Promise<boolean> {
  const room = await getRoom(roomId);

  await pgPool.query(
    'UPDATE rooms SET status = $1, ended_at = CURRENT_TIMESTAMP WHERE id = $2',
    ['waiting', roomId]
  );
  
  if (winner) {
    const gameData = await getGameState(roomId);
    if (gameData) {
      gameData.winner = winner;
      gameData.turnStatus = 'ended';
      await updateGameState(roomId, gameData.currentTurn, gameData);
    }

    // 自动更新所有参赛玩家的累计胜负与场次战绩，并写入对局明细表
    const players = await getRoomPlayers(roomId);
    const allUsernames = players.map(p => p.username);
    await updateUserStats(winner, allUsernames);
    await recordMatchHistory(roomId, winner, allUsernames, room?.startedAt || new Date());
  }
  
  console.log(`✅ 房间 ${roomId} 游戏结束，获胜者: ${winner || '未知'}`);
  return true;
}

// Delete room
export async function deleteRoom(roomId: string): Promise<boolean> {
  const res = await pgPool.query('DELETE FROM rooms WHERE id = $1', [roomId]);
  console.log(`✅ 房间 ${roomId} 已删除`);
  return (res.rowCount || 0) > 0;
}
