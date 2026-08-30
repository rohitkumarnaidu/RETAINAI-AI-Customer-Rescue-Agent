/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Semantic — backed by CSS variables in index.css
        background: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          muted: 'var(--surface-muted)',
          subtle: 'var(--surface-subtle)',
          raised: 'var(--surface-raised)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
          subtle: 'var(--border-subtle)',
        },
        ink: {
          DEFAULT: 'var(--text-primary)',
          muted: 'var(--text-secondary)',
          faint: 'var(--text-tertiary)',
          placeholder: 'var(--text-faint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
        },
        risk: {
          healthy: {
            bg: 'var(--risk-healthy-bg)',
            border: 'var(--risk-healthy-border)',
            text: 'var(--risk-healthy-text)',
            dot: 'var(--risk-healthy-dot)',
          },
          watch: {
            bg: 'var(--risk-watch-bg)',
            border: 'var(--risk-watch-border)',
            text: 'var(--risk-watch-text)',
            dot: 'var(--risk-watch-dot)',
          },
          critical: {
            bg: 'var(--risk-critical-bg)',
            border: 'var(--risk-critical-border)',
            text: 'var(--risk-critical-text)',
            dot: 'var(--risk-critical-dot)',
          },
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in': { from: { transform: 'translateY(-4px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 200ms var(--ease-out)',
        'slide-in': 'slide-in 200ms var(--ease-out)',
      },
    },
  },
  plugins: [],
}
