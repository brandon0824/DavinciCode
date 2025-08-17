import { NextRequest, NextResponse } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiResponseServerIO } from '@/types/socket';

// 全局Socket.io实例
let io: SocketIOServer | null = null;

// 初始化Socket.io
function initSocketIO() {
  if (!io) {
    io = new SocketIOServer({
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://yourdomain.com'] 
          : ['http://localhost:3000'],
        methods: ['GET', 'POST'],
      },
    });
    
    // 连接处理
    io.on('connection', (socket) => {
      console.log(`🔌 用户连接: ${socket.id}`);
      
      // 加入房间
      socket.on('join_room', async (data: { roomId: string; username: string }) => {
        try {
          const { roomId, username } = data;
          console.log(`👤 用户 ${username} 尝试加入房间 ${roomId}`);
          
          // 加入房间
          socket.join(roomId);
          
          // 通知房间内所有玩家
          socket.to(roomId).emit('player_joined', {
            username,
            socketId: socket.id,
            timestamp: new Date(),
          });
          
          // 确认加入成功
          socket.emit('room_joined', {
            roomId,
            username,
            socketId: socket.id,
            timestamp: new Date(),
          });
          
          console.log(`✅ 用户 ${username} 加入房间 ${roomId}`);
          
        } catch (error) {
          console.error('加入房间失败:', error);
          socket.emit('error', { message: '加入房间失败' });
        }
      });
      
      // 离开房间
      socket.on('leave_room', (data: { roomId: string; username: string }) => {
        try {
          const { roomId, username } = data;
          
          // 离开房间
          socket.leave(roomId);
          
          // 通知房间内其他玩家
          socket.to(roomId).emit('player_left', {
            username,
            socketId: socket.id,
            timestamp: new Date(),
          });
          
          console.log(`👋 用户 ${username} 离开房间 ${roomId}`);
          
        } catch (error) {
          console.error('离开房间失败:', error);
        }
      });
      
      // 开始游戏
      socket.on('start_game', (data: { roomId: string; username: string }) => {
        try {
          const { roomId, username } = data;
          
          // 通知房间内所有玩家游戏开始
          io?.to(roomId).emit('game_started', {
            roomId,
            username,
            timestamp: new Date(),
          });
          
          console.log(`🎮 房间 ${roomId} 游戏开始，发起者: ${username}`);
          
        } catch (error) {
          console.error('开始游戏失败:', error);
          socket.emit('error', { message: '开始游戏失败' });
        }
      });
      
      // 游戏动作
      socket.on('game_action', (data: any) => {
        try {
          const { roomId, username, action } = data;
          
          // 广播给房间内所有玩家
          socket.to(roomId).emit('game_update', {
            username,
            action,
            timestamp: new Date(),
          });
          
          console.log(`🎯 游戏动作: ${username} - ${action.type}`);
          
        } catch (error) {
          console.error('游戏动作处理失败:', error);
        }
      });
      
      // 聊天消息
      socket.on('chat_message', (data: { roomId: string; username: string; message: string }) => {
        try {
          const { roomId, username, message } = data;
          
          const chatData = {
            username,
            message,
            timestamp: new Date(),
          };
          
          // 广播给房间内所有玩家
          io?.to(roomId).emit('chat_update', chatData);
          
          console.log(`💬 聊天消息: ${username} - ${message}`);
          
        } catch (error) {
          console.error('聊天消息处理失败:', error);
        }
      });
      
      // 断开连接
      socket.on('disconnect', () => {
        console.log(`🔌 用户断开连接: ${socket.id}`);
      });
    });
    
    console.log('✅ Socket.io服务器初始化成功');
  }
  
  return io;
}

// GET请求：获取Socket.io配置
export async function GET() {
  try {
    const socketIO = initSocketIO();
    
    return NextResponse.json({
      success: true,
      message: 'Socket.io服务器运行中',
      socketId: socketIO?.id,
    });
  } catch (error) {
    console.error('Socket.io初始化失败:', error);
    return NextResponse.json(
      { error: 'Socket.io服务器初始化失败' },
      { status: 500 }
    );
  }
}

// POST请求：处理Socket.io事件
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, data } = body;
    
    const socketIO = initSocketIO();
    if (!socketIO) {
      return NextResponse.json(
        { error: 'Socket.io服务器未初始化' },
        { status: 500 }
      );
    }
    
    // 处理事件
    switch (event) {
      case 'broadcast':
        socketIO.emit(data.channel, data.message);
        break;
      case 'room_broadcast':
        socketIO.to(data.roomId).emit(data.channel, data.message);
        break;
      default:
        return NextResponse.json(
          { error: '未知事件类型' },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      message: '事件处理成功',
    });
  } catch (error) {
    console.error('Socket.io事件处理失败:', error);
    return NextResponse.json(
      { error: '事件处理失败' },
      { status: 500 }
    );
  }
}
