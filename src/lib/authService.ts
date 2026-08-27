import { pgPool } from './postgres';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { validateUsername } from './utils';

export interface User {
  id: number | string;
  username: string;
  role: 'player' | 'admin';
  mustChangePassword?: boolean;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface MatchHistoryItem {
  id: number;
  matchNumber: number; // 对战场次 (序号)
  roomId: string;
  isWinner: boolean; // 是否获胜 (胜利/失败)
  winRateAtTime: number; // 对战胜率 (%)
  startedAt: Date; // 对战时间 (对应开赛时间)
  endedAt: Date;
}

export interface LeaderboardItem {
  username: string;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  winRate: number; // 胜率 (%)
  rank: number;
}

export interface AdminUserItem {
  id: number;
  username: string;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  winRate: number; // 胜率 (%)
  isOnline: boolean; // 基于 15 秒心跳的实时在线状态
  createdAt: Date;
  lastLoginAt?: Date;
}

// 注册新用户 (bcrypt 哈希)
export async function registerUser(username: string, password: string): Promise<User> {
  const trimmedUsername = username.trim();
  const trimmedPassword = password.trim();

  if (!validateUsername(trimmedUsername)) {
    throw new Error('用户名格式不正确（1-20个字符，支持中文、英文、数字、下划线）');
  }

  if (trimmedPassword.length < 7) {
    throw new Error('密码长度至少需要7个字符');
  }

  // 1. 检查用户名是否已注册
  const checkRes = await pgPool.query('SELECT 1 FROM users WHERE username = $1', [trimmedUsername]);
  if (checkRes.rows.length > 0) {
    throw new Error('该用户名已被注册，请直接登录或换一个用户名');
  }

  const passwordHash = await bcrypt.hash(trimmedPassword, 12);

  // 3. 写入数据库 (同时设 last_login_at 为当前时间)
  const insertRes = await pgPool.query(
    `INSERT INTO users (username, password_hash, last_login_at, role)
     VALUES ($1, $2, CURRENT_TIMESTAMP, 'player')
     RETURNING id, username, role, must_change_password, total_games, total_wins, total_losses, created_at, last_login_at`,
    [trimmedUsername, passwordHash]
  );

  const row = insertRes.rows[0];
  console.log(`✅ 新用户注册成功: ${trimmedUsername}`);

  return {
    id: row.id,
    username: row.username,
    role: row.role || 'player',
    mustChangePassword: Boolean(row.must_change_password),
    totalGames: row.total_games || 0,
    totalWins: row.total_wins || 0,
    totalLosses: row.total_losses || 0,
    createdAt: new Date(row.created_at),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined
  };
}

// 用户登录（兼容旧 Base64 哈希并在成功后升级为 bcrypt）
export async function loginUser(username: string, password: string): Promise<User> {
  const trimmedUsername = username.trim();
  const trimmedPassword = password.trim();

  if (!trimmedUsername || !trimmedPassword) {
    throw new Error('用户名和密码不能为空');
  }

  // 1. 查找用户
  const res = await pgPool.query('SELECT * FROM users WHERE username = $1', [trimmedUsername]);
  if (res.rows.length === 0) {
    throw new Error('用户名或密码错误');
  }

  const row = res.rows[0];

  if (row.must_change_password && row.password_reset_expires_at && new Date(row.password_reset_expires_at).getTime() < Date.now()) {
    throw new Error('临时密码已过期，请联系管理员重新重置');
  }

  // 2. 比对加密密码 (Base64 加密算法)
  const isLegacy = !String(row.password_hash).startsWith('$2');
  let isMatch = isLegacy
    ? Buffer.from(trimmedPassword).toString('base64') === row.password_hash
    : await bcrypt.compare(trimmedPassword, row.password_hash);

  if (!isMatch) {
    throw new Error('用户名或密码错误');
  }

  if (isLegacy) {
    await pgPool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(trimmedPassword, 12), row.id]);
  }

  // 3. 更新最后登录时间
  await pgPool.query(
    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
    [row.id]
  );

  console.log(`🔑 用户登录成功: ${trimmedUsername}`);

  return {
    id: row.id,
    username: row.username,
    role: row.role || 'player',
    mustChangePassword: Boolean(row.must_change_password),
    totalGames: row.total_games || 0,
    totalWins: row.total_wins || 0,
    totalLosses: row.total_losses || 0,
    createdAt: new Date(row.created_at),
    lastLoginAt: new Date()
  };
}

