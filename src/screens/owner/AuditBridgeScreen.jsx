import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Shield, CheckCircle2, XCircle, Clock, Minus, ChevronLeft, ChevronDown, ChevronRight, Download, RefreshCw, Plus, Eye, MessageCircle, FileText, Sparkles, X } from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import ActionButton from "../../components/ds/ActionButton";
import PersistentBanner from "../../components/ds/PersistentBanner";
import {
  listAuditEngagements, getAuditEngagement, createAuditEngagement, createSnapshot,
  runAuditCheck, runAllAuditChecks, generateAuditPackage,
  listClarifications, addClarificationMessage, resolveClarification,
} from "../../engine/mockEngine";
import { formatDate } from "../../utils/format";

const STATUS_COLORS = {
  draft: "var(--text-tertiary)", snapshot_pending: "var(--semantic-warning)", active: "#3b82f6",
  clarification_pending: "var(--semantic-warning)", completed: "var(--accent-primary)", archived: "var(--text-tertiary)",
};
const CHECK_ICONS = { pass: CheckCircle2, fail: XCircle, pending: Clock, not_applicable: Minus };
const CHECK_COLORS = { pass: "var(--accent-primary)", fail: "var(--semantic-danger)", pending: "var(--semantic-warning)", not_applicable: "var(--text-tertiary)" };
const TRUST_LABELS = { A: "Class A · Deterministic", B: "Class B · Reconciliation-gated", C: "Class C · Kuwait Compliance" };

