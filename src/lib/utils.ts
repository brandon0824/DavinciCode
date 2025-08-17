import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 生成随机ID
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// 格式化时间
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// 格式化日期
export function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

// 延迟函数
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 验证房间ID格式
export function validateRoomId(roomId: string): boolean {
  return /^[A-Z0-9]{6}$/.test(roomId);
}

// 验证用户名格式
export function validateUsername(username: string): boolean {
  return username.length >= 2 && username.length <= 20 && /^[a-zA-Z0-9\u4e00-\u9fa5_]+$/.test(username);
}

// 验证房间名格式
export function validateRoomName(roomName: string): boolean {
  return roomName.length >= 2 && roomName.length <= 50;
}
