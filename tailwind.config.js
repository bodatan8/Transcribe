/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'spratt-blue': {
          DEFAULT: '#1a6b6b',
          50: '#f0fafa',
          100: '#d5f2f2',
          200: '#ade5e5',
          400: '#40b3b3',
          light: '#40b3b3',
          dark: '#155757',
        },
        'spratt-grey': {
          DEFAULT: '#78716c',
          light: '#a8a29e',
        },
        'surface': {
          primary: 'rgba(255, 255, 255, 0.9)',
          secondary: '#fafaf9',
          tertiary: '#f5f5f4',
          elevated: 'rgba(255, 255, 255, 0.85)',
        },
        'accent': {
          DEFAULT: '#f59e0b',
          light: '#fef3c7',
          coral: '#fb923c',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '24px',
        '3xl': '32px',
      },
      boxShadow: {
        'card': '0 1px 2px rgba(0, 0, 0, 0.02), 0 4px 16px rgba(0, 0, 0, 0.04)',
        'card-elevated': '0 2px 4px rgba(0, 0, 0, 0.03), 0 12px 32px rgba(0, 0, 0, 0.08)',
        'glow': '0 0 20px rgba(26, 107, 107, 0.15)',
        'warm': '0 4px 20px rgba(245, 158, 11, 0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-in': 'slideIn 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in': 'scaleIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
