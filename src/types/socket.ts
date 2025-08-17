import { Server as NetServer, Socket } from 'net';
import { NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';

export type NextApiResponseServerIO = NextApiResponse & {
  socket: Socket & {
    server: NetServer & {
      io: SocketIOServer;
    };
  };
};

export interface SocketMessage {
  event: string;
  data: any;
  timestamp: Date;
}

export interface RoomJoinData {
  roomId: string;
  username: string;
}

export interface GameAction {
  type: 'question' | 'answer' | 'guess' | 'reveal';
  data: any;
}

export interface ChatMessage {
  username: string;
  message: string;
  timestamp: Date;
}
