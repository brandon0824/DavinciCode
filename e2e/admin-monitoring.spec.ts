import { test, expect } from '@playwright/test';

test('未登录用户不能读取管理员监控', async ({ request }) => {
  const response = await request.get('/api/admin/monitoring');
  expect(response.status()).toBe(401);
});

test('注册接口拒绝弱密码', async ({ request }) => {
  const response = await request.post('/api/auth/register', { data: { username: `weak${Date.now()}`, password: '1234' } });
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toContain('7');
});

test('管理员可以读取监控并打开管理台', async ({ page }) => {
  const password = process.env.ADMIN_PASSWORD || 'Brandon';
  const api = await page.context().request;
  const login = await api.post('/api/auth/login', {
    data: { username: 'admin', password },
  });
  expect(login.ok()).toBeTruthy();
  const body = await login.json();
  const setCookie = login.headers()['set-cookie'];
  const token = /davinci_session=([^;]+)/.exec(setCookie || '')?.[1];
  expect(token).toBeTruthy();
  await page.context().addCookies([{ name: 'davinci_session', value: token!, domain: '127.0.0.1', path: '/', httpOnly: true }]);
  await page.addInitScript((user) => sessionStorage.setItem('davinci_user', JSON.stringify(user)), body.user);
  await page.goto('/admin');
  await expect(page.getByText('系统监控')).toBeVisible();
  const monitoring = await api.get('/api/admin/monitoring', { headers: { Cookie: `davinci_session=${token}` } });
  expect([200, 503]).toContain(monitoring.status());
});
