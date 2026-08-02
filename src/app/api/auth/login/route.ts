import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/authService';

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

    const user = await loginUser(username, password);

    return NextResponse.json({
      message: '登录成功',
      user
    });
  } catch (error) {
    console.error('登录错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '用户名或密码错误' },
      { status: 400 }
    );
  }
}
