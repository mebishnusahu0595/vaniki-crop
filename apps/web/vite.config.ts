import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { chunkSplitPlugin } from 'vite-plugin-chunk-split';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    chunkSplitPlugin({
      strategy: 'default',
      useEntryName: false,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons.svg'],
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallbackDenylist: [/^\/assets\//, /^\/api\//],
      },
      manifest: {
        name: 'Vaniki Crop',
        short_name: 'Vaniki',
        description: 'Fresh groceries and farm produce delivered across Vaniki Crop stores.',
        theme_color: '#1f7a3b',
        background_color: '#f7fff8',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router-dom') || id.includes('/react/') || id.includes('/react-dom/')) {
            return 'react';
          }
          if (id.includes('framer-motion') || id.includes('/gsap/') || id.includes('@gsap/react')) {
            return 'motion';
          }
          if (id.includes('@tanstack/react-query')) {
            return 'query';
          }
          if (id.includes('lucide-react') || id.includes('react-hot-toast')) {
            return 'ui';
          }
          return 'vendor';
        },
      },
    },
  },
});
