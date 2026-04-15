import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Search, Lock, X, FileText, Clock, CheckCircle2, AlertCircle, RotateCcw, Save, Calendar, Sparkles, AlertTriangle, MoreVertical } from "lucide-react";
import FileAttachment from "../../components/shared/FileAttachment";
import LtrText from "../../components/shared/LtrText";
import useEscapeKey from "../../hooks/useEscapeKey";
import SharedEmptyState from "../../components/shared/EmptyState";
import Spinner from "../../components/shared/Spinner";
import { mustBalance } from "../../utils/validation";
import { formatDate } from "../../utils/format";
import { formatRelativeTime } from "../../utils/relativeTime";
// Wave 3 rewrite: the composer now holds the full draft in local React
// state and emits a single atomic POST to the Corporate API on save.
// The per-keystroke mock mutators (createManualJEDraft / addLine /
// updateLine / removeLine / updateManualJEDraft / postManualJE /
// reverseManualJE) are no longer part of the write path — the screen
// works against three Wave 3 endpoints via the engine router:
//
//   • POST   /api/journal-entries                  (createJournalEntry)
//   • PATCH  /api/journal-entries/:id              (updateJournalEntryDraft)
//   • POST   /api/journal-entries/:id/validate     (postJournalEntry)
//   • POST   /api/journal-entries/:id/reverse      (reverseJournalEntry)
//
// Reads (list + detail) still go through the engine router:
//   • GET    /api/journal-entries                  (listJournalEntries)
//   • GET    /api/journal-entries/:id              (getJournalEntry)
//
// Template / schedule / period-lock / attachment features are still on
// mockEngine — they have no backend yet and stay mock in Wave 3.
import {
  getManualJEs,
  getManualJEById,
  createJournalEntry,
  updateJournalEntryDraft,
  postJournalEntry,
  reverseJournalEntry,
} from "../../engine";
import {
  getManualJETemplates,
  createFromTemplate,
  saveAsTemplate,
  scheduleManualJE,
  postScheduledNow,
  getChartOfAccounts,
  searchChartOfAccounts,
  checkPeriodStatus,
  attachJEFile,
  removeJEAttachment,
  getJEAttachments,
  useJETemplate,
  getJETemplateMeta,
  deleteJETemplateRecord,
  shareJETemplate,
} from "../../engine/mockEngine";

const COLORS = {
  bg: "var(--bg-base)",
  card: "var(--bg-surface)",
  border: "var(--border-default)",
  text: "var(--text-primary)",
  textDim: "var(--text-secondary)",
  textFaint: "var(--text-tertiary)",
  teal: "var(--accent-primary)",
  amber: "var(--semantic-warning)",
  red: "var(--semantic-danger)",
  blue: "var(--semantic-info)",
};

