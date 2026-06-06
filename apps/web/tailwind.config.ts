import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cinema: {
          950: '#05030A',
          900: '#05030A',
          800: '#10091D',
          700: '#170028',
          600: '#2B1650',
          gold: '#F8C44C',
          'gold-light': '#FFF7D6',
          red: '#FF2BD6',
          'red-light': '#FF6BE5',
          blue: '#145CFF',
          teal: '#35E8FF',
          purple: '#170028',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'Cambria', 'serif'],
        sans: ['Inter', 'Montserrat', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
