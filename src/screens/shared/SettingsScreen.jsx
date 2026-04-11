import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  User, Palette, Globe, Bell, Shield, Plug, ClipboardList,
  Check, AlertTriangle, LogOut, Monitor, Smartphone, Tablet,
} from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import Spinner from "../../components/shared/Spinner";
import { useTenant } from "../../components/shared/TenantContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../i18n/LanguageContext";
import { formatRelativeTime } from "../../utils/relativeTime";
import { formatDate } from "../../utils/format";
import {
  getUserProfile,
  getNotificationPreferences,
  updateNotificationPreferences,
  getActiveSessions,
  signOutSession,
  signOutAllOtherSessions,
  getTwoFactorStatus,
  disableTwoFactor,
  getIntegrations,
  removeIntegration,
  addIntegration,
  getAccountAuditLog,
} from "../../engine/mockEngine";
import ChangePasswordModal from "../../components/settings/ChangePasswordModal";
import EnableTwoFactorModal from "../../components/settings/EnableTwoFactorModal";
import ConfigureIntegrationModal from "../../components/settings/ConfigureIntegrationModal";
import AddIntegrationModal from "../../components/settings/AddIntegrationModal";

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

export default function SettingsScreen({ role: roleRaw = "CFO" }) {
  const role = normalizeRole(roleRaw);
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const { t: ts } = useTranslation("sidebar");
  const accent = ROLE_ACCENT[role] || "var(--accent-primary)";

  const sections = useMemo(() => {
    const list = [
      { id: "account",       icon: User,           label: t("sections.account") },
      { id: "theme",         icon: Palette,        label: t("sections.theme") },
      { id: "language",      icon: Globe,          label: t("sections.language") },
      { id: "notifications", icon: Bell,           label: t("sections.notifications") },
      { id: "security",      icon: Shield,         label: t("sections.security") },
    ];
    if (role !== "Junior") list.push({ id: "integrations", icon: Plug, label: t("sections.integrations") });
    if (role === "Owner") list.push({ id: "audit_log", icon: ClipboardList, label: t("sections.audit_log") });
    return list;
  }, [role, t]);

  const [active, setActive] = useState("account");
  useEffect(() => {
    if (!sections.find((s) => s.id === active)) setActive(sections[0].id);
  }, [sections, active]);

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
          {t("subtitle")}
        </div>
      </div>

      {/* Body: nav rail + content panel */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <aside
          style={{
            width: 220, flexShrink: 0,
            background: "var(--bg-surface)",
            borderInlineEnd: "1px solid var(--border-default)",
            padding: "18px 0",
            overflowY: "auto",
          }}
        >
          {sections.map((s) => {
            const on = active === s.id;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "10px 20px",
                  background: on ? "var(--bg-surface-sunken)" : "transparent",
                  border: "none",
                  color: on ? "var(--text-primary)" : "var(--text-tertiary)",
                  fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                  letterSpacing: "0.05em", textAlign: "start", cursor: "pointer",
                  boxShadow: on ? `inset 2px 0 0 ${accent}` : "none",
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--bg-surface-sunken)"; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}
              >
                <Icon size={14} strokeWidth={2} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </aside>

        <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 32px", minWidth: 0 }}>
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            {active === "account"       && <AccountSection role={role} />}
            {active === "theme"         && <ThemeSection />}
            {active === "language"      && <LanguageSection />}
            {active === "notifications" && <NotificationsSection role={role} />}
            {active === "security"      && <SecuritySection />}
            {active === "integrations"  && role !== "Junior" && <IntegrationsSection />}
            {active === "audit_log"     && role === "Owner" && <AuditLogSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared card + form primitives ─────────────────────────────────────────
function Card({ title, description, children }) {
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
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)", letterSpacing: "-0.2px", lineHeight: 1.1 }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, marginBottom: 14 }}>
          {description}
        </div>
      )}
      {!description && <div style={{ height: 14 }} />}
      {children}
    </div>
  );
}

function FieldRow({ label, value, mono = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)" }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: mono ? "'DM Mono', monospace" : "inherit" }}>{value}</div>
    </div>
  );
}

