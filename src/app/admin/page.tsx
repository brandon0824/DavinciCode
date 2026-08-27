import AdminClient from './AdminClient';

export const metadata = {
  title: '管理员控制台 | Davinci Code',
  description: '用户、房间和系统运行监控',
};

export default function AdminPage() {
  return <AdminClient />;
}
