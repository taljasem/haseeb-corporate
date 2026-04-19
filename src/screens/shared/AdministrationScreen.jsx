import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Users, Plug, Flag, Shield, ClipboardList, CreditCard,
  AlertTriangle, Lock, Check,
} from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import Spinner from "../../components/shared/Spinner";
import TeamAccessSection from "../../components/admin/TeamAccessSection";
import ConfigureIntegrationModal from "../../components/settings/ConfigureIntegrationModal";
import AddIntegrationModal from "../../components/settings/AddIntegrationModal";
import { useAuth } from "../../contexts/AuthContext";
import { getTenantFlags, updateTenantFlags } from "../../engine";
import {
  getIntegrations,
  removeIntegration,
  addIntegration,
  getAccountAuditLog,
} from "../../engine/mockEngine";
import { formatRelativeTime } from "../../utils/relativeTime";

const ROLE_ACCENT = {
  Owner: "var(--role-owner)",
  CFO: "var(--accent-primary)",
  Senior: "var(--accent-primary)",
  Junior: "var(--semantic-info)",
};

function normalizeRole(r) {
  if (!r) return "CFO";
  const s = String(r).toLowerCase();
  if (s.startsWith("own")) return "Owner";
  if (s.startsWith("cfo")) return "CFO";
  if (s.startsWith("sen")) return "Senior";
  return "Junior";
}

function canEdit(role) {
  return role === "CFO" || role === "Senior";
}

function canAccess(role) {
  return role === "CFO" || role === "Senior" || role === "Owner";
}

export default function AdministrationScreen({ role: roleRaw = "CFO" }) {
  const role = normalizeRole(roleRaw);
  const { t } = useTranslation("administration");
  const accent = ROLE_ACCENT[role] || "var(--accent-primary)";
  const editable = canEdit(role);

  const sections = useMemo(() => {
    const list = [
      { id: "team_access",   icon: Users,          label: t("sections.team_access") },
      { id: "integrations",  icon: Plug,           label: t("sections.integrations") },
      { id: "tenant_flags",  icon: Flag,           label: t("sections.tenant_flags") },
      { id: "security",      icon: Shield,         label: t("sections.security") },
      { id: "audit_log",     icon: ClipboardList,  label: t("sections.audit_log") },
      { id: "billing",       icon: CreditCard,     label: t("sections.billing") },
    ];
    return list;
  }, [t]);

  const [active, setActive] = useState("team_access");

  const viewLabelKey =
    role === "Owner"
      ? "view_label_owner"
      : role === "Senior"
      ? "view_label_senior"
      : "view_label_cfo";

  if (!canAccess(role)) {
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "36px 28px" }}>
        <div style={{ maxWidth: 560, margin: "60px auto 0" }}>
          <EmptyState
            icon={Lock}
            title={t("no_access_title")}
            description={t("no_access_description")}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div
        style={{
          padding: "22px 28px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          background: `linear-gradient(180deg, ${accent}1A 0%, transparent 100%)`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.15em",
            color: accent,
          }}
        >
          {t(viewLabelKey)}
        </div>
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 30,
            color: "var(--text-primary)",
            letterSpacing: "-0.3px",
            lineHeight: 1,
            marginTop: 2,
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

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <aside
          style={{
            width: 220,
            flexShrink: 0,
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
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 20px",
                  background: on ? "var(--bg-surface-sunken)" : "transparent",
                  border: "none",
                  color: on ? "var(--text-primary)" : "var(--text-tertiary)",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textAlign: "start",
                  cursor: "pointer",
                  boxShadow: on ? `inset 2px 0 0 ${accent}` : "none",
                }}
                onMouseEnter={(e) => {
                  if (!on) e.currentTarget.style.background = "var(--bg-surface-sunken)";
                }}
                onMouseLeave={(e) => {
                  if (!on) e.currentTarget.style.background = "transparent";
                }}
              >
                <Icon size={14} strokeWidth={2} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </aside>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "22px 28px 32px",
            minWidth: 0,
          }}
        >
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            {role === "Owner" && active !== "billing" && <ReadOnlyBanner />}
            {active === "team_access" && <TeamAccessSection readOnly={!editable} />}
            {active === "integrations" && <IntegrationsAdminSection readOnly={!editable} />}
            {active === "tenant_flags" && <TenantFlagsSection readOnly={!editable} />}
            {active === "security" && <SecurityComingSoon />}
            {active === "audit_log" && <FullAuditLogSection />}
            {active === "billing" && <BillingSection role={role} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyBanner() {
  const { t } = useTranslation("administration");
  return (
    <div
      role="status"
      style={{
        marginBottom: 14,
        background: "var(--semantic-info-subtle, var(--bg-surface-sunken))",
        border: "1px solid var(--semantic-info, var(--border-default))",
        color: "var(--semantic-info, var(--text-secondary))",
        padding: "10px 14px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {t("readonly_banner")}
    </div>
  );
}

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
      <div
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 20,
          color: "var(--text-primary)",
          letterSpacing: "-0.2px",
          lineHeight: 1.1,
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            marginTop: 4,
            marginBottom: 14,
          }}
        >
          {description}
        </div>
      )}
      {!description && <div style={{ height: 14 }} />}
      {children}
    </div>
  );
}

