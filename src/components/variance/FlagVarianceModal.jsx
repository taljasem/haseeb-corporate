import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { runValidators, required, minLength } from "../../utils/validation";
import { flagVariance } from "../../engine/mockEngine";
import { listTeamMembersLive } from "../../engine";
import { normalizeRole, ROLES } from "../../utils/role";
import { emitTaskboxChange } from "../../utils/taskboxBus";

export default function FlagVarianceModal({ open, varianceId, onClose, onFlagged }) {
  const { t } = useTranslation("variance");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [reason, setReason] = useState("");
  // HASEEB-181 — assignee options are now fetched dynamically via
  // listTeamMembersLive rather than the two hardcoded "sara"+"cfo" pills.
  // Seeded ids are no longer assumed; whatever team the tenant has is
  // what the CFO picks from. We still offer a "Myself (CFO)" synthetic
  // pill (id "cfo") for the self-assign case, matching the pre-181 UX.
  // HASEEB-179 default (unselected; submit disabled until pick) stands.
  const [assignee, setAssignee] = useState("");
  const [errors, setErrors] = useState({});
  const [flagging, setFlagging] = useState(false);
  // HASEEB-181 — team fetch state machine.
  const [team, setTeam] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setErrors({});
    setAssignee("");
    setTeamError(false);
    setTeamLoading(true);
    let cancelled = false;
    listTeamMembersLive()
      .then((members) => {
        if (cancelled) return;
        // Drop the synthetic "self" row (mock-only — represents the
        // current CFO; the live endpoint does not emit it). The explicit
        // "Myself (CFO)" pill below covers the self-assign case.
        const non_self = (members || []).filter((m) => m.id !== "self");
        setTeam(non_self);
        setTeamLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[FlagVarianceModal] listTeamMembersLive failed", e);
        setTeam([]);
        setTeamError(true);
        setTeamLoading(false);
      });
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  // HASEEB-181 — split assignables into non-CFO accountants (Senior +
  // Junior) vs everyone else. "Myself (CFO)" is an explicit synthetic
  // pill appended below; tenants whose team has a CFO peer row would
  // see that peer as a regular pill alongside. normalizeRole centralises
  // the role-bucket mapping (HASEEB-155) so we don't re-derive here.
  const assignablePeers = team.filter((m) => {
    const r = normalizeRole(m.role);
    return r === ROLES.SENIOR || r === ROLES.JUNIOR;
  });
  const hasAssignees = assignablePeers.length > 0;

  const handleFlag = async () => {
    const e = runValidators({ reason }, { reason: [required(), minLength(10)] });
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!assignee) return; // guard — UI disables submit when unselected
    setFlagging(true);
    const r = await flagVariance(varianceId, reason, assignee);
    emitTaskboxChange();
    setFlagging(false);
    if (onFlagged) onFlagged(r);
    if (onClose) onClose();
  };

  const err = errors.reason
    ? <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 4 }}>{tc(errors.reason.key, errors.reason.values || {})}</div>
    : null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 500, background: "var(--panel-bg)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("flag_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", marginTop: 2 }}>{t("flag_modal.title")}</div>
          </div>
          <button onClick={onClose} aria-label={t("flag_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{t("flag_modal.field_reason")}</div>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (errors.reason) setErrors({}); }}
              placeholder={t("flag_modal.reason_placeholder")}
              rows={4}
              style={{ width: "100%", background: "var(--bg-surface-sunken)", border: `1px solid ${errors.reason ? "var(--semantic-danger)" : "var(--border-default)"}`, borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }}
            />
            {err}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{t("flag_modal.field_assignee")}</div>
            {teamLoading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", color: "var(--text-tertiary)", fontSize: 12 }}>
                <Spinner size={13} />&nbsp;{t("flag_modal.loading_team")}
              </div>
            )}
            {!teamLoading && teamError && (
              <div style={{ fontSize: 12, color: "var(--semantic-danger)", padding: "8px 0" }}>
                {t("flag_modal.team_load_error")}
              </div>
            )}
            {!teamLoading && !teamError && !hasAssignees && (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "8px 0", lineHeight: 1.4 }}>
                {t("flag_modal.no_team_members")}
              </div>
            )}
            {!teamLoading && !teamError && hasAssignees && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {assignablePeers.map((m) => {
                  const on = assignee === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setAssignee(m.id)}
                      aria-pressed={on}
                      style={{
                        padding: "9px 12px",
                        background: on ? "var(--accent-primary-subtle)" : "transparent",
                        border: on ? "1px solid var(--accent-primary-border)" : "1px solid var(--border-default)",
                        color: on ? "var(--accent-primary)" : "var(--text-secondary)",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: "inherit",
                      }}
                    >
                      <span style={{ display: "block" }}>{m.name}</span>
                      <span style={{ display: "block", fontSize: 10, fontWeight: 500, color: on ? "var(--accent-primary)" : "var(--text-tertiary)", marginTop: 1, opacity: 0.8 }}>{m.role}</span>
                    </button>
                  );
                })}
                {(() => {
                  const on = assignee === "cfo";
                  return (
                    <button
                      key="cfo"
                      onClick={() => setAssignee("cfo")}
                      aria-pressed={on}
                      style={{
                        padding: "9px 12px",
                        background: on ? "var(--accent-primary-subtle)" : "transparent",
                        border: on ? "1px solid var(--accent-primary-border)" : "1px solid var(--border-default)",
                        color: on ? "var(--accent-primary)" : "var(--text-secondary)",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: "inherit",
                      }}
                    >
                      {t("flag_modal.assignee_cfo")}
                    </button>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("flag_modal.cancel")}</button>
          <button onClick={handleFlag} disabled={flagging || !assignee} style={{ background: (flagging || !assignee) ? "color-mix(in srgb, var(--semantic-warning) 40%, transparent)" : "var(--semantic-warning)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: (flagging || !assignee) ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {flagging ? <><Spinner size={13} />&nbsp;{t("flag_modal.flagging")}</> : t("flag_modal.confirm")}
          </button>
        </div>
      </div>
    </>
  );
}
