import { Layers } from "lucide-react";
import { IconButton } from "@/ui/IconButton";
import { useAppStore } from "@/store/useAppStore";

export function LayersButton() {
  const openLayersDrawer = useAppStore((s) => s.openLayersDrawer);
  return (
    <IconButton
      icon={<Layers size={20} />}
      onClick={openLayersDrawer}
      aria-label="Open map layers"
    />
  );
}
