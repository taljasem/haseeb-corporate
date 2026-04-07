import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import Avatar from "../../components/taskbox/Avatar";
import { getTeamMembersWithResponsibilities } from "../../engine/mockEngine";
import { formatRelativeTime } from "../../utils/relativeTime";

function MemberRow({ m }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 160px 1fr 90px 100px 100px",
        gap: 12,
        alignItems: "center",
        padding: "14px 18px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Avatar person={m} size={30} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              color: "#E6EDF3",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {m.name}
          </div>
          <div style={{ fontSize: 10, color: "#5B6570" }}>{m.initials}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#8B98A5" }}>{m.role}</div>
      <div style={{ fontSize: 12, color: "#8B98A5" }}>{m.accessLevel}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: m.isOnline ? "#00C48C" : "rgba(255,255,255,0.15)",
            boxShadow: m.isOnline ? "0 0 6px rgba(0,196,140,0.5)" : "none",
          }}
        />
        <span style={{ fontSize: 11, color: m.isOnline ? "#00C48C" : "#5B6570" }}>
          {m.isOnline ? "online" : "offline"}
        </span>
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          color: "#5B6570",
        }}
      >
        {formatRelativeTime(m.lastActive)}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          style={{
            background: "transparent",
            color: "#8B98A5",
            border: "1px solid rgba(255,255,255,0.12)",
            padding: "5px 10px",
            borderRadius: 5,
            cursor: "pointer",
            fontSize: 10,
            fontFamily: "inherit",
          }}
        >
          Edit
        </button>
      </div>
    </div>
  );
}

function ResponsibilityCard({ m }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: "14px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Avatar person={m} size={28} />
        <div>
          <div style={{ fontSize: 13, color: "#E6EDF3", fontWeight: 500 }}>
            {m.name}
          </div>
          <div style={{ fontSize: 10, color: "#5B6570" }}>{m.role}</div>
        </div>
      </div>
      {m.responsibilities && m.responsibilities.length > 0 ? (
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          {m.responsibilities.map((r, i) => (
            <li
              key={i}
              style={{
                fontSize: 12,
                color: "#8B98A5",
                lineHeight: 1.4,
                paddingLeft: 10,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 7,
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#00C48C",
                }}
              />
              {r}
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ fontSize: 11, color: "#5B6570", fontStyle: "italic" }}>
          No routing rules assigned
        </div>
      )}
    </div>
  );
}

export default function TeamScreen() {
  const [members, setMembers] = useState(null);
  useEffect(() => {
    getTeamMembersWithResponsibilities().then(setMembers);
  }, []);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 28,
                color: "#E6EDF3",
                letterSpacing: "-0.3px",
                lineHeight: 1,
              }}
            >
              TEAM
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "#5B6570",
                marginTop: 6,
              }}
            >
              WHO HAS ACCESS TO HASEEB
            </div>
          </div>
          <button
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#00C48C",
              color: "#fff",
              border: "none",
              padding: "9px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            <UserPlus size={14} strokeWidth={2.4} />
            Invite team member
          </button>
        </div>

        {/* Table */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "180px 160px 1fr 90px 100px 100px",
              gap: 12,
              padding: "10px 18px",
              background: "rgba(255,255,255,0.03)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#5B6570",
            }}
          >
            <div>NAME</div>
            <div>ROLE</div>
            <div>ACCESS LEVEL</div>
            <div>STATUS</div>
            <div>LAST ACTIVE</div>
            <div>ACTIONS</div>
          </div>
          {(members || []).map((m) => (
            <MemberRow key={m.id} m={m} />
          ))}
        </div>

        {/* Responsibilities */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.15em",
            color: "#5B6570",
            marginBottom: 10,
          }}
        >
          WHO HANDLES WHAT
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          {(members || [])
            .filter((m) => m.id !== "owner" && m.id !== "cfo")
            .map((m) => (
              <ResponsibilityCard key={m.id} m={m} />
            ))}
        </div>
        <div>
          <a
            style={{
              fontSize: 12,
              color: "#5B6570",
              cursor: "not-allowed",
              fontStyle: "italic",
            }}
          >
            Manage routing rules → (CFO only)
          </a>
        </div>
      </div>
    </div>
  );
}
