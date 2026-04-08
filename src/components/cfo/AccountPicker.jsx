import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getChartOfAccounts } from "../../engine/mockEngine";
import LtrText from "../shared/LtrText";

const CATEGORIES = [
  { id: "Operating Expenses", key: "cat_operating_expenses" },
  { id: "Cost of Goods Sold", key: "cat_cogs" },
  { id: "Revenue", key: "cat_revenue" },
  { id: "Assets", key: "cat_assets" },
  { id: "Liabilities", key: "cat_liabilities" },
  { id: "Equity", key: "cat_equity" },
  { id: "Other Income", key: "cat_other_income" },
  { id: "Other Expense", key: "cat_other_expense" },
];

const CATEGORY_KEY_BY_ID = CATEGORIES.reduce((acc, c) => ({ ...acc, [c.id]: c.key }), {});

function AccountRow({ account, onPick, active = false }) {
  const { t } = useTranslation("common");
  const catKey = CATEGORY_KEY_BY_ID[account.category];
  const catLabel = catKey ? t(`account_picker.${catKey}`) : account.category;
  return (
    <button
      onClick={() => onPick(account)}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = active ? "rgba(0,196,140,0.06)" : "transparent")
      }
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "10px 12px",
        background: active ? "rgba(0,196,140,0.06)" : "transparent",
        border: "none",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: "pointer",
        textAlign: "start",
        fontFamily: "inherit",
      }}
    >
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 12,
          color: "#5B6570",
          minWidth: 44,
        }}
      >
        <LtrText>{account.code}</LtrText>
      </span>
      <span style={{ flex: 1, fontSize: 13, color: "#E6EDF3" }}>{account.name}</span>
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.10em",
          color: "#5B6570",
          fontWeight: 600,
          textTransform: "uppercase",
        }}
      >
        {catLabel}
      </span>
    </button>
  );
}

/**
 * Reusable account picker.
 * Props:
 *  - filterCategories: array of category names to limit to (optional)
 *  - onSelect: callback(account)
 *  - selected: optional pre-selected account
 */
export default function AccountPicker({ filterCategories = null, onSelect, selected: initial = null }) {
  const { t } = useTranslation("common");
  const [accounts, setAccounts] = useState(null);
  const [mode, setMode] = useState("dropdown"); // dropdown | categories | category-detail
  const [activeCategory, setActiveCategory] = useState(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initial);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getChartOfAccounts().then((all) => {
      const filtered = filterCategories ? all.filter((a) => filterCategories.includes(a.category)) : all;
      setAccounts(filtered);
    });
  }, [filterCategories]);

  const visibleCategories = useMemo(() => {
    if (!accounts) return [];
    const set = new Set(accounts.map((a) => a.category));
    return CATEGORIES.filter((c) => set.has(c.id));
  }, [accounts]);

  const filteredDropdown = useMemo(() => {
    if (!accounts) return [];
    const q = query.trim().toLowerCase();
    if (!q) return accounts.slice(0, 50);
    return accounts.filter(
      (a) =>
        a.code.includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }, [accounts, query]);

  const accountsInCategory = useMemo(() => {
    if (!accounts || !activeCategory) return [];
    return accounts.filter((a) => a.category === activeCategory);
  }, [accounts, activeCategory]);

  const pick = (a) => {
    setSelected(a);
    setOpen(false);
    onSelect && onSelect(a);
  };

  // Selected confirmation card
  if (selected) {
    return (
      <div
        style={{
          background: "rgba(0,196,140,0.05)",
          border: "1px solid rgba(0,196,140,0.25)",
          borderRadius: 8,
          padding: "12px 14px",
        }}
      >
        <div style={{ fontSize: 10, color: "#5B6570", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6 }}>
          {t("account_picker.selected")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#5B6570" }}>
            <LtrText>{selected.code}</LtrText>
          </span>
          <span style={{ flex: 1, fontSize: 14, color: "#E6EDF3", fontWeight: 500 }}>
            {selected.name}
          </span>
          <button
            onClick={() => setSelected(null)}
            style={{
              fontSize: 11,
              color: "#00C48C",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t("account_picker.change")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 10,
        padding: 14,
      }}
    >
      {mode === "dropdown" && (
        <>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={t("account_picker.search_placeholder")}
            className="chat-input"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10,
              padding: "12px 14px",
              color: "#E6EDF3",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          {open && (
            <div
              style={{
                marginTop: 8,
                maxHeight: 320,
                overflowY: "auto",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                background: "rgba(5,7,10,0.6)",
              }}
            >
              {filteredDropdown.length > 0 ? (
                filteredDropdown.map((a) => (
                  <AccountRow key={a.code} account={a} onPick={pick} />
                ))
              ) : (
                <div style={{ padding: 14, fontSize: 12, color: "#5B6570" }}>{t("account_picker.no_matches")}</div>
              )}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <a
              onClick={() => {
                setMode("categories");
                setOpen(false);
              }}
              style={{
                fontSize: 12,
                color: "#00C48C",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              {t("account_picker.browse_by_category")}
            </a>
          </div>
        </>
      )}

      {mode === "categories" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            {visibleCategories.map((cat) => {
              const count = accounts.filter((a) => a.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setMode("category-detail");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 8,
                    cursor: "pointer",
                    color: "#E6EDF3",
                    fontFamily: "inherit",
                    fontSize: 13,
                    textAlign: "start",
                  }}
                >
                  <span>{t(`account_picker.${cat.key}`)}</span>
                  <span style={{ fontSize: 10, color: "#5B6570", fontFamily: "'DM Mono', monospace" }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 12 }}>
            <a
              onClick={() => setMode("dropdown")}
              style={{
                fontSize: 12,
                color: "#00C48C",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              {t("account_picker.search_all")}
            </a>
          </div>
        </>
      )}

      {mode === "category-detail" && (
        <>
          <a
            onClick={() => {
              setMode("categories");
              setActiveCategory(null);
            }}
            style={{
              fontSize: 12,
              color: "#5B6570",
              cursor: "pointer",
              display: "inline-block",
              marginBottom: 8,
            }}
          >
            {t("account_picker.all_categories")}
          </a>
          <div
            style={{
              maxHeight: 320,
              overflowY: "auto",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8,
              background: "rgba(5,7,10,0.6)",
            }}
          >
            {accountsInCategory.map((a) => (
              <AccountRow key={a.code} account={a} onPick={pick} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
