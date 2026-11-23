/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#14243A',
          deep: '#14243A',
          darker: '#0C1728',
          light: '#1F3554',
          subtle: '#284368'
        },
        offwhite: '#F7F7F3',
        gold: {
          DEFAULT: '#B99A62',
          light: '#CEB482',
          dark: '#9B7E48'
        },
        slate: {
          soft: '#64748B',
          muted: '#94A3B8',
          border: '#E2E8F0',
          darkborder: '#1E293B'
        },
        success: {
          DEFAULT: '#16865A',
          light: '#E8F5E9',
          border: '#A5D6A7'
        },
        error: {
          DEFAULT: '#C44747',
          light: '#FFEBEE',
          border: '#FFCDD2'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace']
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'elevated': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
        'premium': '0 20px 25px -5px rgba(20, 36, 58, 0.1), 0 10px 10px -5px rgba(20, 36, 58, 0.04)'
      }
    },
  },
  plugins: [],
}