// KWD amount with 3 decimals and no currency prefix — the composer columns
// already carry a KWD header. 0 renders as "0.000".
function fmtKWD(n) {
  if (n == null || n === 0) return "0.000";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

// Wave 3: build a fresh client-only draft JE. No server call. The
// composer's local state starts from one of these when the user clicks
// "New blank" — nothing is persisted until Save.
function blankDraft() {
  return {
    id: `NEW-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    status: "draft",
    source: "manual",
    date: new Date().toISOString(),
    reference: "",
    description: "",
    lines: [
      { id: "L1", accountCode: "", accountName: "", debit: 0, credit: 0, memo: "" },
      { id: "L2", accountCode: "", accountName: "", debit: 0, credit: 0, memo: "" },
    ],
    createdAt: new Date().toISOString(),
  };
}

// Normalise whatever shape the parent passes as `je` into the local
// draft state shape. Handles:
//   - client-minted blank drafts (already in the right shape)
//   - server-fetched entries adapted by api/journal-entries.js which
//     already maps API shape → mock-compatible { id, status, lines }
//   - SessionStorage prefill from ConversationalJE edit flow, which
//     carries { date, description, lines: [{accountCode, accountName,
//     debit, credit, label}] }
function normaliseInitialJE(je) {
  if (!je) return blankDraft();
  const lines = Array.isArray(je.lines) && je.lines.length > 0
    ? je.lines.map((l, i) => ({
        id: l.id || `L${i + 1}`,
        accountCode: l.accountCode || l.code || "",
        accountName: l.accountName || l.account || l.name || "",
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        memo: l.memo || l.description || l.label || "",
      }))
    : blankDraft().lines;
  return {
    id: je.id || `NEW-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    status: je.status || "draft",
    source: je.source || "manual",
    date: je.date || new Date().toISOString(),
    reference: je.reference || "",
    description: je.description || "",
    lines,
    createdAt: je.createdAt || new Date().toISOString(),
    reversedBy: je.reversedBy,
    reversalOf: je.reversalOf,
    templateId: je.templateId,
  };
}
// Time helpers routed through the shared i18n-aware utilities so Arabic
// renders localized strings and we stop duplicating format logic.
const fmtRelative = (iso) => (iso ? formatRelativeTime(iso) : "—");
const fmtDate = (iso) => formatDate(iso, { withYear: true });

const TABS = [
  { id: "drafts",   key: "drafts" },
  { id: "recent",   key: "recent" },
  { id: "templates",key: "templates" },
  { id: "scheduled",key: "scheduled" },
];

export default function ManualJEScreen({ onOpenAminah }) {
  const { t } = useTranslation("manual-je");
  const { t: tc } = useTranslation("common");
  const [activeTab, setActiveTab] = useState("drafts");
  const [drafts, setDrafts] = useState([]);
  const [recent, setRecent] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [selected, setSelected] = useState(null); // { kind: "je"|"template"|"new", id? }
  const [activeJE, setActiveJE] = useState(null);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [tick, setTick] = useState(0);
  // Wave 3: `newDraft` holds a client-only blank draft for the
  // "New blank" flow. Nothing hits the server until Save Draft /
  // Save and Post. This sidesteps the Wave 2 per-keystroke mock path
  // which would have created a phantom server draft on every click.
  const [newDraft, setNewDraft] = useState(null);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Wave 2: per-source loading so a failing drafts call doesn't hide
  // the recent-posted list that's actually populated in a real tenant.
  const [loadError, setLoadError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    const safe = (p) =>
      p.catch((err) => {
        if (!cancelled) {
          setLoadError({
            message:
              err?.code === "NETWORK_ERROR"
                ? "Can't reach the server. Check your connection and try again."
                : err?.message || "Something went wrong loading journal entries.",
          });
        }
        return [];
      });
    Promise.all([
      safe(Promise.resolve().then(() => getManualJEs("drafts"))),
      safe(Promise.resolve().then(() => getManualJEs("recent-posted"))),
      safe(Promise.resolve().then(() => getManualJETemplates())),
      safe(Promise.resolve().then(() => getManualJEs("scheduled"))),
    ]).then(([d, r, t, s]) => {
      if (cancelled) return;
      setDrafts(d || []);
      setRecent(r || []);
      setTemplates(t || []);
      setScheduled(s || []);
    });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    if (selected?.kind === "je") {
      getManualJEById(selected.id).then(setActiveJE).catch(() => setActiveJE(null));
      setActiveTemplate(null);
    } else if (selected?.kind === "template") {
      const t = templates.find((x) => x.id === selected.id);
      setActiveTemplate(t);
      setActiveJE(null);
    } else if (selected?.kind === "new") {
      setActiveJE(newDraft);
      setActiveTemplate(null);
    } else {
      setActiveJE(null);
      setActiveTemplate(null);
    }
  }, [selected, tick, templates, newDraft]);

  // Wave 3: read any prefill payload stashed by the ConversationalJE
  // edit flow. When the user clicks "Edit" on a draft confirmation card
  // in ConversationalJE, it cancels the server-side pending action and
  // writes the draft to SessionStorage, then navigates here. We pick
  // it up on mount and seed a new client-only draft with the pending
  // data pre-populated. The key is cleared after consumption so the
  // prefill doesn't leak into the next fresh session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem("haseeb:manual-je-prefill");
      if (!raw) return;
      const payload = JSON.parse(raw);
      window.sessionStorage.removeItem("haseeb:manual-je-prefill");
      if (!payload?.draft) return;
      const prefilled = normaliseInitialJE({
        ...payload.draft,
        description: payload.draft.description || "",
        source: "manual",
      });
      setNewDraft(prefilled);
      setActiveTab("drafts");
      setSelected({ kind: "new" });
      showToast(t("toast.draft_prefilled_from_chat", { defaultValue: "Draft loaded from conversation" }));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wave 3: refresh the lists when another surface (e.g. ConversationalJE)
  // posts a journal entry. The event is fire-and-forget and lives on
  // the window global so it doesn't couple screens.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPosted = () => refresh();
    window.addEventListener("haseeb:journal-entry-posted", onPosted);
    return () => window.removeEventListener("haseeb:journal-entry-posted", onPosted);
  }, [refresh]);

  const handleNewBlank = () => {
    // Wave 3: the "new blank" action is purely client-side. A local
    // draft object is minted here; nothing touches the server until
    // the user clicks Save Draft or Save and Post.
    const d = blankDraft();
    setNewDraft(d);
    setActiveTab("drafts");
    setSelected({ kind: "new" });
  };

  const handleUseTemplate = async (templateId) => {
    const j = await createFromTemplate(templateId);
    setActiveTab("drafts");
    setSelected({ kind: "je", id: j.id });
    refresh();
    showToast(t("toast.draft_from_template"));
  };

  const listForTab = () => {
    let list = [];
    if (activeTab === "drafts") list = drafts;
    if (activeTab === "recent") list = recent;
    if (activeTab === "templates") list = templates;
    if (activeTab === "scheduled") list = scheduled;
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((x) =>
      (x.reference || x.name || "").toLowerCase().includes(q) ||
      (x.description || "").toLowerCase().includes(q) ||
      (x.id || "").toLowerCase().includes(q)
    );
  };

  return (
    <div data-split="true" style={{ flex: 1, display: "flex", flexDirection: "row", overflow: "hidden" }}>
      {/* LEFT PANE */}
      <div style={{ width: 340, display: "flex", flexDirection: "column", borderInlineEnd: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: "20px 18px 12px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: COLORS.text, letterSpacing: "-0.3px", lineHeight: 1 }}>
                {t("title")}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: COLORS.textFaint, marginTop: 5 }}>
                {t("subtitle")}
              </div>
            </div>
            <button
              onClick={handleNewBlank}
              style={{
                background: COLORS.teal, color: "#fff", border: "none", padding: "8px 12px",
                borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}
            >
              <Plus size={12} /> {t("new")}
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2 }}>
            {TABS.map((tab) => {
              const counts = { drafts: drafts.length, recent: recent.length, templates: templates.length, scheduled: scheduled.length };
              const on = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSelected(null); }}
                  style={{
                    flex: 1, background: "transparent", border: "none",
                    color: on ? COLORS.teal : COLORS.textFaint,
                    fontSize: 11, fontWeight: 600, padding: "7px 4px", cursor: "pointer",
                    fontFamily: "inherit", boxShadow: on ? `inset 0 -2px 0 ${COLORS.teal}` : "none",
                  }}
                >
                  {t(`tabs.${tab.key}`)}
                  <span style={{ marginInlineStart: 4, fontFamily: "'DM Mono', monospace", fontSize: 10 }}>
                    {counts[tab.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {listForTab().length === 0 ? (
            <SharedEmptyState
              icon={FileText}
              title={tc(`empty_states.manual_je_${activeTab}_title`)}
              description={tc(`empty_states.manual_je_${activeTab}_desc`)}
            />
          ) : (
            listForTab().map((item) => {
              const isTemplate = activeTab === "templates";
              const isSelected = selected && (
                (isTemplate && selected.kind === "template" && selected.id === item.id) ||
                (!isTemplate && selected.kind === "je" && selected.id === item.id)
              );
              return (
                <ListItem
                  key={item.id}
                  item={item}
                  tab={activeTab}
                  selected={isSelected}
                  onClick={() => setSelected({ kind: isTemplate ? "template" : "je", id: item.id })}
                  onRefresh={refresh}
                />
              );
            })
          )}
        </div>

        {/* Search */}
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${COLORS.border}`, position: "relative" }}>
          <Search size={12} color={COLORS.textFaint} style={{ position: "absolute", left: 22, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search_placeholder")}
            style={{
              width: "100%", background: "var(--bg-surface-sunken)", border: `1px solid ${COLORS.border}`,
              borderRadius: 6, padding: "7px 10px 7px 28px", color: COLORS.text, fontSize: 11,
              fontFamily: "inherit", outline: "none",
            }}
          />
        </div>
      </div>

      {/* RIGHT PANE */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, position: "relative" }}>
        {toast && (
          <div
            style={{
              position: "absolute", top: 16, right: 16,
              background: "var(--accent-primary-subtle)", border: "1px solid rgba(0,196,140,0.30)",
              color: COLORS.teal, padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, zIndex: 50,
            }}
          >
            {toast}
          </div>
        )}

        {!selected && (
          <EmptyState
            onBlank={handleNewBlank}
            onTemplates={() => setActiveTab("templates")}
            onRecent={() => setActiveTab("recent")}
          />
        )}

        {(selected?.kind === "je" || selected?.kind === "new") && activeJE && (
          <ManualJEComposer
            je={activeJE}
            isNew={selected?.kind === "new"}
            onDelete={() => {
              if (selected?.kind === "new") {
                // Client-only draft: just clear and go back.
                setNewDraft(null);
                setSelected(null);
                showToast(t("toast.draft_discarded"));
                return;
              }
              // Server draft: no dedicated DELETE endpoint in Wave 3.
              // For now we just clear the selection — the draft stays
              // on the server as a DRAFT row. Wave 4 can wire a proper
              // DELETE /api/journal-entries/:id if that endpoint ships.
              setSelected(null);
              showToast(t("toast.draft_discarded"));
            }}
            onPost={async ({ draft, post }) => {
              // Wave 3: atomic create-or-update-and-post. The composer
              // holds the full draft locally and calls this once on
              // Save. No per-keystroke server calls.
              //
              // New client-only draft →
              //   POST /api/journal-entries with status = POSTED (if post)
              //                             or status = DRAFT  (if !post)
              // Existing server draft →
              //   PATCH /api/journal-entries/:id with the edited body
              //   + POST /api/journal-entries/:id/validate  (if post)
              const payload = {
                date: draft.date,
                description: draft.description,
                reference: draft.reference || undefined,
                currency: "KWD",
                source: draft.source || "manual",
                lines: draft.lines
                  .filter((l) => l.accountCode && (Number(l.debit) > 0 || Number(l.credit) > 0))
                  .map((l) => ({
                    accountCode: l.accountCode,
                    debit: Number(l.debit) || 0,
                    credit: Number(l.credit) || 0,
                    description: l.memo || "",
                  })),
              };

              if (selected?.kind === "new") {
                // New path: create directly with the target status.
                const created = await createJournalEntry({
                  ...payload,
                  status: post ? "POSTED" : "DRAFT",
                });
                const createdId = created?.id || created?.entryNumber;
                setNewDraft(null);
                setActiveTab(post ? "recent" : "drafts");
                if (createdId) {
                  setSelected({ kind: "je", id: createdId });
                } else {
                  setSelected(null);
                }
                refresh();
                showToast(
                  post
                    ? t("toast.posted", { id: created?.entryNumber || createdId || "" })
                    : t("toast.draft_saved", { defaultValue: "Draft saved" })
                );
                return;
              }

              // Existing server draft — PATCH then /validate.
              await updateJournalEntryDraft(activeJE.id, payload);
              if (post) {
                const validated = await postJournalEntry(activeJE.id);
                setActiveTab("recent");
                setSelected({ kind: "je", id: validated?.id || activeJE.id });
                refresh();
                showToast(t("toast.posted", { id: validated?.entryNumber || activeJE.id }));
              } else {
                refresh();
                showToast(t("toast.draft_saved", { defaultValue: "Draft saved" }));
              }
            }}
            onReverse={async (reason) => {
              if (selected?.kind === "new") return;
              const rev = await reverseJournalEntry(activeJE.id, reason);
              setActiveTab("drafts");
              if (rev?.id) setSelected({ kind: "je", id: rev.id });
              refresh();
              showToast(t("toast.reversal_created"));
            }}
            onSchedule={async (date, recurring) => {
              // Scheduling has no backend in Wave 3 — stays on mockEngine.
              // Only works for client-only drafts or mock-backed entries;
              // live server drafts will throw from WRITE_THROW.
              try {
                await scheduleManualJE(activeJE.id, date, recurring);
                setActiveTab("scheduled");
                refresh();
                showToast(t("toast.scheduled", { date: fmtDate(date) }));
              } catch (err) {
                showToast(t("toast.cannot_post", { reason: err?.message || "Scheduling not available" }));
              }
            }}
            onPostNow={async () => {
              try {
                const r = await postScheduledNow(activeJE.id, "cfo");
                setActiveTab("recent");
                setSelected({ kind: "je", id: r.id });
                refresh();
                showToast(t("toast.posted", { id: r.id }));
              } catch (err) {
                showToast(t("toast.cannot_post", { reason: err?.message || "Post-now not available" }));
              }
            }}
            onSaveTemplate={async (name, desc) => {
              if (!activeJE.id) return;
              await saveAsTemplate(activeJE.id, name, desc);
              refresh();
              showToast(t("toast.template_saved"));
            }}
            onAskAminah={onOpenAminah}
          />
        )}

        {selected?.kind === "template" && activeTemplate && (
          <TemplateDetail template={activeTemplate} onUse={() => handleUseTemplate(activeTemplate.id)} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ onBlank, onTemplates, onRecent }) {
  const { t } = useTranslation("manual-je");
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 480, padding: "40px 44px", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, textAlign: "center" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: COLORS.text, letterSpacing: "-0.3px", marginBottom: 8 }}>
          {t("empty_state.title")}
        </div>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 24, lineHeight: 1.55 }}>
          {t("empty_state.desc")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={onBlank}
            style={{ background: COLORS.teal, color: "#fff", border: "none", padding: "10px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            <Plus size={12} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} /> {t("empty_state.blank")}
          </button>
          <button
            onClick={onTemplates}
            style={{ background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}`, padding: "10px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            {t("empty_state.use_template")}
          </button>
          <button
            onClick={onRecent}
            style={{ background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}`, padding: "10px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            {t("empty_state.view_recent")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ListItem({ item, tab, selected, onClick, onRefresh }) {
  const { t } = useTranslation("manual-je");
  const isJE = tab !== "templates";
  const total = isJE ? Math.max(item.totalDebits || 0, item.totalCredits || 0) : 0;
  return (
    <button
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "start", padding: "12px 16px",
        background: selected ? "var(--bg-selected)" : "transparent",
        border: "none", borderBottom: `1px solid var(--border-subtle)`,
        borderInlineStart: selected ? `2px solid ${COLORS.teal}` : "2px solid transparent",
        cursor: "pointer", fontFamily: "inherit", color: COLORS.text,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {tab === "templates" ? item.name : item.reference || t("list.untitled")}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.description}
          </div>
          <div style={{ fontSize: 10, color: COLORS.textFaint, marginTop: 4, fontFamily: "'DM Mono', monospace", display: "flex", gap: 8 }}>
            <span>{item.id}</span>
            {tab === "drafts" && (
              <span style={{ color: item.isBalanced ? COLORS.teal : COLORS.amber }}>
                {item.isBalanced ? t("list.balanced") : t("list.unbalanced")}
              </span>
            )}
            {tab === "recent" && <Lock size={9} style={{ verticalAlign: "middle" }} />}
            {tab === "scheduled" && <span>{fmtDate(item.scheduledFor)}</span>}
            {tab === "templates" && <span>{t("list.lines_used", { count: item.lines.length, used: item.usageCount })}</span>}
          </div>
        </div>
        {isJE && total > 0 && (
          <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: COLORS.text, fontWeight: 600, flexShrink: 0 }}>
            {fmtKWD(total)}
          </div>
        )}
        {tab === "templates" && (
          <TemplateKebab templateId={item.id} onRefresh={onRefresh} />
        )}
      </div>
    </button>
  );
}

function ManualJEComposer({ je, onDelete, onPost, onReverse, onSchedule, onPostNow, onSaveTemplate, onAskAminah, isNew }) {
  const { t } = useTranslation("manual-je");
  const { t: tc } = useTranslation("common");

  // ─── Wave 3: local draft state ───────────────────────────────────
  //
  // The composer holds the FULL draft in local React state. All keystroke
  // edits operate on this local object without any network round-trip.
  // On Save the parent handler either POSTs a new entry or PATCHes +
  // /validate promotes an existing draft. Nothing in this function
  // calls mockEngine.updateManualJEDraft / addLineToManualJE / etc. —
  // those are removed from Wave 3's write path entirely.
  //
  // `je` is the initial snapshot: either a blank locally-minted draft
  // (from handleNewBlank) or a server-fetched draft (from
  // getJournalEntry). We lift it into `draft` and resync whenever the
  // parent swaps the active JE (selected.id change → je.id change).
  const [draft, setDraft] = useState(() => normaliseInitialJE(je));
  useEffect(() => {
    setDraft(normaliseInitialJE(je));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [je?.id]);

  const isPosted = draft.status === "posted";
  const isScheduled = draft.status === "scheduled";
  const isDraft = draft.status === "draft" || isNew;
  const readOnly = isPosted || isScheduled;

  const [reverseModalOpen, setReverseModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [tplModalOpen, setTplModalOpen] = useState(false);
  const [periodStatus, setPeriodStatus] = useState(null);
  const [jeAttachments, setJeAttachments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Check period status whenever the draft date changes. Still served
  // by mockEngine in Wave 3 (no backend endpoint yet).
  useEffect(() => {
    if (!draft.date) { setPeriodStatus(null); return; }
    checkPeriodStatus(draft.date).then(setPeriodStatus).catch(() => setPeriodStatus(null));
  }, [draft.date]);

  // Attachments are still mock-only in Wave 3 — they require a backend
  // endpoint that doesn't exist yet. We only attempt to load them when
  // the JE has a server-side id (i.e. NOT a new locally-minted draft).
  useEffect(() => {
    if (isNew || !draft.id) { setJeAttachments([]); return; }
    getJEAttachments(draft.id).then(setJeAttachments).catch(() => setJeAttachments([]));
  }, [draft.id, isNew]);

  const isHardClosed = periodStatus?.status === "hard-closed";
  const isSoftClosed = periodStatus?.status === "soft-closed";

  const handleAttach = async (file) => {
    if (isNew || !draft.id) return;
    const att = await attachJEFile(draft.id, file);
    setJeAttachments((prev) => [...prev, att]);
  };
  const handleRemoveAtt = async (id) => {
    if (isNew || !draft.id) return;
    await removeJEAttachment(draft.id, id);
    setJeAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // ─── Local-state mutators (no network) ───────────────────────────
  const updateField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateLine = (lineId, changes) => {
    setDraft((prev) => {
      const lines = prev.lines.map((l) => {
        if (l.id !== lineId) return l;
        const next = { ...l, ...changes };
        // Mutual-exclusion: positive debit clears credit and vice versa.
        if (changes.debit && changes.debit > 0) next.credit = 0;
        if (changes.credit && changes.credit > 0) next.debit = 0;
        return next;
      });
      return { ...prev, lines };
    });
  };

  const addLine = () => {
    setDraft((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          id: `L${prev.lines.length + 1}-${Math.random().toString(36).slice(2, 5)}`,
          accountCode: "",
          accountName: "",
          debit: 0,
          credit: 0,
          memo: "",
        },
      ],
    }));
  };

  const removeLine = (lineId) => {
    setDraft((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.id !== lineId) }));
  };

  // ─── Client-side validation ─────────────────────────────────────
  const validation = (() => {
    const td = draft.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCr = draft.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    const errors = [];
    if (draft.lines.length < 2) {
      errors.push(tc("validation.min_lines"));
    }
    draft.lines.forEach((l, i) => {
      if (!l.accountCode && (Number(l.debit) || Number(l.credit))) {
        errors.push(t("lines.line_account_not_selected", { n: i + 1 }));
      }
      if (Number(l.debit) > 0 && Number(l.credit) > 0) {
        errors.push(t("lines.line_both", { n: i + 1 }));
      }
    });
    const balanceCheck = mustBalance(td, totalCr);
    if (balanceCheck && td > 0) {
      errors.push(tc(balanceCheck.key));
    }
    return {
      totalDebits: td,
      totalCredits: totalCr,
      difference: Number((td - totalCr).toFixed(3)),
      isBalanced: Math.abs(td - totalCr) < 0.0001 && td > 0 && draft.lines.length >= 2,
      errors,
    };
  })();

  const canPost = validation.isBalanced && !isHardClosed;
  const postLabel = isSoftClosed ? t("period_lock.post_for_approval") : t("composer.post_entry");

  // ─── Save / post wrapper (atomic) ────────────────────────────────
  const handleSave = async ({ post }) => {
    if (saving) return;
    setSaveError(null);
    setSaving(true);
    try {
      // Parent owns the actual create/update/post endpoint selection —
      // it knows whether this is a new locally-minted draft or an
      // existing server-fetched one.
      await onPost({ draft, post });
    } catch (err) {
      setSaveError(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const statusColor = isPosted ? COLORS.teal : isScheduled ? COLORS.blue : COLORS.amber;
  const statusLabel = isPosted ? t("status.posted") : isScheduled ? t("status.scheduled") : t("status.draft");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px 14px", borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: COLORS.text, letterSpacing: "-0.3px", lineHeight: 1 }}>
                {readOnly ? <LtrText>{draft.id}</LtrText> : isDraft ? (isNew ? t("composer.manual_je") : t("composer.edit_draft")) : t("composer.manual_je")}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: statusColor,
                background: `${statusColor}1A`, border: `1px solid ${statusColor}40`,
                padding: "4px 8px", borderRadius: 4,
              }}>
                {statusLabel}
              </span>
              {draft.reversedBy && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: COLORS.amber,
                  background: `${COLORS.amber}1A`, border: `1px solid ${COLORS.amber}40`,
                  padding: "4px 8px", borderRadius: 4,
                }}>
                  {t("composer.reversed_by", { id: draft.reversedBy })}
                </span>
              )}
              {draft.reversalOf && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: COLORS.blue,
                  background: `${COLORS.blue}1A`, border: `1px solid ${COLORS.blue}40`,
                  padding: "4px 8px", borderRadius: 4,
                }}>
                  {t("composer.reversal_of", { id: draft.reversalOf })}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 6, fontFamily: "'DM Mono', monospace" }}>
              <LtrText>{isNew ? "NEW" : draft.id}</LtrText> · {(draft.source || "manual").toUpperCase()}
              {draft.templateId && <> · {t("composer.from_template", { id: draft.templateId })}</>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {onAskAminah && (
              <button
                onClick={() => onAskAminah({ source: "manual-je", jeId: draft.id })}
                style={{ background: "transparent", color: COLORS.textDim, border: `1px solid ${COLORS.border}`, padding: "7px 12px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Sparkles size={11} /> {t("composer.ask_aminah")}
              </button>
            )}
            {isDraft && (
              <>
                <button onClick={onDelete} disabled={saving}
                  style={{ background: "transparent", color: COLORS.textDim, border: `1px solid ${COLORS.border}`, padding: "7px 12px", borderRadius: 5, fontSize: 11, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                  {t("composer.discard")}
                </button>
                <button onClick={() => handleSave({ post: false })} disabled={saving}
                  style={{ background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}`, padding: "7px 12px", borderRadius: 5, fontSize: 11, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Save size={11} /> {saving ? t("composer.saving") : t("composer.save_draft")}
                </button>
                <button
                  onClick={() => handleSave({ post: true })}
                  disabled={!canPost || saving}
                  title={isHardClosed ? t("period_lock.post_blocked") : undefined}
                  style={{ background: canPost && !saving ? COLORS.teal : "var(--border-subtle)", color: canPost && !saving ? "#fff" : COLORS.textFaint, border: "none", padding: "8px 16px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: canPost && !saving ? "pointer" : "not-allowed", fontFamily: "inherit" }}
                >
                  {saving ? t("composer.posting") : postLabel}
                </button>
              </>
            )}
            {isPosted && !draft.reversedBy && (
              <>
                <button onClick={() => setReverseModalOpen(true)}
                  style={{ background: "transparent", color: COLORS.amber, border: `1px solid ${COLORS.amber}40`, padding: "7px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <RotateCcw size={11} /> {t("composer.reverse_entry")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Period lock banner */}
      {isHardClosed && (
        <div style={{ margin: "12px 24px 0", padding: "12px 16px", background: "var(--semantic-danger-subtle)", border: "1px solid rgba(255,90,95,0.30)", borderRadius: 8, color: "var(--semantic-danger)", fontSize: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{t("period_lock.hard_closed_title")}</div>
            <div style={{ fontWeight: 500 }}>{t("period_lock.hard_closed_body")}</div>
          </div>
        </div>
      )}
      {isSoftClosed && (
        <div style={{ margin: "12px 24px 0", padding: "12px 16px", background: "var(--semantic-warning-subtle)", border: "1px solid rgba(212,168,75,0.30)", borderRadius: 8, color: "var(--semantic-warning)", fontSize: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{t("period_lock.soft_closed_title")}</div>
            <div style={{ fontWeight: 500 }}>{t("period_lock.soft_closed_body")}</div>
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
        {/* Metadata */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
          <Field label={t("fields.date")}>
            <input type="date" disabled={readOnly}
              value={draft.date ? draft.date.slice(0, 10) : ""}
              onChange={(e) => updateField("date", e.target.value ? new Date(e.target.value).toISOString() : "")}
              style={inputStyle(readOnly)} />
          </Field>
          <Field label={t("fields.reference")}>
            <input type="text" disabled={readOnly}
              value={draft.reference || ""}
              onChange={(e) => updateField("reference", e.target.value)}
              style={inputStyle(readOnly)} />
          </Field>
          <Field label={t("fields.description")}>
            <input type="text" disabled={readOnly}
              value={draft.description || ""}
              onChange={(e) => updateField("description", e.target.value)}
              style={inputStyle(readOnly)} />
          </Field>
          <Field label={t("fields.source")}>
            <select disabled={readOnly} value={draft.source || "manual"}
              onChange={(e) => updateField("source", e.target.value)}
              style={inputStyle(readOnly)}>
              <option value="manual">{t("source_options.manual")}</option>
              <option value="adjustment">{t("source_options.adjustment")}</option>
              <option value="reversal">{t("source_options.reversal")}</option>
              <option value="recurring">{t("source_options.recurring")}</option>
            </select>
          </Field>
        </div>
        {saveError && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--semantic-danger-subtle)", border: `1px solid ${COLORS.red}40`, borderRadius: 6, fontSize: 12, color: COLORS.red }}>
            {saveError}
          </div>
        )}

        {/* Lines */}
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 130px 1fr 32px", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${COLORS.border}`, fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: COLORS.textFaint }}>
            <div>{t("lines.col_account")}</div>
            <div style={{ textAlign: "end" }}>{t("lines.col_debit")}</div>
            <div style={{ textAlign: "end" }}>{t("lines.col_credit")}</div>
            <div>{t("lines.col_memo")}</div>
            <div></div>
          </div>
          {draft.lines.map((line, idx) => (
            <LineRow
              key={line.id}
              line={line}
              idx={idx}
              readOnly={readOnly}
              onUpdate={(changes) => updateLine(line.id, changes)}
              onRemove={() => removeLine(line.id)}
              canRemove={draft.lines.length > 2}
            />
          ))}
          {!readOnly && (
            <div style={{ padding: "10px 14px", borderTop: `1px solid ${COLORS.border}` }}>
              <button onClick={addLine}
                style={{ background: "transparent", color: COLORS.teal, border: `1px dashed ${COLORS.teal}40`, padding: "7px 14px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Plus size={11} /> {t("lines.add_line")}
              </button>
            </div>
          )}
        </div>

        {/* Validation errors */}
        {validation.errors.length > 0 && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(245,165,36,0.06)", border: `1px solid ${COLORS.amber}40`, borderRadius: 6, fontSize: 11, color: COLORS.amber }}>
            {validation.errors.map((e, i) => (
              <div key={i}>• {e}</div>
            ))}
          </div>
        )}

        {/* Supporting documents */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: COLORS.textFaint, marginBottom: 8 }}>
            {t("je_attachments.section_title")} {jeAttachments.length > 0 && t("je_attachments.count_label", { count: jeAttachments.length })}
          </div>
          <FileAttachment
            attachments={jeAttachments}
            onAttach={handleAttach}
            onRemove={handleRemoveAtt}
            readOnly={readOnly}
            readonly={readOnly}
            maxSize={10 * 1024 * 1024}
            currentUserId="cfo"
          />
          {readOnly && (
            <div style={{ fontSize: 10, color: COLORS.textFaint, marginTop: 6, fontStyle: "italic" }}>
              {t("je_attachments.readonly_note")}
            </div>
          )}
        </div>
      </div>

      {/* Sticky totals bar */}
      <div style={{ borderTop: `1px solid ${COLORS.border}`, background: "var(--bg-surface-raised)", padding: "14px 24px", flexShrink: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 18, alignItems: "center" }}>
          <TotalCell label={t("totals.total_debits")} value={fmtKWD(validation.totalDebits)} />
          <TotalCell label={t("totals.total_credits")} value={fmtKWD(validation.totalCredits)} />
          <TotalCell label={t("totals.difference")} value={fmtKWD(Math.abs(validation.difference))} color={validation.difference === 0 ? COLORS.teal : COLORS.red} />
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
            color: validation.isBalanced ? COLORS.teal : COLORS.red,
            background: validation.isBalanced ? "var(--accent-primary-subtle)" : "var(--semantic-danger-subtle)",
            border: `1px solid ${(validation.isBalanced ? COLORS.teal : COLORS.red)}40`,
            padding: "8px 14px", borderRadius: 5,
          }}>
            {validation.isBalanced ? t("totals.balanced") : t("totals.out_of_balance")}
          </div>
        </div>
      </div>

      {/* Modals */}
      {reverseModalOpen && (
        <ReverseModal je={draft} onCancel={() => setReverseModalOpen(false)} onConfirm={(reason) => { setReverseModalOpen(false); onReverse(reason); }} />
      )}
      {scheduleModalOpen && (
        <ScheduleModal onCancel={() => setScheduleModalOpen(false)} onConfirm={(date, recurring) => { setScheduleModalOpen(false); onSchedule(date, recurring); }} />
      )}
      {tplModalOpen && (
        <SaveTemplateModal onCancel={() => setTplModalOpen(false)} onConfirm={(name, desc) => { setTplModalOpen(false); onSaveTemplate(name, desc); }} />
      )}
    </div>
  );
}

function inputStyle(disabled) {
  return {
    width: "100%", background: disabled ? "var(--bg-surface)" : "var(--bg-surface-sunken)",
    border: `1px solid ${COLORS.border}`, borderRadius: 5, padding: "8px 10px",
    color: disabled ? COLORS.textDim : COLORS.text, fontSize: 12, fontFamily: "inherit", outline: "none",
  };
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: COLORS.textFaint, marginBottom: 5 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function TotalCell({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: COLORS.textFaint, marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: color || COLORS.text, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function LineRow({ line, idx, readOnly, onUpdate, onRemove, canRemove }) {
  const { t } = useTranslation("manual-je");
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 130px 130px 1fr 32px", gap: 8,
      padding: "10px 14px", alignItems: "center",
      background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
      borderBottom: `1px solid var(--border-subtle)`,
    }}>
      <CompactAccountPicker
        value={line.accountCode ? { code: line.accountCode, name: line.accountName } : null}
        readOnly={readOnly}
        onSelect={(acc) => onUpdate({ accountCode: acc.code, accountName: acc.name })}
        onClear={() => onUpdate({ accountCode: "", accountName: "" })}
      />
      <input
        type="number" step="0.001" disabled={readOnly}
        value={line.debit || ""} placeholder="0.000"
        onChange={(e) => onUpdate({ debit: Number(e.target.value || 0), credit: 0 })}
        style={{ ...inputStyle(readOnly), textAlign: "end", fontFamily: "'DM Mono', monospace" }}
      />
      <input
        type="number" step="0.001" disabled={readOnly}
        value={line.credit || ""} placeholder="0.000"
        onChange={(e) => onUpdate({ credit: Number(e.target.value || 0), debit: 0 })}
        style={{ ...inputStyle(readOnly), textAlign: "end", fontFamily: "'DM Mono', monospace" }}
      />
      <input
        type="text" disabled={readOnly}
        defaultValue={line.memo} placeholder={t("lines.memo_placeholder")}
        onBlur={(e) => onUpdate({ memo: e.target.value })}
        style={inputStyle(readOnly)}
      />
      {!readOnly && canRemove ? (
        <button type="button" onClick={onRemove} aria-label="Remove line"
          style={{ background: "transparent", border: "none", color: COLORS.textFaint, cursor: "pointer", padding: 4 }}>
          <Trash2 size={13} />
        </button>
      ) : <div />}
    </div>
  );
}

// Compact account picker
function CompactAccountPicker({ value, readOnly, onSelect, onClear }) {
  const { t } = useTranslation("manual-je");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    searchChartOfAccounts("", { activeOnly: true }).then(setAccounts);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  const filtered = accounts
    .filter((a) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return a.code.includes(query) || a.name.toLowerCase().includes(q) || (a.subtype || "").toLowerCase().includes(q) || (a.type || "").toLowerCase().includes(q);
    })
    .slice(0, 12);

  if (value && !open) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "var(--bg-selected)", border: `1px solid rgba(0,196,140,0.30)`,
        borderRadius: 5, padding: "7px 10px", fontSize: 12, color: COLORS.text,
      }}>
        <span style={{ fontFamily: "'DM Mono', monospace", color: COLORS.textDim }}>{value.code}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>· {value.name}</span>
        {!readOnly && (
          <button type="button" onClick={onClear} aria-label="Clear" style={{ background: "transparent", border: "none", color: COLORS.textFaint, cursor: "pointer", padding: 0, display: "flex" }}>
            <X size={12} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        type="text" disabled={readOnly}
        value={query} placeholder={t("account_picker.search_placeholder")}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          if (e.key === "Enter" && filtered[highlight]) { onSelect(filtered[highlight]); setOpen(false); setQuery(""); }
          if (e.key === "Escape") { setOpen(false); }
        }}
        style={inputStyle(readOnly)}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
          background: "var(--bg-surface-raised)", border: `1px solid ${COLORS.border}`, borderRadius: 6,
          boxShadow: "var(--panel-shadow)", zIndex: 100, maxHeight: 280, overflowY: "auto",
        }}>
          {filtered.map((a, i) => (
            <div
              key={a.code}
              onMouseDown={() => { onSelect(a); setOpen(false); setQuery(""); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                background: i === highlight ? "var(--accent-primary-subtle)" : "transparent",
                borderBottom: `1px solid var(--border-subtle)`,
              }}
            >
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: COLORS.textFaint, minWidth: 40 }}>{a.code}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                {(a.type || a.subtype) && <div style={{ fontSize: 9, color: COLORS.textFaint, marginTop: 1 }}>{a.type}{a.subtype ? ` · ${a.subtype}` : ""}</div>}
              </div>
              {a.balance != null && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: COLORS.textDim }}>{Number(a.balance).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>}
              {!a.balance && a.category && <span style={{ fontSize: 9, color: COLORS.textFaint }}>{(a.category || "").split(" ")[0]}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateDetail({ template, onUse }) {
  const { t } = useTranslation("manual-je");
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ maxWidth: 720, margin: "0 auto", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "24px 28px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: COLORS.textFaint }}>{t("template_detail.template_label")}</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: COLORS.text, marginTop: 4, marginBottom: 8 }}>
          {template.name.toUpperCase()}
        </div>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 16, lineHeight: 1.55 }}>
          {template.description}
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: COLORS.textFaint, marginBottom: 8 }}>
          {t("template_detail.lines", { count: template.lines.length })}
        </div>
        <div style={{ background: "var(--bg-surface)", border: `1px solid ${COLORS.border}`, borderRadius: 6, marginBottom: 18 }}>
          {template.lines.map((l, i) => (
            <div key={l.id} style={{
              display: "flex", justifyContent: "space-between", padding: "10px 14px",
              borderBottom: i < template.lines.length - 1 ? `1px solid var(--border-subtle)` : "none",
              alignItems: "center",
            }}>
              <div>
                <span style={{ fontFamily: "'DM Mono', monospace", color: COLORS.textFaint, fontSize: 11 }}>{l.accountCode}</span>
                <span style={{ color: COLORS.text, fontSize: 12, marginInlineStart: 8 }}>{l.accountName}</span>
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", color: COLORS.textFaint, fontSize: 12 }}>—</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18, fontSize: 11, color: COLORS.textDim }}>
          <span dangerouslySetInnerHTML={{ __html: t("template_detail.used_times", { count: template.usageCount }).replace(/<strong>/g, `<strong style="color: ${COLORS.text}">`) }} />
          <span>·</span>
          <span>{t("template_detail.created", { time: fmtRelative(template.createdAt) })}</span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onUse}
            style={{ background: COLORS.teal, color: "#fff", border: "none", padding: "10px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {t("template_detail.use_template")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modals
function ModalShell({ title, sub, onCancel, children, footer }) {
  useEscapeKey(onCancel);
  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 480, maxWidth: "calc(100vw - 32px)", background: "var(--bg-surface-raised)",
        border: `1px solid ${COLORS.border}`, borderRadius: 12, zIndex: 301,
        boxShadow: "var(--shadow-xl)",
      }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: COLORS.textFaint }}>{sub}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: COLORS.text, marginTop: 4 }}>{title}</div>
          </div>
          <button onClick={onCancel} style={{ background: "transparent", border: "none", color: COLORS.textFaint, cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px" }}>{children}</div>
        <div style={{ padding: "14px 22px", borderTop: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {footer}
        </div>
      </div>
    </>
  );
}

function ReverseModal({ je, onCancel, onConfirm }) {
  const { t } = useTranslation("manual-je");
  const [reason, setReason] = useState("");
  return (
    <ModalShell
      title={t("reverse_modal.title")} sub={t("reverse_modal.sub")} onCancel={onCancel}
      footer={
        <>
          <button onClick={onCancel} style={{ background: "transparent", color: COLORS.textDim, border: `1px solid ${COLORS.border}`, padding: "9px 16px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{t("reverse_modal.cancel")}</button>
          <button onClick={() => onConfirm(reason)} disabled={!reason.trim()}
            style={{ background: reason.trim() ? COLORS.amber : "var(--border-subtle)", color: reason.trim() ? "#fff" : COLORS.textFaint, border: "none", padding: "9px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: reason.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {t("reverse_modal.confirm")}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.55, marginBottom: 14 }}
        dangerouslySetInnerHTML={{ __html: t("reverse_modal.body", { ref: je.reference }).replace(/<strong>/g, `<strong style="color: ${COLORS.amber}">`) }}
      />
      <div style={{ background: "var(--bg-surface)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 10, marginBottom: 14 }}>
        {je.lines.map((l) => (
          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0" }}>
            <span style={{ color: COLORS.textDim }}>{l.accountCode} {l.accountName}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", color: COLORS.text }}>
              {l.debit > 0 ? `DR ${fmtKWD(l.debit)}` : `CR ${fmtKWD(l.credit)}`}
            </span>
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: COLORS.textFaint, marginBottom: 5 }}>
          {t("reverse_modal.reason_label")}
        </div>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
          placeholder={t("reverse_modal.reason_placeholder")}
          style={{ width: "100%", background: "var(--bg-surface-sunken)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "9px 12px", color: COLORS.text, fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
      </div>
    </ModalShell>
  );
}

function ScheduleModal({ onCancel, onConfirm }) {
  const { t } = useTranslation("manual-je");
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  const [date, setDate] = useState(next.toISOString().slice(0, 10));
  const [freq, setFreq] = useState("none");
  return (
    <ModalShell
      title={t("schedule_modal.title")} sub={t("schedule_modal.sub")} onCancel={onCancel}
      footer={
        <>
          <button onClick={onCancel} style={{ background: "transparent", color: COLORS.textDim, border: `1px solid ${COLORS.border}`, padding: "9px 16px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{t("schedule_modal.cancel")}</button>
          <button onClick={() => onConfirm(new Date(date).toISOString(), freq === "none" ? null : { frequency: freq, nextRun: new Date(date).toISOString() })}
            style={{ background: COLORS.teal, color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {t("schedule_modal.confirm")}
          </button>
        </>
      }
    >
      <Field label={t("schedule_modal.post_on")}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle(false)} />
      </Field>
      <div style={{ height: 12 }} />
      <Field label={t("schedule_modal.frequency")}>
        <select value={freq} onChange={(e) => setFreq(e.target.value)} style={inputStyle(false)}>
          <option value="none">{t("schedule_modal.freq_none")}</option>
          <option value="monthly">{t("schedule_modal.freq_monthly")}</option>
          <option value="quarterly">{t("schedule_modal.freq_quarterly")}</option>
          <option value="annually">{t("schedule_modal.freq_annually")}</option>
        </select>
      </Field>
    </ModalShell>
  );
}

function SaveTemplateModal({ onCancel, onConfirm }) {
  const { t } = useTranslation("manual-je");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <ModalShell
      title={t("save_template_modal.title")} sub={t("save_template_modal.sub")} onCancel={onCancel}
      footer={
        <>
          <button onClick={onCancel} style={{ background: "transparent", color: COLORS.textDim, border: `1px solid ${COLORS.border}`, padding: "9px 16px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{t("save_template_modal.cancel")}</button>
          <button onClick={() => onConfirm(name, desc)} disabled={!name.trim()}
            style={{ background: name.trim() ? COLORS.teal : "var(--border-subtle)", color: name.trim() ? "#fff" : COLORS.textFaint, border: "none", padding: "9px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: name.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {t("save_template_modal.confirm")}
          </button>
        </>
      }
    >
      <Field label={t("save_template_modal.name_label")}>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("save_template_modal.name_placeholder")} style={inputStyle(false)} />
      </Field>
      <div style={{ height: 12 }} />
      <Field label={t("save_template_modal.desc_label")}>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder={t("save_template_modal.desc_placeholder")}
          style={{ ...inputStyle(false), resize: "vertical" }} />
      </Field>
    </ModalShell>
  );
}

function TemplateKebab({ templateId, onRefresh }) {
  const { t } = useTranslation("manual-je");
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const handleDuplicate = async (e) => {
    e.stopPropagation();
    // No dedicated duplicate function — use useJETemplate to create a copy
    await useJETemplate(templateId);
    setOpen(false);
    onRefresh && onRefresh();
  };
  const handleDelete = async (e) => {
    e.stopPropagation();
    await deleteJETemplateRecord(templateId);
    setConfirmDelete(false);
    setOpen(false);
    onRefresh && onRefresh();
  };
  const handleShare = (e) => {
    e.stopPropagation();
    shareJETemplate(templateId, true);
    setOpen(false);
  };
  return (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen(!open)} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
        <MoreVertical size={14} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
          <div style={{ position: "absolute", top: "100%", insetInlineEnd: 0, marginTop: 4, width: 160, background: "var(--bg-surface-raised)", border: "1px solid var(--border-default)", borderRadius: 8, boxShadow: "var(--panel-shadow)", zIndex: 201, padding: "4px 0" }}>
            <KebabItem label={t("templates.kebab.duplicate")} onClick={handleDuplicate} />
            <KebabItem label={t("templates.kebab.share")} onClick={handleShare} />
            <KebabItem label={t("templates.kebab.delete")} onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); setOpen(false); }} danger />
          </div>
        </>
      )}
      {confirmDelete && (
        <>
          <div onClick={() => setConfirmDelete(false)} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", zIndex: 300 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 360, background: "var(--bg-surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "var(--shadow-xl)", padding: "20px 22px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>{t("templates.delete.confirm_title")}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>{t("templates.delete.confirm_body")}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(false)} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("save_template_modal.cancel")}</button>
              <button onClick={handleDelete} style={{ background: "var(--semantic-danger)", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{t("templates.kebab.delete")}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KebabItem({ label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ display: "block", width: "100%", padding: "7px 14px", background: "transparent", border: "none", color: danger ? "var(--semantic-danger)" : "var(--text-primary)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "start" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = danger ? "rgba(239,68,68,0.06)" : "var(--border-subtle)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
      {label}
    </button>
  );
}
