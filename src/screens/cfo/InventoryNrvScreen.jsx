import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  AlertTriangle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import Spinner from "../../components/shared/Spinner";
import NrvPolicyCreateModal from "../../components/inventory-nrv/NrvPolicyCreateModal";
import {
  getActiveNrvPolicy,
  listNrvPolicies,
  deactivateNrvPolicy,
  getNrvAssessment,
} from "../../engine";

function Toast({ text, onClear }) {
  useEffect(() => {
    if (!text) return;
    const id = setTimeout(onClear, 3000);
    return () => clearTimeout(id);
  }, [text, onClear]);
  if (!text) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        insetInlineEnd: 24,
        background: "var(--accent-primary)",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        zIndex: 200,
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
      }}
    >
      {text}
    </div>
  );
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function InventoryNrvScreen({ role = "CFO" }) {
  const { t } = useTranslation("inventory-nrv");
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [asOf, setAsOf] = useState(todayStr());
  const [createOpen, setCreateOpen] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);
  const [acting, setActing] = useState(null);

  const reloadAll = async () => {
    setLoadError(null);
    try {
      const [p, list] = await Promise.all([
        getActiveNrvPolicy().catch(() => null),
        listNrvPolicies().catch(() => []),
      ]);
      setActive(p);
      setHistory(list || []);
    } catch (err) {
      setLoadError(err?.message || t("error_load"));
    }
  };

  const reloadAssessment = async () => {
    try {
      const a = await getNrvAssessment(asOf);
      setAssessment(a);
    } catch (err) {
      setToast(err?.message || t("error_assessment"));
    }
  };

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reloadAssessment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOf, active?.id]);

  const handleDeactivate = async (id) => {
    setActing(`deactivate-${id}`);
    try {
      await deactivateNrvPolicy(id);
      setToast(t("toast.deactivated"));
      await reloadAll();
    } catch (err) {
      setToast(err?.message || t("error_deactivate"));
    } finally {
      setActing(null);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <Toast text={toast} onClear={() => setToast(null)} />

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 18,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--accent-primary)",
              }}
            >
              {t("view_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 28,
                color: "var(--text-primary)",
                letterSpacing: "-0.3px",
                marginTop: 2,
                lineHeight: 1,
              }}
            >
              {t("title")}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
                marginTop: 6,
              }}
            >
              {t("subtitle")}
            </div>
          </div>
          <button onClick={() => setCreateOpen(true)} style={btnPrimary(false)}>
            <Plus size={13} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
            {t("new_policy")}
          </button>
        </div>

        {loadError && (
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
              marginBottom: 12,
            }}
          >
            <AlertTriangle size={14} /> {loadError}
          </div>
        )}

        <ActivePolicyCard
          policy={active}
          onDeactivate={handleDeactivate}
          acting={acting}
        />

        <AssessmentCard
          assessment={assessment}
          asOf={asOf}
          setAsOf={setAsOf}
          onRefresh={reloadAssessment}
          hasActivePolicy={!!active}
        />

        <PolicyHistorySection
          policies={history}
          activeId={active?.id}
          onDeactivate={handleDeactivate}
          acting={acting}
        />

        <div
          style={{
            marginTop: 14,
            fontSize: 11,
            color: "var(--text-tertiary)",
            fontStyle: "italic",
          }}
        >
          {t("posting_deferred_note")}
        </div>

        <NrvPolicyCreateModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            reloadAll();
            setToast(t("toast.created"));
          }}
        />
      </div>
    </div>
  );
}

function ActivePolicyCard({ policy, onDeactivate, acting }) {
  const { t } = useTranslation("inventory-nrv");
  if (policy === null) {
    return (
      <div
        style={{
          padding: "20px 22px",
          border: "1px solid var(--semantic-warning)",
          borderRadius: 10,
          background: "var(--semantic-warning-subtle)",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <AlertTriangle size={20} color="var(--semantic-warning)" />
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--semantic-warning)",
            }}
          >
            {t("active.no_policy_title")}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
            {t("active.no_policy_description")}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        padding: "18px 20px",
        border: "1px solid var(--accent-primary-border)",
        borderRadius: 10,
        background: "var(--accent-primary-subtle)",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: "var(--accent-primary)",
              textTransform: "uppercase",
            }}
          >
            {t("active.heading")}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 6,
              flexWrap: "wrap",
            }}
          >
            <LtrText>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-primary)",
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {t("active.from")}: {String(policy.activeFrom).slice(0, 10)}
              </span>
            </LtrText>
            {policy.activeUntil && (
              <LtrText>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {t("active.until")}: {String(policy.activeUntil).slice(0, 10)}
                </span>
              </LtrText>
            )}
            <span
              style={{
                fontSize: 10,
                color: "var(--text-tertiary)",
                fontFamily: "'DM Mono', monospace",
              }}
            >
              {t("active.bands_count", { count: policy.bands?.length || 0 })}
            </span>
          </div>
          {policy.notes && (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                marginTop: 8,
                fontStyle: "italic",
              }}
            >
              {policy.notes}
            </div>
          )}
        </div>
        <button
          onClick={() => onDeactivate(policy.id)}
          disabled={acting != null}
          style={{
            background: "transparent",
            color: "var(--semantic-danger)",
            border: "1px solid var(--semantic-danger-border)",
            padding: "6px 12px",
            borderRadius: 5,
            cursor: acting != null ? "not-allowed" : "pointer",
            fontSize: 11,
            fontFamily: "inherit",
            fontWeight: 600,
          }}
        >
          {acting === `deactivate-${policy.id}` ? (
            <Spinner size={11} />
          ) : (
            <>
              <XCircle size={11} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />
              {t("active.deactivate")}
            </>
          )}
        </button>
      </div>

      {/* Band quick-view */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 8,
          marginTop: 12,
        }}
      >
        {(policy.bands || []).map((b) => (
          <BandChip key={b.id || b.label} band={b} />
        ))}
      </div>
    </div>
  );
}

