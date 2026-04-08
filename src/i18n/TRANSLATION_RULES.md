# Translation Rules — Haseeb Corporate

Permanent source of truth for all translation work. Every translation step prompt references this file.

## SCOPE DISCIPLINE

### NEVER touch
- src/utils/format.js (currency, date, number formatting is off-limits)
- Tenant configuration architecture (TenantContext, _brandObj transformer)
- NavContext architecture
- Deterministic engine functions in mockEngine.js (engine logic is immutable; only narration strings get translated when explicitly in scope)
- Any English-language behavior

### NEVER do during translation work
- RTL layout fixes outside the dedicated RTL pass step (note them in output, fix them in RTL step)
- Translate screen-specific content during chrome steps
- Translate chrome content during screen-specific steps
- Add new functionality
- Refactor component structure beyond what is needed to add t() calls

### Always flag (do not fix silently)
- Anything that touches files outside the declared scope of the current step
- Anything that breaks the build
- Any decision that requires the architect (Tarek)
- Strings with ambiguous translation

### Permission granted
- Fix trivial errors inline (missing imports, JSON syntax errors, build errors caused by translation refactor itself)
- Add necessary imports (useTranslation, LtrText)
- Reorganize JSON namespace files for clarity if they get unwieldy

## I18N ARCHITECTURE

### File structure
src/i18n/index.js (i18next configuration)
src/i18n/LanguageContext.jsx (LanguageProvider + useLanguage hook)
src/i18n/TRANSLATION_RULES.md (this file)
src/i18n/locales/en/[17 namespace files]
src/i18n/locales/ar/[17 namespace files]

Namespaces: common, header, sidebar, hero, taskbox, bank-accounts, bank-transactions, rules, reconciliation, financial, audit, close, team, manual-je, conv-je, aminah, notifications.

### Component pattern
import { useTranslation } from "react-i18next";
const { t } = useTranslation("namespace-name");
const { t: tc } = useTranslation("common"); // when needed as secondary

Use t() for all user-facing strings: labels, headers, buttons, placeholders, tooltips, modals, toasts, status pills, narration, validation messages.

### Interpolation
{t("labels.day_of", { day: 5, total: 8 })}
JSON: "day_of": "DAY {{day}} OF {{total}}"

### What does NOT get translated
- Badge counts and raw numbers
- Tenant data (company names, bank names, role-holder names from tenant config)
- Account codes (1110, 6200)
- JE IDs, transaction IDs, reference numbers
- Email addresses, URLs
- Currency amounts (handled by format.js)
- Engine constants

## TRANSLATION REGISTER

Modern Standard Arabic (MSA) for all UI strings. Not Kuwaiti dialect. Not classical Arabic.

Gulf finance professional terminology over literal translation. When choosing between literal Arabic and the term used on Gulf bank statements, audit reports, and finance org charts, always choose the latter.

Examples:
- Ledger = دفتر الأستاذ
- Reconciliation = التسويات البنكية or التسويات
- Approval = اعتماد (not موافقة)
- Balance = الرصيد (not التوازن)

Tone: professional, direct, terse. Match the English copys brevity.

## NUMERALS

Use Western Arabic numerals (1, 2, 3, 4, 5, 6, 7, 8, 9, 0) everywhere. Never use Eastern Arabic numerals (٠، ١، ٢، ٣، ٤، ٥، ٦، ٧، ٨، ٩).

Applies to: years, day counts, audit fractions, percentages, currency amounts, all quantities. Consistent with Standalone product rule.

## CURRENCY

Symbols:
- KWD = د.ك
- USD = دولار (text label) or $ (symbol)
- EUR = يورو (text label) or € (symbol)
- SAR = ر.س
- AED = د.إ

KWD always renders with 3 decimal places. USD/EUR with 2. All currency formatting handled by src/utils/format.js (off-limits). Translation layer provides currency symbol/label string only.

In Arabic, amount comes BEFORE currency label: 1,250.000 د.ك. Amount stays LTR via DM Mono class or LtrText wrapper.

## ROLE NAMES (LOCKED)

Canonical Arabic for each role. Locked. Used everywhere. Any deviation must be flagged.

- Owner = المالك
- CFO = المدير المالي
- Senior Accountant = محاسب أول
- Junior Accountant = محاسب مساعد (NOT محاسب مبتدئ — that is wrong register)
- AP Specialist = محاسب الذمم الدائنة
- AR Specialist = محاسب الذمم المدينة

Wrong translations to remove on sight:
- محاسب مبتدئ (beginner accountant — wrong register, education context, not Gulf finance)
- محاسب صغير (condescending)

New roles require architect sign-off before being added.

## LtrText PATTERN

src/components/shared/LtrText.jsx wraps Latin-only or numeric-only substrings inside RTL containers.

Why: Unicode Bidirectional Algorithm reorders Latin substrings inside RTL contexts in ways that look wrong (periods at end of company names get pushed to the left). Wrapping in span with dir="ltr" and unicode-bidi: embed forces correct rendering.

Always wrap:
- Company names from tenant config
- Personal names in Latin (SARA AL-AHMADI, NOOR KANDARI, etc.)
- Bank abbreviations (KIB, BBY, BNK, NBK, KFH)
- Account numbers
- Account codes (1110, 6200)
- JE IDs (JE-0421, JE-MAN-0501)
- Reference numbers, transaction IDs
- Currency amounts (also handled by DM Mono but LtrText is safer for embedded references)
- Percentages (94%, 12.4%)
- Fractions (14/15, 25/30)
- Email addresses
- URLs and domains
- Version strings
- Years embedded in Arabic text

When in doubt, wrap it. Cost of unnecessary wrap is zero. Cost of missing one is visible bidi corruption.

Pattern:
import LtrText from "../shared/LtrText";
<LtrText>{tenant.company.name.toUpperCase() + "."}</LtrText>
{t("hero.audit_label")} <LtrText>{passing}/{total}</LtrText>

## PER-STEP POST-BUILD RITUAL

After every translation step build:
1. git add all changes
2. git commit with the step commit message (provided in prompt)
3. git push to main
4. Wait for Vercel deploy
5. Output the deployment URL
6. Walk the verification checklist provided in the step
7. Note any issues
8. Note any RTL layout issues for the dedicated RTL pass step (do not fix inline)
9. List all files created and modified

## INLINE ERROR HANDLING

Permission to fix inline without asking:
- Missing imports
- JSON syntax errors (typos, trailing commas)
- Component prop type mismatches caused by translation refactor
- Build errors caused by the translation work itself

Do NOT fix inline (always flag):
- Pre-existing bugs unrelated to translation
- Architecture changes
- New functionality
- Anything that touches files outside the declared scope
