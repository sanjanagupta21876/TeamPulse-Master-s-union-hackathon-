/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#09090B',
          sidebar: '#0C0C0F',
          card: '#111114',
          secondary: '#18181B',
        },
        foreground: {
          DEFAULT: '#FAFAFA',
          muted: '#A1A1AA',
        },
        border: {
          DEFAULT: '#27272A',
        },
        accent: {
          DEFAULT: '#8B5CF6',
          hover: '#7C3AED',
          light: '#A78BFA',
          subtle: 'rgba(139, 92, 246, 0.12)',
        },
        status: {
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'card': '12px',
      }
    },
  },
  plugins: [],
}
