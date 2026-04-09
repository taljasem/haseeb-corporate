import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Upload, FileText, FileSpreadsheet, Image as ImageIcon, File as FileIcon,
  Download, Trash2, X,
} from "lucide-react";
import { formatRelativeTime } from "../../utils/relativeTime";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 10;

const ACCEPTED_EXT = [
  ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".xlsx", ".xls", ".csv",
  ".docx", ".doc", ".txt",
];
const BLOCKED_EXT = [".exe", ".bat", ".sh", ".cmd", ".com", ".scr", ".vbs", ".ps1"];

function fmtSize(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function iconFor(type = "", name = "") {
  if (type.startsWith("image/")) return ImageIcon;
  if (type === "application/pdf" || name.toLowerCase().endsWith(".pdf")) return FileText;
  if (type.includes("spreadsheet") || /\.(xlsx|xls|csv)$/i.test(name)) return FileSpreadsheet;
  if (type.includes("word") || /\.(docx|doc)$/i.test(name)) return FileText;
  return FileIcon;
}

function extOk(name) {
  const lower = name.toLowerCase();
  if (BLOCKED_EXT.some((e) => lower.endsWith(e))) return false;
  return ACCEPTED_EXT.some((e) => lower.endsWith(e));
}

/**
 * Reusable file attachment component. Used by Taskbox (session 20D-1) and
 * intended for reuse across Manual JE, Reconciliation, Write-offs, and
 * Month-End Close item sub-forms.
 *
 * Props:
 *   attachments: [{id, name, size, type, uploadedBy, uploadedAt, dataUrl}]
 *   onAttach(file): async; file is { name, size, type, dataUrl, uploadedBy }
 *   onRemove(id): async
 *   readonly: boolean
 *   maxSize: bytes
 *   currentUserId: string
 */
export default function FileAttachment({
  attachments = [],
  onAttach,
  onRemove,
  readonly = false,
  maxSize = MAX_FILE_SIZE,
  currentUserId = "cfo",
}) {
  const { t } = useTranslation("taskbox");
  const fileRef = useRef(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const count = attachments.length;

  const processFiles = async (fileList) => {
    setError(null);
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    if (count + files.length > MAX_FILES) {
      setError(t("attachments.error_too_many"));
      return;
    }
    for (const f of files) {
      if (f.size > maxSize) {
        setError(t("attachments.error_too_large"));
        return;
      }
      if (!extOk(f.name)) {
        setError(t("attachments.error_type"));
        return;
      }
    }
    setUploading(true);
    for (const f of files) {
      const dataUrl = await readAsDataURL(f);
      if (onAttach) {
        await onAttach({
          name: f.name,
          size: f.size,
          type: f.type,
          dataUrl,
          uploadedBy: currentUserId,
        });
      }
    }
    setUploading(false);
  };

  const readAsDataURL = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handlePreview = (att) => {
    if (att.type && att.type.startsWith("image/")) {
      setLightbox(att);
      return;
    }
    if (att.type === "application/pdf" && att.dataUrl) {
      try { window.open(att.dataUrl, "_blank"); } catch (e) { /* noop */ }
      return;
    }
    handleDownload(att);
  };

  const handleDownload = (att) => {
    if (!att.dataUrl) return;
    const a = document.createElement("a");
    a.href = att.dataUrl;
    a.download = att.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRemove = async (id) => {
    if (onRemove) await onRemove(id);
  };

  return (
    <div>
      {/* Empty state + drop zone */}
      {count === 0 && !readonly && (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            processFiles(e.dataTransfer.files);
          }}
          style={{
            border: `1.5px dashed ${dragOver ? "var(--accent-primary)" : "rgba(255,255,255,0.15)"}`,
            background: dragOver ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)",
            borderRadius: 10,
            padding: "24px 18px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <Upload size={20} color="var(--text-tertiary)" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
            {t("attachments.drop_here")}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
            {t("attachments.accept_hint")}
          </div>
        </div>
      )}

      {/* Empty readonly */}
      {count === 0 && readonly && (
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic", padding: "8px 0" }}>
          {t("attachments.empty_readonly")}
        </div>
      )}

      {/* List */}
      {count > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {attachments.map((att) => {
            const Icon = iconFor(att.type, att.name);
            return (
              <div
                key={att.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background: "var(--bg-surface-sunken)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                }}
              >
                <Icon size={16} color="var(--accent-primary)" strokeWidth={2.2} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button
                    onClick={() => handlePreview(att)}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      color: "var(--text-primary)",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "start",
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "block",
                    }}
                  >
                    {att.name}
                  </button>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                    {fmtSize(att.size)} · {t("attachments.uploaded_by", { name: att.uploadedBy || "—" })} · {formatRelativeTime(att.uploadedAt)}
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(att)}
                  aria-label={t("attachments.download")}
                  style={iconBtnStyle}
                >
                  <Download size={13} />
                </button>
                {!readonly && (
                  <button
                    onClick={() => handleRemove(att.id)}
                    aria-label={t("attachments.remove")}
                    style={{ ...iconBtnStyle, color: "var(--semantic-danger)" }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add-more button when at least one exists */}
      {count > 0 && !readonly && count < MAX_FILES && (
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            marginTop: 8,
            background: "transparent",
            border: "1px dashed rgba(255,255,255,0.15)",
            color: "var(--text-secondary)",
            padding: "8px 14px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "inherit",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Upload size={12} /> {t("attachments.browse")}
        </button>
      )}

      {error && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--semantic-danger)" }}>
          {error}
        </div>
      )}
      {uploading && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-tertiary)" }}>…</div>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPTED_EXT.join(",")}
        style={{ display: "none" }}
        onChange={(e) => {
          processFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: "absolute",
              top: 20,
              insetInlineEnd: 20,
              background: "transparent",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              padding: 8,
            }}
          >
            <X size={24} />
          </button>
          <img
            src={lightbox.dataUrl}
            alt={lightbox.name}
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              objectFit: "contain",
              background: "#fff",
              borderRadius: 8,
              padding: 12,
              minWidth: 100,
              minHeight: 100,
            }}
          />
        </div>
      )}
    </div>
  );
}

const iconBtnStyle = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "var(--text-tertiary)",
  padding: 4,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