export async function resetUserPassword(username: string, adminUsername: string, sourceIp?: string): Promise<string> {
  const temporaryPassword = crypto.randomBytes(9).toString('base64url');
  const hash = await bcrypt.hash(temporaryPassword, 12);
  const result = await pgPool.query(
    `UPDATE users SET password_hash = $1, must_change_password = TRUE,
      password_reset_expires_at = CURRENT_TIMESTAMP + INTERVAL '30 minutes', password_reset_by = $2
     WHERE username = $3 AND username <> 'admin' RETURNING username`,
    [hash, adminUsername, username.trim()]
  );
  if (!result.rows[0]) {
    await pgPool.query('INSERT INTO admin_audit_logs(admin_username, action, target_username, source_ip, success) VALUES ($1,$2,$3,$4,FALSE)').catch(() => {});
    throw new Error('用户不存在或不允许重置该账号');
  }
  await pgPool.query('INSERT INTO admin_audit_logs(admin_username, action, target_username, source_ip) VALUES ($1,$2,$3,$4)', [adminUsername, 'reset_password', username.trim(), sourceIp || null]).catch(() => {});
  await pgPool.query('DELETE FROM user_sessions WHERE username = $1', [username.trim()]).catch(() => {});
  return temporaryPassword;
}

export async function changePassword(username: string, currentPassword: string, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.trim().length < 7) throw new Error('新密码至少需要 7 个字符');
  const result = await pgPool.query('SELECT password_hash FROM users WHERE username = $1', [username]);
  if (!result.rows[0] || !(await bcrypt.compare(currentPassword, result.rows[0].password_hash))) throw new Error('当前密码错误');
  await pgPool.query('UPDATE users SET password_hash = $1, must_change_password = FALSE, password_reset_expires_at = NULL, password_reset_by = NULL WHERE username = $2', [await bcrypt.hash(newPassword.trim(), 12), username]);
}

// 根据用户名获取用户信息
export async function getUserByUsername(username: string): Promise<User | null> {
  const res = await pgPool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  return {
    id: row.id,
    username: row.username,
    role: row.role || 'player',
    mustChangePassword: Boolean(row.must_change_password),
    totalGames: row.total_games || 0,
    totalWins: row.total_wins || 0,
    totalLosses: row.total_losses || 0,
    createdAt: new Date(row.created_at),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined
  };
}

// 对局结束自动累加战绩数据 (胜场/负场/总场次)
export async function updateUserStats(winnerUsername: string | undefined, allUsernames: string[]): Promise<void> {
  try {
    for (const username of allUsernames) {
      if (!username) continue;
      const isWinner = Boolean(winnerUsername && username === winnerUsername);

      if (isWinner) {
        await pgPool.query(
          `UPDATE users 
           SET total_games = total_games + 1, total_wins = total_wins + 1 
           WHERE username = $1`,
          [username]
        );
      } else {
        await pgPool.query(
          `UPDATE users 
           SET total_games = total_games + 1, total_losses = total_losses + 1 
           WHERE username = $1`,
          [username]
        );
      }
    }
    console.log(`🏆 已成功自动更新 ${allUsernames.join(', ')} 的战绩统计数据！`);
  } catch (err) {
    console.error('更新用户战绩数据失败:', err);
  }
}