function BandChip({ band }) {
  const pct = (band.writedownPercent / 100).toFixed(2);
  const severe = band.writedownPercent >= 5000;
  const color = severe ? "var(--semantic-danger)" : "var(--accent-primary)";
  const bg = severe
    ? "var(--semantic-danger-subtle)"
    : "var(--bg-surface)";
  const border = severe
    ? "var(--semantic-danger-border)"
    : "var(--accent-primary-border)";
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-primary)",
          fontWeight: 600,
          marginBottom: 3,
        }}
      >
        {band.label}
      </div>
      <LtrText>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-tertiary)",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          {band.minAgeDays} - {band.maxAgeDays == null ? "∞" : band.maxAgeDays}d
        </div>
      </LtrText>
      <LtrText>
        <div
          style={{
            fontSize: 13,
            color,
            fontFamily: "'DM Mono', monospace",
            fontWeight: 700,
            marginTop: 2,
          }}
        >
          {pct}%
        </div>
      </LtrText>
    </div>
  );
}

function AssessmentCard({ assessment, asOf, setAsOf, onRefresh, hasActivePolicy }) {
  const { t } = useTranslation("inventory-nrv");

  return (
    <div
      style={{
        marginTop: 4,
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          background: "var(--bg-surface-sunken)",
          borderBottom: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
            }}
          >
            {t("assessment.heading")}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              marginTop: 3,
            }}
          >
            {t("assessment.subheading")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <label
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "var(--text-tertiary)",
            }}
          >
            {t("assessment.as_of")}
          </label>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            style={{
              background: "var(--panel-bg)",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              padding: "6px 10px",
              color: "var(--text-primary)",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={onRefresh}
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-strong)",
              padding: "6px 12px",
              borderRadius: 5,
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "inherit",
              fontWeight: 600,
            }}
          >
            <RefreshCw
              size={11}
              style={{ verticalAlign: "middle", marginInlineEnd: 4 }}
            />
            {t("assessment.refresh")}
          </button>
        </div>
      </div>

      {!assessment && (
        <div
          style={{
            padding: "30px",
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: 12,
          }}
        >
          {t("assessment.loading")}
        </div>
      )}

      {assessment && (!hasActivePolicy || assessment.policyId == null) && (
        <div
          style={{
            padding: "30px 20px",
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: 12,
            fontStyle: "italic",
          }}
        >
          {t("assessment.no_policy_note")}
        </div>
      )}

      {assessment && assessment.policyId != null && (
        <>
          {/* Totals strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              padding: "14px 16px",
              background: "var(--panel-bg)",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <TotalCell label={t("assessment.total_gross")} value={`${assessment.totalGrossKwd} KWD`} />
            <TotalCell
              label={t("assessment.total_writedown")}
              value={`${assessment.totalWritedownKwd} KWD`}
              tone="danger"
            />
            <TotalCell
              label={t("assessment.total_nrv")}
              value={`${assessment.totalNrvKwd} KWD`}
              tone="primary"
            />
          </div>

          {(assessment.warnings || []).length > 0 && (
            <div
              role="status"
              style={{
                padding: "10px 16px",
                background: "var(--semantic-warning-subtle)",
                color: "var(--semantic-warning)",
                fontSize: 11,
                borderBottom: "1px solid var(--semantic-warning-border, var(--border-default))",
              }}
            >
              <AlertTriangle size={12} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
              {assessment.warnings.join(" · ")}
            </div>
          )}

          {/* Rows */}
          {assessment.rows.length === 0 ? (
            <div
              style={{
                padding: "30px",
                textAlign: "center",
                color: "var(--text-tertiary)",
                fontSize: 12,
              }}
            >
              {t("assessment.empty")}
            </div>
          ) : (
            <AssessmentTable rows={assessment.rows} />
          )}
        </>
      )}
    </div>
  );
}

