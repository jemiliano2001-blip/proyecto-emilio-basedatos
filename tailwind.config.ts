import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

/**
 * Tokens semánticos. Los valores viven en `app/globals.css` (:root) como HSL
 * sin `hsl()` para que Tailwind pueda aplicar opacidad (`bg-primary/10`).
 * Cambiar de paleta o activar dark mode = tocar solo globals.css.
 */
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        card: {
          DEFAULT: token('card'),
          foreground: token('card-foreground'),
        },
        popover: {
          DEFAULT: token('popover'),
          foreground: token('popover-foreground'),
        },
        muted: {
          DEFAULT: token('muted'),
          foreground: token('muted-foreground'),
        },
        border: token('border'),
        input: token('input'),
        ring: token('ring'),

        primary: {
          DEFAULT: token('primary'),
          foreground: token('primary-foreground'),
          hover: token('primary-hover'),
          soft: token('primary-soft'),
          'soft-foreground': token('primary-soft-foreground'),
        },
        secondary: {
          DEFAULT: token('secondary'),
          foreground: token('secondary-foreground'),
        },

        // Estatus: sólido (fill) + suave (tinte con texto oscuro del mismo tono)
        success: {
          DEFAULT: token('success'),
          foreground: token('success-foreground'),
          soft: token('success-soft'),
          'soft-foreground': token('success-soft-foreground'),
        },
        warning: {
          DEFAULT: token('warning'),
          foreground: token('warning-foreground'),
          soft: token('warning-soft'),
          'soft-foreground': token('warning-soft-foreground'),
        },
        danger: {
          DEFAULT: token('danger'),
          foreground: token('danger-foreground'),
          soft: token('danger-soft'),
          'soft-foreground': token('danger-soft-foreground'),
        },
        destructive: {
          DEFAULT: token('danger'),
          foreground: token('danger-foreground'),
        },
        info: {
          DEFAULT: token('info'),
          foreground: token('info-foreground'),
          soft: token('info-soft'),
          'soft-foreground': token('info-soft-foreground'),
        },

        // Sidebar (desktop ≥ lg)
        sidebar: {
          DEFAULT: token('sidebar'),
          foreground: token('sidebar-foreground'),
          muted: token('sidebar-muted'),
          border: token('sidebar-border'),
          accent: token('sidebar-accent'),
          'accent-foreground': token('sidebar-accent-foreground'),
        },

        // Alias legacy — mapean al token nuevo para no romper nada mientras se
        // barre el código. No usar en código nuevo.
        ink: token('foreground'),
        navy: token('foreground'),
        teal: token('primary'),
        accent: {
          DEFAULT: token('primary'),
          foreground: token('primary-foreground'),
        },
        paper: token('background'),
        warn: token('warning'),
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        sm: '0 1px 3px 0 rgb(15 23 42 / 0.04), 0 1px 2px -1px rgb(15 23 42 / 0.03)',
        card: '0 0 0 1px rgb(15 23 42 / 0.05), 0 1px 2px 0 rgb(15 23 42 / 0.03)',
        'card-hover': '0 0 0 1px rgb(15 23 42 / 0.08), 0 4px 12px -2px rgb(15 23 42 / 0.06), 0 2px 4px -1px rgb(15 23 42 / 0.03)',
        md: '0 0 0 1px rgb(15 23 42 / 0.05), 0 4px 12px -2px rgb(15 23 42 / 0.06), 0 2px 4px -1px rgb(15 23 42 / 0.04)',
        lg: '0 0 0 1px rgb(15 23 42 / 0.06), 0 10px 28px -4px rgb(15 23 42 / 0.08), 0 4px 8px -2px rgb(15 23 42 / 0.04)',
        popover: '0 0 0 1px rgb(15 23 42 / 0.06), 0 12px 32px -4px rgb(15 23 42 / 0.12), 0 4px 8px -2px rgb(15 23 42 / 0.06)',
      },
      spacing: {
        sidebar: 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-width-collapsed)',
        topbar: 'var(--topbar-height)',
        bottomnav: 'var(--nav-height)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-out-right': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(100%)' },
        },
        'slide-in-bottom': {
          from: { opacity: '0', transform: 'translateY(100%)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-out-bottom': {
          from: { opacity: '1', transform: 'translateY(0)' },
          to: { opacity: '0', transform: 'translateY(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-out': 'fade-out 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-out-right': 'slide-out-right 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-bottom': 'slide-in-bottom 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-out-bottom': 'slide-out-bottom 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
export default config
