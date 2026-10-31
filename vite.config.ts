import { defineConfig } from 'vite';

// Automatically use '/DinosDino/' base path when building inside GitHub Actions for GitHub Pages
const base = process.env.GITHUB_ACTIONS === 'true' ? '/DinosDino/' : '/';

export default defineConfig({
  base,
  root: './',
  publicDir: 'public',
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (normalizedId.includes('node_modules/three/examples/')) {
            return 'vendor-three-addons';
          }
          if (normalizedId.includes('node_modules/three/')) {
            return 'vendor-three';
          }
        }
      }
    }
  }
});
