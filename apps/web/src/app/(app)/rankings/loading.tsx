export default function RankingsLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6" aria-busy aria-label="Loading rankings">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="skeleton h-7 w-44" />
          <div className="skeleton h-4 w-64" />
        </div>
        <div className="skeleton h-10 w-40 rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
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
  );
}