// 记录一场比赛的明细历史
export async function recordMatchHistory(
  roomId: string,
  winnerUsername: string | undefined,
  allUsernames: string[],
  startedAt: Date = new Date()
): Promise<void> {
  try {
    const endedAt = new Date();
    const matchId = crypto.randomUUID();
    for (const username of allUsernames) {
      if (!username) continue;
      const isWinner = Boolean(winnerUsername && username === winnerUsername);

      await pgPool.query(
        `INSERT INTO match_history (match_id, room_id, username, is_winner, started_at, ended_at)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [matchId, roomId, username, isWinner, startedAt, endedAt]
      );
    }
    console.log(`📜 已成功记录房间 ${roomId} 的对局明细历史！`);
  } catch (err) {
    console.error('记录对局明细历史失败:', err);
  }
}

// 获取某个用户的对战明细列表 (上表)
export async function getUserMatchHistory(username: string): Promise<MatchHistoryItem[]> {
  const res = await pgPool.query(
    `SELECT * FROM match_history WHERE username = $1 ORDER BY started_at DESC`,
    [username.trim()]
  );

  const user = await getUserByUsername(username);
  const totalCount = res.rows.length;
  
  return res.rows.map((row, index) => {
    const matchNumber = totalCount - index;
    const isWinner = Boolean(row.is_winner);
    const winRate = user && user.totalGames > 0 
      ? Math.round((user.totalWins / user.totalGames) * 100)
      : 0;

    return {
      id: row.id,
      matchNumber,
      roomId: row.room_id,
      isWinner,
      winRateAtTime: winRate,
      startedAt: new Date(row.started_at),
      endedAt: new Date(row.ended_at)
    };
  });
}

// 获取全服胜率排行榜 (下表：胜率从高到低，胜率相同时按胜场排序，剔除 admin 管理员)
export async function getLeaderboard(): Promise<LeaderboardItem[]> {
  const res = await pgPool.query(
    `SELECT id, username, total_games, total_wins, total_losses,
            CASE WHEN total_games = 0 THEN 0 ELSE ROUND((total_wins::numeric / total_games::numeric) * 100, 1) END as win_rate
     FROM users
     WHERE COALESCE(role, 'player') <> 'admin' AND username <> 'admin'
     ORDER BY (CASE WHEN total_games = 0 THEN 0 ELSE (total_wins::numeric / total_games::numeric) END) DESC,
              total_wins DESC,
              total_games DESC,
              created_at ASC`
  );

  return res.rows.map((row, index) => ({
    username: row.username,
    totalGames: row.total_games || 0,
    totalWins: row.total_wins || 0,
    totalLosses: row.total_losses || 0,
    winRate: Number(row.win_rate) || 0,
    rank: index + 1
  }));
}

// 获取全服所有注册用户及其胜场/胜率/在线状态/注册与最后在线时间 (仅限管理员)
export async function getAdminAllUsers(): Promise<AdminUserItem[]> {
  const res = await pgPool.query(
    `SELECT id, username, total_games, total_wins, total_losses, created_at, last_login_at,
            (CASE WHEN total_games = 0 THEN 0 ELSE ROUND((total_wins::numeric / total_games::numeric) * 100, 1) END) as win_rate,
            (CASE WHEN last_login_at >= NOW() - INTERVAL '15 seconds' THEN true ELSE false END) as is_online
     FROM users
     ORDER BY
       CASE WHEN COALESCE(role, 'player') = 'admin' OR username = 'admin' THEN 1 ELSE 0 END ASC,
       (CASE WHEN total_games = 0 THEN 0 ELSE (total_wins::numeric / total_games::numeric) END) DESC,
       total_wins DESC,
       total_games DESC,
       created_at ASC`
  );

  return res.rows.map(row => ({
    id: row.id,
    username: row.username,
    totalGames: row.total_games || 0,
    totalWins: row.total_wins || 0,
    totalLosses: row.total_losses || 0,
    winRate: Number(row.win_rate) || 0,
    isOnline: Boolean(row.is_online),
    createdAt: new Date(row.created_at),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined
  }));
}
