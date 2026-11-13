import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

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

  const isPlaceholderOrEmpty = (value?: string): boolean => {
    if (!value || !value.trim()) return true;
    return /placeholder|example|your[_-]|changeme|remixed-project-id|undefined|null/i.test(
      value.trim()
    );
  };

  const pickFirebaseValue = (runtimeVal?: string, envVal?: string): string => {
    if (runtimeVal && !isPlaceholderOrEmpty(runtimeVal)) return runtimeVal.trim();
    if (envVal && !isPlaceholderOrEmpty(envVal)) return envVal.trim();
    return '';
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(
        pickFirebaseValue(runtimeConfig.apiKey, env.VITE_FIREBASE_API_KEY)
      ),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(
        pickFirebaseValue(runtimeConfig.authDomain, env.VITE_FIREBASE_AUTH_DOMAIN)
      ),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(
        pickFirebaseValue(runtimeConfig.projectId, env.VITE_FIREBASE_PROJECT_ID)
      ),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(
        pickFirebaseValue(runtimeConfig.storageBucket, env.VITE_FIREBASE_STORAGE_BUCKET)
      ),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(
        pickFirebaseValue(runtimeConfig.messagingSenderId, env.VITE_FIREBASE_MESSAGING_SENDER_ID)
      ),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(
        pickFirebaseValue(runtimeConfig.appId, env.VITE_FIREBASE_APP_ID)
      ),
      'import.meta.env.VITE_FIREBASE_DATABASE_ID': JSON.stringify(
        pickFirebaseValue(runtimeConfig.firestoreDatabaseId, env.VITE_FIREBASE_DATABASE_ID)
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) return 'three-vendor';
            if (id.includes('node_modules/pdfjs-dist')) return 'pdfjs-vendor';
            if (id.includes('node_modules/katex') || id.includes('rehype-katex') || id.includes('remark-math')) {
              return 'math-vendor';
            }
            if (id.includes('node_modules/firebase')) return 'firebase-vendor';
            if (id.includes('node_modules')) return 'vendor';
          },
        },
      },
    },
  };
});
