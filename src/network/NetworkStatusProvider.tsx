import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useOfflineStore } from "@/store/useOfflineStore";

const NetworkStatusContext = createContext<boolean>(true);

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const setOnline = useOfflineStore((s) => s.setOnline);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setOnline(false);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnline]);

  return (
    <NetworkStatusContext.Provider value={isOnline}>
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useIsOnline() {
  return useContext(NetworkStatusContext);
}
