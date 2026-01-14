import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vite options tailored for Tauri development
  clearScreen: false,
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        popup: resolve(__dirname, 'src/popup.html'),
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
