/**
 * Migration Wizard Step 1 — Source system + file upload.
 *
 * UX decisions (Phase 4 autonomy):
 *   - 4-card picker for source system; labels only (icons optional).
 *   - Parser version defaults to v1 for every source (shortlist confirmed
 *     in spec).
 *   - Entity type picker (invoices / bills / journal-entries) — user
 *     uploads one entity per pass; they can come back to Step 1 to ingest
 *     another entity under the same importJobId session (state preserved
 *     at the screen level).
 *   - File size capped at 5 MB on the frontend (flag: backend cap may
 *     differ; failing upload surfaces the backend error).
 *   - CSV sent as JSON body { csv: string } — not multipart.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, FileText, AlertCircle } from "lucide-react";
import LtrText from "../shared/LtrText";
import Spinner from "../shared/Spinner";
import {
  ingestInvoices,
  ingestBills,
  ingestJournalEntries,
} from "../../engine";

const SOURCE_OPTIONS = [
  { id: "zoho", labelKey: "source_zoho" },
  { id: "haseeb-v1", labelKey: "source_haseeb_v1" },
  { id: "odoo", labelKey: "source_odoo" },
  { id: "quickbooks", labelKey: "source_quickbooks" },
];

const ENTITY_OPTIONS = [
  { id: "invoices", labelKey: "entity_invoices" },
  { id: "bills", labelKey: "entity_bills" },
  { id: "journal-entries", labelKey: "entity_journal_entries" },
];

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB frontend cap

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(fr.error || new Error("read_failed"));
    fr.readAsText(file);
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function PickerCard({ active, disabled, onClick, label, accent }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      style={{
        padding: "14px 16px",
        background: active ? `${accent}1A` : "var(--bg-surface)",
        border: `1px solid ${active ? accent : "var(--border-default)"}`,
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "start",
        fontFamily: "inherit",
        fontSize: 13,
        fontWeight: 600,
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        opacity: disabled ? 0.55 : 1,
        transition: "all 0.12s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <span>{label}</span>
      {active && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: accent,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export default function MigrationStep1Source({
  role,
  readOnly,
  accent,
  sourceSystem,
  setSourceSystem,
  parserVersion,
  setParserVersion,
  entityType,
  setEntityType,
  onIngestComplete,
}) {
  const { t } = useTranslation("migration");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const onFileChange = (e) => {
    setError(null);
    setSuccessMsg(null);
    const f = e.target.files?.[0];
    if (!f) {
      setFile(null);
      return;
    }
    const isCsv =
      f.type === "text/csv" ||
      f.type === "application/vnd.ms-excel" ||
      /\.csv$/i.test(f.name);
    if (!isCsv) {
      setFile(null);
      setError(t("step1.file_not_csv"));
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setFile(null);
      setError(t("step1.file_too_large"));
      return;
    }
    setFile(f);
  };

  const onUpload = async () => {
    if (!file || readOnly) return;
    setUploading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const csv = await readFileAsText(file);
      const payload = {
        sourceSystem,
        parserVersion,
        csv,
        fileName: file.name,
      };
      let result;
      if (entityType === "invoices") result = await ingestInvoices(payload);
      else if (entityType === "bills") result = await ingestBills(payload);
      else result = await ingestJournalEntries(payload);
      const jobId = result?.importJobId || result?.id || null;
      const count = result?.count ?? 0;
      setSuccessMsg(t("step1.upload_success", { count }));
      if (jobId) {
        onIngestComplete({ jobId, entity: entityType });
      }
    } catch (err) {
      setError(err?.message || t("step1.upload_failed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader
        title={t("step1.title")}
        description={t("step1.description")}
      />

      <FieldBlock label={t("step1.source_label")}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 10,
          }}
        >
          {SOURCE_OPTIONS.map((s) => (
            <PickerCard
              key={s.id}
              active={sourceSystem === s.id}
              disabled={readOnly || uploading}
              onClick={() => setSourceSystem(s.id)}
              label={t(`step1.${s.labelKey}`)}
              accent={accent}
            />
          ))}
        </div>
      </FieldBlock>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
          gap: 20,
        }}
      >
        <FieldBlock label={t("step1.parser_version_label")}>
          <select
            value={parserVersion}
            onChange={(e) => setParserVersion(e.target.value)}
            disabled={readOnly || uploading}
            style={selectStyle}
          >
            <option value="v1">v1</option>
          </select>
        </FieldBlock>

        <FieldBlock label={t("step1.entity_label")}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            {ENTITY_OPTIONS.map((eo) => (
              <PickerCard
                key={eo.id}
                active={entityType === eo.id}
                disabled={readOnly || uploading}
                onClick={() => setEntityType(eo.id)}
                label={t(`step1.${eo.labelKey}`)}
                accent={accent}
              />
            ))}
          </div>
        </FieldBlock>
      </div>

      <FieldBlock label={t("step1.file_label")}>
        <div
          style={{
            padding: "18px",
            border: "1px dashed var(--border-default)",
            borderRadius: 8,
            background: "var(--bg-surface)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{ fontSize: 12, color: "var(--text-tertiary)" }}
          >
            {t("step1.file_drop_hint")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: readOnly
                  ? "var(--bg-surface-sunken)"
                  : "var(--bg-surface-sunken)",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                cursor: readOnly || uploading ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-primary)",
                opacity: readOnly ? 0.55 : 1,
              }}
            >
              <Upload size={14} />
              {t("step1.file_label")}
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onFileChange}
                disabled={readOnly || uploading}
                style={{ display: "none" }}
              />
            </label>
            {file && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                <FileText size={14} />
                <span>{file.name}</span>
                <span style={{ color: "var(--text-tertiary)" }}>
                  · {t("step1.file_size")}:{" "}
                  <LtrText style={{ fontFamily: "'DM Mono', monospace" }}>
                    {formatBytes(file.size)}
                  </LtrText>
                </span>
              </div>
            )}
          </div>
        </div>
      </FieldBlock>

      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            background: "var(--semantic-danger-subtle)",
            border: "1px solid var(--semantic-danger-border)",
            borderRadius: 6,
            fontSize: 13,
            color: "var(--semantic-danger)",
          }}
        >
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          style={{
            padding: "10px 12px",
            background: "var(--accent-primary-subtle)",
            border: "1px solid var(--accent-primary-border)",
            borderRadius: 6,
            fontSize: 13,
            color: "var(--accent-primary)",
          }}
        >
          {successMsg}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          paddingTop: 12,
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <button
          type="button"
          onClick={onUpload}
          disabled={readOnly || uploading || !file}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            background: accent,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor:
              readOnly || uploading || !file ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 600,
            opacity: readOnly || uploading || !file ? 0.55 : 1,
          }}
        >
          {uploading ? (
            <>
              <Spinner size={14} color="#fff" />
              {t("step1.uploading")}
            </>
          ) : (
            <>
              <Upload size={14} />
              {t("step1.upload")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ title, description }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 18,
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          marginTop: 4,
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
    </div>
  );
}

function FieldBlock({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

const selectStyle = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--bg-surface)",
  border: "1px solid var(--border-default)",
  borderRadius: 6,
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
  cursor: "pointer",
};
