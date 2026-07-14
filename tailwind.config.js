/** @type {import('tailwindcss').Config} */

// ─── Design tokens live in src/index.css (:root) ────────────────────────────
// This config maps Tailwind utilities onto those CSS variables, so the whole
// theme can be tweaked in ONE place: the token block at the top of index.css.

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        // Court blues (primary)
        court: {
          50: 'rgb(var(--court-50) / <alpha-value>)',
          100: 'rgb(var(--court-100) / <alpha-value>)',
          200: 'rgb(var(--court-200) / <alpha-value>)',
          500: 'rgb(var(--court-500) / <alpha-value>)',
          600: 'rgb(var(--court-600) / <alpha-value>)',
          700: 'rgb(var(--court-700) / <alpha-value>)',
          900: 'rgb(var(--court-900) / <alpha-value>)',
        },
        // Volt green (single sharp accent — the ball)
        volt: {
          300: 'rgb(var(--volt-300) / <alpha-value>)',
          400: 'rgb(var(--volt-400) / <alpha-value>)',
          500: 'rgb(var(--volt-500) / <alpha-value>)',
        },
        sand: 'rgb(var(--sand) / <alpha-value>)',        // off-white app background
        surface: 'rgb(var(--surface) / <alpha-value>)',  // cards
        line: 'rgb(var(--line) / <alpha-value>)',        // hairline borders
        ink: 'rgb(var(--court-900) / <alpha-value>)',    // headings / strong text
        muted: 'rgb(var(--muted) / <alpha-value>)',      // secondary text
        ok: 'rgb(var(--ok) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',

        // Legacy aliases — untouched pages (Admin, Instructions) keep working
        // and automatically inherit the new theme.
        apple: {
          blue: 'rgb(var(--court-600) / <alpha-value>)',
          gray: 'rgb(var(--sand) / <alpha-value>)',
          darkgray: 'rgb(var(--court-900) / <alpha-value>)',
        },
      },
      borderRadius: {
        card: 'var(--radius-card)',   // 16px — cards
        ctrl: 'var(--radius-ctrl)',   // 12px — buttons, inputs, chips
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
      },
    },
  },
  plugins: [],
}
