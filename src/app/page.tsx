import HomeClient from './HomeClient';

export const metadata = {
  title: 'Davinci Code',
  description: '创建房间，与其他玩家进行达芬奇密码对局',
};

export default function HomePage() {
  return <HomeClient />;
}
