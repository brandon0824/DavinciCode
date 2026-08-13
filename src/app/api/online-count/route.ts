import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const username = url.searchParams.get('username');

    // If username is provided, touch/refresh last_login_at timestamp
    if (username && username.trim()) {
      await pgPool.query(
        'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE username = $1',
        [username.trim()]
      ).catch(() => {});
    }

    // 统计过去 15 秒内有心跳更新的活跃账号数 (客户端 Footer 每 4-5 秒发送一次心跳)，不包含 admin 管理员账号
    const res = await pgPool.query(
      `SELECT COUNT(DISTINCT username) AS online_count
       FROM users 
       WHERE last_login_at >= NOW() - INTERVAL '15 seconds'
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
