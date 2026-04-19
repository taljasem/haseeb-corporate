/**
 * VersionHistoryDrawer (FN-244, Phase 4 Wave 1).
 *
 * A right-docked slide-over that lists published versions for the current
 * (reportType, reportKey) tuple. Reuses the side-panel shape of the
 * existing "Adjusting entries" aside on FinancialStatementsScreen so the
 * screen has a single, consistent drawer vocabulary.
 *
 * Renders:
 *   • One row per published version, newest first
 *   • Version number (LTR-safe inside RTL), published-at, published-by
 *   • Superseded vs current badge
 *   • Notes snippet (truncated)
 *   • "View" action that loads that version's snapshot into the screen
 *     via onView(version)
 *
 * All four roles (OWNER, ACCOUNTANT, VIEWER, AUDITOR) can open this
 * drawer. Role-gating on the Publish button lives in the screen that
 * owns this drawer, not here.
 *
 * Uses only existing design-system / shared primitives — no new ones.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, History, Eye } from "lucide-react";
import EmptyState from "../shared/EmptyState";
import LtrText from "../shared/LtrText";
import Spinner from "../shared/Spinner";
import { listReportVersions } from "../../engine";
import { formatRelativeTime } from "../../utils/relativeTime";

function formatAbsolute(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function VersionHistoryDrawer({
  open,
  reportType,
  reportKey,
  reportLabel,
  viewingVersionId,
  onClose,
  onView,
  refreshToken,
}) {
  const { t } = useTranslation("financial");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!open || !reportType || !reportKey) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listReportVersions({ reportType, reportKey, limit: 100 })
      .then((list) => {
        if (cancelled) return;
        setRows(Array.isArray(list) ? list : []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        setError(err?.message || "Unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [open, reportType, reportKey, refreshToken]);

  if (!open) return null;

  return (
    <aside
      style={{
        width: 380,
        flexShrink: 0,
        borderInlineStart: "1px solid var(--border-default)",
        background: "var(--bg-surface)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 18px",
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
            {t("versions.drawer.label")}
          </div>
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 20,
              color: "var(--text-primary)",
              letterSpacing: "-0.2px",
              lineHeight: 1,
              marginTop: 2,
            }}
          >
            {t("versions.drawer.title")}
          </div>
          {reportLabel && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 4,
              }}
            >
              {t("versions.drawer.subtitle", { report: reportLabel })}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label={t("versions.close")}
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

      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: "28px 20px",
              textAlign: "center",
              color: "var(--text-tertiary)",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Spinner size={14} /> {t("versions.drawer.loading")}
          </div>
        )}
        {error && !loading && (
          <div
            role="alert"
            style={{
              margin: "14px 18px",
              background: "rgba(253,54,28,0.08)",
              border: "1px solid rgba(253,54,28,0.3)",
              color: "var(--semantic-danger)",
              padding: "12px 14px",
              borderRadius: 8,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div>{t("versions.drawer.error", { message: error })}</div>
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <EmptyState
            icon={History}
            title={t("versions.drawer.empty_title")}
            description={t("versions.drawer.empty_desc")}
          />
        )}
        {!loading && !error &&
          rows.map((v) => (
            <VersionRow
              key={v.id}
              version={v}
              isViewing={viewingVersionId === v.id}
              onView={() => onView && onView(v)}
            />
          ))}
      </div>
    </aside>
  );
}

function VersionRow({ version, isViewing, onView }) {
  const { t } = useTranslation("financial");
  const superseded = !!version.supersededAt;
  const badgeColor = superseded ? "var(--text-tertiary)" : "var(--accent-primary)";
  const badgeBg = superseded
    ? "var(--bg-surface-sunken)"
    : "var(--accent-primary-subtle)";
  const badgeBorder = superseded
    ? "1px solid var(--border-subtle)"
    : "1px solid rgba(0,196,140,0.30)";
  return (
    <div
      style={{
        padding: "12px 18px",
        borderBottom: "1px solid var(--border-subtle)",
        background: isViewing ? "var(--accent-primary-subtle)" : "transparent",
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
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary)",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          <LtrText>v{version.version}</LtrText>
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: badgeColor,
            background: badgeBg,
            border: badgeBorder,
            padding: "3px 8px",
            borderRadius: 10,
            textTransform: "uppercase",
          }}
        >
          {superseded
            ? t("versions.drawer.superseded_badge")
            : t("versions.drawer.current_badge")}
        </span>
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-tertiary)",
          marginTop: 4,
          fontFamily: "'DM Mono', monospace",
        }}
      >
        <LtrText>{formatAbsolute(version.publishedAt)}</LtrText>
        {version.publishedByName || version.publishedBy
          ? (
            <>
              {" · "}
              {t("versions.drawer.published_by")}{" "}
              {version.publishedByName || version.publishedBy}
            </>
          )
          : null}
        {version.publishedAt
          ? <> · {formatRelativeTime(version.publishedAt)}</>
          : null}
      </div>
      {version.notes && (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            marginTop: 6,
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {version.notes}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button
          onClick={onView}
          disabled={isViewing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: isViewing ? "transparent" : "transparent",
            border: "1px solid var(--border-default)",
            color: isViewing ? "var(--accent-primary)" : "var(--text-secondary)",
            padding: "5px 10px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: isViewing ? "default" : "pointer",
          }}
        >
          <Eye size={12} />
          {isViewing ? t("versions.drawer.viewing") : t("versions.drawer.view")}
        </button>
      </div>
    </div>
  );
}
