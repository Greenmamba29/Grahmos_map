import type { ReactNode } from "react";
import { BottomTabBar } from "@/nav/BottomTabBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white text-ink">
      <main className="relative flex-1 overflow-hidden">{children}</main>
      <BottomTabBar />
    </div>
  );
}
