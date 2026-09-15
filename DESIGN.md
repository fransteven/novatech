# NovaTech — Archivo Control Deck

NovaTech is an operations console for a retailer handling physical, serialized stock. The interface is deliberately light-first, dense without becoming cramped, and built around a single operational signal: orange. It should feel like working over a precise paper ledger with aluminum equipment labels, not like a generic SaaS dashboard.

## Foundation

All design tokens live in `src/app/globals.css` as `--tf-*` OKLCH custom properties. Shadcn semantic tokens map to them, so UI primitives inherit the system instead of introducing literal colors.

| Token family | Purpose |
| --- | --- |
| `--tf-paper`, `--tf-aluminum`, `--tf-ink` | Canvas, opaque working surfaces, and carbon text |
| `--tf-accent` | Orange signal for a committed action, active row, scan affordance, or trace rail |
| `--tf-fg*`, `--tf-border*` | Four text levels and quiet structural separation |
| `--tf-green`, `--tf-amber`, `--tf-red` | Semantic status only; never decoration |

Orange is approximately `#FD3706` / `oklch(0.64 0.245 32)`. Text over an orange primary control uses `--tf-accent-ink` (carbon), never small white text. Dark mode retains the same hierarchy with carbon surfaces and clearer borders.

## Typography and data

- UI: Archivo via `next/font/google`.
- Identifiers, IMEI, money and timestamps: IBM Plex Mono with tabular numerals (`.mono`).
- Headings are compact and tracked tightly; labels are uppercase mono only where they add scanning value.
- The spacing unit is 4px. Use 4, 8, 12, 16, 20, 24, 32, 40 and 48px rather than arbitrary gaps.

## Materials and depth

Tables, forms, totals, cards and drawers have opaque surfaces. The app uses borders and restrained color shifts for normal depth; shadows are reserved for floating controls, popovers, dialogs and sheets. Glass is permitted only for chrome or overlay header/footer regions and degrades to opaque surfaces when blur is unsupported or reduced transparency is requested.

## Signature: trace rail

The 1–2px orange trace rail is NovaTech's visual signature. Use it sparingly on the page heading, the primary KPI, an active/selected table row, scanner state and inspection timeline. Pair it with a small mono code or dot when useful. It identifies a record moving through receiving, serialisation, sale and cash control; it is not decoration.

## Layout and responsive behavior

- Sidebar: 68px collapsed / 232px expanded. It becomes a Sheet below 768px and disappears below 640px except via the topbar menu.
- Topbar: 56px, sticky chrome. Every main page exposes a skip link and `main#main-content`.
- Page shell: `wide`, `standard`, `narrow`, and `workspace` variants share responsive gutters.
- Tables remain dense on desktop and become labelled record cards under 768px. Detail inspection is a right sheet (480px default; wider only for calendars/workflows) and is fullscreen on phones. Mutating work stays in a Dialog; irreversible work uses AlertDialog.

## Motion and accessibility

- Hover/press: 120–140ms; selection: 160–180ms; popovers/dialogs: 200–220ms; sidebar/sheets: 240–260ms.
- Use `cubic-bezier(.2,.8,.2,1)`, opacity and transforms only. No bounce.
- Honor reduced motion and reduced transparency. Keyboard focus, selected state and semantic labels cannot rely on color alone. Coarse targets are at least 44px.
