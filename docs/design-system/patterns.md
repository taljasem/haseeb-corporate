# Design-System Patterns — Haseeb Corporate

Short-form reference for two patterns first adopted during the P1 token + i18n waves. Both are codebase conventions now; reuse them rather than inventing variants.

HASEEB-176 — documentation added post-P1 so future contributors reuse the same APIs.

---

## `color-mix` for alpha-over-token

Use `color-mix(in srgb, <color> N%, transparent)` when you need a translucent fill or border **derived from an existing token** (so it stays theme-correct).

### Browser support

- Chrome 111+, Safari 16.2+, Firefox 113+.
- Within target browser matrix for this product. No polyfill needed.

### When to use

- You have a semantic or role token (e.g. `var(--semantic-warning)`, `var(--role-owner)`, `var(--tier-ai)`) and need a low-opacity fill or border derived from it.
- The same translucent value must work under both dark and light themes without re-authoring per-theme rgba literals.
- Inline-style component APIs that accept a dynamic `color` argument — `color-mix(in srgb, ${color} 10%, transparent)` works whether `color` is a hex literal or a `var(--…)` token. The older `${color}1A` hex-alpha concat pattern silently produced invalid CSS when `color` was already a token.

### When NOT to use

- If the design system already exposes a `-subtle` / `-border` triplet for the semantic role (e.g. `--accent-primary-subtle`, `--accent-primary-border`, `--semantic-danger-subtle`, `--tier-ai-subtle`), **use those tokens directly**. `color-mix` is for ad-hoc derivation, not for re-deriving what the token system already provides.
- Do not reach for `color-mix` just to save a few characters over a named token. Named tokens document intent; `color-mix` does not.

### Percentages used in this codebase

- **6%** — very subtle fill (CTA row backgrounds).
- **10%** — standard pill / chip fill.
- **20%** — subtle border on tinted surfaces.
- **25%** — standard pill border.
- **35%** — stronger border on status toasts.
- **40%** — disabled-state fill derived from the active button color.

### Example sites

- `887083d` (P1 Wave 1) — `src/components/reconciliation/ReconciliationScreen.jsx` ConfidencePill / TierPill / ExceptionRow typeLabel: dynamic `color` argument needs `color-mix(in srgb, ${color} 10%, transparent)` / `25%`.
- `887083d` (P1 Wave 1) — same file, bulk-rule / AI-tier CTA row: `color-mix(in srgb, var(--tier-ai) 6%, transparent)` / `20%`.
- `15a98c2` (P1 D6) — `src/components/variance/FlagVarianceModal.jsx`: disabled submit button uses `color-mix(in srgb, var(--semantic-warning) 40%, transparent)` for the fill.

---

## `<Trans>` + `<LtrText>` for Arabic word order

Use `<Trans>` with a component replacement map when **numeric or Latin-script tokens need to appear at specific positions within Arabic prose** and raw interpolation would misplace them under RTL.

### When to use

- The string contains an embedded number, date, reference code, or Latin-script word that must stay LTR-ordered inside otherwise-Arabic prose.
- Raw `t('key', { count, total })` produces visually wrong placement under RTL because the interpolated values absorb the surrounding bidi context.
- The number or token has semantic significance (a counter, a total, an ID) — wrapping it in `<LtrText>` also flips any embedded digits back to LTR reading order inside mixed scripts.

### Pattern

```jsx
import { Trans } from "react-i18next";
import LtrText from "./LtrText"; // or whichever relative path applies

<Trans
  i18nKey="namespace:key.path"
  values={{ count, total }}
  components={{ l: <LtrText /> }}
/>
```

With locale templates like:

```json
// en/namespace.json
"key": { "path": "<l>{{count}}</l> of <l>{{total}}</l> mapped" }

// ar/namespace.json
"key": { "path": "<l>{{count}}</l> من أصل <l>{{total}}</l> معين" }
```

The `components={{ l: <LtrText /> }}` map binds the `<l>` placeholder in the translation string to an `<LtrText>` React element at render time.

### When NOT to use

- Plain text interpolation with no positioning concerns — standard `t('key', values)` is fine. `<Trans>` pays a small readability cost; don't spend it unless a token's position or reading order actually matters.
- Single-token strings where the token is the whole value (e.g. `t('count', { n })` returning just the number). A wrapping `<LtrText>{count}</LtrText>` around the `t(...)` call is simpler.

### Example sites

- `f6c2c1b` (P1 Wave 2) — `src/screens/cfo/MigrationStep3Mapping.jsx` counter: `<l>{{count}}</l> of <l>{{total}}</l> mapped` — avoids Arabic flipping the "X of Y" counter into a misread order.

---

## Related tokens

Tokens referenced above live in `src/styles/themes.css` under the dark and light `html[data-theme="..."]` blocks. Representative families:

- **Roles** — `--role-owner`, `--role-cfo`, `--role-junior` (role identity pills / badges).
- **Tiers** — `--tier-ai`, `--tier-ai-subtle`, `--tier-ai-border` (AI-tier / bulk-rule accents; distinct from `--role-owner` post HASEEB-174).
- **Semantic** — `--semantic-success` / `-subtle`, `--semantic-warning` / `-subtle`, `--semantic-danger` / `-subtle` / `-border`, `--semantic-info` / `-subtle`.
- **Accent** — `--accent-primary` / `-hover` / `-subtle` / `-border` / `-text`.

Prefer the `-subtle` / `-border` variants over manually `color-mix`-ing the base token when a variant exists.
