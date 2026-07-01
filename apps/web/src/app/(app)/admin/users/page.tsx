import { Search } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@vrs/ui';

import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { search?: string; role?: string; status?: string; cursor?: string };
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  planCode: string;
  subscriptionStatus: string | null;
  projectsCount: number;
  exportsCount: number;
  lastSeenAt: string | null;
  createdAt: string;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const sdk = serverClient();
  const data = await sdk.adminListUsers({
    search: searchParams.search,
    role: searchParams.role as never,
    status: searchParams.status as never,
    cursor: searchParams.cursor,
    limit: 50,
  });
  const items = data.items as unknown as AdminUser[];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} shown
            {searchParams.search ? ` for "${searchParams.search}"` : ''}
          </p>
        </div>
        <Link href="/admin" className="text-sm text-brand-700 hover:text-brand-800">
          Back to admin
        </Link>
      </header>

      <form action="/admin/users" className="flex gap-2" method="GET">
        <div className="flex flex-1 max-w-md items-center gap-2 h-10 rounded-md border border-border bg-surface-raised px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            name="search"
            defaultValue={searchParams.search ?? ''}
            placeholder="Email or name"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          name="role"
          defaultValue={searchParams.role ?? ''}
          className="h-10 rounded-md border border-border bg-surface-raised px-3 text-sm"
        >
          <option value="">All roles</option>
          <option value="USER">User</option>
          <option value="SUPPORT">Support</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select
          name="status"
          defaultValue={searchParams.status ?? ''}
          className="h-10 rounded-md border border-border bg-surface-raised px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="PENDING_DELETION">Pending deletion</option>
        </select>
      </form>

      <div className="rounded-lg border border-border bg-surface-raised overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">User</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Plan</th>
              <th className="px-4 py-2 text-right">Projects</th>
              <th className="px-4 py-2 text-right">Exports</th>
              <th className="px-4 py-2 text-left">Last seen</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{u.name ?? u.email.split('@')[0]}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={u.role === 'ADMIN' ? 'brand' : 'neutral'}>{u.role.toLowerCase()}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(u.status)}>{u.status.toLowerCase().replace('_', ' ')}</Badge>
                </td>
                <td className="px-4 py-3 capitalize">{u.planCode.toLowerCase()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{u.projectsCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{u.exportsCount}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/users/${u.id}`} className="text-sm text-brand-700 hover:text-brand-800">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.nextCursor ? (
        <div className="flex justify-center">
          <Link
            href={{ pathname: '/admin/users', query: { ...searchParams, cursor: data.nextCursor } }}
            className="text-sm text-brand-700 hover:text-brand-800"
          >
            Load more →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function statusTone(status: string): 'success' | 'danger' | 'warning' | 'neutral' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'SUSPENDED') return 'danger';
  if (status === 'PENDING_DELETION') return 'warning';
  return 'neutral';
}