function Toggle({ on, onChange, label, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border-subtle)", gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        onClick={() => onChange(!on)}
        aria-pressed={on}
        style={{
          width: 36, height: 20, borderRadius: 10,
          background: on ? "var(--accent-primary)" : "var(--border-default)",
          border: "none", padding: 2, cursor: "pointer", position: "relative",
          transition: "background 0.15s",
        }}
      >
        <span style={{
          display: "block", width: 16, height: 16, borderRadius: "50%",
          background: "#fff",
          transform: on ? "translateX(16px)" : "translateX(0)",
          transition: "transform 0.15s",
        }} />
      </button>
    </div>
  );
}

const btnPrimary = (saving = false) => ({
  background: "var(--accent-primary)", color: "#fff", border: "none",
  padding: "9px 16px", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer",
  fontSize: 12, fontWeight: 600, fontFamily: "inherit",
});
const btnSecondary = {
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid var(--border-strong)", padding: "9px 16px",
  borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit",
};
const btnDanger = {
  background: "transparent", color: "var(--semantic-danger)",
  border: "1px solid rgba(255,90,95,0.30)", padding: "7px 12px",
  borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600,
};

function Toast({ text, onClear }) {
  useEffect(() => {
    if (!text) return;
    const id = setTimeout(() => onClear && onClear(), 2500);
    return () => clearTimeout(id);
  }, [text, onClear]);
  if (!text) return null;
  return (
    <div
      style={{
        marginBottom: 14,
        background: "var(--accent-primary-subtle)",
        border: "1px solid rgba(0,196,140,0.30)",
        color: "var(--accent-primary)",
        padding: "10px 14px", borderRadius: 8,
        fontSize: 12, fontWeight: 500,
      }}
    >
      {text}
    </div>
  );
}

// ─── Sections ──────────────────────────────────────────────────────────────
function AccountSection({ role }) {
  const { t } = useTranslation("settings");
  const { t: ts } = useTranslation("sidebar");
  const { tenant } = useTenant();
  const [profile, setProfile] = useState(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { getUserProfile().then(setProfile); }, []);

  if (!profile) return <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{t("loading")}</div>;

  const roleLabel = ts(`items.${role === "Owner" ? "today" : role === "CFO" ? "today" : "today"}`, { defaultValue: role });
  const roleNameKey = role === "Owner" ? "role_owner" : role === "CFO" ? "role_cfo" : "role_junior";
  return (
    <>
      <Toast text={toast} onClear={() => setToast(null)} />
      <Card title={t("account.title")} description={t("account.description")}>
        <FieldRow label={t("account.field_name")} value={profile.name} />
        <FieldRow label={t("account.field_email")} value={<LtrText>{profile.email}</LtrText>} mono />
        <FieldRow label={t("account.field_role")} value={t(`change_password_modal.title`, { defaultValue: role }) && role} />
        <FieldRow label={t("account.field_tenant")} value={<LtrText>{tenant?.company?.name || "—"}</LtrText>} />
        <FieldRow label={t("account.field_joined")} value={formatDate(profile.joinedAt, { withYear: true })} />
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setPwOpen(true)} style={btnPrimary(false)}>
            {t("account.change_password")}
          </button>
        </div>
      </Card>
      <ChangePasswordModal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        onSaved={() => setToast(t("change_password_modal.saved"))}
      />
    </>
  );
}

