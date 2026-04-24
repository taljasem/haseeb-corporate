import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import EmptyState from "../shared/EmptyState";
import { Inbox } from "lucide-react";
// Track B Dispatch 6 wire 6 (2026-04-20) — imports swapped from
// ../../engine/mockEngine to ../../engine. delegateBudget routes through
// the live POST /api/budgets/:id/delegate endpoint (via
// delegateBudgetLive), and getTeamMembers via listTeamMembersLive which
// adapts the live { id, name, email, role } shape to what the modal
// consumes. getBudgetById stays on legacy mock — the live
// GET /api/budgets/:id does NOT return the nested departments[] with
// lineItems + totalAnnual that this modal relies on (flagged — see
// src/api/budgets.js file header).
// HASEEB-402 D7 FINAL PUSH (2026-04-24) — getBudgetById migrated to
// consumer-side legacy adapter (backend DTO does not surface nested
// departments[]/lineItems that this modal relies on; tracked HASEEB-403).
import { getBudgetById } from "../../api/budgets-legacy";
import {
  delegateBudgetLive,
  listTeamMembersLive,
} from "../../engine";
import { formatKWD } from "../../utils/format";

// HASEEB-179 — UX default change. Previously hardcoded department
// → seed-user assignments ("noor", "jasem", "layla", "sara") which
// pre-selected specific demo identities regardless of which team was
// actually using the tenant. The correct default comes from tenant
// config (not yet implemented — flagged for follow-up), so in the
// meantime the CFO must explicitly pick an assignee per department.
// The existing `canSend` gate (every expense dept needs a non-empty
// assignment) already enforces this at submit time.
const DEFAULT_ASSIGNMENTS = {};

