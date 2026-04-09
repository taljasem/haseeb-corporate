import {
  ClipboardList, Eye, Search, FileText, BarChart2, BarChart3, Pencil, ShieldCheck,
  CheckCircle, Tag, Upload, CheckSquare, CheckCircle2, AlertTriangle, HelpCircle,
  MessageCircle, Flag, Info, MessageSquare,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTaskTypeMeta } from "../../engine/mockEngine";

const ICON_MAP = {
  ClipboardList, Eye, Search, FileText, BarChart2, BarChart3, Pencil, ShieldCheck,
  CheckCircle, Tag, Upload, CheckSquare, CheckCircle2, AlertTriangle, HelpCircle,
  MessageCircle, Flag, Info, MessageSquare,
};

export default function TaskTypePill({ type, size = "sm" }) {
  const { t } = useTranslation("taskbox");
  const meta = getTaskTypeMeta(type);
  const Icon = ICON_MAP[meta.icon] || MessageSquare;
  const iconSize = size === "md" ? 13 : 11;
  const fontSize = size === "md" ? 11 : 10;
  const padding = size === "md" ? "5px 11px" : "4px 9px";
  const label = t(`task_types.${meta.id}`, { defaultValue: meta.label });

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
      {label}
    </span>
  );
}
