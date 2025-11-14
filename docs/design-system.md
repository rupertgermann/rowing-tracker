# Rowing Tracker Design System

## 1. Design Direction

- **Mood:** Sleek, data-first, like a modern instrument panel.
- **Theme:** Dark by default, with high-contrast accents for metrics and charts.
- **Personas:** Data-loving rowers and motivated athletes who care about progress at a glance.

The UI should feel focused and calm: dark backgrounds, clear grids, big readable numbers, and smooth micro-interactions.

---

## 2. Color System

### 2.1 Core Palette

- **Backgrounds**
  - `bg-app`: `#050712` – App background (root layout).
  - `bg-elevated`: `#0C1020` – Cards, nav bar, panels.
  - `bg-subtle`: `#111627` – Table rows, hovered items, secondary surfaces.

- **Foregrounds**
  - `fg-primary`: `#F9FAFB` – Main text, key labels.
  - `fg-muted`: `#9CA3AF` – Secondary text, descriptions.
  - `fg-soft`: `#6B7280` – Meta labels, helper text.

- **Primary Accent**
  - `accent`: `#38BDF8` – Primary brand color (Sky 400).
  - `accent-soft`: `rgba(56, 189, 248, 0.20)` – Chart fills, subtle glows, backgrounds.

- **Secondary Accent**
  - `accent-secondary`: `#E879F9` – Highlights (PRs, streaks, key milestones).
  - `accent-secondary-soft`: `rgba(232, 121, 249, 0.18)` – Badges, pills, subtle accents.

- **Status Colors**
  - `success`: `#22C55E` – Positive trends (pace/power/volume improving).
  - `warning`: `#FACC15` – Plateaus, caution, consistency drops.
  - `danger`: `#FB7185` – Errors, failed imports.

- **Borders & Overlays**
  - `border-subtle`: `#1F2937` – Card and table borders.
  - `border-strong`: `#374151` – Section dividers, stronger outlines.
  - `overlay`: `rgba(15, 23, 42, 0.8)` – Modals, dialogs.

### 2.2 Chart Colors (Recharts)

- **Metrics → Colors**
  - Training volume (distance): `#38BDF8`.
  - Training volume (time): `#4ADE80`.
  - Pace: `#E879F9`.
  - Power: `#F97316`.
  - Stroke rate: `#A855F7`.
  - Heart rate (future): `#F97373`.

- **Chart Surfaces**
  - Background: `#050712`.
  - Grid lines: `rgba(148, 163, 184, 0.15)`.
  - Tooltip background: `#020617` with border `rgba(148, 163, 184, 0.4)`.

---

## 3. Typography

Use one display font and one UI font. For example:

- **Display / Numbers:** `Space Grotesk` or `Sora` – titles and big metrics.
- **UI / Body:** `Inter` or `system-ui` – navigation, labels, paragraphs.

### 3.1 Hierarchy

- Page title: `text-3xl`–`4xl`, `font-bold`.
- Section title: `text-xl`, `font-semibold`.
- Metric value (cards): `text-3xl`–`4xl`, `font-semibold`.
- Metric label: `text-xs`–`sm`, `text-fg-muted`, `uppercase` optional.
- Body copy: `text-sm`–`base`, `leading-relaxed`.
- Table header: `text-xs`, `uppercase`, `tracking-wide`, `text-fg-muted`.

### 3.2 General Rules

- Prefer shorter labels over long sentences.
- Make key numbers the visual anchor; keep labels lighter and smaller.
- Avoid more than 3 font sizes in a single card.

---

## 4. Spacing & Layout

### 4.1 Spacing Scale

Use a 4px base unit (Tailwind default):

- `4` (4px): tight gaps, icon spacing.
- `8` (8px): small gaps.
- `12` (12px): between label and value inside cards.
- `16` (16px): default padding.
- `24` (24px): card to card spacing.
- `32+` (32px+): section spacing.

### 4.2 Cards

- Padding: `px-5 py-4` or `px-6 py-5`.
- Radius: `rounded-2xl` for hero cards, `rounded-xl` for standard cards.
- Border: `border border-subtle`.
- Shadow in dark mode:
  - Subtle: `shadow-[0_18px_45px_rgba(15,23,42,0.85)]`.
  - Hover: slightly stronger shadow + border color transition to `accent`.

### 4.3 Grid Layout

- Desktop dashboard:
  - Metric cards in `grid grid-cols-4 gap-6` (use `col-span` for wider cards).
  - Charts use `col-span-2` or `col-span-3` depending on importance.