function ThemeSection() {
  const { t } = useTranslation("settings");
  const { theme, setTheme } = useTheme();
  const options = [
    { id: "dark", label: t("theme.dark") },
    { id: "light", label: t("theme.light") },
  ];
  return (
    <Card title={t("theme.title")} description={t("theme.description")}>
      <div style={{ display: "flex", gap: 8 }}>
        {options.map((o) => {
          const on = theme === o.id;
          return (
            <button
              key={o.id}
              onClick={() => setTheme(o.id)}
              style={{
                flex: 1, padding: "14px 16px",
                background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)",
                border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid var(--border-default)",
                color: on ? "var(--accent-primary)" : "var(--text-secondary)",
                borderRadius: 8, cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function LanguageSection() {
  const { t } = useTranslation("settings");
  const { language, setLanguage } = useLanguage();
  const options = [
    { id: "en", label: t("language.language_en") },
    { id: "ar", label: t("language.language_ar") },
  ];
  const now = new Date();
  return (
    <Card title={t("language.title")} description={t("language.description")}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 8 }}>
          {t("language.field_language")}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {options.map((o) => {
            const on = language === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setLanguage(o.id)}
                style={{
                  flex: 1, padding: "12px 14px",
                  background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)",
                  border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid var(--border-default)",
                  color: on ? "var(--accent-primary)" : "var(--text-secondary)",
                  borderRadius: 8, cursor: "pointer",
                  fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
      <FieldRow label={t("language.field_date_format")} value={formatDate(now, { withYear: true })} />
      <FieldRow label={t("language.field_number_format")} value={<LtrText>{(1234567.89).toLocaleString(language === "ar" ? "ar" : "en-US")}</LtrText>} mono />
      <FieldRow label={t("language.field_currency")} value={<><LtrText>{t("language.currency_value")}</LtrText> <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginInlineStart: 8 }}>({t("language.currency_note")})</span></>} />
      <FieldRow label={t("language.field_timezone")} value={<LtrText>{t("language.timezone_value")}</LtrText>} />
    </Card>
  );
}

function NotificationsSection({ role }) {
  const { t } = useTranslation("settings");
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { getNotificationPreferences(role).then(setPrefs); }, [role]);
  if (!prefs) return <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{t("loading")}</div>;

  const categoryKeys = [
    "task_assignments", "approval_requests", "mentions", "daily_digest", "weekly_summary",
  ];
  if (role === "Owner" || role === "CFO") categoryKeys.push("audit_alerts");
  if (role === "CFO" || role === "Junior") categoryKeys.push("reconciliation_alerts");
  if (role === "Owner" || role === "CFO") categoryKeys.push("budget_alerts");

  const setCat = (k, v) => setPrefs({ ...prefs, categories: { ...prefs.categories, [k]: v } });

  const save = async () => {
    setSaving(true);
    await updateNotificationPreferences(role, prefs);
    setSaving(false);
    setToast(t("notifications.saved"));
  };

  return (
    <>
      <Toast text={toast} onClear={() => setToast(null)} />
      <Card title={t("notifications.title")} description={t("notifications.description")}>
        <Toggle
          on={prefs.email_enabled}
          onChange={(v) => setPrefs({ ...prefs, email_enabled: v })}
          label={t("notifications.email_enabled")}
          sub={t("notifications.email_sub")}
        />
        <Toggle
          on={prefs.in_app_enabled}
          onChange={(v) => setPrefs({ ...prefs, in_app_enabled: v })}
          label={t("notifications.in_app_enabled")}
          sub={t("notifications.in_app_sub")}
        />
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 18, marginBottom: 4 }}>
          {t("notifications.categories_heading")}
        </div>
        {categoryKeys.map((k) => (
          <Toggle
            key={k}
            on={!!prefs.categories[k]}
            onChange={(v) => setCat(k, v)}
            label={t(`notifications.categories.${k}`)}
          />
        ))}
        <div style={{ marginTop: 16 }}>
          <button onClick={save} disabled={saving} style={btnPrimary(saving)}>
            {saving ? <><Spinner size={13} />&nbsp;{t("notifications.save")}</> : t("notifications.save")}
          </button>
        </div>
      </Card>
    </>
  );
}

function SecuritySection() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [twoFA, setTwoFA] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [enableOpen, setEnableOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const reload = () => {
    getTwoFactorStatus().then(setTwoFA);
    getActiveSessions().then(setSessions);
  };
  useEffect(() => { reload(); }, []);

  const handleDisable2FA = async () => {
    await disableTwoFactor("000000");
    reload();
  };

  const handleSignOut = async (id) => {
    await signOutSession(id);
    getActiveSessions().then(setSessions);
  };
  const handleSignOutAll = async () => {
    const r = await signOutAllOtherSessions();
    getActiveSessions().then(setSessions);
    setToast(t("security.signed_out_toast", { count: r.count }));
  };

  return (
    <>
      <Toast text={toast} onClear={() => setToast(null)} />
      <Card title={t("security.title")} description={t("security.description")}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border-subtle)", gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
              {t("security.two_factor_heading")}
            </div>
            <div style={{ fontSize: 11, color: twoFA?.enabled ? "var(--accent-primary)" : "var(--text-tertiary)", marginTop: 2 }}>
              {twoFA?.enabled ? t("security.two_factor_enabled") : t("security.two_factor_disabled")} — {twoFA?.enabled ? t("security.two_factor_sub_enabled") : t("security.two_factor_sub_disabled")}
            </div>
          </div>
          {twoFA?.enabled ? (
            <button onClick={handleDisable2FA} style={btnDanger}>{t("security.disable_2fa")}</button>
          ) : (
            <button onClick={() => setEnableOpen(true)} style={btnPrimary(false)}>{t("security.enable_2fa")}</button>
          )}
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 18, marginBottom: 4 }}>
          {t("security.sessions_heading")}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 8 }}>
          {t("security.sessions_sub")}
        </div>
        {!sessions ? (
          <div style={{ color: "var(--text-tertiary)", fontSize: 12, padding: 12 }}>{t("loading")}</div>
        ) : (
          sessions.map((s) => <SessionRow key={s.id} s={s} onSignOut={() => handleSignOut(s.id)} />)
        )}
        {sessions && sessions.length > 1 && (
          <div style={{ marginTop: 14 }}>
            <button onClick={handleSignOutAll} style={btnSecondary}>
              <LogOut size={12} style={{ marginInlineEnd: 6, verticalAlign: "middle" }} />
              {t("security.sign_out_all_others")}
            </button>
          </div>
        )}
      </Card>
      <EnableTwoFactorModal
        open={enableOpen}
        onClose={() => setEnableOpen(false)}
        onEnabled={reload}
      />
    </>
  );
}

