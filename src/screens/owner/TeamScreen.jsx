import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus, Users, Crown, TrendingUp, User, Search, Trash2, X } from "lucide-react";
import EmptyState from "../../components/shared/EmptyState";
import Avatar from "../../components/taskbox/Avatar";
import ActionButton from "../../components/ds/ActionButton";
import SortHeader from "../../components/ds/SortHeader";
import FilterDropdown from "../../components/ds/FilterDropdown";
import EditMemberModal from "../../components/team/EditMemberModal";
import {
  getTeamMembersWithResponsibilities,
  addTeamMember,
  removeTeamMember,
  getTeamActivityLog,
} from "../../engine/mockEngine";
import { formatRelativeTime } from "../../utils/relativeTime";

const ROLE_COLORS = {
  owner: "var(--role-owner, #d4a84b)",
  cfo: "var(--accent-primary)",
  senior: "#3b82f6",
  junior: "var(--text-secondary)",
  auditor: "#a855f7",
};

export default function TeamScreen() {
  const { t } = useTranslation("team");
  const { t: tc } = useTranslation("common");
  const [members, setMembers] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState(null);
  const [activityMember, setActivityMember] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [statusFilter, setStatusFilter] = useState([]);
  const [roleFilter, setRoleFilter] = useState([]);

  const refresh = useCallback(() => { getTeamMembersWithResponsibilities().then(setMembers); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
  const handleSort = (field) => { if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortField(field); setSortDir("asc"); } };

  const filtered = (members || [])
    .filter((m) => statusFilter.length === 0 || statusFilter.includes(m.status || "active"))
    .filter((m) => roleFilter.length === 0 || roleFilter.includes(m.role))
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "name": return (a.name || "").localeCompare(b.name || "") * dir;
        case "role": return (a.role || "").localeCompare(b.role || "") * dir;
        case "last_active": return ((a.lastActive || "").localeCompare(b.lastActive || "")) * dir;
        default: return 0;
      }
    });

  const handleInvite = async (data) => {
    await addTeamMember(data);
    setInviteOpen(false);
    refresh();
    showToast(t("invite_modal.success_toast", { email: data.email }));
  };

  const handleRemove = async () => {
    if (!removingMember) return;
    const result = await removeTeamMember(removingMember.id);
    if (result?.error) { showToast(result.error); } else { showToast(t("remove.success_toast", { name: removingMember.name })); }
    setRemovingMember(null);
    refresh();
  };

  const activeFilters = [];
  if (statusFilter.length > 0) activeFilters.push({ key: "status", label: `${t("filter.status_label")}: ${statusFilter.length}`, onRemove: () => setStatusFilter([]) });
  if (roleFilter.length > 0) activeFilters.push({ key: "role", label: `${t("filter.role_label")}: ${roleFilter.length}`, onRemove: () => setRoleFilter([]) });

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--text-primary)", letterSpacing: "-0.3px", lineHeight: 1 }}>{t("title")}</div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 6 }}>{t("subtitle")}</div>
          </div>
          <ActionButton variant="primary" icon={UserPlus} label={t("invite")} onClick={() => setInviteOpen(true)} />
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <FilterDropdown label={t("filter.status_label")} placeholder={t("filter.status_all")} options={[{ id: "active", label: "Active" }, { id: "invited", label: "Invited" }, { id: "suspended", label: "Suspended" }]} selected={statusFilter} onChange={setStatusFilter} />
          <FilterDropdown label={t("filter.role_label")} placeholder={t("filter.role_all")} options={[{ id: "owner", label: "Owner" }, { id: "cfo", label: "CFO" }, { id: "junior", label: "Junior" }, { id: "auditor", label: "Auditor" }]} selected={roleFilter} onChange={setRoleFilter} />
          {activeFilters.length > 0 && (
            <>
              {activeFilters.map((f) => (
                <span key={f.key} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 10, background: "rgba(0,196,140,0.08)", border: "1px solid rgba(0,196,140,0.2)", color: "var(--accent-primary)" }}>
                  {f.label}
                  <button onClick={f.onRemove} style={{ background: "transparent", border: "none", color: "var(--accent-primary)", cursor: "pointer", padding: 0, display: "inline-flex" }}><X size={10} /></button>
                </span>
              ))}
              <button onClick={() => { setStatusFilter([]); setRoleFilter([]); }} style={{ fontSize: 10, color: "var(--text-tertiary)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>{t("filter.clear_all")}</button>
            </>
          )}
        </div>

        {/* Table */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 100px 90px 100px 120px", gap: 12, padding: "10px 18px", background: "var(--bg-surface-sunken)", borderBottom: "1px solid var(--border-default)", alignItems: "center" }}>
            <SortHeader field="name" activeField={sortField} direction={sortDir} onSort={handleSort} label={t("columns.name")} />
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("columns.access_level")}</div>
            <SortHeader field="role" activeField={sortField} direction={sortDir} onSort={handleSort} label={t("columns.role")} />
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("columns.status")}</div>
            <SortHeader field="last_active" activeField={sortField} direction={sortDir} onSort={handleSort} label={t("columns.last_active")} />
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("columns.actions")}</div>
          </div>
          {filtered.length === 0 && <EmptyState icon={Users} title={tc("empty_states.team_title")} description={tc("empty_states.team_desc")} />}
          {filtered.map((m) => {
            const roleColor = ROLE_COLORS[m.role] || "var(--text-secondary)";
            const isOwner = m.role === "owner";
            return (
              <div key={m.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 100px 90px 100px 120px", gap: 12, alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
                <div onClick={async () => { setActivityMember(m); const log = await getTeamActivityLog(m.id, 10); setActivityLog(log || []); }} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, cursor: "pointer" }}>
                  <Avatar person={m} size={30} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{m.email || m.initials}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{m.accessLevel || "—"}</div>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: roleColor, background: `${roleColor}1A`, border: `1px solid ${roleColor}40`, padding: "3px 8px", borderRadius: 4, display: "inline-block", width: "fit-content" }}>{(m.role || "").toUpperCase()}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: (m.status || "active") === "active" ? "var(--accent-primary)" : "var(--text-tertiary)" }}>{(m.status || "active").toUpperCase()}</span>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{m.lastActive ? formatRelativeTime(m.lastActive) : "—"}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <ActionButton variant="tertiary" size="sm" label={t("edit")} onClick={() => setEditing(m)} />
                  <ActionButton variant="tertiary" size="sm" icon={Trash2} label="" onClick={() => isOwner ? null : setRemovingMember(m)} disabled={isOwner} title={isOwner ? t("remove.owner_disabled") : t("remove.button")} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Role Permissions Panel */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{t("permissions.section_title")}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 12 }}>{t("permissions.section_subtitle")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <RoleCard icon={Crown} title={t("permissions.owner_title")} bullets={t("permissions.owner_bullets")} color="var(--role-owner, #d4a84b)" />
            <RoleCard icon={TrendingUp} title={t("permissions.cfo_title")} bullets={t("permissions.cfo_bullets")} color="var(--accent-primary)" />
            <RoleCard icon={User} title={t("permissions.junior_title")} bullets={t("permissions.junior_bullets")} color="var(--text-secondary)" />
            <RoleCard icon={Search} title={t("permissions.auditor_title")} bullets={t("permissions.auditor_bullets")} color="#a855f7" />
          </div>
        </div>
      </div>

      {/* Edit member modal */}
      <EditMemberModal open={!!editing} member={editing} onClose={() => setEditing(null)} onSaved={() => { refresh(); showToast(t("edit_modal.toast_saved")); }} />

      {/* Invite member modal */}
      {inviteOpen && <InviteMemberModal onClose={() => setInviteOpen(false)} onInvite={handleInvite} />}

      {/* Remove confirmation modal */}
      {removingMember && (
        <>
          <div onClick={() => setRemovingMember(null)} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", backdropFilter: "blur(4px)", zIndex: 300 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 420, background: "var(--bg-surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "var(--shadow-xl)" }}>
            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "var(--text-primary)" }}>{t("remove.modal_title")}</div>
            </div>
            <div style={{ padding: "18px 22px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {t("remove.confirm_body", { name: removingMember.name })}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
              <ActionButton variant="secondary" label={t("remove.cancel_button")} onClick={() => setRemovingMember(null)} />
              <button onClick={handleRemove} style={{ background: "var(--semantic-danger)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{t("remove.confirm_button")}</button>
            </div>
          </div>
        </>
      )}

      {/* Activity slide-over */}
      {activityMember && (
        <>
          <div onClick={() => setActivityMember(null)} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", zIndex: 300 }} />
          <div style={{ position: "fixed", top: 0, insetInlineEnd: 0, bottom: 0, width: 400, maxWidth: "calc(100vw - 32px)", background: "var(--bg-surface-raised)", borderInlineStart: "1px solid var(--border-default)", zIndex: 301, boxShadow: "-24px 0 60px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{activityMember.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{activityMember.role?.toUpperCase()} · Activity log</div>
              </div>
              <button onClick={() => setActivityMember(null)} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 22px" }}>
              {activityLog.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-tertiary)", fontSize: 12 }}>No recent activity</div>
              ) : activityLog.map((e) => (
                <div key={e.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: 10, fontSize: 11 }}>
                  <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace", minWidth: 60 }}>{formatRelativeTime(e.timestamp)}</span>
                  <span style={{ color: "var(--text-secondary)" }}>{e.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "var(--accent-primary-subtle)", border: "1px solid rgba(0,196,140,0.30)", color: "var(--accent-primary)", padding: "10px 18px", borderRadius: 8, fontSize: 12, fontWeight: 500, zIndex: 400 }}>{toast}</div>}
    </div>
  );
}

function RoleCard({ icon: Icon, title, bullets, color }) {
  const lines = (bullets || "").split("\n").filter(Boolean);
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "14px 16px", borderTop: `2px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon size={16} color={color} />
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{title}</div>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {lines.map((line, i) => (
          <li key={i} style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, paddingInlineStart: 12, position: "relative", marginBottom: 3 }}>
            <span style={{ position: "absolute", insetInlineStart: 0, top: 7, width: 4, height: 4, borderRadius: "50%", background: color }} />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InviteMemberModal({ onClose, onInvite }) {
  const { t } = useTranslation("team");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("junior");
  const [message, setMessage] = useState("");
  const canSubmit = name.trim() && email.trim() && email.includes("@") && role;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 460, background: "var(--bg-surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "var(--shadow-xl)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)" }}>{t("invite_modal.title")}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}><X size={16} /></button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label={t("invite_modal.field_name")}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("invite_modal.field_name_placeholder")} style={inputStyle} />
          </Field>
          <Field label={t("invite_modal.field_email")}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("invite_modal.field_email_placeholder")} style={inputStyle} />
          </Field>
          <Field label={t("invite_modal.field_role")}>
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, appearance: "auto" }}>
              <option value="cfo">CFO</option>
              <option value="junior">Junior</option>
              <option value="auditor">Auditor</option>
            </select>
          </Field>
          <Field label={t("invite_modal.field_message")}>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("invite_modal.field_message_placeholder")} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <ActionButton variant="secondary" label={t("invite_modal.cancel_button")} onClick={onClose} />
          <ActionButton variant="primary" label={t("invite_modal.send_button")} onClick={() => onInvite({ name, email, role })} disabled={!canSubmit} />
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "var(--bg-surface-sunken)",
  border: "1px solid var(--border-default)",
  borderRadius: 6,
  padding: "9px 12px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};
