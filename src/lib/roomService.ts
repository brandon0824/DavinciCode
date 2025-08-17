import { pool } from './database';
import { roomCache } from './redis';
import { generateCards, shuffleCards, dealCards } from './gameLogic';

export interface Room {
  id: string;
  name: string;
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
}

export interface RoomPlayer {
  id: string;
  roomId: string;
  userId?: string;
  username: string;
  joinedAt: Date;
  leftAt?: Date;
  isHost: boolean;
  isCurrentTurn: boolean;
}

export interface CreateRoomData {
  name: string;
  maxPlayers?: number;
  customRoomId?: string;
}

export interface JoinRoomData {
  roomId: string;
  username: string;
}

// 生成房间ID
export function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 创建房间
export async function createRoom(data: CreateRoomData): Promise<string> {
  const connection = await pool.getConnection();
  
  try {
    const { name, maxPlayers = 4, customRoomId } = data;
    
    // 使用自定义房间号或生成随机房间号
    let roomId: string;
    if (customRoomId && customRoomId.trim()) {
      // 检查自定义房间号是否已存在
      const existingRoom = await getRoom(customRoomId);
      if (existingRoom) {
        throw new Error('该房间号已被使用，请选择其他房间号');
      }
      roomId = customRoomId.trim();
    } else {
      // 生成随机房间号，确保不重复
      let attempts = 0;
      do {
        roomId = generateRoomId();
        attempts++;
        if (attempts > 10) {
          throw new Error('无法生成唯一房间号，请重试');
        }
      } while (await getRoom(roomId));
    }
    
    // 插入房间到数据库
    await connection.execute(
      'INSERT INTO rooms (id, name, max_players) VALUES (?, ?, ?)',
      [roomId, name, maxPlayers]
    );
    
    // 创建房间对象
    const room: Room = {
      id: roomId,
      name,
      status: 'waiting',
      maxPlayers,
      createdAt: new Date(),
    };
    
    // 缓存到Redis（如果失败，只记录日志，不中断流程）
    try {
      await roomCache.setRoom(roomId, room);
    } catch (redisError) {
      console.warn('Redis缓存失败，但房间已创建:', redisError);
    }
    
    console.log(`✅ 房间创建成功: ${roomId} - ${name}`);
    return roomId;
    
  } catch (error) {
    console.error('❌ 创建房间失败:', error);
    throw new Error(error instanceof Error ? error.message : '创建房间失败');
  } finally {
    connection.release();
  }
}

// 获取房间信息
export async function getRoom(roomId: string): Promise<Room | null> {
  try {
    // 先从Redis缓存获取
    let room = await roomCache.getRoom(roomId);
    
    if (!room) {
      // 从数据库获取
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.execute(
          'SELECT * FROM rooms WHERE id = ?',
          [roomId]
        );
        
        if (Array.isArray(rows) && rows.length > 0) {
          const row = rows[0] as any;
          room = {
            id: row.id,
            name: row.name,
            status: row.status,
            maxPlayers: row.max_players,
            createdAt: new Date(row.created_at),
            startedAt: row.started_at ? new Date(row.started_at) : undefined,
            endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
          };
          
          // 缓存到Redis（如果失败，只记录日志）
          try {
            await roomCache.setRoom(roomId, room);
          } catch (redisError) {
            console.warn('Redis缓存失败:', redisError);
          }
        }
      } finally {
        connection.release();
      }
    }
    
    return room;
  } catch (error) {
    console.error('❌ 获取房间失败:', error);
    return null;
  }
}

// 获取房间列表
export async function getRoomList(): Promise<Room[]> {
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM rooms WHERE status = "waiting" ORDER BY created_at DESC'
    );
    
    const rooms: Room[] = (rows as any[]).map(row => ({
      id: row.id,
      name: row.name,
      status: row.status,
      maxPlayers: row.max_players,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
    }));
    
    return rooms;
  } catch (error) {
    console.error('❌ 获取房间列表失败:', error);
    return [];
  } finally {
    connection.release();
  }
}

