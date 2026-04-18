import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Wave 6B.3 Layer 3: component-test config for tests/components/*.spec.jsx.
// Uses jsdom + React Testing Library. Kept separate from vite.config.js so
// the dashboard's prod build surface is unchanged.
export default defineConfig({
  plugins: [react()],
  define: {
    // Force MOCK mode for component tests; the engine router reads
    // import.meta.env.VITE_USE_MOCKS and the default is already MOCK,
    // but being explicit here removes any surprise.
    'import.meta.env.VITE_USE_MOCKS': JSON.stringify('true'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.spec.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
  },
});
