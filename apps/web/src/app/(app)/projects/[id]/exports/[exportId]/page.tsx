import { ExportStatus } from '@/components/editor/ExportStatus';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string; exportId: string };
}

export default function ExportStatusPage({ params }: PageProps) {
  return (
    <div className="max-w-3xl mx-auto py-6">
      <ExportStatus projectId={params.id} exportId={params.exportId} />
    </div>
  );
}
