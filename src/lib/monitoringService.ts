import { pgPool } from './postgres';
import { getRequestMetrics, getDatabaseMetrics } from './metrics';
import { getRecentErrors } from './errorReporter';

export interface MonitoringSnapshot {
  generatedAt: string;
  onlineUsers: number;
  activeRooms: number;
  activeGames: number;
  activeSessions: number;
  sseConnections: number;
  actionCount24h: number;
  messages24h: number;
  pool: { total: number; idle: number; waiting: number; max: number };
  requests: { totalTracked: number; requestsLastMinute: number; requestsPerSecond: number; averageLatencyMs: number };
  database: { queriesLastMinute: number; failuresLastMinute: number; averageLatencyMs: number };
  alerts: Array<{ level: 'info' | 'warning'; message: string }>;
  recentErrors: Array<{ at: string; scope: string; message: string }>;
  recentAdminActions: Array<{ adminUsername: string; action: string; targetUsername?: string; success: boolean; createdAt: string }>;
}

export async function getMonitoringSnapshot(): Promise<MonitoringSnapshot> {
  const [online, rooms, games, sessions, actions, messages, adminActions] = await Promise.all([
    pgPool.query("SELECT COUNT(*)::int AS count FROM user_presence WHERE last_seen_at > CURRENT_TIMESTAMP - INTERVAL '45 seconds'"),
    pgPool.query("SELECT COUNT(*)::int AS count FROM rooms WHERE status = 'waiting'"),
    pgPool.query("SELECT COUNT(*)::int AS count FROM rooms WHERE status = 'playing'"),
    pgPool.query("SELECT COUNT(*)::int AS count FROM user_sessions WHERE expires_at > CURRENT_TIMESTAMP"),
    pgPool.query("SELECT COUNT(*)::int AS count FROM game_actions WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'"),
    pgPool.query("SELECT COUNT(*)::int AS count FROM room_messages WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'"),
    pgPool.query("SELECT admin_username, action, target_username, success, created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT 20").catch(() => ({ rows: [] }))
  ]);

  const snapshot: MonitoringSnapshot = {
    generatedAt: new Date().toISOString(),
    onlineUsers: online.rows[0].count,
    activeRooms: rooms.rows[0].count,
    activeGames: games.rows[0].count,
    activeSessions: sessions.rows[0].count,
    // SSE connections are process-local; expose the metric when an SSE registry is added.
    sseConnections: 0,
    actionCount24h: actions.rows[0].count,
    messages24h: messages.rows[0].count,
    pool: {
      total: pgPool.totalCount,
      idle: pgPool.idleCount,
      waiting: pgPool.waitingCount,
      max: 20,
    },
    requests: getRequestMetrics(),
    database: getDatabaseMetrics(),
    alerts: [],
    recentErrors: getRecentErrors(),
    recentAdminActions: adminActions.rows.map((row: any) => ({ adminUsername: row.admin_username, action: row.action, targetUsername: row.target_username || undefined, success: Boolean(row.success), createdAt: new Date(row.created_at).toISOString() })),
  };
  if (snapshot.pool.waiting > 0) snapshot.alerts.push({ level: 'warning', message: `${snapshot.pool.waiting} 个请求正在等待数据库连接` });
  if (snapshot.activeGames > 0) snapshot.alerts.push({ level: 'info', message: `当前有 ${snapshot.activeGames} 场对局进行中` });
  if (!snapshot.alerts.length) snapshot.alerts.push({ level: 'info', message: '系统运行正常，暂无告警' });
  return snapshot;
}