function SessionRow({ s, onSignOut }) {
  const { t } = useTranslation("settings");
  const Icon = /iPhone|Mobile/i.test(s.device) ? Smartphone : /iPad|Tablet/i.test(s.device) ? Tablet : Monitor;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <Icon size={16} color="var(--text-tertiary)" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
          <LtrText>{s.device}</LtrText> · <LtrText>{s.browser}</LtrText>
          {s.isCurrent && (
            <span style={{ marginInlineStart: 8, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--accent-primary)", background: "var(--accent-primary-subtle)", padding: "2px 6px", borderRadius: 3 }}>
              {t("security.session_current")}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
          {s.location} · {formatRelativeTime(s.lastActive)}
        </div>
      </div>
      {!s.isCurrent && (
        <button onClick={onSignOut} style={btnDanger}>{t("security.session_sign_out")}</button>
      )}
    </div>
  );
}

function IntegrationsSection() {
  const { t } = useTranslation("settings");
  const [items, setItems] = useState(null);
  const [configuring, setConfiguring] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const reload = () => { getIntegrations().then(setItems); };
  useEffect(() => { reload(); }, []);

  return (
    <>
      <Card title={t("integrations.title")} description={t("integrations.description")}>
        {!items ? (
          <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{t("loading")}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={Plug} title={t("empty_integrations")} description="" />
        ) : (
          items.map((i) => <IntegrationRow key={i.id} i={i} onConfigure={() => setConfiguring(i)} onDisconnect={async () => { await removeIntegration(i.id); reload(); }} />)
        )}
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setAddOpen(true)} style={btnPrimary(false)}>
            {t("integrations.add_integration")}
          </button>
        </div>
      </Card>
      <ConfigureIntegrationModal
        open={!!configuring}
        integration={configuring}
        onClose={() => setConfiguring(null)}
        onSaved={reload}
      />
      <AddIntegrationModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={async (id) => { await addIntegration(id); reload(); }}
      />
    </>
  );
}

function IntegrationRow({ i, onConfigure, onDisconnect }) {
  const { t } = useTranslation("settings");
  const statusColor = {
    connected:    "var(--accent-primary)",
    disconnected: "var(--text-tertiary)",
    error:        "var(--semantic-danger)",
  }[i.status];
  const statusLabel = {
    connected:    t("integrations.status_connected"),
    disconnected: t("integrations.status_disconnected"),
    error:        t("integrations.status_error"),
  }[i.status];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-surface-sunken)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Plug size={14} color="var(--text-tertiary)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{i.name}</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, display: "flex", gap: 8 }}>
          <span style={{ color: statusColor, fontWeight: 600 }}>
            {i.status === "error" ? <AlertTriangle size={10} style={{ verticalAlign: "middle", marginInlineEnd: 3 }} /> : i.status === "connected" ? <Check size={10} style={{ verticalAlign: "middle", marginInlineEnd: 3 }} /> : null}
            {statusLabel}
          </span>
          <span>·</span>
          <span>{i.category}</span>
          <span>·</span>
          <span>{i.lastSync ? t("integrations.last_sync", { time: formatRelativeTime(i.lastSync) }) : t("integrations.never_synced")}</span>
        </div>
      </div>
      {i.status === "connected" ? (
        <>
          <button onClick={onConfigure} style={btnSecondary}>{t("integrations.configure")}</button>
          <button onClick={onDisconnect} style={btnDanger}>{t("integrations.disconnect")}</button>
        </>
      ) : (
        <button onClick={onConfigure} style={btnPrimary(false)}>{t("integrations.connect")}</button>
      )}
    </div>
  );
}