function Toggle({ on, onChange, label, sub, disabled = false }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: "1px solid var(--border-subtle)",
        gap: 14,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
            {sub}
          </div>
        )}
      </div>
      <button
        onClick={() => !disabled && onChange(!on)}
        aria-pressed={on}
        disabled={disabled}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: on ? "var(--accent-primary)" : "var(--border-default)",
          border: "none",
          padding: 2,
          cursor: disabled ? "not-allowed" : "pointer",
          position: "relative",
          transition: "background 0.15s",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span
          style={{
            display: "block",
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            transform: on ? "translateX(16px)" : "translateX(0)",
            transition: "transform 0.15s",
          }}
        />
      </button>
    </div>
  );
}

function TenantFlagsSection({ readOnly }) {
  const { t } = useTranslation("administration");
  const [flags, setFlags] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    getTenantFlags()
      .then((f) => {
        const next = { hasForeignActivity: !!f?.hasForeignActivity };
        setFlags(next);
        setDraft(next);
      })
      .catch((err) => setError(err?.message || "Failed to load tenant flags."));
  }, []);

  const dirty = flags && draft && flags.hasForeignActivity !== draft.hasForeignActivity;

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const next = await updateTenantFlags(draft);
      const normalized = { hasForeignActivity: !!next?.hasForeignActivity };
      setFlags(normalized);
      setDraft(normalized);
      setToast(t("flags.saved"));
    } catch (err) {
      setError(err?.message || "Failed to save tenant flags.");
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <Card title={t("flags.title")} description={t("flags.description")}>
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 12px",
            background: "var(--semantic-danger-subtle)",
            border: "1px solid var(--semantic-danger)",
            borderRadius: 8,
            color: "var(--semantic-danger)",
            fontSize: 12,
          }}
        >
          <AlertTriangle size={14} /> {error}
        </div>
      </Card>
    );
  }

  if (!flags || !draft) {
    return (
      <Card title={t("flags.title")} description={t("flags.description")}>
        <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
      </Card>
    );
  }

  return (
    <Card title={t("flags.title")} description={t("flags.description")}>
      {toast && (
        <div
          role="status"
          style={{
            marginBottom: 14,
            background: "var(--accent-primary-subtle)",
            border: "1px solid var(--accent-primary-border)",
            color: "var(--accent-primary)",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {toast}
        </div>
      )}

      <Toggle
        on={draft.hasForeignActivity}
        onChange={(v) => setDraft({ ...draft, hasForeignActivity: v })}
        label={t("flags.has_foreign_activity.label")}
        sub={t("flags.has_foreign_activity.description")}
        disabled={readOnly}
      />

      {readOnly && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-tertiary)",
            marginTop: 10,
            fontStyle: "italic",
          }}
        >
          {t("flags.owner_readonly_note")}
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {!readOnly && (
          <button
            onClick={save}
            disabled={!dirty || saving}
            style={{
              background: dirty ? "var(--accent-primary)" : "var(--bg-surface-sunken)",
              color: dirty ? "#fff" : "var(--text-tertiary)",
              border: "none",
              padding: "9px 16px",
              borderRadius: 6,
              cursor: dirty && !saving ? "pointer" : "not-allowed",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("flags.saving")}
              </>
            ) : (
              t("flags.save")
            )}
          </button>
        )}
        {dirty && !saving && (
          <span
            style={{
              fontSize: 11,
              color: "var(--semantic-warning)",
              fontStyle: "italic",
            }}
          >
            {t("flags.unsaved_changes")}
          </span>
        )}
      </div>

      <div
        style={{
          marginTop: 18,
          padding: "10px 12px",
          fontSize: 11,
          color: "var(--text-tertiary)",
          background: "var(--bg-surface-sunken)",
          border: "1px dashed var(--border-default)",
          borderRadius: 8,
          fontStyle: "italic",
        }}
      >
        {t("flags.backend_pending_note")}
      </div>
    </Card>
  );
}

function IntegrationsAdminSection({ readOnly }) {
  const { t } = useTranslation("administration");
  const [items, setItems] = useState(null);
  const [configuring, setConfiguring] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const reload = () => getIntegrations().then(setItems);
  useEffect(() => {
    reload();
  }, []);

  return (
    <Card title={t("integrations.title")} description={t("integrations.description")}>
      {!items ? (
        <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Plug} title="" description="" />
      ) : (
        items.map((i) => (
          <IntegrationRow
            key={i.id}
            i={i}
            readOnly={readOnly}
            onConfigure={() => setConfiguring(i)}
            onDisconnect={async () => {
              await removeIntegration(i.id);
              reload();
            }}
          />
        ))
      )}
      {!readOnly && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setAddOpen(true)}
            style={{
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
            +&nbsp;Add integration
          </button>
        </div>
      )}
      <ConfigureIntegrationModal
        open={!!configuring}
        integration={configuring}
        onClose={() => setConfiguring(null)}
        onSaved={reload}
      />
      <AddIntegrationModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={async (id) => {
          await addIntegration(id);
          reload();
        }}
      />
    </Card>
  );
}

