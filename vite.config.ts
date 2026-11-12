import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Bridge environment variables in AI Studio runtime when .env is not populated
  let runtimeConfig: Record<string, string> = {};
  const appletConfigPath = path.resolve(import.meta.dirname, 'firebase-applet-config.json');
  if (fs.existsSync(appletConfigPath)) {
    try {
      runtimeConfig = JSON.parse(fs.readFileSync(appletConfigPath, 'utf-8'));
    } catch {
      runtimeConfig = {};
    }
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'manifest.json'],
        manifest: false, // Uses /public/manifest.json
        workbox: {
          maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        },
      }),
    ],
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(
        env.VITE_FIREBASE_API_KEY || runtimeConfig.apiKey || ''
      ),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(
        env.VITE_FIREBASE_AUTH_DOMAIN || runtimeConfig.authDomain || ''
      ),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(
        env.VITE_FIREBASE_PROJECT_ID || runtimeConfig.projectId || ''
      ),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(
        env.VITE_FIREBASE_STORAGE_BUCKET || runtimeConfig.storageBucket || ''
      ),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(
        env.VITE_FIREBASE_MESSAGING_SENDER_ID || runtimeConfig.messagingSenderId || ''
      ),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(
        env.VITE_FIREBASE_APP_ID || runtimeConfig.appId || ''
      ),
      'import.meta.env.VITE_FIREBASE_DATABASE_ID': JSON.stringify(
        env.VITE_FIREBASE_DATABASE_ID || runtimeConfig.firestoreDatabaseId || ''
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
