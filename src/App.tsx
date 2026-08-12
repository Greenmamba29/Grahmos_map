import { useState } from 'react'
import { ExploreScreen } from '@/screens/ExploreScreen'
import {
  AlertsScreen,
  OfflineScreen,
  RoutesScreen,
  SavedScreen,
} from '@/screens/placeholders'
import { BottomTabBar, type AppTab } from '@/components/layout/BottomTabBar'

export default function App() {
  const [tab, setTab] = useState<AppTab>('explore')

  return (
    <div className="relative mx-auto h-dvh w-full max-w-lg overflow-hidden bg-map-wash shadow-xl sm:max-w-none">
      <main className="absolute inset-0 bottom-[3.5rem]">
        {tab === 'explore' ? (
          <ExploreScreen onOpenRoutes={() => setTab('routes')} />
        ) : null}
        {tab === 'routes' ? <RoutesScreen /> : null}
        {tab === 'saved' ? <SavedScreen /> : null}
        {tab === 'offline' ? <OfflineScreen /> : null}
        {tab === 'alerts' ? <AlertsScreen /> : null}
      </main>
      <BottomTabBar active={tab} onChange={setTab} />
    </div>
  )
}
