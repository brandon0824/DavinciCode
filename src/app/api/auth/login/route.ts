import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/authService';
import { createSession } from '@/lib/session';

const failures = new Map<string, { count: number; blockedUntil: number }>();

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    const state = failures.get(ip);
    if (state?.blockedUntil && state.blockedUntil > now) {
      return NextResponse.json({ error: '登录尝试过于频繁，请稍后再试' }, { status: 429 });
    }
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    const user = await loginUser(username, password);
    failures.delete(ip);

    const response = NextResponse.json({
      message: '登录成功',
      user
    });
    await createSession(user.username, response);
    return response;
  } catch (error) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const state = failures.get(ip) || { count: 0, blockedUntil: 0 };
    state.count += 1;
    if (state.count >= 5) { state.blockedUntil = Date.now() + 15 * 60 * 1000; state.count = 0; }
    failures.set(ip, state);
    console.error('登录错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '用户名或密码错误' },
      { status: 400 }
    );
  }
}
