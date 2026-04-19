import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle, ShieldCheck } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import LtrText from "../shared/LtrText";
import Spinner from "../shared/Spinner";
import {
  previewBulkReclassification,
  approveBulkReclassification,
  cancelBulkReclassification,
  getBulkReclassificationJeShape,
} from "../../engine";

// Preview + Approve + Cancel drawer.
//
// UX Q8 (from 2026-04-19-phase4-breakdown.md §4 #8 — "Bulk reclassification
// friction: double-confirm + typed-account-name OR single-click?"):
// shipping with the CONSERVATIVE-SINGLE-CLICK variant:
//   • Preview is mandatory on the backend (DRAFT → PREVIEWED required
//     before APPROVED). The UI funnel respects that.
//   • Prominent danger-tone warning banner is shown once preview has
//     captured lines.
//   • Approve is a single-click button clearly labeled "Approve &
//     lock reclassification".
// A typed-account-name double-confirm can be retrofitted without
// breaking this surface if Tarek wants that friction level later.

export default function BulkReclassPreviewDrawer({
  open,
  proposal,
  accounts,
  onClose,
  onUpdated,
  setToast,
}) {
  const { t } = useTranslation("bulk-reclass");
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(null); // 'preview' | 'approve' | 'cancel'
  const [actionError, setActionError] = useState(null);
  const [jeShape, setJeShape] = useState(null);
  const [jeShapeError, setJeShapeError] = useState(null);

  useEscapeKey(onClose, open);

  useEffect(() => {
    if (!open || !proposal) {
      setActionError(null);
      setJeShape(null);
      setJeShapeError(null);
      return;
    }
    // If the proposal is already APPROVED or POSTED, fetch the JE shape
    // so the operator can see what will/did post.
    if (proposal.status === "APPROVED" || proposal.status === "POSTED") {
      setLoading(true);
      getBulkReclassificationJeShape(proposal.id)
        .then((shape) => {
          setJeShape(shape);
          setLoading(false);
        })
        .catch((err) => {
          setJeShapeError(err?.message || t("drawer.error_je_shape"));
          setLoading(false);
        });
    }
  }, [open, proposal, t]);

  if (!open || !proposal) return null;

  const accountLabel = (id) => {
    const a = (accounts || []).find((x) => x.id === id);
    return a ? `${a.code} — ${a.nameEn || a.name}` : id;
  };

  const lines = proposal.lines || [];
  const totalDebit = lines.reduce((a, l) => a + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((a, l) => a + Number(l.credit || 0), 0);
  const netMoved = Math.abs(totalDebit - totalCredit);

  const runPreview = async () => {
    setActionError(null);
    setActing("preview");
    try {
      await previewBulkReclassification(proposal.id);
      if (onUpdated) await onUpdated();
      setToast(t("drawer.preview_captured_toast"));
    } catch (err) {
      setActionError(err?.message || t("drawer.error_preview"));
    } finally {
      setActing(null);
    }
  };

  const runApprove = async () => {
    setActionError(null);
    setActing("approve");
    try {
      await approveBulkReclassification(proposal.id);
      if (onUpdated) await onUpdated();
      setToast(t("drawer.approved_toast"));
    } catch (err) {
      setActionError(err?.message || t("drawer.error_approve"));
    } finally {
      setActing(null);
    }
  };

  const runCancel = async () => {
    setActionError(null);
    setActing("cancel");
    try {
      await cancelBulkReclassification(proposal.id);
      if (onUpdated) await onUpdated();
      setToast(t("drawer.cancelled_toast"));
    } catch (err) {
      setActionError(err?.message || t("drawer.error_cancel"));
    } finally {
      setActing(null);
    }
  };

  const isDraft = proposal.status === "DRAFT";
  const isPreviewed = proposal.status === "PREVIEWED";
  const isApproved = proposal.status === "APPROVED";
  const isPosted = proposal.status === "POSTED";
  const isTerminal = isApproved || isPosted || proposal.status === "CANCELLED";

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          zIndex: 300,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          insetInlineEnd: 0,
          height: "100vh",
          width: 620,
          background: "var(--panel-bg)",
          borderInlineStart: "1px solid var(--border-default)",
          zIndex: 301,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
              }}
            >
              {t("drawer.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {proposal.description}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("drawer.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Proposal summary */}
          <div
            style={{
              padding: "12px 14px",
              background: "var(--bg-surface-sunken)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div>
              <span style={{ color: "var(--text-tertiary)" }}>
                {t("drawer.from_label")}:
              </span>{" "}
              <LtrText>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    color: "var(--text-primary)",
                  }}
                >
                  {accountLabel(proposal.fromAccountId)}
                </span>
              </LtrText>
            </div>
            <div>
              <span style={{ color: "var(--text-tertiary)" }}>
                {t("drawer.to_label")}:
              </span>{" "}
              <LtrText>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    color: "var(--text-primary)",
                  }}
                >
                  {accountLabel(proposal.toAccountId)}
                </span>
              </LtrText>
            </div>
            {(proposal.dateFrom || proposal.dateTo) && (
              <div>
                <span style={{ color: "var(--text-tertiary)" }}>
                  {t("drawer.date_range_label")}:
                </span>{" "}
                <LtrText>
                  <span style={{ fontFamily: "'DM Mono', monospace" }}>
                    {proposal.dateFrom || "—"} → {proposal.dateTo || "—"}
                  </span>
                </LtrText>
              </div>
            )}
            {proposal.descriptionContains && (
              <div>
                <span style={{ color: "var(--text-tertiary)" }}>
                  {t("drawer.description_contains_label")}:
                </span>{" "}
                <span style={{ color: "var(--text-primary)" }}>
                  "{proposal.descriptionContains}"
                </span>
              </div>
            )}
            {proposal.notes && (
              <div style={{ marginTop: 4, fontStyle: "italic", color: "var(--text-secondary)" }}>
                {proposal.notes}
              </div>
            )}
          </div>

          {/* High-stakes warning banner before approve */}
          {isPreviewed && (
            <div
              role="alert"
              style={{
                display: "flex",
                gap: 10,
                padding: "12px 14px",
                background: "var(--semantic-warning-subtle)",
                border: "1px solid var(--semantic-warning)",
                borderRadius: 8,
                color: "var(--semantic-warning)",
                fontSize: 12,
                alignItems: "flex-start",
              }}
            >
              <AlertTriangle size={14} style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {t("drawer.warning_title")}
                </div>
                <div style={{ color: "var(--text-secondary)" }}>
                  {t("drawer.warning_body")}
                </div>
              </div>
            </div>
          )}

          {/* Action error */}
          {actionError && (
            <div
              role="alert"
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 12px",
                background: "var(--semantic-danger-subtle)",
                border: "1px solid var(--semantic-danger)",
                borderRadius: 8,
                color: "var(--semantic-danger)",
                fontSize: 12,
              }}
            >
              <AlertTriangle size={14} /> {actionError}
            </div>
          )}

          {/* Preview lines */}
          {(isPreviewed || isTerminal) && lines.length > 0 && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {t("drawer.captured_lines_heading", { count: lines.length })}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                  }}
                >
                  <LtrText>
                    <span style={{ fontFamily: "'DM Mono', monospace" }}>
                      {t("drawer.net_moved", {
                        amount: netMoved.toFixed(3),
                      })}
                    </span>
                  </LtrText>
                </div>
              </div>
              <div
                style={{
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  overflow: "hidden",
                  maxHeight: 260,
                  overflowY: "auto",
                }}
              >
                {lines.map((line, idx) => (
                  <div
                    key={line.id || idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 14px",
                      borderBottom:
                        idx === lines.length - 1
                          ? "none"
                          : "1px solid var(--border-subtle)",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "var(--text-primary)" }}>
                        {line.originDescription || t("drawer.no_description")}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-tertiary)",
                          marginTop: 2,
                        }}
                      >
                        <LtrText>
                          <span style={{ fontFamily: "'DM Mono', monospace" }}>
                            {line.originDate}
                          </span>
                        </LtrText>
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        color:
                          Number(line.debit) > 0
                            ? "var(--accent-primary)"
                            : "var(--text-secondary)",
                        fontWeight: 600,
                      }}
                    >
                      <LtrText>
                        {Number(line.debit) > 0
                          ? `DR ${line.debit}`
                          : `CR ${line.credit}`}
                      </LtrText>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(isPreviewed || isTerminal) && lines.length === 0 && (
            <div
              style={{
                padding: "18px",
                textAlign: "center",
                color: "var(--text-tertiary)",
                fontSize: 12,
                border: "1px dashed var(--border-default)",
                borderRadius: 8,
              }}
            >
              {t("drawer.no_captured_lines")}
            </div>
          )}

          {/* JE shape — APPROVED or POSTED */}
          {(isApproved || isPosted) && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  color: "var(--text-tertiary)",
                  marginBottom: 8,
                }}
              >
                {t("drawer.je_shape_heading")}
              </div>
              {loading && (
                <div
                  style={{ color: "var(--text-tertiary)", fontSize: 12 }}
                >
                  {t("drawer.je_shape_loading")}
                </div>
              )}
              {jeShapeError && (
                <div
                  role="alert"
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "10px 12px",
                    background: "var(--semantic-danger-subtle)",
                    border: "1px solid var(--semantic-danger)",
                    borderRadius: 8,
                    color: "var(--semantic-danger)",
                    fontSize: 12,
                  }}
                >
                  <AlertTriangle size={14} /> {jeShapeError}
                </div>
              )}
              {jeShape && (
                <div
                  style={{
                    border: "1px solid var(--accent-primary)",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "var(--accent-primary-subtle)",
                  }}
                >
                  <div
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid rgba(0,196,140,0.30)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      color: "var(--accent-primary)",
                      fontWeight: 600,
                    }}
                  >
                    <ShieldCheck size={14} />
                    <LtrText>
                      <span style={{ fontFamily: "'DM Mono', monospace" }}>
                        {t("drawer.total_moved", {
                          amount: jeShape.totalMovedKwd,
                        })}
                      </span>
                    </LtrText>
                  </div>
                  {jeShape.legs.length === 0 && (
                    <div
                      style={{
                        padding: "12px 14px",
                        color: "var(--text-secondary)",
                        fontSize: 12,
                      }}
                    >
                      {jeShape.note}
                    </div>
                  )}
                  {jeShape.legs.map((leg, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 14px",
                        borderTop:
                          i === 0 ? "none" : "1px solid rgba(0,196,140,0.30)",
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "var(--text-primary)",
                            fontWeight: 600,
                          }}
                        >
                          {leg.description}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--text-tertiary)",
                            marginTop: 2,
                          }}
                        >
                          <LtrText>
                            <span style={{ fontFamily: "'DM Mono', monospace" }}>
                              {accountLabel(leg.accountId)}
                            </span>
                          </LtrText>
                        </div>
                      </div>
                      <div
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          color: "var(--text-primary)",
                          fontWeight: 700,
                        }}
                      >
                        <LtrText>
                          {leg.side} {leg.amountKwd}
                        </LtrText>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {isApproved && !isPosted && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    fontStyle: "italic",
                  }}
                >
                  {t("drawer.posting_deferred_note")}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            padding: "14px 22px",
            borderTop: "1px solid var(--border-subtle)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {(isDraft || isPreviewed) && (
            <button
              onClick={runCancel}
              disabled={acting != null}
              style={{
                ...btnSecondary,
                color: "var(--semantic-danger)",
                borderColor: "rgba(208,90,90,0.30)",
              }}
            >
              {acting === "cancel" ? (
                <>
                  <Spinner size={13} />
                  &nbsp;{t("drawer.cancelling")}
                </>
              ) : (
                t("drawer.action_cancel")
              )}
            </button>
          )}
          {(isDraft || isPreviewed) && (
            <button
              onClick={runPreview}
              disabled={acting != null}
              style={btnSecondary}
            >
              {acting === "preview" ? (
                <>
                  <Spinner size={13} />
                  &nbsp;{t("drawer.previewing")}
                </>
              ) : isDraft ? (
                t("drawer.action_preview")
              ) : (
                t("drawer.action_re_preview")
              )}
            </button>
          )}
          {isPreviewed && (
            <button
              onClick={runApprove}
              disabled={acting != null}
              style={btnApproveStyle(acting === "approve")}
            >
              {acting === "approve" ? (
                <>
                  <Spinner size={13} />
                  &nbsp;{t("drawer.approving")}
                </>
              ) : (
                t("drawer.action_approve")
              )}
            </button>
          )}
          <button onClick={onClose} style={btnSecondary}>
            {t("drawer.close_button")}
          </button>
        </div>
      </div>
    </>
  );
}

const btnSecondary = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-strong)",
  padding: "9px 16px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "inherit",
  fontWeight: 600,
};
const btnApproveStyle = (loading) => ({
  background: "var(--accent-primary)",
  color: "#fff",
  border: "none",
  padding: "9px 18px",
  borderRadius: 6,
  cursor: loading ? "not-allowed" : "pointer",
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "inherit",
});
