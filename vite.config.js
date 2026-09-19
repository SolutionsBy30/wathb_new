import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/wathb/',
  // This config sits at the repo root, which also contains api/, admin/,
  // supervisor/ and school/. Without an explicit include, vitest walks all of
  // them and tries to run the API's jest specs.
  test: {
    include: ['src/**/*.spec.{js,jsx}'],
  },
});
