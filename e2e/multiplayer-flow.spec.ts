import { test, expect } from '@playwright/test';

async function registerPlayer(request: any, username: string) {
  const response = await request.post('/api/auth/register', { data: { username, password: 'test-pass-123' } });
  expect(response.ok(), await response.text()).toBeTruthy();
  const token = /davinci_session=([^;]+)/.exec(response.headers()['set-cookie'] || '')?.[1];
  expect(token).toBeTruthy();
  return { username, headers: { Cookie: `davinci_session=${token}` } };
}

test('两名玩家可以创建、加入并开始一局游戏', async ({ request }) => {
  const suffix = `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
  const host = await registerPlayer(request, `host${suffix}`);
  const guest = await registerPlayer(request, `guest${suffix}`);

  const create = await request.post('/api/rooms', {
    headers: host.headers,
    data: { name: 'E2E 多人房间', username: host.username },
  });
  expect(create.ok()).toBeTruthy();
  const { roomId } = await create.json();

  const join = await request.post(`/api/rooms/${roomId}/join`, {
    headers: guest.headers,
    data: { username: guest.username },
  });
  expect(join.ok()).toBeTruthy();
  expect((await join.json()).players).toHaveLength(2);

  const start = await request.post(`/api/rooms/${roomId}/start`, {
    headers: host.headers,
    data: { username: host.username },
  });
  expect(start.ok()).toBeTruthy();

  const game = await request.get(`/api/rooms/${roomId}/game`, { headers: guest.headers });
  expect(game.ok()).toBeTruthy();
  const gameData = await game.json();
  expect(gameData.gameState.hands[guest.username]).toBeTruthy();
  expect(gameData.gameState.hands[host.username].some((card: { value: unknown; isRevealed: boolean }) => card.value === null && !card.isRevealed)).toBeTruthy();
});

test('非房主不能关闭房间，房主可以关闭等待中的房间', async ({ request }) => {
  const suffix = `${Date.now().toString().slice(-8)}x`;
  const host = await registerPlayer(request, `hostclose${suffix}`);
  const guest = await registerPlayer(request, `guestclose${suffix}`);
  const create = await request.post('/api/rooms', { headers: host.headers, data: { name: '关闭测试房间', username: host.username } });
  expect(create.ok()).toBeTruthy();
  const { roomId } = await create.json();
  await request.post(`/api/rooms/${roomId}/join`, { headers: guest.headers, data: { username: guest.username } });
  expect((await request.delete(`/api/rooms/${roomId}`, { headers: guest.headers })).status()).toBe(409);
  expect((await request.delete(`/api/rooms/${roomId}`, { headers: host.headers })).ok()).toBeTruthy();
});
