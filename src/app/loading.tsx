export default function Loading() {
  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-7xl animate-pulse space-y-6">
        <div className="h-10 w-56 rounded-2xl bg-secondary" />
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="h-80 rounded-[2rem] bg-secondary" />
          <div className="space-y-4">
            <div className="h-40 rounded-[2rem] bg-secondary" />
            <div className="h-40 rounded-[2rem] bg-secondary" />
          </div>
        </div>
      </div>
    </div>
  );
}
