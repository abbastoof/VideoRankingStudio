import { TicketThread } from '@/components/support/TicketThread';
import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  createdAt: string;
  lastMessageAt: string;
  messages: Array<{
    id: string;
    authorId: string;
    authorName: string;
    authorRole: string;
    body: string;
    internal: boolean;
    createdAt: string;
  }>;
}

export default async function TicketPage({ params }: { params: { id: string } }) {
  const sdk = serverClient();
  const ticket = (await sdk.getTicket(params.id)) as unknown as Ticket;
  return <TicketThread initial={ticket} />;
}
