export function SavedScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-background p-6 text-center">
      <div className="rounded-2xl bg-surface p-8 shadow-map">
        <h2 className="text-lg font-semibold text-text-primary">Saved</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Your saved facilities and regions will appear here.
        </p>
      </div>
    </div>
  );
}
