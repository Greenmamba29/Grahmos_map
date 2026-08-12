import { BrowserRouter } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { AppRouter } from "@/app/router";
import { NetworkStatusProvider } from "@/network/NetworkStatusProvider";

export default function App() {
  return (
    <NetworkStatusProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AppShell>
          <AppRouter />
        </AppShell>
      </BrowserRouter>
    </NetworkStatusProvider>
  );
}
