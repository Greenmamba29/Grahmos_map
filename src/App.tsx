import { useAppStore } from "./store/appStore";
import { useLoadFacilities } from "./hooks/useFacilities";
import { BottomTabBar } from "./components/shell/BottomTabBar";
import { OfflineBanner } from "./components/shell/OfflineBanner";
import { ExploreScreen } from "./screens/ExploreScreen";
import { RoutesScreen } from "./screens/RoutesScreen";
import { SavedScreen } from "./screens/SavedScreen";
import { OfflineScreen } from "./screens/OfflineScreen";
import { AlertsScreen } from "./screens/AlertsScreen";

export default function App() {
  const tab = useAppStore((s) => s.tab);
  useLoadFacilities();

  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col overflow-hidden bg-white">
      <OfflineBanner />
      {tab === "explore" && <ExploreScreen />}
      {tab === "routes" && <RoutesScreen />}
      {tab === "saved" && <SavedScreen />}
      {tab === "offline" && <OfflineScreen />}
      {tab === "alerts" && <AlertsScreen />}
      <BottomTabBar />
    </div>
  );
}
