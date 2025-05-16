// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import UnoCSS from 'unocss/astro';
import alpine from '@astrojs/alpinejs'; // Add this import
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    mode: 'directory',
    functionPerRoute: true,
    sessionKVBindingName: 'SESSION',
    platformProxy: { enabled: true },
    runtime: { mode: 'local' },
  }),
  integrations: [
    UnoCSS({ 
      injectReset: true,
      mode: 'global',
    }),
    alpine({
      entrypoint: '/src/scripts/alpine-setup.js'
    }) // Add this integration
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  viewTransitions: true,
  vite: {
    ssr: {
      external: ['node:path', '@node-rs/argon2-wasm32-wasi']
    },
    build: {
      rollupOptions: {
        external: ['node:path', '@node-rs/argon2-wasm32-wasi']
      }
    },
    resolve: {
      alias: {
        '@components':  path.resolve(__dirname, './src/components'),
        '@layouts':     path.resolve(__dirname, './src/layouts'),
        '@lib':         path.resolve(__dirname, './src/lib'),
        '@utils':       path.resolve(__dirname, './src/utils'),
        '@styles':      path.resolve(__dirname, './src/styles'),
        '@db':          path.resolve(__dirname, './src/db'),
        '@types':       path.resolve(__dirname, './src/types'),
        '@pages':       path.resolve(__dirname, './src/pages'),
        '@auth-lib':    path.resolve(__dirname, './src/lib/auth'),
        '@services':    path.resolve(__dirname, './src/lib/services'),
        '@accounting':  path.resolve(__dirname, './src/lib/accounting'),
        '@rules':       path.resolve(__dirname, './src/lib/rules'),
      }
    }
  }
});