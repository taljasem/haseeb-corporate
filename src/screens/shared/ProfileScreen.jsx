import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Shield, Eye, GavelIcon, Wrench, BookOpen, TrendingUp, CheckCircle2,
} from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import Spinner from "../../components/shared/Spinner";
import { useTenant } from "../../components/shared/TenantContext";
import { formatRelativeTime } from "../../utils/relativeTime";
import { formatDate } from "../../utils/format";
import {
  getUserProfile,
  getUserStats,
  getUserResponsibilities,
  getUserRecentActivity,
  getUserNotes,
  updateUserNotes,
} from "../../engine/mockEngine";
import EditProfileModal from "../../components/profile/EditProfileModal";
import FullActivitySlideOver from "../../components/profile/FullActivitySlideOver";

const ROLE_ACCENT = {
  Owner:  "var(--role-owner)",
  CFO:    "var(--accent-primary)",
  Junior: "var(--semantic-info)",
};

function normalizeRole(r) {
  if (!r) return "CFO";
  const s = String(r).toLowerCase();
  if (s.startsWith("own")) return "Owner";
  if (s.startsWith("cfo")) return "CFO";
  return "Junior";
}

function getInitials(name) {
  if (!name) return "?";
  return name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

export default function ProfileScreen({ role: roleRaw = "CFO" }) {
  const role = normalizeRole(roleRaw);
  const { t } = useTranslation("profile");
  const accent = ROLE_ACCENT[role];

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [resp, setResp] = useState(null);
  const [activity, setActivity] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);

  const loadProfile = () => getUserProfile().then(setProfile);
  useEffect(() => {
    loadProfile();
    getUserStats(role).then(setStats);
    getUserResponsibilities(role).then(setResp);
    getUserRecentActivity(10).then(setActivity);
  }, [role]);

  if (!profile) {
    return <div style={{ padding: 28, color: "var(--text-tertiary)" }}>{t("loading")}</div>;
  }

  const subtitleKey = role === "Owner" ? "subtitle_owner" : role === "CFO" ? "subtitle_cfo" : "subtitle_junior";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Hero band */}
      <div
        style={{
          padding: "22px 28px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          background: `linear-gradient(180deg, ${accent}1A 0%, transparent 100%)`,
          flexShrink: 0,
        }}
      >
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: "var(--text-primary)", letterSpacing: "-0.3px", lineHeight: 1 }}>
          {t("title")}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 6 }}>
          {t(subtitleKey)}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 32px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <HeaderCard profile={profile} role={role} accent={accent} onEdit={() => setEditOpen(true)} />
          {stats && role !== "Owner" && <StatsCard stats={stats} role={role} />}
          {stats && role === "Owner" && <StatsCard stats={stats} role={role} />}
          {resp && <ResponsibilitiesCard role={role} items={resp} />}
          {activity && <ActivityCard items={activity} onViewFull={() => setFullOpen(true)} />}
          {role === "Junior" && <NotesCard />}
        </div>
      </div>

      <EditProfileModal
        open={editOpen}
        profile={profile}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => setProfile(updated)}
      />
      <FullActivitySlideOver open={fullOpen} onClose={() => setFullOpen(false)} />
    </div>
  );
}

function Card({ title, subtitle, headerRight, children }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        padding: "20px 22px",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
        <div>
          {title && <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)", letterSpacing: "-0.2px", lineHeight: 1.1 }}>{title}</div>}
          {subtitle && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontWeight: 600, letterSpacing: "0.1em" }}>{subtitle}</div>}
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

function HeaderCard({ profile, role, accent, onEdit }) {
  const { t } = useTranslation("profile");
  const { t: th } = useTranslation("header");
  const { tenant } = useTenant();
  const roleLabel = role === "Owner" ? th("role_owner") : role === "CFO" ? th("role_cfo") : t("subtitle_junior");
  const initials = getInitials(profile.name);
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        padding: "22px 24px",
        marginBottom: 14,
        display: "flex",
        gap: 20,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 72, height: 72, borderRadius: "50%",
          background: profile.avatarColor || accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 26, fontWeight: 700,
          fontFamily: "'Bebas Neue', sans-serif",
          letterSpacing: "0.02em",
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
          {t("header_card.label")}
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: "var(--text-primary)", letterSpacing: "-0.3px", marginTop: 2, lineHeight: 1.1 }}>
          {profile.name}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
          {roleLabel} · <LtrText>{tenant?.company?.name || "—"}</LtrText>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 10, display: "flex", gap: 18, flexWrap: "wrap" }}>
          <span><LtrText>{profile.email}</LtrText></span>
          <span>·</span>
          <span>{t("header_card.joined")} {formatDate(profile.joinedAt, { withYear: true })}</span>
        </div>
        {profile.bio && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 12, lineHeight: 1.6, maxWidth: 560 }}>
            {profile.bio}
          </div>
        )}
      </div>
      <button
        onClick={onEdit}
        style={{
          background: "transparent", color: "var(--text-secondary)",
          border: "1px solid var(--border-strong)", padding: "8px 14px",
          borderRadius: 6, cursor: "pointer",
          fontSize: 11, fontWeight: 600, fontFamily: "inherit",
          flexShrink: 0,
        }}
      >
        {t("header_card.edit_profile")}
      </button>
    </div>
  );
}

