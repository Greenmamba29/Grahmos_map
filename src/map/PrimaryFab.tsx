import { Navigation } from "lucide-react";
import { IconButton } from "@/ui/IconButton";
import { useNavigate } from "react-router-dom";

export function PrimaryFab() {
  const navigate = useNavigate();
  return (
    <IconButton
      icon={<Navigation size={24} fill="currentColor" />}
      variant="accent"
      size="lg"
      onClick={() => navigate("/routes")}
      aria-label="Get directions to nearest safe route"
    />
  );
}
