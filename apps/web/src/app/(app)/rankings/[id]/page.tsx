import { RankingEditor } from '@/components/rankings/RankingEditor';
import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

export default async function RankingDetailPage({ params }: { params: { id: string } }) {
  const sdk = serverClient();
  const data = await sdk.getRanking(params.id);
  return <RankingEditor initial={data as never} />;
}
