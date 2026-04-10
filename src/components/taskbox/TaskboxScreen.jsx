import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, Plus, Inbox, Filter, X as XIcon, MoreVertical, FileText as FileTextIcon } from "lucide-react";
import EmptyState from "../shared/EmptyState";
import {
  getTaskbox,
  getTaskboxCounts,
  completeTask as engineCompleteTask,
  replyToTask as engineReplyToTask,
  approveBudget as engineApproveBudget,
  requestBudgetChanges as engineRequestBudgetChanges,
  cancelTask as engineCancelTask,
  approveCloseAndSyncTask,
  rejectCloseAndSyncTask,
  approveReconciliationCompletion,
  rejectReconciliationCompletion,
  approvePeriodReopen,
  rejectPeriodReopen,
  bulkApproveTasks,
  bulkRejectTasks,
  bulkAssignTasks,
  bulkMarkAsRead,
  bulkCompleteTasks,
  bulkArchiveTasks,
  exportTasks,
  searchTasks,
  getTaskTemplates,
  deleteTaskTemplate,
  duplicateTaskTemplate,
  shareTaskTemplate,
  getRecipientsForRole,
  getTaskTypesForDirection,
} from "../../engine/mockEngine";
import { emitTaskboxChange } from "../../utils/taskboxBus";

const ROLE_TO_USER_ID = { CFO: "cfo", Owner: "owner", Junior: "sara" };
import TaskRow from "./TaskRow";
import TaskDetail from "./TaskDetail";
import NewTaskModal from "./NewTaskModal";
import EscalateTaskModal from "./EscalateTaskModal";
import AdvancedSearchSlideOver from "./AdvancedSearchSlideOver";
import { formatRelativeTime } from "../../utils/relativeTime";

const FILTER_IDS = [
  { id: "all",          key: "all" },
  { id: "unread",       key: "unread" },
  { id: "approvals",    key: "approvals" },
  { id: "received",     key: "received" },
  { id: "sent",         key: "sent" },
  { id: "needs-action", key: "needs_action" },
  { id: "completed",    key: "completed" },
];