function AssessmentTable({ rows }) {
  const { t } = useTranslation("inventory-nrv");
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "120px 80px 80px 120px 110px 110px 1fr",
          gap: 8,
          padding: "10px 14px",
          background: "var(--bg-surface-sunken)",
          borderBottom: "1px solid var(--border-default)",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
        }}
      >
        <div>{t("table.sku")}</div>
        <div style={{ textAlign: "end" }}>{t("table.age_days")}</div>
        <div style={{ textAlign: "end" }}>{t("table.qty")}</div>
        <div style={{ textAlign: "end" }}>{t("table.gross")}</div>
        <div style={{ textAlign: "end" }}>{t("table.writedown")}</div>
        <div style={{ textAlign: "end" }}>{t("table.nrv")}</div>
        <div>{t("table.band")}</div>
      </div>
      {rows.map((r, idx) => {
        const writedownNum = Number(r.writedownKwd);
        const tone =
          r.matchedBandPercent >= 5000
            ? "var(--semantic-danger)"
            : r.matchedBandPercent >= 1
            ? "var(--semantic-warning)"
            : "var(--text-primary)";
        return (
          <div
            key={r.itemId}
            style={{
              display: "grid",
              gridTemplateColumns: "120px 80px 80px 120px 110px 110px 1fr",
              gap: 8,
              padding: "10px 14px",
              borderBottom:
                idx === rows.length - 1 ? "none" : "1px solid var(--border-subtle)",
              fontSize: 12,
              alignItems: "center",
            }}
          >
            <LtrText>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  color: "var(--text-primary)",
                }}
              >
                {r.sku}
              </div>
            </LtrText>
            <LtrText>
              <div
                style={{
                  textAlign: "end",
                  fontFamily: "'DM Mono', monospace",
                  color: "var(--text-tertiary)",
                }}
              >
                {r.ageDays == null ? "—" : r.ageDays}
              </div>
            </LtrText>
            <LtrText>
              <div
                style={{
                  textAlign: "end",
                  fontFamily: "'DM Mono', monospace",
                  color: "var(--text-secondary)",
                }}
              >
                {r.currentQuantity}
              </div>
            </LtrText>
            <LtrText>
              <div
                style={{
                  textAlign: "end",
                  fontFamily: "'DM Mono', monospace",
                  color: "var(--text-primary)",
                }}
              >
                {r.grossValueKwd}
              </div>
            </LtrText>
            <LtrText>
              <div
                style={{
                  textAlign: "end",
                  fontFamily: "'DM Mono', monospace",
                  color: writedownNum > 0 ? tone : "var(--text-tertiary)",
                  fontWeight: writedownNum > 0 ? 600 : 400,
                }}
              >
                {r.writedownKwd}
              </div>
            </LtrText>
            <LtrText>
              <div
                style={{
                  textAlign: "end",
                  fontFamily: "'DM Mono', monospace",
                  color: "var(--text-primary)",
                  fontWeight: 600,
                }}
              >
                {r.nrvKwd}
              </div>
            </LtrText>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {r.matchedBandLabel ? (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: "var(--bg-surface-sunken)",
                    color: tone,
                    border: `1px solid ${tone}`,
                  }}
                >
                  {r.matchedBandLabel} · {(r.matchedBandPercent / 100).toFixed(2)}%
                </span>
              ) : (
                <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>
                  {r.note}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TotalCell({ label, value, tone }) {
  const color =
    tone === "danger"
      ? "var(--semantic-danger)"
      : tone === "primary"
      ? "var(--accent-primary)"
      : "var(--text-primary)";
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <LtrText>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 15,
            fontWeight: 700,
            color,
          }}
        >
          {value}
        </div>
      </LtrText>
    </div>
  );
}

function PolicyHistorySection({ policies, activeId, onDeactivate, acting }) {
  const { t } = useTranslation("inventory-nrv");
  if (policies === null) return null;
  const nonActive = (policies || []).filter((p) => p.id !== activeId);
  if (nonActive.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
          marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        {t("history.heading", { count: nonActive.length })}
      </div>
      <div
        style={{
          border: "1px solid var(--border-default)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {nonActive.map((p, idx) => (
          <div
            key={p.id}
            style={{
              padding: "10px 14px",
              borderBottom:
                idx === nonActive.length - 1 ? "none" : "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <LtrText>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    color: "var(--text-primary)",
                  }}
                >
                  {String(p.activeFrom).slice(0, 10)}
                  {p.activeUntil ? ` → ${String(p.activeUntil).slice(0, 10)}` : ` → ${t("history.current")}`}
                </span>
              </LtrText>
              {p.notes && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    marginTop: 2,
                  }}
                >
                  {p.notes}
                </div>
              )}
            </div>
            {!p.activeUntil && (
              <button
                onClick={() => onDeactivate(p.id)}
                disabled={acting != null}
                style={{
                  background: "transparent",
                  color: "var(--semantic-danger)",
                  border: "1px solid var(--semantic-danger-border)",
                  padding: "5px 10px",
                  borderRadius: 5,
                  cursor: acting != null ? "not-allowed" : "pointer",
                  fontSize: 10,
                  fontFamily: "inherit",
                  fontWeight: 600,
                }}
              >
                {acting === `deactivate-${p.id}` ? <Spinner size={10} /> : t("history.deactivate")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const btnPrimary = (l) => ({
  background: "var(--accent-primary)",
  color: "#fff",
  border: "none",
  padding: "9px 16px",
  borderRadius: 6,
  cursor: l ? "not-allowed" : "pointer",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "inherit",
});
