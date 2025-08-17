import { createClient } from 'redis';

// Redis连接配置
export const redisConfig = {
  url: 'redis://localhost:6379',
  socket: {
    host: 'localhost',
    port: 6379,
  },
};

// 创建Redis客户端
export const redis = createClient(redisConfig);

// 连接Redis
export async function connectRedis() {
  try {
    // 如果已经连接，先断开
    if (redis.isOpen) {
      await redis.disconnect();
    }
    
    await redis.connect();
    console.log('✅ Redis连接成功');
    return true;
  } catch (error) {
    console.error('❌ Redis连接失败:', error);
    return false;
  }
}

// 断开Redis连接
export async function disconnectRedis() {
  try {
    if (redis.isOpen) {
      await redis.disconnect();
      console.log('✅ Redis连接已断开');
    }
  } catch (error) {
    console.error('❌ Redis断开连接失败:', error);
  }
}

// Redis键名常量
export const REDIS_KEYS = {
  // 房间相关
  ROOM_PREFIX: 'room:',
  ROOM_PLAYERS_PREFIX: 'room_players:',
  ROOM_STATUS_PREFIX: 'room_status:',
  
  // 游戏相关
  GAME_STATE_PREFIX: 'game_state:',
  GAME_CARDS_PREFIX: 'game_cards:',
  GAME_TURN_PREFIX: 'game_turn:',
  
  // 用户相关
  USER_SESSION_PREFIX: 'user_session:',
  USER_ROOM_PREFIX: 'user_room:',
  
  // 实时通信
  ROOM_SUBSCRIBERS_PREFIX: 'room_subscribers:',
};

// 房间缓存操作
export const roomCache = {
  // 设置房间信息
  async setRoom(roomId: string, roomData: any) {
    try {
      if (!redis.isOpen) {
        await connectRedis();
      }
      const key = `${REDIS_KEYS.ROOM_PREFIX}${roomId}`;
      await redis.setEx(key, 3600, JSON.stringify(roomData)); // 1小时过期
    } catch (error) {
      console.error('Redis setRoom失败:', error);
      throw error;
    }
  },

  // 获取房间信息
  async getRoom(roomId: string) {
    try {
      if (!redis.isOpen) {
        await connectRedis();
      }
      const key = `${REDIS_KEYS.ROOM_PREFIX}${roomId}`;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis getRoom失败:', error);
      return null;
    }
  },

  // 删除房间信息
  async deleteRoom(roomId: string) {
    try {
      if (!redis.isOpen) {
        await connectRedis();
      }
      const key = `${REDIS_KEYS.ROOM_PREFIX}${roomId}`;
      await redis.del(key);
    } catch (error) {
      console.error('Redis deleteRoom失败:', error);
    }
  },

  // 设置房间玩家列表
  async setRoomPlayers(roomId: string, players: any[]) {
    try {
      if (!redis.isOpen) {
        await connectRedis();
      }
      const key = `${REDIS_KEYS.ROOM_PLAYERS_PREFIX}${roomId}`;
      await redis.setEx(key, 3600, JSON.stringify(players));
    } catch (error) {
      console.error('Redis setRoomPlayers失败:', error);
      throw error;
    }
  },

  // 获取房间玩家列表
  async getRoomPlayers(roomId: string) {
    try {
      if (!redis.isOpen) {
        await connectRedis();
      }
      const key = `${REDIS_KEYS.ROOM_PLAYERS_PREFIX}${roomId}`;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Redis getRoomPlayers失败:', error);
      return [];
    }
  },

  // 设置游戏状态
  async setGameState(roomId: string, gameState: any) {
    try {
      if (!redis.isOpen) {
        await connectRedis();
      }
      const key = `${REDIS_KEYS.GAME_STATE_PREFIX}${roomId}`;
      await redis.setEx(key, 7200, JSON.stringify(gameState)); // 2小时过期
    } catch (error) {
      console.error('Redis setGameState失败:', error);
      throw error;
    }
  },

  // 获取游戏状态
  async getGameState(roomId: string) {
    try {
      if (!redis.isOpen) {
        await connectRedis();
      }
      const key = `${REDIS_KEYS.GAME_STATE_PREFIX}${roomId}`;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis getGameState失败:', error);
      return null;
    }
  },

  // 设置用户当前房间
  async setUserRoom(userId: string, roomId: string) {
    try {
      if (!redis.isOpen) {
        await connectRedis();
      }
      const key = `${REDIS_KEYS.USER_ROOM_PREFIX}${userId}`;
      await redis.setEx(key, 3600, roomId);
    } catch (error) {
      console.error('Redis setUserRoom失败:', error);
    }
  },

  // 获取用户当前房间
  async getUserRoom(userId: string) {
    try {
      if (!redis.isOpen) {
        await connectRedis();
      }
      const key = `${REDIS_KEYS.USER_ROOM_PREFIX}${userId}`;
      return await redis.get(key);
    } catch (error) {
      console.error('Redis getUserRoom失败:', error);
      return null;
    }
  },

  // 删除用户房间信息
  async deleteUserRoom(userId: string) {
    try {
      if (!redis.isOpen) {
        await connectRedis();
      }
      const key = `${REDIS_KEYS.USER_ROOM_PREFIX}${userId}`;
      await redis.del(key);
    } catch (error) {
      console.error('Redis deleteUserRoom失败:', error);
    }
  },
};

// 发布订阅操作
export const pubsub = {
  // 发布房间消息
  async publishToRoom(roomId: string, event: string, data: any) {
    try {
      if (!redis.isOpen) {
        await connectRedis();
      }
      const channel = `room:${roomId}`;
      await redis.publish(channel, JSON.stringify({ event, data }));
    } catch (error) {
      console.error('Redis publishToRoom失败:', error);
    }
  },

  // 订阅房间消息
  async subscribeToRoom(roomId: string, callback: (message: any) => void) {
    try {
      if (!redis.isOpen) {
        await connectRedis();
      }
      const channel = `room:${roomId}`;
      await redis.subscribe(channel, (message) => {
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch (error) {
          console.error('解析Redis消息失败:', error);
        }
      });
    } catch (error) {
      console.error('Redis subscribeToRoom失败:', error);
    }
  },

  // 取消订阅
  async unsubscribeFromRoom(roomId: string) {
    try {
      if (!redis.isOpen) {
        await connectRedis();
      }
      const channel = `room:${roomId}`;
      await redis.unsubscribe(channel);
    } catch (error) {
      console.error('Redis unsubscribeFromRoom失败:', error);
    }
  },
};
