import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        operational: '#22c55e',
        degraded: '#f59e0b',
        outage: '#ef4444',
        unknown: '#6b7280',
      },
    },
  },
  plugins: [],
};

export default config;
