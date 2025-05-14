// uno.config.ts
import { defineConfig } from 'unocss';
import { presetWind, presetTypography, presetWebFonts } from 'unocss';

export default defineConfig({
  // Using Wind preset (similar to Tailwind) for familiar syntax
  presets: [
    presetWind(),
    presetTypography(), // For better typography
    presetWebFonts({
      // Optimize font loading
      fonts: {
        sans: 'Inter:400,500,600,700',
        mono: 'JetBrains Mono'
      }
    })
  ],
  // Define theme
  theme: {
    colors: {
      primary: {
        50: '#f0f9ff',
        100: '#e0f2fe',
        200: '#bae6fd',
        300: '#7dd3fc',
        400: '#38bdf8',
        500: '#0ea5e9',
        600: '#0284c7',
        700: '#0369a1',
        800: '#075985',
        900: '#0c4a6e',
        950: '#082f49',
      }
    }
  },
  // Safelist important classes that might be dynamically generated
  safelist: 'bg-primary-500 text-white p-2 rounded'.split(' ')
});