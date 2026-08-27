import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/postgres';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const session = await getSessionUser(request);
    const username = session?.username;

    await pgPool.query(`CREATE TABLE IF NOT EXISTS user_presence (
      username VARCHAR(50) PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).catch(() => {});

    // If a valid session is provided, touch independent presence state.
    if (username) {
      await pgPool.query(
        `INSERT INTO user_presence(username, last_seen_at) VALUES ($1, CURRENT_TIMESTAMP)
         ON CONFLICT (username) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP`,
        [username]
      ).catch(() => {});
    }

    // 统计过去 15 秒内有心跳更新的活跃账号数 (客户端 Footer 每 4-5 秒发送一次心跳)，不包含 admin 管理员账号
    const res = await pgPool.query(
      `SELECT COUNT(DISTINCT username) AS online_count
       FROM user_presence
       WHERE last_seen_at >= NOW() - INTERVAL '15 seconds'
         AND LOWER(username) != 'admin'`
    );
    
    let count = parseInt(res.rows[0]?.online_count || '0', 10);
    if (isNaN(count) || count < 0) count = 0;

    return NextResponse.json({ onlineCount: count });
  } catch (error) {
    console.error('获取在线人数失败:', error);
    return NextResponse.json({ onlineCount: 0 });
  }
}
