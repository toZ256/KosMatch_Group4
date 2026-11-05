import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F5F5F5',
        surface: '#FFFFFF',
        ink: '#303841',
        muted: '#6B7280',
        accent: '#76ABAE',
        primary: '#FF5722',
        line: '#E5E7EB',
        sukses: '#16A34A',
        bahaya: '#DC2626',
      },
      borderRadius: {
        card: '28px',
        pill: '9999px',
      },
      boxShadow: {
        card: '0 8px 30px -4px rgba(48,56,65,0.06), 0 2px 6px -1px rgba(48,56,65,0.03)',
        float: '0 12px 36px -6px rgba(48,56,65,0.10), 0 4px 12px -2px rgba(48,56,65,0.05)',
        'tactile-primary': '0 4px 0 0 #C83E12, 0 8px 20px -4px rgba(255,87,34,0.35)',
        'tactile-accent': '0 4px 0 0 #568588, 0 8px 20px -4px rgba(118,171,174,0.35)',
        'tactile-ink': '0 4px 0 0 #1B2026',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      keyframes: {
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'dot-bounce': {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '40%': { transform: 'translateY(-4px)', opacity: '1' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 200ms ease-out',
        'fade-in': 'fade-in 200ms ease-out',
        'dot-bounce': 'dot-bounce 1.2s infinite ease-in-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