function StatsCard({ stats, role }) {
  const { t } = useTranslation("profile");
  const primary = stats.primary;
  return (
    <Card title={t("stats.title")} subtitle={t("stats.subtitle")}>
      <div style={{ display: "flex", gap: 18, alignItems: "baseline", marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 34, fontWeight: 500, color: "var(--accent-primary)", fontVariantNumeric: "tabular-nums" }}>
          <LtrText>{primary.value}{primary.unit === "pct" ? "%" : ""}</LtrText>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)" }}>
          {t(`stats.primary.${primary.label}`)}
        </div>
        {primary.delta && (
          <div style={{ fontSize: 11, fontWeight: 600, color: primary.trend === "up" ? "var(--accent-primary)" : "var(--semantic-danger)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <TrendingUp size={11} /><LtrText>{primary.delta}</LtrText>
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {stats.cards.map((c) => (
          <div
            key={c.key}
            style={{
              background: "var(--bg-surface-sunken)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 500, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
              <LtrText>{c.value}</LtrText>
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginTop: 4 }}>
              {t(`stats.cards.${c.key}`)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ResponsibilitiesCard({ role, items }) {
  const { t } = useTranslation("profile");
  const typeIcon = { approval: Shield, oversight: Eye, governance: BookOpen, execution: Wrench };
  return (
    <Card
      title={t("responsibilities.title")}
      subtitle={t("responsibilities.subtitle")}
    >
      {items.length === 0 ? (
        <EmptyState icon={BookOpen} title={t("responsibilities.empty")} description="" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {items.map((r) => {
            const Icon = typeIcon[r.type] || BookOpen;
            return (
              <div
                key={r.id}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--bg-surface-sunken)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={13} color="var(--accent-primary)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                    <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{t(`responsibilities.type_${r.type}`)}</span>
                    <span> · {r.scope}</span>
                  </div>
                  {r.description && (
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.5 }}>{r.description}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ActivityCard({ items, onViewFull }) {
  const { t } = useTranslation("profile");
  return (
    <Card title={t("activity.title")} subtitle={t("activity.subtitle")}>
      {items.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t("activity.empty")} description="" />
      ) : (
        <div>
          {items.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 0",
                borderBottom: "1px solid var(--border-subtle)",
                fontSize: 13, color: "var(--text-secondary)",
              }}
            >
              <span style={{ flex: 1 }}>
                {t(`activity.actions.${a.action}`, { target: a.target, defaultValue: a.action })}
              </span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text-tertiary)" }}>
                {formatRelativeTime(a.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <button
          onClick={onViewFull}
          style={{
            background: "transparent", color: "var(--accent-primary)",
            border: "none", padding: 0, cursor: "pointer",
            fontSize: 12, fontFamily: "inherit", fontWeight: 500,
          }}
        >
          {t("activity.view_full")}
        </button>
      </div>
    </Card>
  );
}

function NotesCard() {
  const { t } = useTranslation("profile");
  const [notes, setNotes] = useState(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef(null);

  useEffect(() => {
    getUserNotes().then((n) => {
      setNotes(n);
      setDraft(n.content || "");
    });
  }, []);

  const saveNow = async () => {
    if (!notes) return;
    if (draft === notes.content) return;
    setSaving(true);
    const updated = await updateUserNotes(draft);
    setNotes(updated);
    setSaving(false);
  };

  if (!notes) return null;

  return (
    <Card title={t("notes.title")} subtitle={t("notes.subtitle")}>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={saveNow}
        placeholder={t("notes.placeholder")}
        rows={8}
        style={{
          width: "100%",
          background: "var(--bg-surface-sunken)",
          border: "1px solid var(--border-default)",
          borderRadius: 8,
          padding: "12px 14px",
          color: "var(--text-primary)",
          fontSize: 13, fontFamily: "inherit",
          outline: "none", resize: "vertical",
          lineHeight: 1.6,
        }}
      />
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8, fontFamily: "'DM Mono', monospace" }}>
        {saving ? t("notes.saving") : t("notes.saved", { time: formatRelativeTime(notes.lastSaved) })}
      </div>
    </Card>
  );
}
