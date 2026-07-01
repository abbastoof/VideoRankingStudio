import { redirect } from 'next/navigation';

import { requireSession } from '@/lib/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (session.user.role !== 'ADMIN') redirect('/dashboard');
  return <>{children}</>;
}
