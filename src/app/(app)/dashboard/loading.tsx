export default function DashboardLoading() {
  return (
    <div
      className="space-y-6 lg:space-y-8"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <span className="sr-only">Loading dashboard…</span>

      <div className="skeleton h-48 rounded-3xl" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="skeleton h-36 rounded-2xl" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="skeleton h-80 rounded-2xl lg:col-span-3" />
        <div className="skeleton h-80 rounded-2xl lg:col-span-2" />
      </div>

      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );
}
