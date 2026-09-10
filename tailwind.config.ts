import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Colores de marca Proyecto Emilio (locked en design.md y AGENTS.md)
        navy: '#132A45',
        teal: '#1E7F7A',
        ink: '#132A45',
        accent: '#1E7F7A',
        paper: '#F9FAFB',
        danger: '#DC2626',
        warn: '#D97706',

        // Mapeo semántico para compatibilidad con el ecosistema shadcn/ui
        border: '#E5E7EB',
        input: '#D1D5DB',
        ring: '#1E7F7A',
        background: '#F9FAFB',
        foreground: '#111827',
        primary: {
          DEFAULT: '#132A45',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#F3F4F6',
          foreground: '#132A45',
        },
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#F3F4F6',
          foreground: '#6B7280',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#111827',
        },
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
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
          from: { opacity: '0', transform: 'scale(0.95)' },
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
      },
      animation: {
        'fade-in': 'fade-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-out': 'fade-out 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-out-right': 'slide-out-right 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
export default config
