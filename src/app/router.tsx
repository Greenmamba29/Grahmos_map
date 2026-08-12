import { Routes, Route } from "react-router-dom";
import { ExploreScreen } from "@/screens/ExploreScreen";
import { SavedScreen } from "@/screens/SavedScreen";
import { AlertsScreen } from "@/screens/AlertsScreen";
import { RouteScreen } from "@/route/RouteScreen";
import { OfflineScreen } from "@/offline/OfflineScreen";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<ExploreScreen />} />
      <Route path="/routes" element={<RouteScreen />} />
      <Route path="/saved" element={<SavedScreen />} />
      <Route path="/offline" element={<OfflineScreen />} />
      <Route path="/alerts" element={<AlertsScreen />} />
    </Routes>
  );
}
