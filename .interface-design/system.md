# Archivo Control Deck

## Direction

An operational ledger for a serialized electronics retailer: paper, aluminum, carbon and one printed-orange control signal. High density is deliberate; calm surfaces and mono metadata make physical items traceable.

## Tokens

- Accent: `--tf-accent`, approximately #FD3706; foreground is `--tf-accent-ink`, never small white copy.
- Surfaces: paper canvas / solid aluminum work surface / carbon dark counterpart.
- Type: Archivo UI and IBM Plex Mono for identifiers, values and timestamps.

## Spatial rules

- 4px spacing scale.
- Sidebar 68px compact, 232px expanded; topbar 56px.
- Cards and tables are opaque, borders-first and use radii 6/8/10px.
- Floating popovers, dialogs and sheets may use a reserved shadow and glass only in chrome.

## Reusable patterns

### Trace rail

- Width: 1–2px orange line with a mono marker when data is selected or operationally active.
- Use: PageHeader, main KPI, selected record, scanner state and inspection timeline.

### Page shell

- Variants: wide, standard, narrow and workspace.
- Responsive gutters: 16px mobile, 24px tablet, 32px desktop.

### Detail sheet

- Inspection uses right-side Sheet, 480px normal width, opaque body and glass header/footer.
- Fullscreen under 640px. Mutations stay in Dialog.

### Motion

- `cubic-bezier(.2,.8,.2,1)`; 120–140ms controls, 160–180ms selection, 200–220ms overlays, 240–260ms sheets/sidebar.
