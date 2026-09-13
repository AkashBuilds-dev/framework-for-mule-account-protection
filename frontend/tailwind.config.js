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
        navy: {
          950: '#0A0E1A', // Deep navy-black background
          900: '#0F172A',
          800: '#1E293B',
        },
        surface: {
          DEFAULT: '#111827', // Slate card surface
          elevated: '#1A2234',
          highlight: '#243048',
        },
        border: {
          subtle: '#1F2937',
          highlight: '#374151',
        },
        accent: {
          cyan: '#06B6D4',
          'cyan-dark': '#0891B2',
          'cyan-glow': 'rgba(6, 182, 212, 0.15)',
        },
        status: {
          danger: '#EF4444',
          warning: '#F59E0B',
          success: '#10B981',
          info: '#3B82F6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.25)',
        'glow-danger': '0 0 20px rgba(239, 68, 68, 0.3)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar': 'radar 2s ease-out infinite',
      },
      keyframes: {
        radar: {
          '0%': { transform: 'scale(0.8)', opacity: '1' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        }
      }
    },
  },
  plugins: [],
};