export default function AuditBridgeScreen({ onOpenAminah }) {
  const { t } = useTranslation("audit");
  const [view, setView] = useState("list");
  const [engagements, setEngagements] = useState(null);
  const [selectedEng, setSelectedEng] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [clarifications, setClarifications] = useState([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const loadList = useCallback(() => { listAuditEngagements().then(setEngagements); }, []);
  useEffect(() => { loadList(); }, [loadList]);

  const openEngagement = async (id) => {
    const eng = await getAuditEngagement(id);
    setSelectedEng(eng);
    setActiveTab("overview");
    setView("detail");
    const clars = await listClarifications(id);
    setClarifications(clars || []);
  };

  const handleCreateEngagement = async () => {
    await createAuditEngagement({ auditorFirm: "New Audit Firm", fiscalPeriod: "2026-Q1", engagementType: "quarterly_review" });
    loadList();
    showToast("Engagement created");
  };

  const handleCreateSnapshot = async () => {
    if (!selectedEng) return;
    const updated = await createSnapshot(selectedEng.id);
    setSelectedEng(updated);
    showToast("Snapshot frozen");
  };

  const handleRunAllChecks = async () => {
    if (!selectedEng) return;
    await runAllAuditChecks(selectedEng.id);
    const fresh = await getAuditEngagement(selectedEng.id);
    setSelectedEng(fresh);
    showToast("All checks completed");
  };

  const handleRunCheck = async (checkId) => {
    if (!selectedEng) return;
    await runAuditCheck(selectedEng.id, checkId);
    const fresh = await getAuditEngagement(selectedEng.id);
    setSelectedEng(fresh);
  };

  const handleExport = async () => {
    if (!selectedEng) return;
    const result = await generateAuditPackage(selectedEng.id);
    if (!result?.csvText) return;
    const blob = new Blob([result.csvText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = result.filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Audit package downloaded");
  };

  if (view === "detail" && selectedEng) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {previewMode && (
          <PersistentBanner open title={`Viewing as ${selectedEng.leadAuditor || "Auditor"}`} body="This is what the auditor sees — read-only mode" icon={Eye} variant="warning" onDismiss={() => setPreviewMode(false)} />
        )}
        {/* Header */}
        <div style={{ padding: "16px 28px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <button onClick={() => { setView("list"); setPreviewMode(false); }} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}>
            <ChevronLeft size={14} className="rtl-flip" /> {t("back_to_list")}
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "var(--text-primary)" }}><LtrText>{selectedEng.auditorFirm}</LtrText> · {selectedEng.fiscalPeriod}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{selectedEng.leadAuditor} · {selectedEng.engagementType}</div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <StatusPill status={selectedEng.status} />
              {!previewMode && <ActionButton variant="secondary" size="sm" icon={Eye} label="View as auditor" onClick={() => setPreviewMode(true)} />}
              {previewMode && <ActionButton variant="secondary" size="sm" icon={X} label="Exit preview" onClick={() => setPreviewMode(false)} />}
              {selectedEng.snapshotId && <ActionButton variant="secondary" size="sm" icon={Download} label={t("export_package")} onClick={handleExport} />}
              {onOpenAminah && <ActionButton variant="tertiary" size="sm" icon={Sparkles} label="Ask Aminah" onClick={() => onOpenAminah(`Audit engagement ${selectedEng.id} for ${selectedEng.fiscalPeriod}`)} />}
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 20, marginTop: 14 }}>
            {["overview", "checks", "clarifications", "export", "audit_trail"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: activeTab === tab ? "var(--accent-primary)" : "var(--text-tertiary)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 0", borderBottom: activeTab === tab ? "2px solid var(--accent-primary)" : "2px solid transparent" }}>
                {tab.toUpperCase().replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
        {/* Tab content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
          {activeTab === "overview" && <OverviewTab eng={selectedEng} onCreateSnapshot={handleCreateSnapshot} />}
          {activeTab === "checks" && <ChecksTab eng={selectedEng} onRunCheck={handleRunCheck} onRunAll={handleRunAllChecks} previewMode={previewMode} onOpenAminah={onOpenAminah} />}
          {activeTab === "clarifications" && <ClarificationsTab engagementId={selectedEng.id} clarifications={clarifications} onRefresh={async () => { const c = await listClarifications(selectedEng.id); setClarifications(c); }} />}
          {activeTab === "export" && <ExportTab eng={selectedEng} onExport={handleExport} />}
          {activeTab === "audit_trail" && <AuditTrailTab trail={selectedEng.auditTrail || []} />}
        </div>
        {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(0,196,140,0.15)", border: "1px solid rgba(0,196,140,0.35)", color: "var(--accent-primary)", padding: "10px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600, zIndex: 400 }}>{toast}</div>}
      </div>
    );
  }

  // Engagement list view
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>{t("title")}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{t("description")}</div>
          </div>
          <ActionButton variant="primary" icon={Plus} label={t("new_engagement")} onClick={handleCreateEngagement} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
        {!engagements ? (
          <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Loading...</div>
        ) : engagements.length === 0 ? (
          <EmptyState icon={Shield} title="No audit engagements" description="Create your first engagement to start" />
        ) : (
          <div style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 100px 100px 80px 80px 100px", gap: 12, padding: "10px 18px", background: "var(--bg-surface-sunken)", borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
              <div>FIRM</div><div>LEAD AUDITOR</div><div>PERIOD</div><div>STATUS</div><div>CHECKS</div><div>CLARS</div><div>CREATED</div>
            </div>
            {engagements.map((eng) => (
              <button key={eng.id} onClick={() => openEngagement(eng.id)} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 100px 100px 80px 80px 100px", gap: 12, padding: "14px 18px", width: "100%", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", fontFamily: "inherit", textAlign: "start", color: "var(--text-primary)", fontSize: 12 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,196,140,0.03)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <div style={{ fontWeight: 500 }}><LtrText>{eng.auditorFirm}</LtrText></div>
                <div style={{ color: "var(--text-secondary)" }}>{eng.leadAuditor || "—"}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}><LtrText>{eng.fiscalPeriod}</LtrText></div>
                <StatusPill status={eng.status} />
                <div style={{ fontSize: 11 }}>{eng.checksSummary?.passing || 0}/{eng.checksSummary?.total || 0}</div>
                <div style={{ fontSize: 11, color: eng.clarificationsSummary?.open > 0 ? "var(--semantic-warning)" : "var(--text-tertiary)" }}>{eng.clarificationsSummary?.open || 0} open</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{formatDate(eng.createdAt)}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(0,196,140,0.15)", border: "1px solid rgba(0,196,140,0.35)", color: "var(--accent-primary)", padding: "10px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600, zIndex: 400 }}>{toast}</div>}
    </div>
  );
}

function StatusPill({ status }) {
  const color = STATUS_COLORS[status] || "var(--text-tertiary)";
  return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color, background: `${color}1A`, border: `1px solid ${color}40`, padding: "3px 8px", borderRadius: 4 }}>{(status || "draft").toUpperCase().replace("_", " ")}</span>;
}

function OverviewTab({ eng, onCreateSnapshot }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Card title="FIRM DETAILS">
        <Field label="Firm" value={eng.auditorFirm} />
        <Field label="License" value={eng.auditorFirmLicense || "—"} mono />
        <Field label="Lead auditor" value={eng.leadAuditor || "—"} />
        <Field label="Email" value={eng.leadAuditorEmail || "—"} />
      </Card>
      <Card title="ENGAGEMENT">
        <Field label="Period" value={eng.fiscalPeriod} mono />
        <Field label="Type" value={(eng.engagementType || "").replace("_", " ")} />
        <Field label="Status" value={eng.status} />
        <Field label="Fees" value={`${eng.fees?.amount?.toLocaleString()} ${eng.fees?.currency}`} mono />
      </Card>
      <Card title="SNAPSHOT">
        {eng.snapshotId ? (
          <>
            <Field label="ID" value={eng.snapshotId} mono />
            <Field label="Frozen" value={formatDate(eng.snapshotFrozenAt)} />
            <Field label="Hash" value={`sha256:${btoa(eng.snapshotId).slice(0, 24)}...`} mono />
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>No snapshot yet</div>
            <ActionButton variant="primary" size="sm" label="Prepare snapshot" onClick={onCreateSnapshot} />
          </div>
        )}
      </Card>
      <Card title="KEY NUMBERS">
        <Field label="Checks" value={`${eng.checksSummary?.passing || 0}/${eng.checksSummary?.total || 0} passing`} />
        <Field label="Failing" value={String(eng.checksSummary?.failing || 0)} />
        <Field label="Clarifications" value={`${eng.clarificationsSummary?.open || 0} open, ${eng.clarificationsSummary?.resolved || 0} resolved`} />
      </Card>
    </div>
  );
}

function ChecksTab({ eng, onRunCheck, onRunAll, previewMode, onOpenAminah }) {
  const [expandedId, setExpandedId] = useState(null);
  const checks = eng.checks || [];
  const grouped = { A: checks.filter(c => c.trustClass === "A"), B: checks.filter(c => c.trustClass === "B"), C: checks.filter(c => c.trustClass === "C") };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>15 CHECKS · {eng.checksSummary?.passing || 0} PASSING · {eng.checksSummary?.failing || 0} FAILING</div>
        {!previewMode && <ActionButton variant="secondary" size="sm" icon={RefreshCw} label="Re-run all" onClick={onRunAll} />}
      </div>
      {["A", "B", "C"].map((cls) => (
        <div key={cls} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 8 }}>{TRUST_LABELS[cls]}</div>
          {grouped[cls].map((c) => {
            const Icon = CHECK_ICONS[c.status] || Clock;
            const color = CHECK_COLORS[c.status] || "var(--text-tertiary)";
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id} style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)", borderInlineStart: `3px solid ${color}`, borderRadius: 6, marginBottom: 6, overflow: "hidden" }}>
                <button onClick={() => setExpandedId(isExpanded ? null : c.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "start" }}>
                  {isExpanded ? <ChevronDown size={12} color="var(--text-tertiary)" /> : <ChevronRight size={12} color="var(--text-tertiary)" />}
                  <Icon size={14} color={color} />
                  <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, flex: 1 }}>{c.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color, background: `${color}1A`, padding: "2px 6px", borderRadius: 3 }}>{c.status.toUpperCase().replace("_", " ")}</span>
                  <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace" }}><LtrText>{c.id}</LtrText></span>
                </button>
                {isExpanded && (
                  <div style={{ padding: "10px 14px 14px 40px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 8 }}>{c.result}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontStyle: "italic", marginBottom: 8, lineHeight: 1.5 }}>{c.explanation}</div>
                    {c.failReason && <div style={{ fontSize: 11, color: "var(--semantic-danger)", marginBottom: 8 }}>Fail: {c.failReason}</div>}
                    {c.lastRunAt && <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 8 }}>Last run: {formatDate(c.lastRunAt)}</div>}
                    <div style={{ display: "flex", gap: 6 }}>
                      {!previewMode && <ActionButton variant="secondary" size="sm" icon={RefreshCw} label="Re-run" onClick={() => onRunCheck(c.id)} />}
                      {onOpenAminah && <ActionButton variant="tertiary" size="sm" icon={Sparkles} label="Ask Aminah" onClick={() => onOpenAminah(`Explain check ${c.id}: ${c.name}`)} />}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ClarificationsTab({ engagementId, clarifications, onRefresh }) {
  const [selectedId, setSelectedId] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const selected = clarifications.find(c => c.id === selectedId);
  const handleReply = async () => {
    if (!replyDraft.trim() || !selectedId) return;
    await addClarificationMessage(selectedId, { author: "CFO", role: "cfo", content: replyDraft.trim() });
    setReplyDraft("");
    onRefresh();
  };
  const handleResolve = async () => {
    if (!selectedId) return;
    await resolveClarification(selectedId, "Resolved by CFO");
    onRefresh();
    setSelectedId(null);
  };
  return (
    <div style={{ display: "flex", gap: 14, minHeight: 400 }}>
      <div style={{ flex: "0 0 45%", background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>CLARIFICATIONS · {clarifications.length}</div>
        {clarifications.map((c) => (
          <button key={c.id} onClick={() => setSelectedId(c.id)} style={{ display: "block", width: "100%", padding: "10px 14px", background: selectedId === c.id ? "rgba(0,196,140,0.04)" : "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", fontFamily: "inherit", textAlign: "start" }}>
            <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{c.subject}</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{c.raisedByName} · <StatusPill status={c.status} /> · {c.messages.length} messages</div>
          </button>
        ))}
      </div>
      <div style={{ flex: 1, background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, display: "flex", flexDirection: "column" }}>
        {selected ? (
          <>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{selected.subject}</div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{selected.context.type} · {selected.raisedByName}</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
              {selected.messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 10, display: "flex", justifyContent: m.role === "cfo" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "80%", background: m.role === "cfo" ? "rgba(0,196,140,0.08)" : "var(--bg-surface-sunken)", border: `1px solid ${m.role === "cfo" ? "rgba(0,196,140,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius: 10, padding: "8px 12px" }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 3 }}>{m.author} · {m.role.toUpperCase()}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{m.content}</div>
                  </div>
                </div>
              ))}
              {selected.resolution && <div style={{ fontSize: 11, color: "var(--accent-primary)", padding: "8px 0", fontWeight: 500 }}>Resolved: {selected.resolution}</div>}
            </div>
            {selected.status !== "resolved" && (
              <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 6 }}>
                <input value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder="Reply..." onKeyDown={(e) => { if (e.key === "Enter") handleReply(); }} style={{ flex: 1, background: "var(--bg-surface-sunken)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "8px 10px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                <ActionButton variant="primary" size="sm" label="Send" onClick={handleReply} disabled={!replyDraft.trim()} />
                <ActionButton variant="secondary" size="sm" label="Resolve" onClick={handleResolve} />
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 12 }}>Select a clarification to view</div>
        )}
      </div>
    </div>
  );
}

function ExportTab({ eng, onExport }) {
  const files = [
    { name: "trial_balance.xlsx", type: "XLSX" }, { name: "balance_sheet.xlsx", type: "XLSX" },
    { name: "income_statement.xlsx", type: "XLSX" }, { name: "journal_register.xlsx", type: "XLSX" },
    { name: "check_summary.xlsx", type: "XLSX" }, { name: "clarification_summary.xlsx", type: "XLSX" },
    { name: "financial_statements.xhtml", type: "iXBRL" }, { name: "snapshot_certificate.pdf", type: "PDF" },
    { name: "manifest.json", type: "JSON" },
  ];
  const canExport = eng.snapshotId && (eng.status === "active" || eng.status === "completed");
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 14 }}>Audit package contents — {files.length} files</div>
      <div style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
        {files.map((f, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={13} color="var(--text-tertiary)" />
              <span style={{ color: "var(--text-primary)", fontFamily: "'DM Mono', monospace", fontSize: 11 }}><LtrText>{f.name}</LtrText></span>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-tertiary)", background: "rgba(255,255,255,0.04)", padding: "2px 6px", borderRadius: 3 }}>{f.type}</span>
          </div>
        ))}
      </div>
      <ActionButton variant="primary" icon={Download} label="Generate audit package" onClick={onExport} disabled={!canExport} />
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 8, fontStyle: "italic" }}>Preview of the real audit package. Full export requires Arelle XBRL validation runtime in production.</div>
    </div>
  );
}

function AuditTrailTab({ trail }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 10 }}>IMMUTABLE AUDIT TRAIL — CRYPTOGRAPHICALLY VERIFIED</div>
      <div style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
        {(trail || []).map((e) => (
          <div key={e.id} style={{ display: "flex", gap: 12, padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 11, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace", minWidth: 60 }}>{formatDate(e.timestamp)}</span>
            <span style={{ color: "var(--text-secondary)", fontWeight: 500, minWidth: 80 }}>{e.actor}</span>
            <span style={{ color: "var(--text-primary)", flex: 1 }}>{(e.action || "").replace(/_/g, " ")}</span>
            <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "var(--text-tertiary)" }}><LtrText>{(e.digestHash || "").slice(0, 20)}...</LtrText></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "14px 18px" }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 12 }}>
      <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ color: "var(--text-primary)", fontFamily: mono ? "'DM Mono', monospace" : "inherit", fontSize: mono ? 11 : 12 }}>{value || "—"}</span>
    </div>
  );
}
