/**
 * AminahTag — enforces de-noise rule for repeated Aminah tags.
 * First instance in a section: full opacity. Subsequent: 0.4.
 */
import { Sparkles } from "lucide-react";

export default function AminahTag({ isFirstInSection = true }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "4px 10px",
        borderRadius: 4,
        background: "rgba(139, 92, 246, 0.10)",
        color: "#8B5CF6",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        opacity: isFirstInSection ? 1 : 0.4,
      }}
    >
      <Sparkles size={12} />
      <span>AMINAH</span>
    </div>
  );
}
