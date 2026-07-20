/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // CGOPS design-language tokens — kept identical to the platform's
      // tailwind.config.js so sibling apps render as one product. One orange
      // accent; quiet cool-neutral greys; status colors stay separate (Tailwind
      // emerald/amber/red/blue).
      colors: {
        cg: {
          bg: '#f7f7f8',
          surface: '#ffffff',
          surface2: '#f4f4f5',
          surface3: '#ececee',
          border: '#e4e4e7',
          borderStrong: '#d4d4d8',
          text: '#18181b',
          muted: '#52525b',
          faint: '#8f8f98',
          accent: '#ea580c',
          accentHover: '#c2410c',
          accentSoft: 'rgba(234,88,12,0.08)',
        },
      },
      boxShadow: {
        cg: '0 1px 2px rgba(16,24,40,0.05), 0 1px 3px rgba(16,24,40,0.06)',
        'cg-md': '0 8px 24px rgba(16,24,40,0.12)',
      },
    },
  },
  plugins: [],
};
