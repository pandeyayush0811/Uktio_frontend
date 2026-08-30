import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/android/**',
      '**/.{idea,git,cache,output,temp}/**'
    ]
  }
});
