import { useState } from "react";
import { LocateFixed } from "lucide-react";
import { IconButton } from "@/ui/IconButton";
import { useMap } from "./MapProvider";

export function MyLocationButton() {
  const { map } = useMap();
  const [locating, setLocating] = useState(false);

  function handleClick() {
    if (!map) return;
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.easeTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: Math.max(map.getZoom(), 14),
        });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <IconButton
      icon={<LocateFixed size={20} className={locating ? "animate-pulse" : undefined} />}
      onClick={handleClick}
      aria-label="Center on my location"
    />
  );
}
