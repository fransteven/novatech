# NovaTech Design System

> **Current version** — supersedes any prior emerald/no-indigo rule. Accent is now **indigo (OKLCH)**.

## Tokens

All design tokens are OKLCH, defined as `--tf-*` CSS custom props in `src/app/globals.css`.
Shadcn semantic names (`--primary`, `--muted`, `--border`, etc.) are mapped to `--tf-*` — update the design tokens, shadcn components follow automatically.

### Colors

| Token | Light | Dark | Use |
|---|---|---|---|
| `--tf-bg` | `oklch(0.99 0.003 80)` | `oklch(0.16 0.01 260)` | Page background |
| `--tf-bg-elev` | `oklch(1 0 0)` | `oklch(0.2 0.012 260)` | Cards, sidebar, panels |
| `--tf-bg-muted` | `oklch(0.97 0.004 80)` | `oklch(0.22 0.012 260)` | Hover, table headers, muted zones |
| `--tf-border` | `oklch(0.92 0.005 80)` | `oklch(0.28 0.012 260)` | Default borders |
| `--tf-border-strong` | `oklch(0.88 0.006 80)` | `oklch(0.34 0.014 260)` | Input borders, strong dividers |
| `--tf-fg` | `oklch(0.18 0.01 260)` | `oklch(0.97 0.004 260)` | Primary text |
| `--tf-fg-muted` | `oklch(0.46 0.012 260)` | `oklch(0.72 0.012 260)` | Secondary text |
| `--tf-fg-subtle` | `oklch(0.62 0.012 260)` | `oklch(0.58 0.012 260)` | Tertiary text, placeholders |
| **`--tf-accent`** | `oklch(0.58 0.19 265)` | `oklch(0.7 0.17 265)` | **Primary action — indigo** |
| `--tf-accent-fg` | `oklch(0.99 0 0)` | `oklch(0.15 0.01 260)` | Text on accent bg |
| `--tf-accent-soft` | `oklch(0.95 0.04 265)` | `oklch(0.28 0.06 265)` | Accent hover surface |
| `--tf-accent-ring` | `oklch(0.58 0.19 265 / 0.25)` | `oklch(0.7 0.17 265 / 0.3)` | Focus rings |
| `--tf-green` | `oklch(0.62 0.15 150)` | `oklch(0.74 0.16 150)` | Normal/OK status |
| `--tf-green-soft` | `oklch(0.95 0.05 150)` | `oklch(0.28 0.06 150)` | Green badge bg |
| `--tf-amber` | `oklch(0.72 0.15 70)` | `oklch(0.8 0.16 70)` | Warning / low stock |
| `--tf-amber-soft` | `oklch(0.96 0.06 70)` | `oklch(0.32 0.07 70)` | Amber badge bg |
| `--tf-red` | `oklch(0.6 0.2 25)` | `oklch(0.72 0.18 25)` | Error / out of stock |
| `--tf-red-soft` | `oklch(0.96 0.04 25)` | `oklch(0.3 0.08 25)` | Red badge bg |

### Typography

- **UI**: Inter (loaded via `next/font/google`)
- **Monospace** (SKU, IMEI, prices): JetBrains Mono — use `className="mono"` or `font-mono`
- Base size: 14px · Line height 1.5 · Letter spacing -0.005em
- Headings: `text-[28px] font-bold tracking-[-0.025em]`
- Metadata: `text-[10px]`
- Actions: `text-sm`

### Spacing & Radius

| Utility | Value |
|---|---|
| `--radius` (base) | 10px (`0.625rem`) |
| `rounded-sm` | 6px |
| `rounded` | 10px |
| `rounded-lg` | 14px |
| `rounded-xl` | 20px |

### Shadows

Use inline `style={{ boxShadow: 'var(--tf-shadow-sm)' }}` or `shadow-*` if Tailwind scale aligns.

- `--tf-shadow-sm` — subtle card resting state
- `--tf-shadow-md` — hover lift, dropdowns
- `--tf-shadow-lg` — sheets, overlays

### Animations

All transitions: `cubic-bezier(.4,0,.2,1)` — standard Material easing.

| Duration | Use |
|---|---|
| 100ms | Instant hover bg |
| 150ms | Color, border transitions |
| 200ms | Fade in/out |
| 250ms | Row stagger, slide-in |
| 280ms | Sheets, dialogs |

Keyframes available: `tf-pulse`, `tf-row-in`, `tf-menu-in` (in globals.css).

## Layout

- **Sidebar expanded**: 264px
- **Sidebar collapsed**: 72px
- **Topbar height**: 60px (sticky, backdrop-blur glass)
- **Page max-width**: 1480px, `px-8 py-7`

## Component patterns

### Sidebar

- Brand logo: 36×36 gradient box (`linear-gradient(135deg, var(--tf-accent), oklch(0.5 0.2 295))`)
- Active item: `bg-accent text-accent-foreground font-semibold` + 3px left rail (`.tf-nav-rail`)
- Collapsed: icons only, 72px wide
- Footer: user-card with online dot + Cuenta/Salir buttons

### KPI Cards

- `bg-card border border-border rounded-[14px] p-5` + hover `-translate-y-0.5`
- Alert variant (low stock): add `.tf-kpi-alert` + `border-amber`

### Table

- Toolbar: `bg-card border border-border rounded-[10px_10px_0_0]`
- Table wrap: `bg-card border border-border border-t-0 rounded-[0_0_10px_10px]`
- Header: `bg-muted text-muted-foreground text-xs uppercase tracking-wide`
- Row hover: `hover:bg-muted/50`
- Row stagger: add `.tf-row-enter` + `animationDelay: i * 18ms`

### Status Badges

Three classes: `.tf-badge-normal` / `.tf-badge-low` / `.tf-badge-out`
Add `.tf-pulse-dot` inside for animated dot on low/out states.

### Dark Mode

Toggle via `document.documentElement.dataset.theme = "dark" | "light"` + also add/remove `.dark` class.
Persistent via `localStorage["tf-theme"]`.
