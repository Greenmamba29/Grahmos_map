import { useState } from 'react';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { ExploreScreen } from '@/screens/ExploreScreen';
import { RoutesScreen } from '@/screens/RoutesScreen';
import { SavedScreen } from '@/screens/SavedScreen';
import { OfflineScreen } from '@/screens/OfflineScreen';
import { AlertsScreen } from '@/screens/AlertsScreen';
import { LayersProvider } from '@/context/LayersContext';
import type { TabId } from '@/types/navigation';

function ScreenRouter({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'explore':
      return <ExploreScreen />;
    case 'routes':
      return <RoutesScreen />;
    case 'saved':
      return <SavedScreen />;
    case 'offline':
      return <OfflineScreen />;
    case 'alerts':
      return <AlertsScreen />;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('explore');

  return (
    <LayersProvider>
      <div className="flex h-dvh flex-col bg-background">
        <main className="min-h-0 flex-1 overflow-hidden">
          <ScreenRouter tab={activeTab} />
        </main>
        <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </LayersProvider>
  );
}