function AuditLogSection() {
  const { t } = useTranslation("settings");
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => { getAccountAuditLog({ action: filter }).then(setItems); }, [filter]);

  const actions = ["all", "login", "settings_change", "approval", "post_je", "rule_create", "role_change", "reconciliation", "budget_approve", "integration"];

  return (
    <Card title={t("audit_log.title")} description={t("audit_log.description")}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {actions.map((a) => {
          const on = filter === a;
          return (
            <button
              key={a}
              onClick={() => setFilter(a)}
              style={{
                fontSize: 11, fontWeight: 600, padding: "5px 12px",
                borderRadius: 14,
                background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)",
                border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid var(--border-default)",
                color: on ? "var(--accent-primary)" : "var(--text-tertiary)",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {t(`audit_log.filter_${a}`)}
            </button>
          );
        })}
      </div>
      {!items ? (
        <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{t("loading")}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t("empty_audit")} description="" />
      ) : (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "110px 150px 140px 1fr 110px", gap: 10, padding: "8px 0", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-subtle)" }}>
            <div>{t("audit_log.col_time")}</div>
            <div>{t("audit_log.col_actor")}</div>
            <div>{t("audit_log.col_action")}</div>
            <div>{t("audit_log.col_target")}</div>
            <div>{t("audit_log.col_ip")}</div>
          </div>
          {items.map((e) => (
            <div key={e.id} style={{ display: "grid", gridTemplateColumns: "110px 150px 140px 1fr 110px", gap: 10, padding: "10px 0", fontSize: 12, color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)", alignItems: "center" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text-tertiary)" }}>{formatRelativeTime(e.timestamp)}</div>
              <div style={{ color: "var(--text-primary)" }}>{e.actor}</div>
              <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>{t(`audit_log.filter_${e.action}`, { defaultValue: e.action })}</div>
              <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.target}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text-tertiary)" }}><LtrText>{e.ipAddress}</LtrText></div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