export default function DelegateBudgetModal({ open, budgetId, onClose, onDelegated }) {
  const { t } = useTranslation("budget");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [budget, setBudget] = useState(null);
  const [team, setTeam] = useState([]);
  const [assignments, setAssignments] = useState({}); // departmentId → juniorUserId
  const [notes, setNotes] = useState({});             // departmentId → note string
  const [expandedNotes, setExpandedNotes] = useState({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !budgetId) return;
    getBudgetById(budgetId).then((b) => {
      setBudget(b);
      if (b) {
        // HASEEB-179 — leave assignments empty by default so the CFO
        // explicitly picks each department head rather than inheriting
        // a seed-user id. DEFAULT_ASSIGNMENTS stays as an extension
        // point for future tenant-config-driven defaults.
        const init = {};
        b.departments
          .filter((d) => d.category === "expense")
          .forEach((d) => {
            const preset = DEFAULT_ASSIGNMENTS[d.name];
            if (preset) init[d.id] = preset;
          });
        setAssignments(init);
      }
    });
    // Live GET /api/team/members — returns { id, name, email, role }. The
    // legacy mockEngine.getTeamMembers had a synthetic "self" row that
    // represented the current CFO; the live endpoint does not emit a
    // self-row, so the filter is a no-op against live data but preserved
    // for MOCK-mode compatibility.
    listTeamMembersLive().then((members) =>
      setTeam((members || []).filter((m) => m.id !== "self")),
    );
  }, [open, budgetId]);

  if (!open) return null;

  const expenseDepts = (budget?.departments || []).filter((d) => d.category === "expense");
  const canSend = budget && expenseDepts.every((d) => !!assignments[d.id]);

  const handleSend = async () => {
    setSending(true);
    // Live POST /api/budgets/:id/delegate shape:
    //   { delegations: [{ departmentId, assignToUserId }] }
    // Note the LIVE endpoint does NOT carry per-delegation notes (flagged
    // shape delta — see src/api/budgets.js file header). Notes captured in
    // this modal are currently informational only on the live path; the
    // mock adapter still forwards them to mockEngine via the engine
    // extras in src/engine/index.js::buildMockExtras.
    const delegations = expenseDepts.map((d) => ({
      departmentId: d.id,
      assignToUserId: assignments[d.id],
      // `notes` is carried in the payload for the mock adapter's benefit;
      // the live wrapper will strip it before POSTing (see budgets.js
      // delegateBudget — it only serialises { delegations: [...]}; the
      // {departmentId, assignToUserId} subset is all that reaches the wire).
      notes: notes[d.id] || null,
    }));
    try {
      await delegateBudgetLive(budgetId, { delegations });
      onDelegated && onDelegated(delegations.length);
      onClose && onClose();
    } catch (err) {
      // Surface via the parent onDelegated/toast path on next wire; for
      // now the modal just stops the spinner and leaves itself open so
      // the user can retry. No alert() to avoid regressing UX.
      console.error("[DelegateBudgetModal] delegate failed", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 300,
        }}
      />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 600, maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 80px)",
          background: "var(--panel-bg)",
          border: "1px solid var(--border-default)",
          borderRadius: 12, zIndex: 301,
          display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
              {t("delegate_modal.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.2px", marginTop: 2,
              }}
            >
              {t("delegate_modal.title")}
            </div>
            {budget && (
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                {t("delegate_modal.sub", { period: budget.period.label, count: expenseDepts.length })}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t("delegate_modal.close")}
            style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "14px 22px 4px", overflowY: "auto", flex: 1 }}>
          {expenseDepts.length === 0 && (
            <EmptyState icon={Inbox} title={tc("empty_states.delegate_title")} description={tc("empty_states.delegate_desc")} />
          )}
          {expenseDepts.map((d) => {
            const expanded = !!expandedNotes[d.id];
            return (
              <div
                key={d.id}
                style={{
                  padding: "12px 14px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{d.name}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        fontFamily: "'DM Mono', monospace",
                        marginTop: 2,
                      }}
                    >
                      {formatKWD(d.totalAnnual)}
                    </div>
                  </div>
                  <select
                    value={assignments[d.id] || ""}
                    onChange={(e) => setAssignments({ ...assignments, [d.id]: e.target.value })}
                    style={{
                      background: "var(--bg-surface-sunken)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      color: "var(--text-primary)",
                      fontSize: 12,
                      fontFamily: "inherit",
                      minWidth: 160,
                    }}
                  >
                    {/* HASEEB-179 — no preselected assignee; CFO must pick. */}
                    <option value="">{t("delegate_modal.pick_assignee", { defaultValue: "Select assignee…" })}</option>
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() =>
                    setExpandedNotes({ ...expandedNotes, [d.id]: !expanded })
                  }
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--accent-primary)",
                    fontSize: 11,
                    cursor: "pointer",
                    padding: "6px 0 0",
                    fontFamily: "inherit",
                  }}
                >
                  {expanded ? t("delegate_modal.hide_notes") : t("delegate_modal.add_notes")}
                </button>
                {expanded && (
                  <textarea
                    value={notes[d.id] || ""}
                    onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })}
                    placeholder={t("delegate_modal.notes_placeholder", {
                      name: (team.find((m) => m.id === assignments[d.id]) || {}).name || t("delegate_modal.notes_fallback")
                    })}
                    rows={2}
                    style={{
                      width: "100%",
                      marginTop: 6,
                      background: "var(--bg-surface-sunken)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      color: "var(--text-primary)",
                      fontSize: 12,
                      fontFamily: "inherit",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              marginBottom: 10,
              fontStyle: "italic",
            }}
          >
            {t("delegate_modal.footnote", { count: expenseDepts.length })}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-strong)",
                padding: "9px 16px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
              }}
            >
              {t("delegate_modal.cancel")}
            </button>
            <button
              onClick={handleSend}
              disabled={!canSend || sending}
              style={{
                background: canSend ? "var(--accent-primary)" : "rgba(0,196,140,0.25)",
                color: "#fff",
                border: "none",
                padding: "9px 18px",
                borderRadius: 6,
                cursor: canSend ? "pointer" : "not-allowed",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              {sending ? <><Spinner size={13} />&nbsp;{t("delegate_modal.sending")}</> : t("delegate_modal.send")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
