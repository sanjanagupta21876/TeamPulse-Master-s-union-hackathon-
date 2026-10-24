/** @type {import('tailwindcss').Config} */

// Colors are CSS variables (see src/index.css) so opacity modifiers like `bg-red/10` keep working.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        wall: token('wall'),
        paper: token('paper'),
        sunken: token('sunken'),
        line: { DEFAULT: token('line'), strong: token('line-strong') },
        ink: { DEFAULT: token('ink'), soft: token('ink-soft') },
        pencil: token('pencil'),
        faint: token('faint'),
        marker: { DEFAULT: token('marker'), strong: token('marker-strong') },
        red: token('red'),
        amber: token('amber'),
        green: token('green'),
        sky: token('sky'),
      },
      fontFamily: {
        sans: ['"Figtree Variable"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', '"Figtree Variable"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