// 加入房间
export async function joinRoom(data: JoinRoomData): Promise<boolean> {
  const connection = await pool.getConnection();
  
  try {
    const { roomId, username } = data;
    
    // 检查房间是否存在
    const room = await getRoom(roomId);
    if (!room) {
      throw new Error('房间不存在');
    }
    
    // 检查房间状态
    if (room.status !== 'waiting') {
      throw new Error('房间已开始游戏');
    }
    
    // 获取当前玩家列表
    const currentPlayers = await getRoomPlayers(roomId);
    
    // 检查房间是否已满
    if (currentPlayers.length >= room.maxPlayers) {
      throw new Error('房间已满');
    }
    
    // 检查用户名是否已存在
    if (currentPlayers.some(p => p.username === username)) {
      throw new Error('用户名已存在');
    }
    
    // 创建新玩家
    const newPlayer: RoomPlayer = {
      id: Math.random().toString(36).substring(2),
      roomId,
      username,
      joinedAt: new Date(),
      isHost: currentPlayers.length === 0, // 第一个玩家是房主
      isCurrentTurn: false,
    };
    
    // 插入到数据库
    await connection.execute(
      'INSERT INTO room_players (room_id, username, is_host) VALUES (?, ?, ?)',
      [roomId, username, newPlayer.isHost]
    );
    
    // 更新Redis缓存（如果失败，只记录日志）
    try {
      const updatedPlayers = [...currentPlayers, newPlayer];
      await roomCache.setRoomPlayers(roomId, updatedPlayers);
    } catch (redisError) {
      console.warn('Redis缓存更新失败:', redisError);
    }
    
    console.log(`✅ 用户 ${username} 加入房间 ${roomId}`);
    return true;
    
  } catch (error) {
    console.error('❌ 加入房间失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// 离开房间
export async function leaveRoom(roomId: string, username: string): Promise<boolean> {
  const connection = await pool.getConnection();
  
  try {
    // 更新数据库
    await connection.execute(
      'UPDATE room_players SET left_at = NOW() WHERE room_id = ? AND username = ?',
      [roomId, username]
    );
    
    // 更新Redis缓存（如果失败，只记录日志）
    try {
      const currentPlayers = await getRoomPlayers(roomId);
      const updatedPlayers = currentPlayers.filter(p => p.username !== username);
      
      if (updatedPlayers.length > 0) {
        // 如果还有玩家，更新房主
        if (updatedPlayers.length === 1) {
          updatedPlayers[0].isHost = true;
        }
        await roomCache.setRoomPlayers(roomId, updatedPlayers);
      } else {
        // 如果没有玩家了，删除房间
        await deleteRoom(roomId);
      }
    } catch (redisError) {
      console.warn('Redis缓存更新失败:', redisError);
    }
    
    console.log(`✅ 用户 ${username} 离开房间 ${roomId}`);
    return true;
    
  } catch (error) {
    console.error('❌ 离开房间失败:', error);
    return false;
  } finally {
    connection.release();
  }
}

// 获取房间玩家列表
export async function getRoomPlayers(roomId: string): Promise<RoomPlayer[]> {
  try {
    // 先从Redis缓存获取
    let players = await roomCache.getRoomPlayers(roomId);
    
    if (players.length === 0) {
      // 从数据库获取
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.execute(
          'SELECT * FROM room_players WHERE room_id = ? AND left_at IS NULL ORDER BY joined_at ASC',
          [roomId]
        );
        
        players = (rows as any[]).map(row => ({
          id: row.id.toString(),
          roomId: row.room_id,
          userId: row.user_id,
          username: row.username,
          joinedAt: new Date(row.joined_at),
          leftAt: row.left_at ? new Date(row.left_at) : undefined,
          isHost: Boolean(row.is_host),
          isCurrentTurn: Boolean(row.is_current_turn),
        }));
        
        // 缓存到Redis（如果失败，只记录日志）
        try {
          await roomCache.setRoomPlayers(roomId, players);
        } catch (redisError) {
          console.warn('Redis缓存失败:', redisError);
        }
      } finally {
        connection.release();
      }
    }
    
    return players;
  } catch (error) {
    console.error('❌ 获取房间玩家失败:', error);
    return [];
  }
}

// 开始游戏
export async function startGame(roomId: string): Promise<boolean> {
  const connection = await pool.getConnection();
  
  try {
    // 检查房间状态
    const room = await getRoom(roomId);
    if (!room || room.status !== 'waiting') {
      throw new Error('房间状态不允许开始游戏');
    }
    
    // 获取玩家列表
    const players = await getRoomPlayers(roomId);
    if (players.length < 2) {
      throw new Error('至少需要2名玩家才能开始游戏');
    }
    
    // 更新房间状态
    await connection.execute(
      'UPDATE rooms SET status = "playing", started_at = NOW() WHERE id = ?',
      [roomId]
    );
    
    // 更新Redis缓存（如果失败，只记录日志）
    try {
      const updatedRoom = { ...room, status: 'playing' as const, startedAt: new Date() };
      await roomCache.setRoom(roomId, updatedRoom);
    } catch (redisError) {
      console.warn('Redis缓存更新失败:', redisError);
    }
    
    console.log(`✅ 房间 ${roomId} 游戏开始`);
    return true;
    
  } catch (error) {
    console.error('❌ 开始游戏失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// 结束游戏
export async function endGame(roomId: string, winner?: string): Promise<boolean> {
  const connection = await pool.getConnection();
  
  try {
    // 更新房间状态
    await connection.execute(
      'UPDATE rooms SET status = "finished", ended_at = NOW() WHERE id = ?',
      [roomId]
    );
    
    // 更新Redis缓存（如果失败，只记录日志）
    try {
      const room = await getRoom(roomId);
      if (room) {
        const updatedRoom = { ...room, status: 'finished' as const, endedAt: new Date() };
        await roomCache.setRoom(roomId, updatedRoom);
      }
    } catch (redisError) {
      console.warn('Redis缓存更新失败:', redisError);
    }
    
    console.log(`✅ 房间 ${roomId} 游戏结束${winner ? `，获胜者: ${winner}` : ''}`);
    return true;
    
  } catch (error) {
    console.error('❌ 结束游戏失败:', error);
    return false;
  } finally {
    connection.release();
  }
}

// 删除房间
export async function deleteRoom(roomId: string): Promise<boolean> {
  const connection = await pool.getConnection();
  
  try {
    // 删除数据库中的房间
    await connection.execute('DELETE FROM rooms WHERE id = ?', [roomId]);
    
    // 删除Redis缓存（如果失败，只记录日志）
    try {
      await roomCache.deleteRoom(roomId);
      await roomCache.setRoomPlayers(roomId, []);
    } catch (redisError) {
      console.warn('Redis缓存删除失败:', redisError);
    }
    
    console.log(`✅ 房间 ${roomId} 已删除`);
    return true;
    
  } catch (error) {
    console.error('❌ 删除房间失败:', error);
    return false;
  } finally {
    connection.release();
  }
}

// 清理过期房间
export async function cleanupExpiredRooms(): Promise<number> {
  const connection = await pool.getConnection();
  
  try {
    // 删除超过24小时的等待中房间
    const [result] = await connection.execute(
      'DELETE FROM rooms WHERE status = "waiting" AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)'
    );
    
    const deletedCount = (result as any).affectedRows || 0;
    console.log(`🧹 清理了 ${deletedCount} 个过期房间`);
    
    return deletedCount;
  } catch (error) {
    console.error('❌ 清理过期房间失败:', error);
    return 0;
  } finally {
    connection.release();
  }
}
