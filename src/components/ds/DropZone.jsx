/**
 * DropZone — file upload area with drag+drop, click, and validation.
 *
 * Usage:
 *   <DropZone onFile={handleFile} accept=".csv" maxSize={5*1024*1024}
 *     title="Drop CSV file here" subtitle="or click to browse — max 5 MB" />
 */
import { useRef, useState } from "react";
import { Upload } from "lucide-react";

export default function DropZone({
  onFile,
  accept,
  maxSize,
  maxFiles = 1,
  title = "Drop file here",
  subtitle = "or click to browse",
  icon: Icon = Upload,
  disabled = false,
  loading = false,
  height = 80,
  variant = "default",
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const compact = variant === "compact";

  const validate = (file) => {
    if (maxSize && file.size > maxSize) {
      setError(`File too large (max ${Math.round(maxSize / 1024 / 1024)} MB)`);
      return false;
    }
    if (accept) {
      const exts = accept.split(",").map((a) => a.trim().toLowerCase());
      const name = file.name.toLowerCase();
      const type = (file.type || "").toLowerCase();
      const ok = exts.some((ext) =>
        ext.startsWith(".") ? name.endsWith(ext) : type.includes(ext.replace("*", ""))
      );
      if (!ok) {
        setError(`Unsupported file type. Accepted: ${accept}`);
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (validate(file)) {
      onFile && onFile(file);
    }
  };

  const accentBorder = dragOver ? "var(--accent-primary)" : "rgba(0,196,140,0.3)";
  const accentBg = dragOver ? "rgba(0,196,140,0.06)" : "transparent";

  return (
    <div>
      <div
        onClick={() => !disabled && !loading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && !loading) handleFiles(e.dataTransfer.files);
        }}
        style={{
          display: "flex",
          flexDirection: compact ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: compact ? 10 : 6,
          height,
          padding: compact ? "8px 16px" : "16px 24px",
          border: `2px dashed ${accentBorder}`,
          borderRadius: 8,
          background: accentBg,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.4 : 1,
          transition: "all 0.15s",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={maxFiles > 1}
          style={{ display: "none" }}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {loading ? (
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Processing...</div>
        ) : (
          <>
            <Icon size={compact ? 16 : 22} color="var(--accent-primary)" style={{ opacity: 0.7 }} />
            <div style={{ textAlign: compact ? "start" : "center" }}>
              <div style={{ fontSize: compact ? 11 : 13, fontWeight: 500, color: "var(--text-secondary)" }}>{title}</div>
              {subtitle && <div style={{ fontSize: compact ? 10 : 11, color: "var(--text-tertiary)", marginTop: compact ? 0 : 2 }}>{subtitle}</div>}
            </div>
          </>
        )}
      </div>
      {error && (
        <div style={{ fontSize: 11, color: "var(--semantic-danger)", marginTop: 4, paddingInlineStart: 4 }}>{error}</div>
      )}
    </div>
  );
}
