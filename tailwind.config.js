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
          DEFAULT: '#6366f1',
          light: '#818cf8',
          dark: '#4f46e5',
        },
        secondary: {
          DEFAULT: '#ec4899',
          light: '#f472b6',
          dark: '#db2777',
        },
        accent: {
          DEFAULT: '#06b6d4',
          light: '#22d3ee',
          dark: '#0891b2',
        },
        background: {
          main: '#fafbff',
          secondary: '#f1f5f9',
          card: '#ffffff',
        },
        text: {
          primary: '#1e293b',
          secondary: '#475569',
          muted: '#94a3b8',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '10px',
        md: '14px',
        lg: '20px',
        xl: '28px',
        '2xl': '36px',
      },
      boxShadow: {
        glow: '0 0 40px rgba(99, 102, 241, 0.4)',
        float: '0 20px 60px -12px rgba(99, 102, 241, 0.25)',
      },
    },
  },
  plugins: [],
}
