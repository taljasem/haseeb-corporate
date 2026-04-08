import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Search, Lock, X, FileText, Clock, CheckCircle2, AlertCircle, RotateCcw, Save, Calendar, Sparkles } from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import {
  getManualJEs,
  getManualJEById,
  getManualJETemplates,
  createManualJEDraft,
  updateManualJEDraft,
  addLineToManualJE,
  updateLineInManualJE,
  removeLineFromManualJE,
  postManualJE,
  discardManualJEDraft,
  createFromTemplate,
  saveAsTemplate,
  reverseManualJE,
  scheduleManualJE,
  postScheduledNow,
  getChartOfAccounts,
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

function fmtKWD(n) {
  if (n == null || n === 0) return "0.000";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function fmtRelative(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TABS = [
  { id: "drafts",   key: "drafts" },
  { id: "recent",   key: "recent" },
  { id: "templates",key: "templates" },
  { id: "scheduled",key: "scheduled" },
];

export default function ManualJEScreen({ onOpenAminah }) {
  const { t } = useTranslation("manual-je");
  const [activeTab, setActiveTab] = useState("drafts");
  const [drafts, setDrafts] = useState([]);
  const [recent, setRecent] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [selected, setSelected] = useState(null); // { kind: "je"|"template", id }
  const [activeJE, setActiveJE] = useState(null);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    Promise.all([
      getManualJEs("drafts"),
      getManualJEs("recent-posted"),
      getManualJETemplates(),
      getManualJEs("scheduled"),
    ]).then(([d, r, t, s]) => {
      setDrafts(d);
      setRecent(r);
      setTemplates(t);
      setScheduled(s);
    });
  }, [tick]);

  useEffect(() => {
    if (selected?.kind === "je") {
      getManualJEById(selected.id).then(setActiveJE);
      setActiveTemplate(null);
    } else if (selected?.kind === "template") {
      const t = templates.find((x) => x.id === selected.id);
      setActiveTemplate(t);
      setActiveJE(null);
    } else {
      setActiveJE(null);
      setActiveTemplate(null);
    }
  }, [selected, tick, templates]);

  const handleNewBlank = async () => {
    const j = await createManualJEDraft({});
    setActiveTab("drafts");
    setSelected({ kind: "je", id: j.id });
    refresh();
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
            <div style={{ padding: 24, textAlign: "center", color: COLORS.textFaint, fontSize: 12 }}>
              {t("empty_list", { tab: t(`tab_names.${activeTab}`) })}
            </div>
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

        {selected?.kind === "je" && activeJE && (
          <ManualJEComposer
            je={activeJE}
            onChange={refresh}
            onDelete={async () => { await discardManualJEDraft(activeJE.id); setSelected(null); refresh(); showToast(t("toast.draft_discarded")); }}
            onPost={async () => {
              const r = await postManualJE(activeJE.id, "cfo");
              if (r?.error) { showToast(t("toast.cannot_post", { reason: r.error })); return; }
              showToast(t("toast.posted", { id: r.id }));
              setActiveTab("recent");
              setSelected({ kind: "je", id: r.id });
              refresh();
            }}
            onReverse={async (reason) => {
              const rev = await reverseManualJE(activeJE.id, reason);
              setActiveTab("drafts");
              setSelected({ kind: "je", id: rev.id });
              refresh();
              showToast(t("toast.reversal_created"));
            }}
            onSchedule={async (date, recurring) => {
              await scheduleManualJE(activeJE.id, date, recurring);
              setActiveTab("scheduled");
              refresh();
              showToast(t("toast.scheduled", { date: fmtDate(date) }));
            }}
            onPostNow={async () => {
              const r = await postScheduledNow(activeJE.id, "cfo");
              setActiveTab("recent");
              setSelected({ kind: "je", id: r.id });
              refresh();
              showToast(t("toast.posted", { id: r.id }));
            }}
            onSaveTemplate={async (name, desc) => {
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

function ListItem({ item, tab, selected, onClick }) {
  const { t } = useTranslation("manual-je");
  const isJE = tab !== "templates";
  const total = isJE ? Math.max(item.totalDebits || 0, item.totalCredits || 0) : 0;
  return (
    <button
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "start", padding: "12px 16px",
        background: selected ? "var(--bg-selected)" : "transparent",
        border: "none", borderBottom: `1px solid rgba(255,255,255,0.04)`,
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
      </div>
    </button>
  );
}

function ManualJEComposer({ je, onChange, onDelete, onPost, onReverse, onSchedule, onPostNow, onSaveTemplate, onAskAminah }) {
  const { t } = useTranslation("manual-je");
  const isPosted = je.status === "posted";
  const isScheduled = je.status === "scheduled";
  const isDraft = je.status === "draft";
  const readOnly = isPosted || isScheduled;

  const [reverseModalOpen, setReverseModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [tplModalOpen, setTplModalOpen] = useState(false);

  const validation = (() => {
    const td = je.lines.reduce((s, l) => s + (l.debit || 0), 0);
    const tc = je.lines.reduce((s, l) => s + (l.credit || 0), 0);
    const errors = [];
    je.lines.forEach((l, i) => {
      if (!l.accountCode && (l.debit || l.credit)) errors.push(t("lines.line_account_not_selected", { n: i + 1 }));
      if (l.debit > 0 && l.credit > 0) errors.push(t("lines.line_both", { n: i + 1 }));
    });
    return { totalDebits: td, totalCredits: tc, difference: Number((td - tc).toFixed(3)), isBalanced: Math.abs(td - tc) < 0.0001 && td > 0, errors };
  })();

  const updateField = async (field, value) => {
    await updateManualJEDraft(je.id, { [field]: value });
    onChange();
  };

  const updateLine = async (lineId, changes) => {
    await updateLineInManualJE(je.id, lineId, changes);
    onChange();
  };

  const addLine = async () => {
    await addLineToManualJE(je.id);
    onChange();
  };

  const removeLine = async (lineId) => {
    await removeLineFromManualJE(je.id, lineId);
    onChange();
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
                {readOnly ? <LtrText>{je.id}</LtrText> : isDraft ? t("composer.edit_draft") : t("composer.manual_je")}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: statusColor,
                background: `${statusColor}1A`, border: `1px solid ${statusColor}40`,
                padding: "4px 8px", borderRadius: 4,
              }}>
                {statusLabel}
              </span>
              {je.reversedBy && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: COLORS.amber,
                  background: `${COLORS.amber}1A`, border: `1px solid ${COLORS.amber}40`,
                  padding: "4px 8px", borderRadius: 4,
                }}>
                  {t("composer.reversed_by", { id: je.reversedBy })}
                </span>
              )}
              {je.reversalOf && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: COLORS.blue,
                  background: `${COLORS.blue}1A`, border: `1px solid ${COLORS.blue}40`,
                  padding: "4px 8px", borderRadius: 4,
                }}>
                  {t("composer.reversal_of", { id: je.reversalOf })}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 6, fontFamily: "'DM Mono', monospace" }}>
              <LtrText>{je.id}</LtrText> · {je.source.toUpperCase()}
              {je.templateId && <> · {t("composer.from_template", { id: je.templateId })}</>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {onAskAminah && (
              <button
                onClick={() => onAskAminah({ source: "manual-je", jeId: je.id })}
                style={{ background: "transparent", color: COLORS.textDim, border: `1px solid ${COLORS.border}`, padding: "7px 12px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Sparkles size={11} /> {t("composer.ask_aminah")}
              </button>
            )}
            {isDraft && (
              <>
                <button onClick={onDelete}
                  style={{ background: "transparent", color: COLORS.textDim, border: `1px solid ${COLORS.border}`, padding: "7px 12px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                  {t("composer.discard")}
                </button>
                <button onClick={() => setScheduleModalOpen(true)} disabled={!validation.isBalanced}
                  style={{ background: "transparent", color: validation.isBalanced ? COLORS.text : COLORS.textFaint, border: `1px solid ${COLORS.border}`, padding: "7px 12px", borderRadius: 5, fontSize: 11, cursor: validation.isBalanced ? "pointer" : "not-allowed", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Calendar size={11} /> {t("composer.schedule")}
                </button>
                <button onClick={() => setTplModalOpen(true)} disabled={!validation.isBalanced}
                  style={{ background: "transparent", color: validation.isBalanced ? COLORS.text : COLORS.textFaint, border: `1px solid ${COLORS.border}`, padding: "7px 12px", borderRadius: 5, fontSize: 11, cursor: validation.isBalanced ? "pointer" : "not-allowed", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Save size={11} /> {t("composer.save_as_template")}
                </button>
                <button onClick={onPost} disabled={!validation.isBalanced}
                  style={{ background: validation.isBalanced ? COLORS.teal : "rgba(255,255,255,0.05)", color: validation.isBalanced ? "#fff" : COLORS.textFaint, border: "none", padding: "8px 16px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: validation.isBalanced ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                  {t("composer.post_entry")}
                </button>
              </>
            )}
            {isPosted && !je.reversedBy && (
              <>
                <button onClick={() => setTplModalOpen(true)}
                  style={{ background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}`, padding: "7px 12px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Save size={11} /> {t("composer.save_as_template")}
                </button>
                <button onClick={() => setReverseModalOpen(true)}
                  style={{ background: "transparent", color: COLORS.amber, border: `1px solid ${COLORS.amber}40`, padding: "7px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <RotateCcw size={11} /> {t("composer.reverse_entry")}
                </button>
              </>
            )}
            {isScheduled && (
              <>
                <button onClick={onPostNow}
                  style={{ background: COLORS.teal, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {t("composer.post_now")}
                </button>
                <button onClick={async () => { await updateManualJEDraft(je.id, { status: "draft", scheduledFor: null, recurringRule: null }); onChange(); }}
                  style={{ background: "transparent", color: COLORS.red, border: `1px solid ${COLORS.red}40`, padding: "7px 12px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                  {t("composer.cancel_schedule")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
        {/* Metadata */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
          <Field label={t("fields.date")}>
            <input type="date" disabled={readOnly} defaultValue={je.date ? je.date.slice(0, 10) : ""}
              onBlur={(e) => updateField("date", new Date(e.target.value).toISOString())}
              style={inputStyle(readOnly)} />
          </Field>
          <Field label={t("fields.reference")}>
            <input type="text" disabled={readOnly} defaultValue={je.reference}
              onBlur={(e) => updateField("reference", e.target.value)}
              style={inputStyle(readOnly)} />
          </Field>
          <Field label={t("fields.description")}>
            <input type="text" disabled={readOnly} defaultValue={je.description}
              onBlur={(e) => updateField("description", e.target.value)}
              style={inputStyle(readOnly)} />
          </Field>
          <Field label={t("fields.source")}>
            <select disabled={readOnly} value={je.source}
              onChange={(e) => updateField("source", e.target.value)}
              style={inputStyle(readOnly)}>
              <option value="manual">{t("source_options.manual")}</option>
              <option value="adjustment">{t("source_options.adjustment")}</option>
              <option value="reversal">{t("source_options.reversal")}</option>
              <option value="recurring">{t("source_options.recurring")}</option>
            </select>
          </Field>
        </div>

        {/* Lines */}
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 130px 1fr 32px", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${COLORS.border}`, fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: COLORS.textFaint }}>
            <div>{t("lines.col_account")}</div>
            <div style={{ textAlign: "end" }}>{t("lines.col_debit")}</div>
            <div style={{ textAlign: "end" }}>{t("lines.col_credit")}</div>
            <div>{t("lines.col_memo")}</div>
            <div></div>
          </div>
          {je.lines.map((line, idx) => (
            <LineRow
              key={line.id}
              line={line}
              idx={idx}
              readOnly={readOnly}
              onUpdate={(changes) => updateLine(line.id, changes)}
              onRemove={() => removeLine(line.id)}
              canRemove={je.lines.length > 2}
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
        <ReverseModal je={je} onCancel={() => setReverseModalOpen(false)} onConfirm={(reason) => { setReverseModalOpen(false); onReverse(reason); }} />
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
      borderBottom: `1px solid rgba(255,255,255,0.04)`,
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
        <button onClick={onRemove}
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
    getChartOfAccounts().then(setAccounts);
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
      return a.code.includes(query) || a.name.toLowerCase().includes(q);
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
          <button onClick={onClear} style={{ background: "transparent", border: "none", color: COLORS.textFaint, cursor: "pointer", padding: 0, display: "flex" }}>
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
          boxShadow: "0 12px 32px rgba(0,0,0,0.6)", zIndex: 100, maxHeight: 280, overflowY: "auto",
        }}>
          {filtered.map((a, i) => (
            <div
              key={a.code}
              onMouseDown={() => { onSelect(a); setOpen(false); setQuery(""); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                background: i === highlight ? "var(--accent-primary-subtle)" : "transparent",
                borderBottom: `1px solid rgba(255,255,255,0.04)`,
              }}
            >
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: COLORS.textFaint }}>{a.code}</span>
              <span style={{ fontSize: 12, color: COLORS.text, flex: 1 }}>{a.name}</span>
              <span style={{ fontSize: 9, color: COLORS.textFaint }}>{a.category.split(" ")[0]}</span>
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
              borderBottom: i < template.lines.length - 1 ? `1px solid rgba(255,255,255,0.04)` : "none",
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
  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 480, maxWidth: "calc(100vw - 32px)", background: "var(--bg-surface-raised)",
        border: `1px solid ${COLORS.border}`, borderRadius: 12, zIndex: 301,
        boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
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
            style={{ background: reason.trim() ? COLORS.amber : "rgba(255,255,255,0.05)", color: reason.trim() ? "#fff" : COLORS.textFaint, border: "none", padding: "9px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: reason.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
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
            style={{ background: name.trim() ? COLORS.teal : "rgba(255,255,255,0.05)", color: name.trim() ? "#fff" : COLORS.textFaint, border: "none", padding: "9px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: name.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
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
