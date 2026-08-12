export function OfflineScreen() {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-gray-200 bg-surface px-4 py-4">
        <h1 className="text-xl font-semibold text-text-primary">Offline maps</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Download regions for use without connectivity
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <button
          type="button"
          className="mb-4 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-map transition-colors hover:bg-primary-hover"
        >
          See what you can download
        </button>

        <div className="rounded-2xl bg-surface p-6 text-center shadow-map">
          <p className="text-sm text-text-secondary">
            No regions downloaded yet. Tap above to select an area on the map.
          </p>
        </div>
      </div>
    </div>
  );
}
