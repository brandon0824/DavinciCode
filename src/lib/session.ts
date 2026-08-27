import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from './postgres';

const COOKIE = 'davinci_session';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

let tableReady: Promise<void> | undefined;
async function ensureSessionsTable() {
  if (!tableReady) tableReady = pgPool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      token_hash CHAR(64) PRIMARY KEY,
      username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS user_sessions_expires_idx ON user_sessions(expires_at);
  `).then(() => undefined);
  return tableReady;
}

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export async function createSession(username: string, response: NextResponse) {
  await ensureSessionsTable();
  const token = crypto.randomBytes(32).toString('hex');
  await pgPool.query('INSERT INTO user_sessions(token_hash, username, expires_at) VALUES ($1,$2,$3)', [hashToken(token), username, new Date(Date.now() + TTL_MS)]);
  response.cookies.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: TTL_MS / 1000 });
}

export async function getSessionUser(request: NextRequest): Promise<{ username: string; role: string; isAdmin: boolean } | null> {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return null;
  await ensureSessionsTable();
  const result = await pgPool.query('SELECT s.username, COALESCE(u.role, \'player\') AS role FROM user_sessions s JOIN users u ON u.username = s.username WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP', [hashToken(token)]);
  if (!result.rows[0]) return null;
  return { username: result.rows[0].username, role: result.rows[0].role, isAdmin: result.rows[0].role === 'admin' };
}

export async function destroySession(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(COOKIE)?.value;
  if (token) {
    await ensureSessionsTable();
    await pgPool.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(token)]);
  }
  response.cookies.set(COOKIE, '', { httpOnly: true, expires: new Date(0), path: '/' });
}

export { COOKIE };
