/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        muted: "#64748B",
        border: "#E2E8F0",
        surface: "#FFFFFF",
        bg: "#F8F7F5",
        risk: { critical: "#DC2626", watch: "#D97706", healthy: "#0F766E" }
      },
      fontFamily: { sans: ['Inter','system-ui','sans-serif'], mono: ['JetBrains Mono','ui-monospace','monospace'] },
      borderRadius: { 'xl': '12px', '2xl': '16px' },
      boxShadow: { 'soft': '0 1px 2px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04)', 'card': '0 1px 3px rgba(15,23,42,0.08), 0 4px 12px rgba(15,23,42,0.06)' }
    },
  },
  plugins: [],
}
