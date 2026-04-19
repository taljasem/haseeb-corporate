/**
 * ChecklistInstancePanel (FN-227, Phase 4 Wave 1 Item 3).
 *
 * Per-period structured-close-checklist view. Renders below the AI
 * advisor on MonthEndCloseScreen. Complements — does NOT replace —
 * the existing AI-driven close flow.
 *
 * Backend endpoints consumed:
 *   POST /api/monthly-close-checklist/instances   (idempotent for period)
 *   GET  /api/monthly-close-checklist/instances   (list for a year)
 *   GET  /api/monthly-close-checklist/instances/:id
 *   PATCH /api/monthly-close-checklist/items/:id
 *
 * Lifecycle surfaced on the banner:
 *   OPEN → IN_PROGRESS → COMPLETED → SIGNED_OFF, with REOPENED for
 *   corrections. The banner auto-refreshes when the instance mutates.
 *
 * Role gating:
 *   • OWNER sees all actions. Sign-off + Reopen are OWNER-only.
 *   • ACCOUNTANT (UI proxy: CFO) sees "Open checklist", can mark items
 *     whose completeRoleGate is ACCOUNTANT or OWNER_OR_ACCOUNTANT.
 *   • VIEWER / AUDITOR can read but not mark. The actions simply do not
 *     render; the backend 403 is the authoritative gate.
 *
 * Design rules obeyed:
 *   • No new design-system primitives.
 *   • No hex literals; every color via `var(--*)` tokens.
 *   • RTL/Arabic split-fragment i18n; <LtrText> ONLY wraps numeric /
 *     Latin tokens, never Arabic prose.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardList,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  Settings,
  Sparkles,
  PlayCircle,
  Plus,
} from "lucide-react";
import LtrText from "../shared/LtrText";
import Spinner from "../shared/Spinner";
import ActionButton from "../ds/ActionButton";
import {
  listTemplateItems,
  openInstance,
  listInstances,
  getInstance,
  markItemStatus,
  reopenInstance,
} from "../../engine";
import { formatRelativeTime } from "../../utils/relativeTime";
import ChecklistTemplateEditor from "./ChecklistTemplateEditor";
import SignOffModal from "./SignOffModal";

// Status → design-token map. Reuses the palette shape of the hosting
// screen's STATUS map (complete / in_progress / pending / blocked) so
// the visual language stays consistent across both checklists.
const ITEM_STATUS_META = {
  PENDING: {
    Icon: Circle,
    color: "var(--text-tertiary)",
    labelKey: "checklist.item_status.pending",
  },
  IN_PROGRESS: {
    Icon: Clock,
    color: "var(--semantic-info)",
    labelKey: "checklist.item_status.in_progress",
  },
  COMPLETED: {
    Icon: CheckCircle2,
    color: "var(--accent-primary)",
    labelKey: "checklist.item_status.completed",
  },
  BLOCKED: {
    Icon: AlertTriangle,
    color: "var(--semantic-danger)",
    labelKey: "checklist.item_status.blocked",
  },
};

const INSTANCE_STATUS_META = {
  OPEN: { color: "var(--text-tertiary)", labelKey: "checklist.instance_status.open" },
  IN_PROGRESS: { color: "var(--semantic-info)", labelKey: "checklist.instance_status.in_progress" },
  COMPLETED: { color: "var(--accent-primary)", labelKey: "checklist.instance_status.completed" },
  SIGNED_OFF: { color: "var(--accent-primary)", labelKey: "checklist.instance_status.signed_off" },
  REOPENED: { color: "var(--semantic-warning)", labelKey: "checklist.instance_status.reopened" },
};

// Owner → OWNER; CFO → ACCOUNTANT. Everyone else is treated as a reader.
function mapRoleToGate(role) {
  if (role === "Owner") return "OWNER";
  if (role === "CFO") return "ACCOUNTANT";
  return "VIEWER";
}

function canMarkItem(userGate, itemGate) {
  if (userGate === "VIEWER") return false;
  if (itemGate === "OWNER_OR_ACCOUNTANT") return userGate === "OWNER" || userGate === "ACCOUNTANT";
  return userGate === itemGate;
}

// (fiscalYear, fiscalMonth) derivation from the screen's `period` string
// ("March 2026" etc.). The server accepts any valid (year, 1-12); when
// the period string can't be parsed (which should be rare in the seeded
// flow), we fall back to the current calendar month so the "Open
// checklist" button remains functional.
const MONTHS_EN = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
function parsePeriod(period) {
  if (!period || typeof period !== "string") {
    const d = new Date();
    return { fiscalYear: d.getFullYear(), fiscalMonth: d.getMonth() + 1 };
  }
  const trimmed = period.trim().toLowerCase();
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const monthName = parts[0];
    const year = parseInt(parts[1], 10);
    const idx = MONTHS_EN.findIndex((m) => m.startsWith(monthName));
    if (idx >= 0 && Number.isFinite(year)) {
      return { fiscalYear: year, fiscalMonth: idx + 1 };
    }
  }
  const d = new Date();
  return { fiscalYear: d.getFullYear(), fiscalMonth: d.getMonth() + 1 };
}

export default function ChecklistInstancePanel({ role, period, onOpenAminah, currentUserId }) {
  const { t } = useTranslation("close");
  const userGate = mapRoleToGate(role);
  const isOwner = userGate === "OWNER";
  const canOpen = userGate === "OWNER" || userGate === "ACCOUNTANT";

  const [templates, setTemplates] = useState(null); // null = loading, [] = empty, [..] = seeded
  const [templatesError, setTemplatesError] = useState(null);
  const [instance, setInstance] = useState(null);   // null = not loaded / no instance yet
  const [instanceError, setInstanceError] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingInstance, setLoadingInstance] = useState(false);
  const [opening, setOpening] = useState(false);
  const [mutatingItemId, setMutatingItemId] = useState(null);
  const [blockedDraft, setBlockedDraft] = useState({ itemId: null, reason: "" });
  const [editorOpen, setEditorOpen] = useState(false);
  const [signOffOpen, setSignOffOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [toast, setToast] = useState(null);

  const { fiscalYear, fiscalMonth } = useMemo(() => parsePeriod(period), [period]);

  const showToast = useCallback((text) => {
    setToast(text);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    setTemplatesError(null);
    try {
      const list = await listTemplateItems(false);
      setTemplates(Array.isArray(list) ? list : []);
    } catch (err) {
      // 403 means the role can't see templates at all. We show the
      // same empty-but-not-configurable state so the panel still
      // renders.
      if (err && err.status === 403) {
        setTemplates([]);
      } else {
        setTemplates([]);
        setTemplatesError(err?.message || String(err || ""));
      }
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const loadInstance = useCallback(async () => {
    setLoadingInstance(true);
    setInstanceError(null);
    try {
      const list = await listInstances({ fiscalYear });
      const match = (list || []).find(
        (i) => i.fiscalYear === fiscalYear && i.fiscalMonth === fiscalMonth
      );
      if (!match) {
        setInstance(null);
      } else {
        const hydrated = await getInstance(match.id);
        setInstance(hydrated || match);
      }
    } catch (err) {
      if (err && err.status === 403) {
        setInstance(null);
      } else {
        setInstanceError(err?.message || String(err || ""));
      }
    } finally {
      setLoadingInstance(false);
    }
  }, [fiscalYear, fiscalMonth]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  const handleOpenInstance = async () => {
    if (!canOpen) return;
    setOpening(true);
    try {
      const inst = await openInstance({ fiscalYear, fiscalMonth });
      setInstance(inst);
      showToast(t("checklist.toast.opened"));
    } catch (err) {
      showToast(err?.message || t("checklist.error.open_failed"));
    } finally {
      setOpening(false);
    }
  };

  const handleMarkItem = async (item, nextStatus, extra = {}) => {
    if (!canMarkItem(userGate, item.completeRoleGate)) return;
    setMutatingItemId(item.id);
    try {
      const body = { status: nextStatus, ...extra };
      const res = await markItemStatus(item.id, body);
      // Response may be { item, instance } or just an item.
      if (res && res.instance) {
        setInstance(res.instance);
      } else if (res && res.id && instance) {
        // Patch the item locally and refetch instance status if needed.
        const next = {
          ...instance,
          items: (instance.items || []).map((i) => (i.id === res.id ? res : i)),
        };
        setInstance(next);
        // Optimistic: let the server own the instance status on next
        // refresh; we refetch to be safe.
        loadInstance();
      } else {
        loadInstance();
      }
      if (nextStatus === "COMPLETED") showToast(t("checklist.toast.item_completed"));
      if (nextStatus === "BLOCKED") showToast(t("checklist.toast.item_blocked"));
      if (nextStatus === "IN_PROGRESS") showToast(t("checklist.toast.item_in_progress"));
      if (nextStatus === "PENDING") showToast(t("checklist.toast.item_reset"));
    } catch (err) {
      showToast(err?.message || t("checklist.error.mark_failed"));
    } finally {
      setMutatingItemId(null);
      if (nextStatus === "BLOCKED") setBlockedDraft({ itemId: null, reason: "" });
    }
  };

  const handleReopen = async () => {
    if (!isOwner || !instance) return;
    setReopening(true);
    try {
      const updated = await reopenInstance(instance.id);
      setInstance(updated || instance);
      showToast(t("checklist.toast.reopened"));
      setReopenOpen(false);
      // Items should have been reset by the backend; re-fetch to be safe.
      loadInstance();
    } catch (err) {
      showToast(err?.message || t("checklist.error.reopen_failed"));
    } finally {
      setReopening(false);
    }
  };

  // Derived flags for rendering.
  const instStatus = instance?.status || null;
  const instMeta = instStatus ? INSTANCE_STATUS_META[instStatus] : null;
  const showSignOffButton =
    isOwner && instStatus === "COMPLETED" && instance && (instance.items || []).length > 0;
  const showReopenButton =
    isOwner && (instStatus === "SIGNED_OFF" || instStatus === "COMPLETED");

  // SoD pre-check: is the current user among any item's completedBy?
  // If yes, the Sign-off button is disabled client-side with a tooltip.
  // The server still enforces authoritatively.
  const signerIsCompleter = useMemo(() => {
    if (!instance || !currentUserId) return false;
    return (instance.items || []).some((i) => i.completedBy === currentUserId);
  }, [instance, currentUserId]);

  const templatesEmpty = Array.isArray(templates) && templates.filter((t) => t.isActive).length === 0;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 20,
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <ClipboardList size={14} color="var(--text-tertiary)" />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
              }}
            >
              {t("checklist.section_title")}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 2,
                lineHeight: 1.5,
              }}
            >
              {t("checklist.section_desc")}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {instMeta && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: instMeta.color,
                background: `${instMeta.color}14`,
                border: `1px solid ${instMeta.color}55`,
                padding: "4px 10px",
                borderRadius: 4,
              }}
            >
              {t(instMeta.labelKey)}
            </span>
          )}
          {isOwner && (
            <ActionButton
              variant="secondary"
              size="sm"
              icon={Settings}
              label={t("checklist.template.manage_button")}
              onClick={() => setEditorOpen(true)}
            />
          )}
          {onOpenAminah && (
            <ActionButton
              variant="secondary"
              size="sm"
              icon={Sparkles}
              label={t("checklist.ask_aminah")}
              onClick={() =>
                onOpenAminah(
                  `Explain the structured monthly close checklist for ${period}. ` +
                    `Current instance status: ${instStatus || "not opened"}.`
                )
              }
            />
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "16px 18px" }}>
        {/* Loading templates */}
        {loadingTemplates && templates === null && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: "24px 0",
              textAlign: "center",
              color: "var(--text-tertiary)",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Spinner size={14} /> {t("checklist.loading")}
          </div>
        )}

        {/* Error state */}
        {templatesError && (
          <ErrorBlock title={t("checklist.error.templates_title")} message={templatesError} />
        )}

        {/* Empty state: no template configured */}
        {!loadingTemplates && templatesEmpty && !templatesError && (
          <div
            style={{
              background: "var(--bg-surface-sunken)",
              border: "1px dashed var(--border-default)",
              borderRadius: 8,
              padding: "22px 18px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: 6,
              }}
            >
              {isOwner
                ? t("checklist.empty.owner_title")
                : t("checklist.empty.non_owner_title")}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-tertiary)",
                lineHeight: 1.5,
                marginBottom: 14,
              }}
            >
              {isOwner
                ? t("checklist.empty.owner_desc")
                : t("checklist.empty.non_owner_desc")}
            </div>
            {isOwner && (
              <ActionButton
                variant="primary"
                size="sm"
                icon={Plus}
                label={t("checklist.empty.configure_button")}
                onClick={() => setEditorOpen(true)}
              />
            )}
          </div>
        )}

        {/* Template configured, no instance yet for this period */}
        {!loadingTemplates && !templatesEmpty && !instance && !loadingInstance && !instanceError && (
          <div
            style={{
              background: "var(--bg-surface-sunken)",
              border: "1px dashed var(--border-default)",
              borderRadius: 8,
              padding: "22px 18px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: 6,
              }}
            >
              {t("checklist.no_instance.title", { period })}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-tertiary)",
                lineHeight: 1.5,
                marginBottom: 14,
              }}
            >
              {canOpen
                ? t("checklist.no_instance.desc_can_open")
                : t("checklist.no_instance.desc_read_only")}
            </div>
            {canOpen && (
              <ActionButton
                variant="primary"
                size="sm"
                icon={PlayCircle}
                label={
                  opening
                    ? t("checklist.no_instance.opening")
                    : t("checklist.no_instance.open_button", { period })
                }
                disabled={opening}
                onClick={handleOpenInstance}
              />
            )}
          </div>
        )}

        {/* Instance error */}
        {instanceError && (
          <ErrorBlock title={t("checklist.error.instance_title")} message={instanceError} />
        )}

        {/* Reopened banner */}
        {instance && instance.status === "REOPENED" && (
          <div
            role="status"
            style={{
              background: "var(--semantic-warning-subtle)",
              border: "1px solid var(--semantic-warning)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <RotateCcw size={14} color="var(--semantic-warning)" />
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {t("checklist.reopened_banner")}
            </div>
          </div>
        )}

        {/* Signed-off banner */}
        {instance && instance.status === "SIGNED_OFF" && (
          <div
            role="status"
            style={{
              background: "var(--accent-primary-subtle)",
              border: "1px solid var(--accent-primary)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <ShieldCheck size={14} color="var(--accent-primary)" />
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {t("checklist.signed_off_banner.prefix")}
              <LtrText>{instance.signedOffByName || instance.signedOffBy || ""}</LtrText>
              {t("checklist.signed_off_banner.middle")}
              {instance.signedOffAt ? formatRelativeTime(instance.signedOffAt) : ""}
              {t("checklist.signed_off_banner.suffix")}
            </div>
          </div>
        )}

        {/* Items list + actions */}
        {instance && (instance.items || []).length > 0 && (
          <>
            <div
              style={{
                background: "var(--bg-surface-sunken)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                overflow: "hidden",
                marginBottom: 14,
              }}
            >
              {(instance.items || [])
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((item) => (
                  <ChecklistInstanceRow
                    key={item.id}
                    item={item}
                    userGate={userGate}
                    locked={instance.status === "SIGNED_OFF"}
                    busy={mutatingItemId === item.id}
                    onMark={(nextStatus, extra) => handleMarkItem(item, nextStatus, extra)}
                    blockedDraft={blockedDraft}
                    setBlockedDraft={setBlockedDraft}
                  />
                ))}
            </div>

            {/* Action bar: sign-off + reopen. */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {showSignOffButton && (
                <ActionButton
                  variant="primary"
                  size="sm"
                  icon={ShieldCheck}
                  label={t("checklist.sign_off.button")}
                  onClick={() => setSignOffOpen(true)}
                  disabled={signerIsCompleter}
                  title={
                    signerIsCompleter ? t("checklist.sign_off.sod_blocked_hint") : undefined
                  }
                />
              )}
              {showReopenButton && (
                <ActionButton
                  variant="secondary"
                  size="sm"
                  icon={RotateCcw}
                  label={t("checklist.reopen.button")}
                  onClick={() => setReopenOpen(true)}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg-surface-raised)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
            padding: "10px 18px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            zIndex: 400,
            boxShadow: "var(--shadow-xl)",
          }}
        >
          {toast}
        </div>
      )}

      {/* Template editor modal (OWNER only) */}
      {editorOpen && isOwner && (
        <ChecklistTemplateEditor
          open={editorOpen}
          templates={templates || []}
          onClose={() => setEditorOpen(false)}
          onRefresh={() => {
            loadTemplates();
          }}
        />
      )}

      {/* Sign-off modal (OWNER only) */}
      {signOffOpen && isOwner && instance && (
        <SignOffModal
          open={signOffOpen}
          instance={instance}
          currentUserId={currentUserId}
          onClose={() => setSignOffOpen(false)}
          onSignedOff={(updated) => {
            if (updated) setInstance(updated);
            else loadInstance();
            showToast(t("checklist.toast.signed_off"));
          }}
        />
      )}

      {/* Reopen confirmation modal */}
      {reopenOpen && isOwner && instance && (
        <ReopenConfirmModal
          open={reopenOpen}
          period={period}
          onClose={() => setReopenOpen(false)}
          onConfirm={handleReopen}
          loading={reopening}
        />
      )}
    </div>
  );
}

/* ───────── Instance-item row ───────── */

function ChecklistInstanceRow({ item, userGate, locked, busy, onMark, blockedDraft, setBlockedDraft }) {
  const { t } = useTranslation("close");
  const meta = ITEM_STATUS_META[item.status] || ITEM_STATUS_META.PENDING;
  const Icon = meta.Icon;
  const canMark = canMarkItem(userGate, item.completeRoleGate) && !locked;
  const isCompleted = item.status === "COMPLETED";
  const isBlocked = item.status === "BLOCKED";
  const isInProgress = item.status === "IN_PROGRESS";
  const isEditingBlocked = blockedDraft.itemId === item.id;

  return (
    <div
      style={{
        padding: "12px 14px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Icon size={16} color={meta.color} strokeWidth={2.2} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-primary)",
              fontWeight: 500,
              textDecoration: isCompleted ? "line-through" : "none",
              lineHeight: 1.4,
            }}
          >
            {item.label}
          </div>
          {item.description && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 3,
                lineHeight: 1.5,
              }}
            >
              {item.description}
            </div>
          )}
          {/* Attribution line when COMPLETED */}
          {isCompleted && item.completedBy && (
            <div
              style={{
                fontSize: 10,
                color: "var(--text-tertiary)",
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              {t("checklist.item.completed_by_prefix")}
              <LtrText>{item.completedByName || item.completedBy}</LtrText>
              {t("checklist.item.completed_by_middle")}
              {item.completedAt ? formatRelativeTime(item.completedAt) : ""}
              {t("checklist.item.completed_by_suffix")}
            </div>
          )}
          {/* Blocked reason */}
          {isBlocked && item.blockedReason && (
            <div
              style={{
                fontSize: 11,
                color: "var(--semantic-danger)",
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              {t("checklist.item.blocked_reason_prefix")}
              {item.blockedReason}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: meta.color,
            background: `${meta.color}14`,
            border: `1px solid ${meta.color}55`,
            padding: "3px 8px",
            borderRadius: 4,
            minWidth: 80,
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          {t(meta.labelKey)}
        </span>
      </div>

      {/* Role-gate chip */}
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", paddingInlineStart: 28 }}>
        {t("checklist.item.role_gate_prefix")}
        {t(`checklist.role_gate.${item.completeRoleGate}`)}
      </div>

      {/* Action row */}
      {canMark && !isEditingBlocked && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingInlineStart: 28 }}>
          {!isInProgress && !isCompleted && (
            <ActionButton
              variant="secondary"
              size="sm"
              icon={Clock}
              label={t("checklist.item.mark_in_progress")}
              disabled={busy}
              onClick={() => onMark("IN_PROGRESS")}
            />
          )}
          {!isCompleted && (
            <ActionButton
              variant="primary"
              size="sm"
              icon={CheckCircle2}
              label={t("checklist.item.mark_complete")}
              disabled={busy}
              onClick={() => onMark("COMPLETED")}
            />
          )}
          {!isBlocked && (
            <ActionButton
              variant="secondary"
              size="sm"
              icon={AlertTriangle}
              label={t("checklist.item.mark_blocked")}
              disabled={busy}
              onClick={() => setBlockedDraft({ itemId: item.id, reason: "" })}
            />
          )}
          {(isCompleted || isBlocked || isInProgress) && (
            <ActionButton
              variant="secondary"
              size="sm"
              label={t("checklist.item.reset")}
              disabled={busy}
              onClick={() => onMark("PENDING")}
            />
          )}
        </div>
      )}

      {/* Blocked-reason inline editor */}
      {canMark && isEditingBlocked && (
        <div
          style={{
            paddingInlineStart: 28,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.12em",
              color: "var(--text-tertiary)",
            }}
          >
            {t("checklist.item.blocked_reason_label")}
          </div>
          <textarea
            value={blockedDraft.reason}
            onChange={(e) => setBlockedDraft({ itemId: item.id, reason: e.target.value })}
            placeholder={t("checklist.item.blocked_reason_placeholder")}
            rows={2}
            maxLength={500}
            style={{
              width: "100%",
              background: "var(--bg-surface)",
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
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <ActionButton
              variant="secondary"
              size="sm"
              label={t("checklist.item.cancel")}
              disabled={busy}
              onClick={() => setBlockedDraft({ itemId: null, reason: "" })}
            />
            <ActionButton
              variant="primary"
              size="sm"
              label={t("checklist.item.blocked_confirm")}
              disabled={busy || !blockedDraft.reason.trim()}
              onClick={() => onMark("BLOCKED", { blockedReason: blockedDraft.reason.trim() })}
            />
          </div>
        </div>
      )}

      {/* Locked hint when role can't mark */}
      {!canMark && !locked && (
        <div
          style={{
            paddingInlineStart: 28,
            fontSize: 10,
            color: "var(--text-tertiary)",
            fontStyle: "italic",
          }}
        >
          {t("checklist.item.role_denied_hint")}
        </div>
      )}
    </div>
  );
}

/* ───────── Reopen confirmation modal ───────── */

function ReopenConfirmModal({ open, period, onClose, onConfirm, loading }) {
  const { t } = useTranslation("close");
  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--overlay-backdrop)",
          backdropFilter: "blur(4px)",
          zIndex: 340,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("checklist.reopen.modal_title")}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 440,
          maxWidth: "calc(100vw - 32px)",
          background: "var(--bg-surface-raised)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          zIndex: 341,
          boxShadow: "var(--shadow-xl)",
        }}
      >
        <div
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 20,
              color: "var(--text-primary)",
              letterSpacing: "-0.2px",
            }}
          >
            {t("checklist.reopen.modal_title")}
          </div>
        </div>
        <div style={{ padding: "18px 22px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {t("checklist.reopen.modal_body", { period })}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            padding: "14px 22px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <ActionButton
            variant="secondary"
            label={t("checklist.reopen.cancel")}
            onClick={onClose}
            disabled={loading}
          />
          <ActionButton
            variant="primary"
            icon={RotateCcw}
            label={loading ? t("checklist.reopen.confirming") : t("checklist.reopen.confirm")}
            disabled={loading}
            onClick={onConfirm}
          />
        </div>
      </div>
    </>
  );
}

/* ───────── Shared error block ───────── */

function ErrorBlock({ title, message }) {
  return (
    <div
      role="alert"
      style={{
        background: "var(--semantic-danger-subtle)",
        border: "1px solid var(--semantic-danger)",
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <AlertTriangle size={16} color="var(--semantic-danger)" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--semantic-danger)",
            marginBottom: 2,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {message}
        </div>
      </div>
    </div>
  );
}
