import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { pool } from './database';
import { roomCache, pubsub } from './redis';

export interface GameSocket {
  id: string;
  userId?: string;
  username?: string;
  roomId?: string;
}

export interface GameMessage {
  type: 'join_room' | 'leave_room' | 'start_game' | 'game_action' | 'chat';
  data: any;
}

// Socket.io事件类型
export const SOCKET_EVENTS = {
  // 连接相关
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  
  // 房间相关
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  ROOM_JOINED: 'room_joined',
  ROOM_LEFT: 'room_left',
  ROOM_UPDATE: 'room_update',
  
  // 游戏相关
  START_GAME: 'start_game',
  GAME_STARTED: 'game_started',
  GAME_ACTION: 'game_action',
  GAME_UPDATE: 'game_update',
  GAME_END: 'game_end',
  
  // 玩家相关
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  PLAYER_UPDATE: 'player_update',
  
  // 聊天相关
  CHAT_MESSAGE: 'chat_message',
  CHAT_UPDATE: 'chat_update',
  
  // 错误处理
  ERROR: 'error',
};

// 创建Socket.io服务器
export function createSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] 
        : ['http://localhost:3000'],
      methods: ['GET', 'POST'],
    },
  });

  // 连接处理
  io.on(SOCKET_EVENTS.CONNECT, async (socket) => {
    console.log(`🔌 用户连接: ${socket.id}`);
    
    // 存储socket信息
    const gameSocket: GameSocket = {
      id: socket.id,
    };
    
    // 加入房间
    socket.on(SOCKET_EVENTS.JOIN_ROOM, async (data: { roomId: string; username: string }) => {
      try {
        const { roomId, username } = data;
        
        // 验证房间是否存在
        const room = await roomCache.getRoom(roomId);
        if (!room) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: '房间不存在' });
          return;
        }
        
        // 检查房间是否已满
        const players = await roomCache.getRoomPlayers(roomId);
        if (players.length >= room.maxPlayers) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: '房间已满' });
          return;
        }
        
        // 检查用户名是否已存在
        if (players.some(p => p.username === username)) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: '用户名已存在' });
          return;
        }
        
        // 加入房间
        socket.join(roomId);
        
        // 更新socket信息
        gameSocket.roomId = roomId;
        gameSocket.username = username;
        
        // 创建新玩家
        const newPlayer = {
          id: socket.id,
          username,
          joinedAt: new Date(),
          isHost: players.length === 0,
          isCurrentTurn: false,
        };
        
        // 添加到玩家列表
        const updatedPlayers = [...players, newPlayer];
        await roomCache.setRoomPlayers(roomId, updatedPlayers);
        
        // 通知房间内所有玩家
        io.to(roomId).emit(SOCKET_EVENTS.PLAYER_JOINED, {
          player: newPlayer,
          players: updatedPlayers,
        });
        
        // 通知房间更新
        io.to(roomId).emit(SOCKET_EVENTS.ROOM_UPDATE, {
          roomId,
          players: updatedPlayers,
          playerCount: updatedPlayers.length,
        });
        
        // 确认加入成功
        socket.emit(SOCKET_EVENTS.ROOM_JOINED, {
          roomId,
          player: newPlayer,
          players: updatedPlayers,
        });
        
        console.log(`👤 用户 ${username} 加入房间 ${roomId}`);
        
      } catch (error) {
        console.error('加入房间失败:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: '加入房间失败' });
      }
    });
    
    // 离开房间
    socket.on(SOCKET_EVENTS.LEAVE_ROOM, async () => {
      try {
        const { roomId, username } = gameSocket;
        
        if (roomId && username) {
          // 离开房间
          socket.leave(roomId);
          
          // 获取当前玩家列表
          const players = await roomCache.getRoomPlayers(roomId);
          const updatedPlayers = players.filter(p => p.username !== username);
          
          // 更新玩家列表
          await roomCache.setRoomPlayers(roomId, updatedPlayers);
          
          // 通知房间内其他玩家
          socket.to(roomId).emit(SOCKET_EVENTS.PLAYER_LEFT, {
            username,
            players: updatedPlayers,
          });
          
          // 通知房间更新
          io.to(roomId).emit(SOCKET_EVENTS.ROOM_UPDATE, {
            roomId,
            players: updatedPlayers,
            playerCount: updatedPlayers.length,
          });
          
          // 如果房间空了，删除房间
          if (updatedPlayers.length === 0) {
            await roomCache.deleteRoom(roomId);
            console.log(`🗑️ 房间 ${roomId} 已删除`);
          }
          
          // 清除socket信息
          gameSocket.roomId = undefined;
          gameSocket.username = undefined;
          
          console.log(`👋 用户 ${username} 离开房间 ${roomId}`);
        }
      } catch (error) {
        console.error('离开房间失败:', error);
      }
    });
    
    // 开始游戏
    socket.on(SOCKET_EVENTS.START_GAME, async () => {
      try {
        const { roomId, username } = gameSocket;
        
        if (!roomId || !username) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: '未在房间中' });
          return;
        }
        
        // 检查是否是房主
        const players = await roomCache.getRoomPlayers(roomId);
        const currentPlayer = players.find(p => p.username === username);
        
        if (!currentPlayer?.isHost) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: '只有房主可以开始游戏' });
          return;
        }
        
        // 检查玩家数量
        if (players.length < 2) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: '至少需要2名玩家才能开始游戏' });
          return;
        }
        
        // 开始游戏逻辑
        // TODO: 实现游戏开始逻辑
        
        // 通知所有玩家游戏开始
        io.to(roomId).emit(SOCKET_EVENTS.GAME_STARTED, {
          roomId,
          players,
          gameState: {}, // TODO: 初始化游戏状态
        });
        
        console.log(`🎮 房间 ${roomId} 游戏开始`);
        
      } catch (error) {
        console.error('开始游戏失败:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: '开始游戏失败' });
      }
    });
    
    // 游戏动作
    socket.on(SOCKET_EVENTS.GAME_ACTION, async (data: any) => {
      try {
        const { roomId, username } = gameSocket;
        
        if (!roomId || !username) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: '未在房间中' });
          return;
        }
        
        // TODO: 处理游戏动作
        console.log(`🎯 游戏动作: ${username} - ${data.type}`);
        
        // 广播给房间内所有玩家
        socket.to(roomId).emit(SOCKET_EVENTS.GAME_UPDATE, {
          player: username,
          action: data,
        });
        
      } catch (error) {
        console.error('游戏动作处理失败:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: '游戏动作处理失败' });
      }
    });
    
    // 聊天消息
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, async (data: { message: string }) => {
      try {
        const { roomId, username } = gameSocket;
        
        if (!roomId || !username) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: '未在房间中' });
          return;
        }
        
        const chatData = {
          username,
          message: data.message,
          timestamp: new Date(),
        };
        
        // 广播给房间内所有玩家
        io.to(roomId).emit(SOCKET_EVENTS.CHAT_UPDATE, chatData);
        
      } catch (error) {
        console.error('聊天消息处理失败:', error);
      }
    });
    
    // 断开连接
    socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
      try {
        const { roomId, username } = gameSocket;
        
        if (roomId && username) {
          // 自动离开房间
          const players = await roomCache.getRoomPlayers(roomId);
          const updatedPlayers = players.filter(p => p.username !== username);
          
          await roomCache.setRoomPlayers(roomId, updatedPlayers);
          
          // 通知其他玩家
          socket.to(roomId).emit(SOCKET_EVENTS.PLAYER_LEFT, {
            username,
            players: updatedPlayers,
          });
          
          // 如果房间空了，删除房间
          if (updatedPlayers.length === 0) {
            await roomCache.deleteRoom(roomId);
          }
          
          console.log(`🔌 用户 ${username} 断开连接，离开房间 ${roomId}`);
        }
        
        console.log(`🔌 用户断开连接: ${socket.id}`);
      } catch (error) {
        console.error('断开连接处理失败:', error);
      }
    });
  });

  return io;
}
