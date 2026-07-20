/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F97316',
          hover: '#EA580C',
        },
        background: {
          DEFAULT: '#FFFDF9',
        },
        card: {
          DEFAULT: '#FFFFFF',
        },
        secondaryBg: {
          DEFAULT: '#FFF6ED',
        },
        border: {
          DEFAULT: '#FFE3CC',
        },
        textMain: {
          DEFAULT: '#431407',
        },
        textMuted: {
          DEFAULT: '#7C5C4B',
        },
        success: {
          DEFAULT: '#16A34A',
        },
        danger: {
          DEFAULT: '#DC2626',
        },
      },
      borderRadius: {
        'xl': '20px',
        '2xl': '24px',
        '3xl': '30px',
        '4xl': '36px',
      },
      boxShadow: {
        'soft': '0 8px 30px rgba(0, 0, 0, 0.03)',
        'premium': '0 12px 40px rgba(99, 102, 241, 0.08)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.02)',
        'ring': '0 0 0 4px rgba(99, 102, 241, 0.15)',
      }
    },
  },
  plugins: [],
}