- Tablet:
  - `grid-cols-2 gap-4`, cards wrap nicely.
- Mobile:
  - `grid-cols-1 gap-4`, vertical stacking.

---

## 5. Key Components

### 5.1 Navigation Bar

- Background: `bg-app` or `bg-elevated` with `border-b border-subtle`.
- Layout:
  - Left: logo / app title.
  - Right: nav links (Dashboard, Sessions, PRs, Upload) and theme toggle (future).
- Nav item states:
  - Default: `text-fg-muted`.
  - Hover: `bg-subtle`, `text-fg-primary`.
  - Active route: pill-style highlight with `bg-accent-soft text-fg-primary`.

### 5.2 Metric Cards (Dashboard & Detail)

- Structure:
  - Top row: label (`text-xs text-fg-muted`).
  - Middle: main value (`text-3xl font-semibold text-fg-primary`).
  - Bottom: secondary info (delta vs last period, streak info, etc.).
- Styling:
  - Background: `bg-elevated`.
  - Border: `border-subtle`, on hover `border-accent`.
  - Icon (optional): small icon in `accent` in the top-right.
- Variants:
  - PR cards use `accent-secondary` for highlight elements.
  - Streak cards use a subtle gradient from `accent` to `accent-secondary` at low opacity.

### 5.3 Charts

- Container:
  - Card with header and content.
  - Header: title + description + time range controls.
- Time range controls:
  - Use shadcn `Button` with `variant="outline"`.
  - Active state: `bg-accent text-fg-primary border-none`.
  - Inactive: `bg-transparent text-fg-muted border-subtle`.
- Tooltip:
  - Background: `#020617`.
  - Border: `border border-strong`.
  - Text: `text-xs text-fg-primary`, labels in `text-fg-muted`.

### 5.4 Tables (Sessions List)

- Table header:
  - `text-xs uppercase tracking-wide text-fg-muted`.
  - Background: `bg-app`.
- Rows:
  - Base: `bg-app border-b border-subtle`.
  - Hover: `bg-subtle` and cursor pointer.
- PR badge:
  - Small pill: `bg-accent-secondary-soft text-accent-secondary rounded-full px-2 py-0.5 text-[11px]`.

### 5.5 Upload & Empty States

- Upload hero:
  - Card with `bg-elevated`.
  - Title in display font, optional gradient text (`from-accent to-accent-secondary`).
  - Primary CTA button in `accent`.
- Dropzone:
  - `border-dashed border-2 border-subtle rounded-2xl bg-app/60`.
  - Hover: `border-accent bg-accent-soft/10`.
- Empty states:
  - Simple illustrative icon in `accent-secondary`.
  - Short friendly copy in `fg-muted`.
  - Prominent CTA button.

---

## 6. Feedback & States

### 6.1 Toasts

- Success:
  - Background: `bg-elevated`.
  - Left border: `success`.
  - Icon: check in `success`.
- Error:
  - Background: `bg-elevated`.
  - Left border: `danger`.
  - Icon: alert in `danger`.

### 6.2 Loading

- Skeletons:
  - Use `bg-subtle` bars with gradient shimmer.
- Spinners:
  - Simple, unobtrusive, in `accent`.

### 6.3 Focus & Accessibility

- Focus rings:
  - `outline-none ring-2 ring-accent ring-offset-2 ring-offset-bg-app`.
- Contrast:
  - Ensure text on `bg-app` and `bg-elevated` meets WCAG AA.

---

## 7. Implementation Notes

### 7.1 Tailwind & CSS Variables

- Define CSS variables in `globals.css`:
  - `--background`, `--foreground`, `--card`, `--card-foreground`, `--primary`, `--primary-foreground`, etc.
  - Map them to the colors above for `.dark`.
- Extend `tailwind.config.ts` to use these variables for `backgroundColor`, `textColor`, `borderColor`, and chart-specific colors (`--chart-1`, `--chart-2`, ...).

### 7.2 shadcn/ui Theme

- Configure the `primary`, `secondary`, `destructive`, `muted`, and `accent` tokens to align with the palette above.
- Buttons:
  - `variant="default"` uses `accent`.
  - `variant="secondary"` uses `accent-secondary` sparingly.

### 7.3 Recharts

- Centralize chart colors in a small config (e.g. `lib/chartTheme.ts`) that imports values from CSS variables or a shared theme map.
- Use consistent line widths, dot sizes, and tooltip styling across charts.

This design system should be considered the single source of truth for visual decisions in the Rowing Tracker MVP.