export default function TaskboxScreen({ role = "CFO", initialTaskId = null, initialFilter = null }) {
  const { t } = useTranslation("taskbox");
  const { t: tc } = useTranslation("common");
  const [tab, setTab] = useState("tasks"); // tasks | templates
  const [tasks, setTasks] = useState(null);
  const [filter, setFilter] = useState(initialFilter || "all");
  useEffect(() => { if (initialFilter) setFilter(initialFilter); }, [initialFilter]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState(initialTaskId);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkEscalateOpen, setBulkEscalateOpen] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  const refresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
    emitTaskboxChange();
  }, []);
  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 3000);
  };
  const [counts, setCounts] = useState({});

  useEffect(() => {
    getTaskbox(role, filter).then((list) => setTasks(list.filter((x) => !x.archived)));
    getTaskboxCounts(role).then(setCounts);
  }, [role, filter, refreshTick]);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(id);
  }, [query]);

  // Escape clears search
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && query) setQuery(""); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query]);

  useEffect(() => {
    if (initialTaskId) setOpenTaskId(initialTaskId);
  }, [initialTaskId]);

  const hasAdvancedFilters = Object.keys(searchFilters).some((k) => {
    const v = searchFilters[k];
    return Array.isArray(v) ? v.length > 0 : !!v;
  });

  // Filtered list combining filter tab + search query + advanced filters
  const filtered = useMemo(() => {
    const base = (tasks || []).filter((task) => !task.archived);
    if (!debouncedQuery && !hasAdvancedFilters) return base;
    const q = debouncedQuery.toLowerCase().trim();
    return base.filter((task) => {
      if (q) {
        const hay = [
          task.subject, task.body, task.sender?.name, task.recipient?.name, task.type,
          task.linkedItem?.id,
          ...(task.messages || []).map((m) => m.body),
          ...(task.attachments || []).map((a) => a.name),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const f = searchFilters;
      if (f.senderIds?.length && !f.senderIds.includes(task.sender?.id)) return false;
      if (f.recipientIds?.length && !f.recipientIds.includes(task.recipient?.id)) return false;
      if (f.types?.length && !f.types.includes(task.type)) return false;
      if (f.statuses?.length && !f.statuses.includes(task.status)) return false;
      if (f.priorities?.length && !f.priorities.includes(task.priority)) return false;
      if (f.hasAttachments && !(task.attachments && task.attachments.length > 0)) return false;
      if (f.linkedType && task.linkedItem?.type !== f.linkedType) return false;
      if (f.createdAfter && new Date(task.createdAt) < new Date(f.createdAfter)) return false;
      if (f.createdBefore && new Date(task.createdAt) > new Date(f.createdBefore)) return false;
      return true;
    });
  }, [tasks, debouncedQuery, searchFilters, hasAdvancedFilters]);

  const openTask = tasks && openTaskId ? tasks.find((t) => t.id === openTaskId) : null;
  const openCount = (tasks || []).filter((t) => t.status !== "completed").length;

  // Bulk selection helpers
  const bulkMode = selectedIds.size > 0;
  const toggleSelect = (task) => {
    const n = new Set(selectedIds);
    if (n.has(task.id)) n.delete(task.id); else n.add(task.id);
    setSelectedIds(n);
  };
  const selectAllVisible = () => {
    const n = new Set(selectedIds);
    filtered.forEach((t) => n.add(t.id));
    setSelectedIds(n);
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulk = async (action, extra) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (action === "approve") {
      const r = await bulkApproveTasks(ids);
      showToast(t("bulk.approved_toast", { count: r.approved, skipped: r.skipped }));
    } else if (action === "reject") {
      const r = await bulkRejectTasks(ids, extra?.reason || "");
      showToast(t("bulk.rejected_toast", { count: r.rejected }));
    } else if (action === "assign") {
      const r = await bulkAssignTasks(ids, extra?.recipientId);
      showToast(t("bulk.assigned_toast", { count: r.assigned }));
    } else if (action === "mark_read") {
      const r = await bulkMarkAsRead(ids);
      showToast(t("bulk.read_toast", { count: r.marked }));
    } else if (action === "complete") {
      const r = await bulkCompleteTasks(ids);
      showToast(t("bulk.completed_toast", { count: r.completed }));
    } else if (action === "archive") {
      const r = await bulkArchiveTasks(ids);
      showToast(t("bulk.archived_toast", { count: r.archived }));
    } else if (action === "export") {
      await exportTasks(ids, "csv");
      // Client-side CSV export
      const selected = filtered.filter((f) => ids.includes(f.id));
      const rows = [["ID", "Type", "Subject", "Sender", "Recipient", "Status", "Created", "Updated"]];
      selected.forEach((t2) => rows.push([t2.id, t2.type, t2.subject, t2.sender?.name || "", t2.recipient?.name || "", t2.status, t2.createdAt || "", t2.updatedAt || ""]));
      downloadCSV(`tasks-export-${new Date().toISOString().slice(0, 10)}.csv`, rows);
      showToast(t("bulk.exported_toast", { count: ids.length }));
    }
    clearSelection();
    refresh();
  };

  if (openTask) {
    return (
      <TaskDetail
        task={openTask}
        currentUserId={ROLE_TO_USER_ID[role] || "cfo"}
        onBack={() => setOpenTaskId(null)}
        onOpenTask={(id) => setOpenTaskId(id)}
        onComplete={async (t) => {
          await engineCompleteTask(t.id, null, role === "CFO" ? "cfo" : role === "Owner" ? "owner" : "sara");
          refresh();
        }}
        onReply={async (t, body) => {
          await engineReplyToTask(t.id, body, role === "CFO" ? "cfo" : role === "Owner" ? "owner" : "sara");
          refresh();
        }}
        onApprovalAction={async (task, action, note) => {
          const author = role === "CFO" ? "cfo" : role === "Owner" ? "owner" : "sara";
          const isBudgetApproval = task.type === "approve-budget";
          const isCloseApproval =
            task.type === "request-approval" && task.linkedItem?.type === "month-end-close";
          const isReconciliationApproval =
            task.type === "request-approval" && task.linkedItem?.type === "reconciliation";
          const isPeriodReopenApproval =
            task.type === "request-approval" && task.linkedItem?.type === "period_reopen";
          const budgetId = task.linkedItem?.budgetId;
          if (action === "approve") {
            if (isPeriodReopenApproval && task.linkedItem?.periodKey) {
              await approvePeriodReopen(task.linkedItem.periodKey, author);
              await engineCompleteTask(task.id, "Period re-open approved.", author);
              setToast(t("toast.period_reopen_approved"));
              setTimeout(() => setToast(null), 2600);
            } else if (isReconciliationApproval && task.linkedItem?.reconciliationId) {
              await approveReconciliationCompletion(task.linkedItem.reconciliationId, author);
              await engineCompleteTask(task.id, "Reconciliation approved.", author);
              setToast(t("toast.reconciliation_approved"));
              setTimeout(() => setToast(null), 2600);
            } else if (isCloseApproval) {
              await approveCloseAndSyncTask(task.linkedItem?.period || null);
            } else if (isBudgetApproval && budgetId) {
              await engineApproveBudget(budgetId, author);
              await engineCompleteTask(task.id, `Budget approved.`, author);
              setToast(t("toast.budget_approved"));
              setTimeout(() => setToast(null), 2600);
            } else {
              await engineCompleteTask(task.id, "Approved.", author);
            }
          } else if (action === "request-changes") {
            if (isBudgetApproval && budgetId) {
              await engineRequestBudgetChanges(budgetId, note);
              await engineCompleteTask(task.id, `Change request sent.`, author);
              setToast(t("toast.change_request_sent"));
              setTimeout(() => setToast(null), 2600);
            } else {
              await engineReplyToTask(task.id, `[Requested changes] ${note}`, author);
            }
          } else if (action === "reject") {
            if (isPeriodReopenApproval && task.linkedItem?.periodKey) {
              await rejectPeriodReopen(task.linkedItem.periodKey, author, note || "");
              await engineCompleteTask(task.id, `Period re-open rejected: ${note || "No reason given"}`, author);
              setToast(t("toast.period_reopen_rejected"));
              setTimeout(() => setToast(null), 2600);
            } else if (isReconciliationApproval && task.linkedItem?.reconciliationId) {
              await rejectReconciliationCompletion(task.linkedItem.reconciliationId, author, note || "");
              await engineCompleteTask(task.id, `Reconciliation rejected: ${note || "No reason given"}`, author);
              setToast(t("toast.reconciliation_rejected"));
              setTimeout(() => setToast(null), 2600);
            } else if (isCloseApproval) {
              await rejectCloseAndSyncTask(task.linkedItem?.period || null, note || "");
            } else {
              await engineReplyToTask(task.id, `[Rejected] ${note}`, author);
            }
          } else if (action === "cancel") {
            await engineCancelTask(task.id, author);
            setOpenTaskId(null);
            setToast(t("toast.request_cancelled"));
            setTimeout(() => setToast(null), 2000);
          }
          refresh();
        }}
      />
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 28px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--text-primary)", letterSpacing: "-0.3px", lineHeight: 1 }}>
              {t("title")}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 6 }}>
              {t("open_count", { count: openCount })}
            </div>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}
          >
            <Plus size={14} strokeWidth={2.4} />
            {t("new_task")}
          </button>
        </div>

        {/* Top-level tab bar: Tasks | Templates */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {["tasks", "templates"].map((key) => {
            const on = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  background: "transparent", border: "none",
                  color: on ? "var(--accent-primary)" : "var(--text-tertiary)",
                  fontSize: 13, fontWeight: 600, letterSpacing: "0.05em",
                  padding: "10px 16px", cursor: "pointer", fontFamily: "inherit",
                  boxShadow: on ? "inset 0 -2px 0 var(--accent-primary)" : "none",
                }}
              >
                {t(`tabs_top.${key}`)}
              </button>
            );
          })}
        </div>

        {tab === "tasks" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {FILTER_IDS.map((f) => {
                  const on = filter === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      style={{
                        background: "transparent", border: "none",
                        color: on ? "var(--accent-primary)" : "var(--text-tertiary)",
                        fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
                        padding: "8px 12px", cursor: "pointer", fontFamily: "inherit",
                        boxShadow: on ? "inset 0 -2px 0 #00C48C" : "none",
                      }}
                    >
                      {t(`filters.${f.key}`)}
                      {counts[f.id] != null && (
                        <span style={{ marginInlineStart: 6, fontSize: 10, color: on ? "var(--accent-primary)" : "var(--text-tertiary)", fontFamily: "'DM Mono', monospace" }}>
                          · {counts[f.id]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative", width: 260 }}>
                  <Search size={13} color="var(--text-tertiary)" style={{ position: "absolute", insetInlineStart: 10, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("search.placeholder")}
                    style={{ width: "100%", background: "var(--bg-surface-sunken)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: "8px 30px 8px 30px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }}
                  />
                  {query && (
                    <button onClick={() => setQuery("")} aria-label={t("search.clear")} style={{ position: "absolute", insetInlineEnd: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 0 }}>
                      <XIcon size={12} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setAdvancedOpen(true)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: hasAdvancedFilters ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)",
                    border: hasAdvancedFilters ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                    color: hasAdvancedFilters ? "var(--accent-primary)" : "var(--text-tertiary)",
                    padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                    fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                  }}
                >
                  <Filter size={12} /> {t("search.advanced")}
                </button>
              </div>
            </div>

            {/* Search match count + active filter pills */}
            {(debouncedQuery || hasAdvancedFilters) && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {debouncedQuery && (
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    {filtered.length === 1 ? t("search.match_count", { count: 1 }) : t("search.match_count_plural", { count: filtered.length })}
                  </span>
                )}
                {hasAdvancedFilters && Object.keys(searchFilters).map((k) => {
                  const v = searchFilters[k];
                  const isArr = Array.isArray(v);
                  const label = isArr ? `${k}: ${v.length}` : `${k}`;
                  if (isArr ? v.length === 0 : !v) return null;
                  return (
                    <button
                      key={k}
                      onClick={() => {
                        const next = { ...searchFilters };
                        delete next[k];
                        setSearchFilters(next);
                      }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--accent-primary-subtle)", color: "var(--accent-primary)", border: "1px solid rgba(0,196,140,0.30)", padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {label} <XIcon size={10} />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bulk action bar */}
      {tab === "tasks" && bulkMode && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 28px", background: "var(--accent-primary-subtle)", borderBottom: "1px solid rgba(0,196,140,0.30)", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: "var(--accent-primary)", fontWeight: 600 }}>
            {t("bulk.selected", { count: selectedIds.size })}
          </div>
          <button onClick={selectAllVisible} style={bulkBtnStyle}>{t("bulk.select_all")}</button>
          <button onClick={() => handleBulk("approve")} style={bulkBtnStyle}>{t("bulk.approve_all")}</button>
          <button onClick={() => setBulkRejectOpen(true)} style={bulkBtnStyle}>{t("bulk.reject_all")}</button>
          <button onClick={() => setBulkAssignOpen(true)} style={bulkBtnStyle}>{t("bulk.assign_to")}</button>
          <button onClick={() => setBulkEscalateOpen(true)} style={bulkBtnStyle}>{t("bulk.escalate_all")}</button>
          <button onClick={() => handleBulk("mark_read")} style={bulkBtnStyle}>{t("bulk.mark_read")}</button>
          <button onClick={() => handleBulk("complete")} style={bulkBtnStyle}>{t("bulk.mark_complete")}</button>
          <button onClick={() => handleBulk("archive")} style={bulkBtnStyle}>{t("bulk.archive")}</button>
          <button onClick={() => handleBulk("export")} style={bulkBtnStyle}>{t("bulk.export_csv")}</button>
          <div style={{ flex: 1 }} />
          <button onClick={clearSelection} style={{ ...bulkBtnStyle, color: "var(--semantic-danger)", border: "1px solid rgba(255,90,95,0.30)" }}>
            {t("bulk.cancel")}
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ margin: "12px 28px 0", background: "var(--accent-primary-subtle)", border: "1px solid rgba(0,196,140,0.30)", color: "var(--accent-primary)", padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500 }}>
          {toast}
        </div>
      )}

      {/* List / Templates */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "tasks" ? (
          filtered.length === 0 ? (
            <EmptyState icon={Inbox} title={tc("empty_states.taskbox_title")} description={tc("empty_states.taskbox_desc")} />
          ) : (
            filtered.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onClick={(x) => { if (bulkMode) { toggleSelect(x); } else { setOpenTaskId(x.id); } }}
                selectable
                selected={selectedIds.has(task.id)}
                onToggleSelect={toggleSelect}
              />
            ))
          )
        ) : (
          <TemplatesTab role={role} onRefresh={refresh} onToast={showToast} />
        )}
      </div>

      <NewTaskModal
        open={modalOpen}
        role={role}
        onClose={() => setModalOpen(false)}
        onSent={(newTask) => {
          setToast(t("toast.task_sent", { name: newTask.recipient.name }));
          refresh();
          setTimeout(() => setToast(null), 3000);
        }}
      />

      <AdvancedSearchSlideOver
        open={advancedOpen}
        filters={searchFilters}
        people={peopleForFilters(tasks || [])}
        taskTypes={typesForFilters(tasks || [])}
        onClose={() => setAdvancedOpen(false)}
        onApply={(f) => { setSearchFilters(f); setAdvancedOpen(false); }}
        onReset={() => setSearchFilters({})}
      />

      {/* Bulk modals */}
      <EscalateTaskModal
        open={bulkEscalateOpen}
        bulkTaskIds={Array.from(selectedIds)}
        onClose={() => setBulkEscalateOpen(false)}
        onEscalated={(r) => {
          showToast(t("bulk.escalated_toast", { count: r.escalated || 0 }));
          clearSelection();
          refresh();
        }}
      />
      <BulkRejectModal
        open={bulkRejectOpen}
        count={selectedIds.size}
        onClose={() => setBulkRejectOpen(false)}
        onConfirm={async (reason) => {
          setBulkRejectOpen(false);
          await handleBulk("reject", { reason });
        }}
      />
      <BulkAssignModal
        open={bulkAssignOpen}
        count={selectedIds.size}
        role={role}
        onClose={() => setBulkAssignOpen(false)}
        onConfirm={async (recipientId) => {
          setBulkAssignOpen(false);
          await handleBulk("assign", { recipientId });
        }}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────
function peopleForFilters(tasks) {
  const map = new Map();
  for (const t of tasks) {
    if (t.sender) map.set(t.sender.id, t.sender);
    if (t.recipient) map.set(t.recipient.id, t.recipient);
  }
  return Array.from(map.values());
}
function typesForFilters(tasks) {
  const map = new Map();
  for (const t of tasks) {
    if (t.type) map.set(t.type, { id: t.type, label: t.type });
  }
  return Array.from(map.values());
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => {
    const v = String(c == null ? "" : c);
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const bulkBtnStyle = {
  background: "transparent", color: "var(--accent-primary)",
  border: "1px solid rgba(0,196,140,0.30)", padding: "6px 12px",
  borderRadius: 5, cursor: "pointer",
  fontSize: 11, fontWeight: 600, fontFamily: "inherit",
};

// ── Templates Tab ─────────────────────────────────────────────────
function TemplatesTab({ role, onRefresh, onToast }) {
  const { t } = useTranslation("taskbox");
  const [templates, setTemplates] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const load = () => getTaskTemplates("all").then(setTemplates);
  useEffect(() => { load(); }, []);

  if (templates === null) {
    return <div style={{ padding: 24, color: "var(--text-tertiary)", fontSize: 12 }}>…</div>;
  }

  if (templates.length === 0) {
    return <EmptyState icon={FileTextIcon} title={t("templates.empty_title")} description={t("templates.empty_desc")} />;
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t("templates.delete_confirm"))) return;
    await deleteTaskTemplate(id);
    load();
    onToast && onToast(t("templates.deleted_toast"));
  };
  const handleDuplicate = async (id) => {
    await duplicateTaskTemplate(id);
    load();
    onToast && onToast(t("templates.duplicated_toast"));
  };
  const handleShare = async (id, scope) => {
    await shareTaskTemplate(id, scope);
    load();
    onToast && onToast(scope === "role" ? t("templates.shared_toast") : t("templates.private_toast"));
  };

  return (
    <div style={{ padding: "18px 28px 28px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 120px 80px 120px 40px", gap: 10, padding: "10px 14px", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-tertiary)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div>{t("templates.col_name")}</div>
        <div>{t("templates.col_type")}</div>
        <div>{t("templates.col_visibility")}</div>
        <div style={{ textAlign: "end" }}>{t("templates.col_usage")}</div>
        <div>{t("templates.col_last")}</div>
        <div />
      </div>
      {templates.map((tpl) => (
        <div key={tpl.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 120px 80px 120px 40px", gap: 10, padding: "14px", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center", position: "relative" }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{tpl.name}</div>
            {tpl.description && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{tpl.description}</div>}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{tpl.type}</div>
          <div>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", color: tpl.visibility === "role" ? "var(--accent-primary)" : "var(--text-tertiary)", background: tpl.visibility === "role" ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)", padding: "3px 8px", borderRadius: 4 }}>
              {tpl.visibility === "role" ? t("templates.visibility_role") : t("templates.visibility_my")}
            </span>
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: "end", color: "var(--text-primary)" }}>{tpl.usageCount}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{tpl.lastUsed ? formatRelativeTime(tpl.lastUsed) : "—"}</div>
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenuOpenId(menuOpenId === tpl.id ? null : tpl.id)} aria-label={t("templates.kebab_open")} style={{ width: 28, height: 28, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <MoreVertical size={14} />
            </button>
            {menuOpenId === tpl.id && (
              <div data-popover-anchor="end" style={{ position: "absolute", top: "calc(100% + 4px)", insetInlineEnd: 0, width: 200, background: "var(--bg-surface-raised)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, boxShadow: "0 12px 32px rgba(0,0,0,0.6)", zIndex: 150, padding: "6px 0" }}>
                <MenuItem label={t("templates.kebab_duplicate")} onClick={() => { setMenuOpenId(null); handleDuplicate(tpl.id); }} />
                {tpl.visibility === "my" ? (
                  <MenuItem label={t("templates.kebab_share_role")} onClick={() => { setMenuOpenId(null); handleShare(tpl.id, "role"); }} />
                ) : (
                  <MenuItem label={t("templates.kebab_make_private")} onClick={() => { setMenuOpenId(null); handleShare(tpl.id, "private"); }} />
                )}
                <MenuItem label={t("templates.kebab_delete")} danger onClick={() => { setMenuOpenId(null); handleDelete(tpl.id); }} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MenuItem({ label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", background: "transparent", border: "none",
        textAlign: "start", padding: "9px 14px",
        fontSize: 12, fontFamily: "inherit",
        color: danger ? "var(--semantic-danger)" : "var(--text-primary)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface-sunken)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {label}
    </button>
  );
}

// ── Bulk Reject Modal ─────────────────────────────────────────────
function BulkRejectModal({ open, count, onClose, onConfirm }) {
  const { t } = useTranslation("taskbox");
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 480, background: "var(--bg-surface-raised)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)" }}>
            {t("bulk.reject_modal_title", { count })}
          </div>
        </div>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>
            {t("bulk.reject_reason")}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("bulk.reject_reason_placeholder")}
            rows={4}
            style={{ width: "100%", background: "var(--bg-surface-sunken)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("bulk.cancel")}</button>
          <button onClick={() => onConfirm(reason)} style={{ background: "var(--semantic-danger)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{t("bulk.confirm")}</button>
        </div>
      </div>
    </>
  );
}

// ── Bulk Assign Modal ─────────────────────────────────────────────
function BulkAssignModal({ open, count, role, onClose, onConfirm }) {
  const { t } = useTranslation("taskbox");
  const [people, setPeople] = useState([]);
  const [picked, setPicked] = useState("");

  useEffect(() => {
    if (!open) return;
    getRecipientsForRole(role || "CFO").then((list) => {
      setPeople(list);
      setPicked(list[0]?.id || "");
    });
  }, [open, role]);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 480, background: "var(--bg-surface-raised)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)" }}>
            {t("bulk.assign_modal_title", { count })}
          </div>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 4 }}>
            {t("bulk.assign_pick")}
          </div>
          {people.map((p) => (
            <button
              key={p.id}
              onClick={() => setPicked(p.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                background: picked === p.id ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)",
                border: picked === p.id ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "start",
              }}
            >
              <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{p.name}</div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{p.role}</div>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("bulk.cancel")}</button>
          <button onClick={() => onConfirm(picked)} style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{t("bulk.confirm")}</button>
        </div>
      </div>
    </>
  );
}