function IntegrationRow({ i, readOnly, onConfigure, onDisconnect }) {
  const statusColor = {
    connected: "var(--accent-primary)",
    disconnected: "var(--text-tertiary)",
    error: "var(--semantic-danger)",
  }[i.status];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 0",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "var(--bg-surface-sunken)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Plug size={14} color="var(--text-tertiary)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
          {i.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-tertiary)",
            marginTop: 2,
            display: "flex",
            gap: 8,
          }}
        >
          <span style={{ color: statusColor, fontWeight: 600 }}>
            {i.status === "connected" && (
              <Check
                size={10}
                style={{ verticalAlign: "middle", marginInlineEnd: 3 }}
              />
            )}
            {i.status === "error" && (
              <AlertTriangle
                size={10}
                style={{ verticalAlign: "middle", marginInlineEnd: 3 }}
              />
            )}
            {i.status}
          </span>
          <span>·</span>
          <span>{i.category}</span>
          <span>·</span>
          <span>
            {i.lastSync ? formatRelativeTime(i.lastSync) : "never synced"}
          </span>
        </div>
      </div>
      {!readOnly &&
        (i.status === "connected" ? (
          <>
            <button onClick={onConfigure} style={btnSecondary}>
              Configure
            </button>
            <button onClick={onDisconnect} style={btnDanger}>
              Disconnect
            </button>
          </>
        ) : (
          <button onClick={onConfigure} style={btnPrimary}>
            Connect
          </button>
        ))}
    </div>
  );
}

function SecurityComingSoon() {
  const { t } = useTranslation("administration");
  return (
    <Card title={t("security.title")} description={t("security.description")}>
      <div
        style={{
          padding: "24px",
          textAlign: "center",
          color: "var(--text-tertiary)",
          fontSize: 12,
          border: "1px dashed var(--border-default)",
          borderRadius: 8,
          fontStyle: "italic",
        }}
      >
        {t("security.coming_soon")}
      </div>
    </Card>
  );
}

function FullAuditLogSection() {
  const { t } = useTranslation("administration");
  const [items, setItems] = useState(null);

  useEffect(() => {
    getAccountAuditLog({ action: "all" }).then(setItems);
  }, []);

  return (
    <Card title={t("audit_log.title")} description={t("audit_log.description")}>
      {!items ? (
        <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
      ) : items.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t("audit_log.empty")} description="" />
      ) : (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "110px 150px 140px 1fr 110px",
              gap: 10,
              padding: "8px 0",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "var(--text-tertiary)",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div>{t("audit_log.col_time")}</div>
            <div>{t("audit_log.col_actor")}</div>
            <div>{t("audit_log.col_action")}</div>
            <div>{t("audit_log.col_target")}</div>
            <div>{t("audit_log.col_ip")}</div>
          </div>
          {items.map((e) => (
            <div
              key={e.id}
              style={{
                display: "grid",
                gridTemplateColumns: "110px 150px 140px 1fr 110px",
                gap: 10,
                padding: "10px 0",
                fontSize: 12,
                color: "var(--text-secondary)",
                borderBottom: "1px solid var(--border-subtle)",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                }}
              >
                {formatRelativeTime(e.timestamp)}
              </div>
              <div style={{ color: "var(--text-primary)" }}>{e.actor}</div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-tertiary)",
                }}
              >
                {e.action}
              </div>
              <div
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {e.target}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  color: "var(--text-tertiary)",
                }}
              >
                <LtrText>{e.ipAddress}</LtrText>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function BillingSection({ role }) {
  const { t } = useTranslation("administration");
  return (
    <Card title={t("billing.title")} description={t("billing.description")}>
      {role !== "Owner" && (
        <div
          style={{
            marginBottom: 14,
            background: "var(--semantic-warning-subtle)",
            border: "1px solid var(--semantic-warning)",
            color: "var(--semantic-warning)",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          {t("billing.owner_only_note")}
        </div>
      )}
      <div
        style={{
          padding: "24px",
          textAlign: "center",
          color: "var(--text-tertiary)",
          fontSize: 12,
          border: "1px dashed var(--border-default)",
          borderRadius: 8,
          fontStyle: "italic",
        }}
      >
        {t("billing.coming_soon")}
      </div>
    </Card>
  );
}

const btnPrimary = {
  background: "var(--accent-primary)",
  color: "#fff",
  border: "none",
  padding: "9px 16px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "inherit",
};
const btnSecondary = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-strong)",
  padding: "9px 16px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "inherit",
};
const btnDanger = {
  background: "transparent",
  color: "var(--semantic-danger)",
  border: "1px solid var(--semantic-danger-border)",
  padding: "7px 12px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 11,
  fontFamily: "inherit",
  fontWeight: 600,
};
