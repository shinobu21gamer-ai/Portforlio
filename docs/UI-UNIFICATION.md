# UI unification — POS & HRMS are one product

**Status:** done (both builds + full test suite green)
**Files that must stay byte-identical:** `frontend/src/app-shell.css` ↔ `frontend-hrms/src/app-shell.css`,
`frontend/src/components/BrandMark.jsx` ↔ `frontend-hrms/src/components/BrandMark.jsx`

## Why

The two SPAs looked like different products: different rails, different page headers,
different sign-in screens, different modals — and no shared shell vocabulary at all.
Two *systemic* causes accounted for most of the visible difference:

1. **No `box-sizing` reset in the POS.** HRMS ships `*, *::before, *::after { box-sizing: border-box }`
   in `design-system.css`; the POS shipped none. Every padded/bordered element in the
   register was therefore bigger than it declared — the rail rendered **272px** instead of
   248px and each nav row **60px** instead of 40px, while the identical classes in HRMS
   rendered the declared size. Fixed once in `app-shell.css` (§1b).
2. **No `body` margin reset in the POS.** HRMS carries `html, body { margin: 0 }`; the POS
   did not, so the whole app rendered inset inside the browser's default `body { margin: 8px }`
   with a ring of page colour around it.

Measured after the fix, same viewport (1440×900):

| | POS | HRMS |
|---|---|---|
| rail | 248px @ x14 y19 | 248px @ x14 y19 |
| main panel | x276, padding 30px | x276, padding 30px |
| nav row | 40px · 12.5px/650 · pad 9/11 | 40px · 12.5px/650 · pad 9/11 |
| table wrap | r15, `#e4e9f1` | r15, `#e4e9f1` |

Remaining difference is composition only: the register adds a third column (cart) and the
HRMS panel keeps a 1560px max-width.

## The contract

`app-shell.css` is loaded **last** in both `main.jsx` and owns:

| Section | Owns |
|---|---|
| 1 | `--shell-rail-w/-gap/-pad/-radius/-max-w`, `--shell-band-h`, `--app-canvas`, `--rail-*` |
| 1b | base reset parity (`box-sizing`, `html/body` margin) |
| 2 | the rail: `.pos-shell .sidebar` ≡ `.hrms-sidebar`, items `.sidebar-btn` / `.nav-item` / `.sidebar-signout`, `.nav-child`, `.nav-badge`, `.sidebar-user`/`.user-info` |
| 3 | the content panel: `.pos-shell .main` ≡ `.hrms-main`, HRMS topbar as a flush panel header |
| 4 | page headers `.page-header` / `.pos-header` / `.finance-header` |
| 5 | sign-in surfaces `.auth-page`/`.login-page`, `.auth-card`/`.login-card`, `.auth-lockup`, `.login-brand`/`.login-header` |
| 5b | modal + confirm-dialog chrome: both class families, plus `.confirm-dialog` |
| 6 | status/error/notice surfaces: `.page-error-wrap`, `.error-state`, `.pay-status-*`, `.pay-notice`, `.wallet-*`, `.pay-steps`, 404 |
| 7 | responsive at 1100 / 900 / 560px |

Legacy class names are all still supported, so no page had to be rewritten.

## Gotchas (learned the hard way)

- **Specificity.** App stylesheets scope the same components more tightly than a bare
  element+class (`.pos-shell .pos-header { align-items: center }` in `ui-polish.css` beat the
  shared `.pos-header` rule and left the POS header centred after it had stacked into a
  column). Shared rules therefore repeat themselves with the scoped selectors —
  `.pos-shell .pos-header`, `.hrms-main .page-header`, … — rather than relying on load order.
- **Components, not just CSS.** `ConfirmDialog.jsx` had forked *markup*: the POS copy used
  centred inline styles and closed unconditionally while HRMS had `.confirm-dialog` markup,
  async `onConfirm`, `loading` and `preventClose`. The POS now mirrors HRMS. `Modal` is one
  API in both apps (`open/onClose/title/size/wide/preventClose/showCloseButton`).
- **`.brand-lockup` is a full-width flex row**, so `margin: 0 auto` on the wrapper does not
  centre the mark; centre with `justify-content` on the lockup.
- Sync check after every edit:
  `diff -q frontend/src/app-shell.css frontend-hrms/src/app-shell.css`

## Fixes that came out of the pass

- `TotalP44.00` on the payment screen — `.pay-summary-total` was the only summary row
  without `display:flex/justify-content:space-between` (its sibling `.pay-summary-row` had it).
- `page-error-wrap` was used ~40 times across both apps and defined in **neither**; a failed
  fetch collapsed to the top of the page with no rhythm. Now a centred card.
- `.receipt-date`, `.receipt-invoice` and `.receipt-80mm` were referenced by the on-screen
  80mm slip but never styled.
- HRMS `MyLeaves` had a hand-rolled `.modal-overlay/.modal` with an inline `maxWidth` and an
  `✕` cancel button; it now uses the shared `Modal`.
- The POS 404 and HRMS 404 were two unrelated screens; both are now the same card and copy.
- `.login-card` had `max-width: none`, so a `.login-card` rendered outside `.auth-shell`
  stretched to 1380px.

## Still open

- Dark-mode inline-style audit, modal focus traps + `aria-live` toasts, per-role
  quick-actions bar, ⌘K palette (the rest of P3 in `IMPROVEMENT_PLAN.md`).
