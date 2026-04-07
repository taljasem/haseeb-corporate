import * as Lucide from "lucide-react";
import { getTaskTypeMeta } from "../../engine/mockEngine";

export default function TaskTypePill({ type, size = "sm" }) {
  const meta = getTaskTypeMeta(type);
  const Icon = Lucide[meta.icon] || Lucide.MessageSquare;
  const iconSize = size === "md" ? 13 : 11;
  const fontSize = size === "md" ? 11 : 10;
  const padding = size === "md" ? "5px 11px" : "4px 9px";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding,
        background: `${meta.color}19`,
        border: `1px solid ${meta.color}40`,
        borderRadius: 4,
        color: meta.color,
        fontSize,
        fontWeight: 600,
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
        flexShrink: 0,
        fontFamily: "inherit",
      }}
    >
      <Icon size={iconSize} strokeWidth={2.2} />
      {meta.label}
    </span>
  );
}
