/**
 * @file DisclosureNotesSection.jsx
 *
 * AUDIT-ACC-040 — Disclosure Notes audit-package renderer.
 *
 * Consumes the envelope shipped by `getDisclosureNotes(period)` (backend
 * mirrors `DisclosureNoteDto` from
 * `src/modules/disclosure-notes/disclosure-notes.types.ts`). Renders 19
 * IFRS + 6 AAOIFI builder outputs as a structured, scannable document:
 *
 *   • Each note: numbered header ("Note N"), bilingual title, narrative
 *     body, and optional tabular schedule.
 *   • AAOIFI notes render with AAOIFI label primary + IFRS cross-
 *     reference column (matches `buildAaoifiInstrumentNote` output).
 *   • Notes flagged `NARRATIVE_PENDING` surface a "Narrative required"
 *     badge and a stubbed "Edit narrative" button that opens a
 *     "coming soon" modal referencing HASEEB-223.
 *   • Auto-populated notes carry an inline "Auto-populated from {source}"
 *     citation in the note header.
 *   • Each note is collapsible via a chevron toggle.
 *
 * Role gating (midsize model):
 *   • Owner / CFO / Senior → view + Edit-narrative stub access
 *   • Junior → view only, no Edit-narrative button
 *
 * No hex literals. RTL-safe via logical properties.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Edit3, FileText, X } from "lucide-react";
import LtrText from "../shared/LtrText";
import { normalizeRole } from "../../utils/role";

// ── helpers ──────────────────────────────────────────────────────

function noteLabel(note, lang) {
  if (!note) return "";
  if (lang === "ar" && note.titleAr) return note.titleAr;
  return note.titleEn || "";
}

function paragraphs(note, lang) {
  const narrative = Array.isArray(note.narratives) ? note.narratives : [];
  const out = [];
  for (const n of narrative) {
    const list = lang === "ar" ? n.paragraphsAr : n.paragraphsEn;
    if (Array.isArray(list)) out.push(...list);
  }
  return out;
}

function formatCellValue(cell, isAmount) {
  if (cell == null) return "\u2014";
  const str = String(cell);
  if (!isAmount) return str;
  // Render 3-dp strings with thousands separators; accept negatives.
  const num = Number(str);
  if (!Number.isFinite(num)) return str;
  const abs = Math.abs(num).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  if (num === 0) return "0.000";
  return num < 0 ? `(${abs})` : abs;
}

// ── NARRATIVE_PENDING stub modal (HASEEB-223) ─────────────────────

function NarrativeEditorStubModal({ open, onClose }) {
  const { t } = useTranslation("financial");
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="narrative-stub-title"
      data-testid="narrative-editor-stub"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 400,
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 92vw)",
          background: "var(--bg-surface-raised)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div
            id="narrative-stub-title"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 20,
              color: "var(--text-primary)",
              letterSpacing: "-0.2px",
              lineHeight: 1,
            }}
          >
            {t("disclosureNotes.narrativeEditorStub.title")}
          </div>
          <button
            onClick={onClose}
            aria-label={t("disclosureNotes.narrativeEditorStub.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}
        >
          {t("disclosureNotes.narrativeEditorStub.body")}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "var(--accent-primary)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {t("disclosureNotes.narrativeEditorStub.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Single-note renderer ──────────────────────────────────────────

function DisclosureNoteRow({
  note,
  noteNumber,
  canEditNarrative,
  onOpenStub,
}) {
  const { t, i18n } = useTranslation("financial");
  const isArabic = i18n.language === "ar";
  const [expanded, setExpanded] = useState(noteNumber <= 2);
  const isPending = note.kind === "NARRATIVE_PENDING";
  const isAaoifi = !!note.isAaoifi;
  const source = note.autoPopulatedFrom || null;

  const title = noteLabel(note, isArabic ? "ar" : "en");
  const bodyParagraphs = paragraphs(note, isArabic ? "ar" : "en");

  return (
    <div
      data-testid="disclosure-note"
      data-note-type={note.noteType}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={`note-body-${noteNumber}`}
        style={{
          width: "100%",
          background: "var(--bg-surface-sunken)",
          border: "none",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          textAlign: "start",
          color: "var(--text-primary)",
          fontFamily: "inherit",
        }}
      >
        {expanded ? (
          <ChevronDown size={14} aria-hidden="true" />
        ) : (
          <ChevronRight size={14} aria-hidden="true" />
        )}
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-tertiary)",
            flexShrink: 0,
          }}
        >
          <LtrText>
            {t("disclosureNotes.noteLabel", { n: noteNumber })}
          </LtrText>
        </div>
        <div
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        {isAaoifi && (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 10,
              background: "var(--accent-primary-subtle)",
              color: "var(--accent-primary)",
              border: "1px solid var(--accent-primary-border)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            {t("disclosureNotes.aaoifi.badge")}
          </span>
        )}
        {isPending && (
          <span
            data-testid="narrative-pending-badge"
            style={{
              padding: "2px 8px",
              borderRadius: 10,
              background: "var(--bg-warning-subtle, rgba(212,168,75,0.12))",
              color: "var(--semantic-warning, #D4A84B)",
              border: "1px solid var(--semantic-warning, #D4A84B)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            {t("disclosureNotes.narrativePendingBadge")}
          </span>
        )}
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: "var(--text-tertiary)",
            flexShrink: 0,
          }}
        >
          <LtrText>{note.standardReference}</LtrText>
        </div>
      </button>

      {/* Body — expanded */}
      {expanded && (
        <div
          id={`note-body-${noteNumber}`}
          style={{
            padding: "14px 18px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Auto-populated citation */}
          {source && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                fontStyle: "italic",
              }}
            >
              {t("disclosureNotes.autoPopulatedFrom", { source })}
            </div>
          )}

          {/* Narrative paragraphs */}
          {bodyParagraphs.map((p, i) => (
            <p
              key={i}
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.7,
                color: "var(--text-secondary)",
              }}
            >
              {p}
            </p>
          ))}

          {/* Tables */}
          {Array.isArray(note.tables) &&
            note.tables.map((tbl, ti) => (
              <NoteTable key={ti} table={tbl} isArabic={isArabic} />
            ))}

          {/* Edit-narrative stub (HASEEB-223) — role-gated */}
          {isPending && canEditNarrative && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => onOpenStub(note)}
                data-testid="edit-narrative-stub"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: "var(--bg-surface-sunken)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  color: "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                <Edit3 size={12} />
                {t("disclosureNotes.editNarrativeButton")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NoteTable({ table, isArabic }) {
  if (!table || !Array.isArray(table.columns)) return null;
  const title =
    isArabic && table.titleAr ? table.titleAr : table.titleEn || "";
  const footnote =
    isArabic && table.footnoteAr ? table.footnoteAr : table.footnoteEn;

  return (
    <div
      style={{
        background: "var(--bg-surface-sunken)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {title && (
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid var(--border-subtle)",
                  textAlign: "start",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                }}
              >
                {isArabic ? "البند" : "Item"}
              </th>
              {table.columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--border-subtle)",
                    textAlign: col.align === "end" ? "end" : "start",
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                  }}
                >
                  {isArabic && col.labelAr ? col.labelAr : col.labelEn}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(table.rows || []).map((row, ri) => (
              <tr
                key={ri}
                style={{
                  background: row.isTotal
                    ? "var(--bg-surface)"
                    : "transparent",
                  fontWeight: row.isTotal ? 600 : 400,
                }}
              >
                <td
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                    fontWeight: row.isTotal ? 600 : 400,
                  }}
                >
                  {isArabic && row.labelAr ? row.labelAr : row.labelEn}
                </td>
                {(row.cells || []).map((cell, ci) => {
                  const col = table.columns[ci];
                  const align = col?.align === "end" ? "end" : "start";
                  return (
                    <td
                      key={ci}
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid var(--border-subtle)",
                        textAlign: align,
                        color: "var(--text-primary)",
                        fontFamily: col?.isAmount
                          ? "'DM Mono', monospace"
                          : "inherit",
                        fontVariantNumeric: col?.isAmount
                          ? "tabular-nums"
                          : "normal",
                      }}
                    >
                      {col?.isAmount ? (
                        <LtrText>
                          {formatCellValue(cell, col.isAmount)}
                        </LtrText>
                      ) : (
                        cell ?? ""
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote && (
        <div
          style={{
            padding: "8px 14px",
            borderTop: "1px solid var(--border-subtle)",
            fontSize: 10,
            color: "var(--text-tertiary)",
            fontStyle: "italic",
            lineHeight: 1.6,
          }}
        >
          {footnote}
        </div>
      )}
    </div>
  );
}

// ── Top-level section ─────────────────────────────────────────────

export default function DisclosureNotesSection({ run, role = "Owner" }) {
  const { t } = useTranslation("financial");
  const [stubNote, setStubNote] = useState(null);

  const normalized = normalizeRole(role);
  // Junior = no edit access; other roles get the stub button for
  // NARRATIVE_PENDING notes.
  const canEditNarrative =
    normalized === "Owner" ||
    normalized === "CFO" ||
    normalized === "Senior";

  const notes = Array.isArray(run?.notes) ? run.notes : [];

  if (notes.length === 0) {
    return (
      <div
        data-testid="disclosure-notes-empty"
        style={{
          padding: "24px 20px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 10,
          textAlign: "center",
          color: "var(--text-tertiary)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
        }}
      >
        <FileText size={20} aria-hidden="true" />
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {t("disclosureNotes.emptyTitle")}
        </div>
        <div style={{ fontSize: 12 }}>{t("disclosureNotes.emptyDesc")}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
      data-testid="disclosure-notes-section"
    >
      {notes.map((note, i) => (
        <DisclosureNoteRow
          key={note.id || `${note.noteType}-${i}`}
          note={note}
          noteNumber={i + 1}
          canEditNarrative={canEditNarrative}
          onOpenStub={(n) => setStubNote(n)}
        />
      ))}
      <NarrativeEditorStubModal
        open={!!stubNote}
        onClose={() => setStubNote(null)}
      />
    </div>
  );
}
