// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import UnoCSS from 'unocss/astro';

// https://astro.build/config
export default defineConfig({
  output: 'server', // Enable SSR
  adapter: cloudflare({
    mode: 'directory', // Use directory mode for simpler deployment
    functionPerRoute: true // Create a separate function per route for better performance
  }),
  integrations: [
    UnoCSS({
      injectReset: true // Add CSS reset
    })
  ],
  vite: {
    build: {
      // Optimize build for performance
      minify: 'terser',
      // Configure Terser options
      terserOptions: {
        compress: {
          drop_console: true // Remove console logs in production
        }
      }
    }
  }
});