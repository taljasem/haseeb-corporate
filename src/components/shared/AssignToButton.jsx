import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
// HASEEB-402 D7 FINAL PUSH (2026-04-24) — direct mockEngine import moved
// to consumer-side legacy adapter. LIVE mode calls listTeamMembersLive.
import { getTeamMembers } from "../../api/budgets-legacy";

function PersonPlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function Avatar({ member, size = 24 }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `${member.color}22`,
        border: `1px solid ${member.color}55`,
        color: member.color,
        fontSize: size >= 28 ? 11 : 10,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontFamily: "inherit",
      }}
    >
      {member.initials}
    </span>
  );
}

/**
 * AssignToButton — small reusable button that opens a popover.
 * Props: itemType, itemId, currentAssignee (id), onAssign(id, note)
 */
export default function AssignToButton({
  itemType = "general",
  itemId,
  currentAssignee = null,
  onAssign,
  compact = false,
  variant = "default", // "default" | "ghost"
  onClickOverride = null, // when set, click bypasses the popover and fires this callback
}) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null);
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (open && !members) getTeamMembers().then(setMembers);
  }, [open, members]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const filtered = useMemo(() => {
    if (!members) return [];
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q)
    );
  }, [members, query]);

  const currentMember = members && currentAssignee
    ? members.find((m) => m.id === currentAssignee || m.name.toLowerCase().includes((currentAssignee || "").toLowerCase()))
    : null;

  const handleAssign = () => {
    if (!picked) return;
    onAssign && onAssign(picked.id, note);
    setConfirmation(picked);
    setOpen(false);
    setPicked(null);
    setNote("");
    setTimeout(() => setConfirmation(null), 2400);
  };

  const buttonLabel = currentMember
    ? t("assign.reassign", { initials: currentMember.initials })
    : confirmation
      ? t("assign.assigned_to", { name: confirmation.name.split(" ")[0] })
      : t("assign.button_assign");

  const isGhost = variant === "ghost";

  return (
    <span style={{ position: "relative", display: "inline-block" }} ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (onClickOverride) {
            onClickOverride();
            return;
          }
          setOpen((o) => !o);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 600,
          padding: compact ? "4px 8px" : "6px 10px",
          borderRadius: 6,
          background: confirmation
            ? "var(--accent-primary-subtle)"
            : isGhost
              ? "transparent"
              : "transparent",
          border: confirmation
            ? "1px solid var(--accent-primary-border)"
            : "1px solid var(--border-default)",
          color: confirmation ? "var(--accent-primary)" : "var(--text-tertiary)",
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "all 0.12s ease",
        }}
        onMouseEnter={(e) => {
          if (confirmation) return;
          e.currentTarget.style.background = "var(--bg-surface-sunken)";
          e.currentTarget.style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          if (confirmation) return;
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--text-tertiary)";
        }}
      >
        <PersonPlusIcon />
        {buttonLabel}
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          data-popover-anchor="end"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            width: 280,
            background: "var(--bg-surface-raised)",
            border: "1px solid var(--border-default)",
            borderRadius: 10,
            padding: 14,
            zIndex: 200,
            boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "var(--text-tertiary)",
              marginBottom: 10,
            }}
          >
            {t("assign.assign_to")}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("assign.search_placeholder")}
            style={{
              width: "100%",
              background: "var(--bg-surface-sunken)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              padding: "9px 12px",
              color: "var(--text-primary)",
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
              marginBottom: 10,
            }}
          />
          <div
            style={{
              maxHeight: 200,
              overflowY: "auto",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              marginBottom: 10,
            }}
          >
            {filtered.map((m) => {
              const active = picked && picked.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setPicked(m)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "8px 10px",
                    background: active ? "var(--accent-primary-subtle)" : "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                    textAlign: "start",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "var(--bg-surface-sunken)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Avatar member={m} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--text-primary)" }}>
                      {m.id === "self" ? t("assign.assign_to_myself") : m.name}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 1 }}>
                      {m.role}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("assign.note_placeholder")}
            style={{
              width: "100%",
              background: "var(--bg-surface-sunken)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              padding: "8px 12px",
              color: "var(--text-primary)",
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
              marginBottom: 10,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleAssign}
              disabled={!picked}
              style={{
                flex: 1,
                background: picked ? "var(--accent-primary)" : "rgba(0,196,140,0.25)",
                color: "#fff",
                border: "none",
                padding: "8px 12px",
                borderRadius: 6,
                cursor: picked ? "pointer" : "not-allowed",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              {t("assign.button_assign")}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setPicked(null);
                setNote("");
              }}
              style={{
                background: "transparent",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-strong)",
                padding: "8px 12px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
              }}
            >
              {t("assign.button_cancel")}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
