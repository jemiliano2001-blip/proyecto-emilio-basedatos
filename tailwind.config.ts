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
      },
    },
  },
  plugins: [],
}
export default config
