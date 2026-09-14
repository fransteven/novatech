# NovaTech Design System

> **Current version** — supersedes any prior emerald/no-indigo rule. Accent is now **indigo (OKLCH)**.

## Tokens

All design tokens are OKLCH, defined as `--tf-*` CSS custom props in `src/app/globals.css`.
Shadcn semantic names (`--primary`, `--muted`, `--border`, etc.) are mapped to `--tf-*` — update the design tokens, shadcn components follow automatically.

### Colors

| Token | Light | Dark | Use |
|---|---|---|---|
| `--tf-bg` | `oklch(0.982 0.014 84)` | `oklch(0.185 0.024 258)` | Lienzo marfil de recibo / grafito azulado |
| `--tf-bg-elev` | `oklch(0.995 0.006 84)` | `oklch(0.225 0.025 258)` | Cards, sidebar, panels |
| `--tf-bg-muted` | `oklch(0.955 0.018 84)` | `oklch(0.27 0.026 258)` | Hover, table headers, muted zones |
| `--tf-border` | `oklch(0.885 0.018 84)` | `oklch(0.335 0.024 258)` | Default borders |
| `--tf-border-strong` | `oklch(0.81 0.022 84)` | `oklch(0.42 0.028 258)` | Input borders, strong dividers |
| `--tf-fg` | `oklch(0.235 0.026 258)` | `oklch(0.94 0.012 84)` | Primary text |
| `--tf-fg-muted` | `oklch(0.47 0.028 258)` | `oklch(0.74 0.018 245)` | Secondary text |
| `--tf-fg-subtle` | `oklch(0.61 0.022 258)` | `oklch(0.59 0.018 245)` | Tertiary text, placeholders |
| **`--tf-accent`** | `oklch(0.47 0.155 269)` | `oklch(0.72 0.135 269)` | **Primary action — índigo tinta** |
| `--tf-accent-fg` | `oklch(0.99 0.005 84)` | `oklch(0.19 0.024 258)` | Text on accent bg |
| `--tf-accent-soft` | `oklch(0.93 0.042 269)` | `oklch(0.31 0.072 269)` | Accent hover surface |
| `--tf-accent-ring` | `oklch(0.47 0.155 269 / 0.24)` | `oklch(0.72 0.135 269 / 0.3)` | Focus rings |
| `--tf-green` | `oklch(0.48 0.115 158)` | `oklch(0.75 0.12 158)` | Normal/OK status |
| `--tf-green-soft` | `oklch(0.93 0.038 158)` | `oklch(0.3 0.06 158)` | Green badge bg |
| `--tf-amber` | `oklch(0.62 0.13 72)` | `oklch(0.81 0.13 72)` | Warning / low stock |
| `--tf-amber-soft` | `oklch(0.945 0.052 72)` | `oklch(0.34 0.065 72)` | Amber badge bg |
| `--tf-red` | `oklch(0.53 0.17 27)` | `oklch(0.72 0.15 27)` | Error / out of stock |
| `--tf-red-soft` | `oklch(0.94 0.042 27)` | `oklch(0.33 0.075 27)` | Red badge bg |

### Typography

- **UI**: IBM Plex Sans (loaded via `next/font/google`)
- **Monospace** (SKU, IMEI, prices): IBM Plex Mono — use `className="mono"` or `font-mono`; importes usan cifras tabulares.
- Base size: 14px · Line height 1.5 · Letter spacing -0.005em
- Headings: `text-[28px] font-bold tracking-[-0.025em]`
- Metadata: `text-[10px]`
- Actions: `text-sm`

### Spacing & Radius

| Utility | Value |
|---|---|
| `--radius` (base) | 12px (`0.75rem`) |
| `rounded-sm` | 8px |
| `rounded` | 12px |
| `rounded-lg` | 12px |
| `rounded-xl` | 16px |

### Shadows

Use inline `style={{ boxShadow: 'var(--tf-shadow-sm)' }}` or `shadow-*` if Tailwind scale aligns.

- `--tf-shadow-sm` — subtle card resting state
- `--tf-shadow-md` — hover lift, dropdowns
- `--tf-shadow-lg` — sheets, overlays

### Animations

All transitions: `cubic-bezier(.4,0,.2,1)` — standard Material easing.

| Duration | Use |
|---|---|
| 120ms | Hover y foco |
| 180ms | Cambios de estado |
| 240ms | Sheets, diálogos y overlays |

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

- `bg-card border border-border rounded-[14px] p-5`, sin elevación al pasar el cursor si el dato es estático.
- Las variantes `metric`/KPI incluyen una **línea de registro**: riel izquierdo de 1px en `--tf-accent`, con 20px de margen vertical. Es una firma informativa, no un gradiente decorativo.
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
