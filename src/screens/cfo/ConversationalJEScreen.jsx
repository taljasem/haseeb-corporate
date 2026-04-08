import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import AccountPicker from "../../components/cfo/AccountPicker";
import DirArrow from "../../components/shared/DirArrow";
import JournalEntryCard from "../../components/cfo/JournalEntryCard";
import { useTenant } from "../../components/shared/TenantContext";

function UserBubble({ children }) {
  return (
    <div data-bubble="user" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
      <div
        style={{
          maxWidth: "78%",
          background: "rgba(0,196,140,0.12)",
          border: "1px solid rgba(0,196,140,0.20)",
          borderRadius: 12,
          borderBottomRightRadius: 4,
          padding: "10px 14px",
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--text-primary)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function AminahBubble({ children, wide = false }) {
  return (
    <div data-bubble="aminah" style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
      <div
        style={{
          maxWidth: wide ? "100%" : "88%",
          width: wide ? "100%" : "auto",
          background: "var(--bg-surface-sunken)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          borderBottomLeftRadius: 4,
          padding: "12px 14px",
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--text-secondary)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ExchangeOne() {
  const { t } = useTranslation("conv-je");
  const [step, setStep] = useState(0);
  const [debit, setDebit] = useState(null);
  const [credit, setCredit] = useState(null);
  const [posted, setPosted] = useState(false);

  const amount = 30.0;
  const draft = debit && credit && {
    id: "JE-0421",
    description: t("cfo.cleaning_je_description"),
    status: "Draft - Validated",
    lines: [
      { account: debit.name, code: debit.code, debit: amount, credit: null },
      { account: credit.name, code: credit.code, debit: null, credit: amount },
    ],
    totalDebit: amount,
    totalCredit: amount,
    balanced: true,
    mappingVersion: "v1.0",
    createdAt: new Date().toISOString(),
    hashChainStatus: "ready",
  };

  return (
    <div>
      <UserBubble>{t("cfo.user_1")}</UserBubble>
      <AminahBubble>{t("cfo.aminah_1")}</AminahBubble>

      {step >= 0 && !debit && (
        <AminahBubble wide>
          <div style={{ marginBottom: 8, fontSize: 11, color: "var(--text-tertiary)", letterSpacing: "0.10em", fontWeight: 600 }}>
            {t("labels.expense_account")}
          </div>
          <AccountPicker
            filterCategories={["Operating Expenses"]}
            onSelect={(a) => {
              setDebit(a);
              setStep(1);
            }}
          />
        </AminahBubble>
      )}

      {debit && (
        <AminahBubble>
          {t("cfo.aminah_got_debit_prefix")}
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{debit.name}</span>
          {t("cfo.aminah_got_debit_suffix")}
        </AminahBubble>
      )}

      {debit && !credit && (
        <AminahBubble wide>
          <div style={{ marginBottom: 8, fontSize: 11, color: "var(--text-tertiary)", letterSpacing: "0.10em", fontWeight: 600 }}>
            {t("labels.cash_account")}
          </div>
          <AccountPicker
            filterCategories={["Assets"]}
            onSelect={(a) => {
              setCredit(a);
              setStep(2);
            }}
          />
        </AminahBubble>
      )}

      {draft && (
        <>
          <AminahBubble>{t("cfo.drafting")}</AminahBubble>
          <div style={{ maxWidth: "100%" }}>
            <JournalEntryCard
              entry={draft}
              state={posted ? "posted" : "draft-validated"}
              onConfirm={() => setPosted(true)}
              onEdit={() => {}}
              onDiscard={() => {
                setDebit(null);
                setCredit(null);
                setPosted(false);
              }}
              showAssign
              assignItemType="journal-entry"
            />
          </div>
          {!posted && <AminahBubble>{t("cfo.review_and_confirm")}</AminahBubble>}
          {posted && <AminahBubble>{t("cfo.posted")}</AminahBubble>}
        </>
      )}
    </div>
  );
}

function ExchangeTwo() {
  const { t } = useTranslation("conv-je");
  const { tenant } = useTenant();
  const bankName = tenant?.banks?.[0]?.abbreviation || "KIB";
  return (
    <div>
      <UserBubble>{t("cfo.user_2")}</UserBubble>
      <AminahBubble>
        {t("cfo.aminah_2", { bank: bankName })}{" "}
        <a
          style={{
            color: "var(--accent-primary)",
            fontWeight: 500,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {t("cfo.open_bank_tx")}
        </a>
      </AminahBubble>
    </div>
  );
}

function ExchangeThree() {
  const { t } = useTranslation("conv-je");
  return (
    <div>
      <UserBubble>{t("cfo.user_3")}</UserBubble>
      <AminahBubble>{t("cfo.aminah_3")}</AminahBubble>
    </div>
  );
}

// ─────────────────────────────────────────
// JUNIOR (Sara) exchanges — threshold flow
// ─────────────────────────────────────────

function JuniorExchangeOne() {
  const { t } = useTranslation("conv-je");
  const [step, setStep] = useState(0);
  const [debit, setDebit] = useState(null);
  const [credit, setCredit] = useState(null);
  const amount = 45.0;
  const draft = debit && credit && {
    id: "JE-0421",
    description: t("junior.office_supplies_description"),
    status: "Draft - Validated",
    lines: [
      { account: debit.name, code: debit.code, debit: amount, credit: null },
      { account: credit.name, code: credit.code, debit: null, credit: amount },
    ],
    totalDebit: amount,
    totalCredit: amount,
    balanced: true,
    mappingVersion: "v1.0",
    createdAt: new Date().toISOString(),
    hashChainStatus: step === 3 ? "extended" : "ready",
  };

  if (step === 0) {
    return (
      <div>
        <AminahBubble>{t("junior.greeting")}</AminahBubble>
        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
          <button
            onClick={() => setStep(1)}
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: "var(--accent-primary)",
              background: "var(--bg-selected)",
              border: "1px dashed rgba(0,196,140,0.30)",
              padding: "8px 14px",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t("junior.try_small_example")}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <AminahBubble>{t("junior.greeting")}</AminahBubble>
      <UserBubble>{t("junior.user_1")}</UserBubble>
      <AminahBubble>{t("junior.aminah_which_expense")}</AminahBubble>
      {!debit && (
        <AminahBubble wide>
          <div style={{ marginBottom: 8, fontSize: 11, color: "var(--text-tertiary)", letterSpacing: "0.10em", fontWeight: 600 }}>
            {t("labels.expense_account")}
          </div>
          <AccountPicker filterCategories={["Operating Expenses"]} onSelect={setDebit} />
        </AminahBubble>
      )}
      {debit && (
        <>
          <AminahBubble>{t("junior.aminah_which_petty")}</AminahBubble>
          {!credit && (
            <AminahBubble wide>
              <div style={{ marginBottom: 8, fontSize: 11, color: "var(--text-tertiary)", letterSpacing: "0.10em", fontWeight: 600 }}>
                {t("labels.petty_cash_account")}
              </div>
              <AccountPicker filterCategories={["Assets"]} onSelect={setCredit} />
            </AminahBubble>
          )}
        </>
      )}
      {draft && (
        <>
          <AminahBubble>{t("junior.drafting")}</AminahBubble>
          <JournalEntryCard
            entry={draft}
            state={step === 3 ? "posted" : "draft-validated"}
            onConfirm={() => setStep(3)}
          />
          {step !== 3 && (
            <AminahBubble>
              <Trans i18nKey="junior.under_threshold" ns="conv-je" components={{ b: <strong style={{ color: "var(--text-primary)", fontWeight: 500 }} /> }} />
            </AminahBubble>
          )}
          {step === 3 && (
            <AminahBubble>
              <Trans i18nKey="junior.posted_as" ns="conv-je" values={{ id: "JE-0421" }} components={{ b: <strong style={{ color: "var(--text-primary)", fontWeight: 500 }} /> }} />
            </AminahBubble>
          )}
        </>
      )}
    </div>
  );
}

function JuniorExchangeTwo({ onOpenTaskbox }) {
  const { t } = useTranslation("conv-je");
  const [step, setStep] = useState(0);
  const [debit, setDebit] = useState(null);
  const [credit, setCredit] = useState(null);
  const amount = 3200.0;
  const draft = debit && credit && {
    id: "JE-0428",
    description: t("junior.bonus_accrual_description"),
    status: step === 3 ? "Pending Approval" : "Draft - Validated",
    lines: [
      { account: debit.name, code: debit.code, debit: amount, credit: null },
      { account: credit.name, code: credit.code, debit: null, credit: amount },
    ],
    totalDebit: amount,
    totalCredit: amount,
    balanced: true,
    mappingVersion: "v1.0",
    createdAt: new Date().toISOString(),
    hashChainStatus: "not committed",
  };

  if (step === 0) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
          <button
            onClick={() => setStep(1)}
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: "var(--semantic-warning)",
              background: "rgba(212,168,75,0.06)",
              border: "1px dashed rgba(212,168,75,0.30)",
              padding: "8px 14px",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t("junior.try_large_example")}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <UserBubble>{t("junior.user_2")}</UserBubble>
      <AminahBubble>{t("junior.aminah_which_expense_bonus")}</AminahBubble>
      {!debit && (
        <AminahBubble wide>
          <div style={{ marginBottom: 8, fontSize: 11, color: "var(--text-tertiary)", letterSpacing: "0.10em", fontWeight: 600 }}>
            {t("labels.expense_account")}
          </div>
          <AccountPicker filterCategories={["Operating Expenses"]} onSelect={setDebit} />
        </AminahBubble>
      )}
      {debit && (
        <>
          <AminahBubble>{t("junior.aminah_which_liability")}</AminahBubble>
          {!credit && (
            <AminahBubble wide>
              <div style={{ marginBottom: 8, fontSize: 11, color: "var(--text-tertiary)", letterSpacing: "0.10em", fontWeight: 600 }}>
                {t("labels.liability_account")}
              </div>
              <AccountPicker filterCategories={["Liabilities"]} onSelect={setCredit} />
            </AminahBubble>
          )}
        </>
      )}
      {draft && (
        <>
          <AminahBubble>{t("junior.drafting")}</AminahBubble>
          <JournalEntryCard
            entry={draft}
            state={step === 3 ? "pending-approval" : "draft-validated"}
            onConfirm={() => setStep(3)}
          />
          {step !== 3 && (
            <AminahBubble>
              <Trans i18nKey="junior.over_threshold" ns="conv-je" components={{ b: <strong style={{ color: "var(--text-primary)", fontWeight: 500, fontFamily: "'DM Mono', monospace" }} /> }} />
            </AminahBubble>
          )}
          {step === 3 && (
            <>
              <AminahBubble>
                <Trans i18nKey="junior.sent_to_cfo" ns="conv-je" values={{ id: "TSK-0428" }} components={{ b: <strong style={{ color: "var(--text-primary)", fontWeight: 500 }} /> }} />
              </AminahBubble>
              <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 4 }}>
                <a
                  onClick={onOpenTaskbox}
                  style={{ fontSize: 11, color: "var(--accent-primary)", cursor: "pointer", marginInlineStart: 38 }}
                >
                  {t("junior.view_in_taskbox")}
                </a>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function JuniorExchangeThree({ onOpenBankTx }) {
  const { t } = useTranslation("conv-je");
  const { tenant } = useTenant();
  const bankName = tenant?.banks?.[0]?.abbreviation || "KIB";
  const accountName = `${bankName} Operating Account`;
  const [played, setPlayed] = useState(false);
  if (!played) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
        <button
          onClick={() => setPlayed(true)}
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "var(--text-tertiary)",
            background: "var(--bg-surface)",
            border: "1px dashed rgba(255,255,255,0.15)",
            padding: "8px 14px",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {t("junior.try_bank_example")}
        </button>
      </div>
    );
  }
  return (
    <div>
      <UserBubble>{t("junior.user_3")}</UserBubble>
      <AminahBubble>
        <Trans i18nKey="junior.aminah_bank_refuse" ns="conv-je" values={{ account: accountName }} components={{ b: <strong style={{ color: "var(--text-primary)", fontWeight: 500 }} /> }} />
      </AminahBubble>
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <a
          onClick={onOpenBankTx}
          style={{ fontSize: 11, color: "var(--accent-primary)", cursor: "pointer", marginInlineStart: 38 }}
        >
          {t("junior.go_to_bank_tx")}
        </a>
      </div>
    </div>
  );
}

export default function ConversationalJEScreen({ role = "CFO", onNavigate }) {
  const { t } = useTranslation("conv-je");
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "20px 28px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.15em",
            color: "var(--text-tertiary)",
            marginBottom: 4,
          }}
        >
          {t("header.label")}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>
          {t("header.sub")}
        </div>
      </div>

      {/* Scrollable chat area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 28px" }}>
          {role === "Junior" ? (
            <>
              <JuniorExchangeOne />
              <div style={{ height: 28 }} />
              <JuniorExchangeTwo onOpenTaskbox={() => onNavigate && onNavigate("taskbox")} />
              <div style={{ height: 28 }} />
              <JuniorExchangeThree onOpenBankTx={() => onNavigate && onNavigate("bank-transactions")} />
            </>
          ) : (
            <>
              <ExchangeOne />
              <div style={{ height: 28 }} />
              <ExchangeTwo />
              <div style={{ height: 28 }} />
              <ExchangeThree />
            </>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div
        style={{
          padding: "14px 28px 18px",
          borderTop: "1px solid rgba(255,255,255,0.10)",
          flexShrink: 0,
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", position: "relative" }}>
          <input
            className="chat-input"
            placeholder={t("input_placeholder")}
            style={{
              width: "100%",
              background: "var(--bg-surface-sunken)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10,
              padding: "14px 50px 14px 16px",
              color: "var(--text-primary)",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <button
            className="send-btn"
            style={{
              position: "absolute",
              right: 7,
              top: "50%",
              transform: "translateY(-50%)",
              width: 34,
              height: 34,
              background: "var(--accent-primary)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            <DirArrow />
          </button>
        </div>
      </div>
    </div>
  );
}
