# Theme — ObraTrack / Proyecto Emilio

## Part 1 — Compact token summary

**Genre:** modern-minimal · utilitarian · light only (field PWA)

| Token | Value | Use |
|-------|-------|-----|
| `--color-paper` / `paper` | `#F9FAFB` | Page background |
| `--color-paper-2` | `#FFFFFF` | Cards / surfaces |
| `--color-ink` / `ink` / `navy` | `#132A45` | Titles, primary CTA, active tab |
| `--color-ink-2` | `#4B5563` | Secondary text |
| `--color-rule` | `#E5E7EB` | Borders |
| `--color-accent` / `accent` / `teal` | `#1E7F7A` | Links, focus, disponible |
| `--color-danger` / `danger` | `#DC2626` | Destructive |
| `--color-warn` / `warn` | `#D97706` | Warning / pending |
| `--radius-card` | `0.75rem` | Cards |
| `--radius-btn` | `0.5rem` | Buttons |
| `--nav-height` | `4.25rem` | Bottom nav + safe area padding |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Motion |
| `--dur-short` | `180ms` | Transitions |

**Typography:** system UI stack only (`ui-sans-serif`, `system-ui`, Segoe UI). No Google Fonts. Headings weight 700. Body/inputs ≥16px. Money/qty: `tabular-nums`.

**CTA:** `.btn-primary` fill navy; `.btn-secondary` outline; `.btn-danger` fill red. Min hit 44×44. One primary per screen.

**Chrome:** sticky `.glass-header`; bottom nav ≤5 tabs (md:hidden); desktop horizontal nav in TopBar.

**Shell widths:** `.page-shell` → `max-w-2xl md:max-w-5xl lg:max-w-6xl`.

## Part 2 — Raw sources

### `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#132A45',
        teal: '#1E7F7A',
        ink: '#132A45',
        accent: '#1E7F7A',
        paper: '#F9FAFB',
        danger: '#DC2626',
        warn: '#D97706',
        border: '#E5E7EB',
        input: '#D1D5DB',
        ring: '#1E7F7A',
        background: '#F9FAFB',
        foreground: '#111827',
        primary: { DEFAULT: '#132A45', foreground: '#FFFFFF' },
        secondary: { DEFAULT: '#F3F4F6', foreground: '#132A45' },
        destructive: { DEFAULT: '#DC2626', foreground: '#FFFFFF' },
        muted: { DEFAULT: '#F3F4F6', foreground: '#6B7280' },
        card: { DEFAULT: '#FFFFFF', foreground: '#111827' },
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
    },
  },
  plugins: [],
}
export default config
```

### `app/globals.css` — see full file in repo (`:root` tokens + `.btn-*` / `.card` / `.input-base` / `.page-shell` / `.glass-header`).

### Authority doc: `design.md` (locked system — do not invent new brand colors or fonts).
