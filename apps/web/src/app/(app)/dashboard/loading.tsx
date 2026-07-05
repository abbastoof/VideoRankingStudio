export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8" aria-busy aria-label="Loading dashboard">
      <div className="space-y-2">
        <div className="skeleton h-7 w-64" />
        <div className="skeleton h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-border p-5">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="skeleton h-5 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-border">
              <div className="skeleton aspect-video rounded-none" />
              <div className="space-y-2 p-4">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
