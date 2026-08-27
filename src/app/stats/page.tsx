import StatsClient from './StatsClient';

export const metadata = {
  title: '战绩数据与胜率排行榜 | Davinci Code',
  description: '查看个人对战历史和全服胜率排行榜',
};

export default function StatsPage() {
  return <StatsClient />;
}
