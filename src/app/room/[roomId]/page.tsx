import RoomClient from './RoomClient';

export const dynamic = 'force-dynamic';

export default function RoomPage({ params }: { params: { roomId: string } }) {
  return <RoomClient params={params} />;
}
