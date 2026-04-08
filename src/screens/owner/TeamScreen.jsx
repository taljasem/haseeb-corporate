import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus } from "lucide-react";
import Avatar from "../../components/taskbox/Avatar";
import { getTeamMembersWithResponsibilities } from "../../engine/mockEngine";
import { formatRelativeTime } from "../../utils/relativeTime";

function MemberRow({ m }) {
  const { t } = useTranslation("team");
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
              color: "var(--text-primary)",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {m.name}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{m.initials}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.role}</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.accessLevel}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: m.isOnline ? "var(--accent-primary)" : "var(--border-strong)",
            boxShadow: m.isOnline ? "0 0 6px rgba(0,196,140,0.5)" : "none",
          }}
        />
        <span style={{ fontSize: 11, color: m.isOnline ? "var(--accent-primary)" : "var(--text-tertiary)" }}>
          {m.isOnline ? t("online") : t("offline")}
        </span>
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          color: "var(--text-tertiary)",
        }}
      >
        {formatRelativeTime(m.lastActive)}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          style={{
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid rgba(255,255,255,0.12)",
            padding: "5px 10px",
            borderRadius: 5,
            cursor: "pointer",
            fontSize: 10,
            fontFamily: "inherit",
          }}
        >
          {t("edit")}
        </button>
      </div>
    </div>
  );
}

function ResponsibilityCard({ m }) {
  const { t } = useTranslation("team");
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: "14px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Avatar person={m} size={28} />
        <div>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
            {m.name}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{m.role}</div>
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
                color: "var(--text-secondary)",
                lineHeight: 1.4,
                paddingInlineStart: 10,
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
                  background: "var(--accent-primary)",
                }}
              />
              {r}
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontStyle: "italic" }}>
          {t("no_rules")}
        </div>
      )}
    </div>
  );
}

export default function TeamScreen() {
  const { t } = useTranslation("team");
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
                color: "var(--text-primary)",
                letterSpacing: "-0.3px",
                lineHeight: 1,
              }}
            >
              {t("title")}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
                marginTop: 6,
              }}
            >
              {t("subtitle")}
            </div>
          </div>
          <button
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--accent-primary)",
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
            {t("invite")}
          </button>
        </div>

        {/* Table */}
        <div
          style={{
            background: "var(--bg-surface)",
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
              background: "var(--bg-surface-sunken)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "var(--text-tertiary)",
            }}
          >
            <div>{t("columns.name")}</div>
            <div>{t("columns.role")}</div>
            <div>{t("columns.access_level")}</div>
            <div>{t("columns.status")}</div>
            <div>{t("columns.last_active")}</div>
            <div>{t("columns.actions")}</div>
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
            color: "var(--text-tertiary)",
            marginBottom: 10,
          }}
        >
          {t("who_handles_what")}
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
              color: "var(--text-tertiary)",
              cursor: "not-allowed",
              fontStyle: "italic",
            }}
          >
            {t("manage_rules")}
          </a>
        </div>
      </div>
    </div>
  );
}
