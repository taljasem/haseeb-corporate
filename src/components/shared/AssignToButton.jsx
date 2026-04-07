import { useEffect, useMemo, useRef, useState } from "react";
import { getTeamMembers } from "../../engine/mockEngine";

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
    ? `Reassign · ${currentMember.initials}`
    : confirmation
      ? `Assigned to ${confirmation.name.split(" ")[0]}`
      : "Assign";

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
            ? "rgba(0,196,140,0.10)"
            : isGhost
              ? "transparent"
              : "transparent",
          border: confirmation
            ? "1px solid rgba(0,196,140,0.30)"
            : "1px solid rgba(255,255,255,0.10)",
          color: confirmation ? "#00C48C" : "#5B6570",
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "all 0.12s ease",
        }}
        onMouseEnter={(e) => {
          if (confirmation) return;
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          e.currentTarget.style.color = "#E6EDF3";
        }}
        onMouseLeave={(e) => {
          if (confirmation) return;
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "#5B6570";
        }}
      >
        <PersonPlusIcon />
        {buttonLabel}
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            width: 280,
            background: "#0C0E12",
            border: "1px solid rgba(255,255,255,0.10)",
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
              color: "#5B6570",
              marginBottom: 10,
            }}
          >
            ASSIGN TO
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search team members..."
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 8,
              padding: "9px 12px",
              color: "#E6EDF3",
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
              border: "1px solid rgba(255,255,255,0.06)",
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
                    background: active ? "rgba(0,196,140,0.08)" : "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Avatar member={m} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "#E6EDF3" }}>
                      {m.id === "self" ? "Assign to myself" : m.name}
                    </div>
                    <div style={{ fontSize: 10, color: "#5B6570", marginTop: 1 }}>
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
            placeholder="Add a note (optional)"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#E6EDF3",
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
                background: picked ? "#00C48C" : "rgba(0,196,140,0.25)",
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
              Assign
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setPicked(null);
                setNote("");
              }}
              style={{
                background: "transparent",
                color: "#8B98A5",
                border: "1px solid rgba(255,255,255,0.15)",
                padding: "8px 12px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
