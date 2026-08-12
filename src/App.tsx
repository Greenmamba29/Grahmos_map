import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BottomTabBar } from '@/components/shell/BottomTabBar';
import { UpdatePrompt } from '@/app/UpdatePrompt';
import { ExploreScreen } from '@/screens/ExploreScreen';
import { RoutesScreen } from '@/screens/RoutesScreen';
import { SavedScreen } from '@/screens/SavedScreen';
import { OfflineScreen } from '@/screens/OfflineScreen';
import { AlertsScreen } from '@/screens/AlertsScreen';
import { outboxStore } from '@/lib/db';
import { startOutboxSync } from '@/lib/outbox';

export default function App() {
  const location = useLocation();
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => startOutboxSync(), []);

  // Poll the outbox rather than push from it: writes happen in several places and
  // the badge only needs to be roughly live.
  useEffect(() => {
    let active = true;
    const tick = async () => {
      const queued = await outboxStore.all();
      if (active) setQueuedCount(queued.length);
    };
    void tick();
    const timer = window.setInterval(tick, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [location.pathname]);

  return (
    <div className="relative flex h-full flex-col bg-canvas">
      <main className="relative min-h-0 flex-1 overflow-hidden pb-[56px]">
        <Routes>
          <Route path="/" element={<ExploreScreen />} />
          <Route path="/routes" element={<RoutesScreen />} />
          <Route path="/saved" element={<SavedScreen />} />
          <Route path="/offline" element={<OfflineScreen />} />
          <Route path="/alerts" element={<AlertsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <BottomTabBar badges={{ '/alerts': queuedCount }} />
      <UpdatePrompt />
    </div>
  );
}
