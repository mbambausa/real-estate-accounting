// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import UnoCSS from 'unocss/astro';
// Remove this import: import authAstro from 'auth-astro';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    mode: 'directory',
    functionPerRoute: true,
    runtime: {
      mode: 'experimental',
      bindings: {} // Bindings defined in wrangler.toml
    }
  }),
  integrations: [
    UnoCSS({ injectReset: true }),
    // Remove authAstro() integration from here
  ],
  vite: {
    ssr: {
      external: ['node:path', '@node-rs/argon2-wasm32-wasi'],
    },
    build: {
      rollupOptions: {
        external: ['node:path', '@node-rs/argon2-wasm32-wasi']
      }
    }
  }
});