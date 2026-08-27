import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/authService';
import { createSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    const user = await registerUser(username, password);

    const response = NextResponse.json({
      message: '注册成功',
      user
    });
    await createSession(user.username, response);
    return response;
  } catch (error) {
    console.error('注册错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '注册失败，请稍后重试' },
      { status: 400 }
    );
  }
}
