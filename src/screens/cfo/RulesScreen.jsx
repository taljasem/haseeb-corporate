import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search } from "lucide-react";
import {
  getCategorizationRules,
  getRoutingRules,
  getSuggestedCategorizationRules,
  getSuggestedRoutingRules,
  muteCategorizationRule,
  unmuteCategorizationRule,
  deleteCategorizationRule,
  muteRoutingRule,
  unmuteRoutingRule,
  deleteRoutingRule,
} from "../../engine/mockEngine";
import CategorizationRuleRow from "../../components/rules/CategorizationRuleRow";
import RoutingRuleRow from "../../components/rules/RoutingRuleRow";
import SuggestedRuleRow from "../../components/rules/SuggestedRuleRow";
import NewCategorizationRuleModal from "../../components/rules/NewCategorizationRuleModal";
import NewRoutingRuleModal from "../../components/rules/NewRoutingRuleModal";

const TABS = [
  { id: "categorization", key: "categorization" },
  { id: "routing",        key: "routing" },
  { id: "suggested",      key: "suggested" },
];
const STATUS_FILTERS = ["all", "active", "muted", "deleted"];

export default function RulesScreen({ initialTab = "categorization" }) {
  const { t } = useTranslation("rules");
  const [tab, setTab] = useState(initialTab);
  const [statusFilter, setStatusFilter] = useState("active");
  const [query, setQuery] = useState("");
  const [catRules, setCatRules] = useState(null);
  const [routeRules, setRouteRules] = useState(null);
  const [catSuggestions, setCatSuggestions] = useState([]);
  const [routeSuggestions, setRouteSuggestions] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catModalPrefill, setCatModalPrefill] = useState(null);
  const [catEditingRule, setCatEditingRule] = useState(null);
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [routeEditingRule, setRouteEditingRule] = useState(null);
  const [toast, setToast] = useState(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    getCategorizationRules("all").then(setCatRules);
    getRoutingRules("all").then(setRouteRules);
    getSuggestedCategorizationRules().then(setCatSuggestions);
    getSuggestedRoutingRules().then(setRouteSuggestions);
  }, [tick]);

  const toast2 = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const rulesInTab = () => {
    let arr = [];
    if (tab === "categorization") arr = catRules || [];
    if (tab === "routing")        arr = routeRules || [];
    if (statusFilter !== "all") arr = arr.filter((r) => r.status === statusFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter((r) => r.name.toLowerCase().includes(q));
    }
    return arr;
  };

  const suggestionsInTab = () => {
    let arr = [...catSuggestions, ...routeSuggestions];
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter((s) =>
        (s.merchant || s.description || "").toLowerCase().includes(q)
      );
    }
    return arr;
  };

  const totalActive = (catRules || []).filter((r) => r.status === "active").length
                    + (routeRules || []).filter((r) => r.status === "active").length;

  const catCount    = (catRules || []).filter((r) => r.status === "active").length;
  const routeCount  = (routeRules || []).filter((r) => r.status === "active").length;
  const sugCount    = catSuggestions.length + routeSuggestions.length;

  const handleMute = async (rule) => {
    if (tab === "categorization") {
      if (rule.status === "muted") await unmuteCategorizationRule(rule.id);
      else await muteCategorizationRule(rule.id);
    } else {
      if (rule.status === "muted") await unmuteRoutingRule(rule.id);
      else await muteRoutingRule(rule.id);
    }
    refresh();
    toast2(rule.status === "muted" ? t("toast.rule_reactivated") : t("toast.rule_muted"));
  };

  const handleDelete = async (rule) => {
    if (tab === "categorization") await deleteCategorizationRule(rule.id);
    else                           await deleteRoutingRule(rule.id);
    refresh();
    toast2(t("toast.rule_deleted"));
  };

  const handleCreateSuggestion = (s) => {
    if (s.kind === "categorization") {
      setCatModalPrefill({ name: `${s.merchant} auto-categorization`, merchant: s.merchant });
      setCatModalOpen(true);
    } else {
      setRouteModalOpen(true);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "20px 28px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 28,
                color: "#E6EDF3",
                letterSpacing: "-0.3px",
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
                color: "#5B6570",
                marginTop: 6,
              }}
            >
              {t("active_count", { count: totalActive })}
            </div>
          </div>
          <button
            onClick={() => {
              if (tab === "routing") setRouteModalOpen(true);
              else { setCatModalPrefill(null); setCatModalOpen(true); }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#00C48C",
              color: "#fff",
              border: "none",
              padding: "9px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            <Plus size={14} strokeWidth={2.4} />
            {t("new_rule")}
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {TABS.map((tb) => {
            const on = tab === tb.id;
            const count = tb.id === "categorization" ? catCount : tb.id === "routing" ? routeCount : sugCount;
            return (
              <button
                key={tb.id}
                onClick={() => { setTab(tb.id); setExpandedId(null); }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: on ? "#00C48C" : "#5B6570",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: on ? "inset 0 -2px 0 #00C48C" : "none",
                }}
              >
                {t(`tabs.${tb.key}`)}
                <span style={{ color: "#5B6570", marginInlineStart: 6, fontWeight: 500 }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* Filter row */}
        {tab !== "suggested" && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              {STATUS_FILTERS.map((f) => {
                const on = statusFilter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "5px 12px",
                      borderRadius: 14,
                      background: on ? "rgba(0,196,140,0.10)" : "rgba(255,255,255,0.02)",
                      border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                      color: on ? "#00C48C" : "#5B6570",
                      cursor: "pointer",
                      textTransform: "capitalize",
                      fontFamily: "inherit",
                    }}
                  >
                    {t(`status_filters.${f}`)}
                  </button>
                );
              })}
            </div>
            <div style={{ position: "relative", width: 260 }}>
              <Search
                size={13}
                color="#5B6570"
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search_placeholder")}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 8,
                  padding: "8px 12px 8px 30px",
                  color: "#E6EDF3",
                  fontSize: 12,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            margin: "12px 28px 0",
            background: "rgba(0,196,140,0.10)",
            border: "1px solid rgba(0,196,140,0.30)",
            color: "#00C48C",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {toast}
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "categorization" &&
          rulesInTab().map((r) => (
            <CategorizationRuleRow
              key={r.id}
              rule={r}
              expanded={expandedId === r.id}
              onToggle={(rr) => setExpandedId(expandedId === rr.id ? null : rr.id)}
              onEdit={(rule) => { setCatEditingRule(rule); setCatModalOpen(true); }}
              onMute={handleMute}
              onDelete={handleDelete}
            />
          ))}
        {tab === "routing" &&
          rulesInTab().map((r) => (
            <RoutingRuleRow
              key={r.id}
              rule={r}
              expanded={expandedId === r.id}
              onToggle={(rr) => setExpandedId(expandedId === rr.id ? null : rr.id)}
              onEdit={(rule) => { setRouteEditingRule(rule); setRouteModalOpen(true); }}
              onMute={handleMute}
              onDelete={handleDelete}
            />
          ))}
        {tab === "suggested" &&
          suggestionsInTab().map((s) => (
            <SuggestedRuleRow
              key={s.id}
              suggestion={s}
              onCreate={handleCreateSuggestion}
              onDismiss={() => toast2(t("suggested.suggestion_dismissed"))}
            />
          ))}
      </div>

      <NewCategorizationRuleModal
        open={catModalOpen}
        onClose={() => { setCatModalOpen(false); setCatEditingRule(null); setCatModalPrefill(null); }}
        prefill={catModalPrefill}
        editingRule={catEditingRule}
        onCreated={(r) => {
          refresh();
          toast2(catEditingRule ? t("toast.rule_updated", { name: r.name }) : t("toast.rule_created", { name: r.name }));
          setCatEditingRule(null);
        }}
      />
      <NewRoutingRuleModal
        open={routeModalOpen}
        onClose={() => { setRouteModalOpen(false); setRouteEditingRule(null); }}
        editingRule={routeEditingRule}
        onCreated={(r) => {
          refresh();
          toast2(routeEditingRule ? t("toast.rule_updated", { name: r.name }) : t("toast.rule_created", { name: r.name }));
          setRouteEditingRule(null);
        }}
      />
    </div>
  );
}
