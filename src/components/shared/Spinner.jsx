import { Loader2 } from "lucide-react";

/**
 * Spinner — inline loading indicator. Wraps Lucide Loader2 with a spin
 * animation. Used inside buttons during async operations.
 */
export default function Spinner({ size = 16, color = "currentColor", style }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        animation: "haseeb-spin 1s linear infinite",
        ...style,
      }}
    >
      <Loader2 size={size} strokeWidth={2.2} />
    </span>
  );
}
