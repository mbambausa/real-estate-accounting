// uno.config.ts
import { defineConfig } from 'unocss';
import { presetWind, presetTypography, presetWebFonts } from 'unocss';
import transformerVariantGroup from '@unocss/transformer-variant-group';
import transformerDirectives from '@unocss/transformer-directives';

export default defineConfig({
  presets: [
    presetWind(), // Tailwind-like utilities
    presetTypography(), // Rich text styling
    presetWebFonts({
      provider: 'google',
      fonts: {
        sans: 'Inter:400,500,600,700',
        heading: 'Poppins:600,700,800',
        mono: 'JetBrains Mono:400,500',
      }
    }),
  ],
  
  transformers: [
    transformerVariantGroup(), // Support for variant grouping (hover:(bg-gray-100 text-gray-800))
    transformerDirectives(), // Support for @apply, @screen, etc.
  ],
  
  theme: {
    colors: {
      // Modern blue primary color
      primary: {
        50: '#f0f7ff',
        100: '#e0f0ff',
        200: '#bae0ff',
        300: '#7dc6ff',
        400: '#36a9ff',
        500: '#0090ff',
        600: '#0072e6',
        700: '#005bbd',
        800: '#004c99',
        900: '#003c77',
        950: '#00264d',
      },
      // Complementary accent color (amber/gold)
      accent: {
        50: '#fffbeb',
        100: '#fef5c7',
        200: '#feea89',
        300: '#fdd84b',
        400: '#fbc11f',
        500: '#f59e0b',
        600: '#d97706',
        700: '#b45309',
        800: '#92400e',
        900: '#78350f',
        950: '#451a03',
      },
      // Neutral gray for UI elements
      neutral: {
        50: '#f9fafb',
        100: '#f4f5f7',
        200: '#e5e7eb',
        300: '#d2d6dc',
        400: '#9fa6b2',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
        950: '#0c111b',
      },
      // Success color
      success: {
        50: '#ecfdf5',
        100: '#d1fae5',
        500: '#10b981',
        700: '#047857',
      },
      // Warning color
      warning: {
        50: '#fffbeb',
        100: '#fef3c7',
        500: '#f59e0b',
        700: '#b45309',
      },
      // Error color
      error: {
        50: '#fef2f2',
        100: '#fee2e2',
        500: '#ef4444',
        700: '#b91c1c',
      },
    },
    
    // Custom box shadows
    boxShadow: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      card: '0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
      'card-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.06), 0 10px 10px -5px rgba(0, 0, 0, 0.03)',
      inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      none: 'none',
    },
  },
  
  // Custom shortcuts for common patterns
  shortcuts: [
    // Buttons
    ['btn', 'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'],
    ['btn-primary', 'btn bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500'],
    ['btn-secondary', 'btn bg-neutral-200 text-neutral-800 hover:bg-neutral-300 focus:ring-neutral-400'],
    ['btn-outline', 'btn border border-neutral-300 text-neutral-700 hover:bg-neutral-100 focus:ring-neutral-400'],
    ['btn-accent', 'btn bg-accent-500 text-white hover:bg-accent-600 focus:ring-accent-500'],
    ['btn-sm', 'px-3 py-1.5 text-xs rounded'],
    ['btn-lg', 'px-5 py-3 text-base rounded-xl'],
    
    // Cards
    ['card', 'bg-white rounded-lg border border-neutral-200 shadow-card hover:shadow-card-hover transition-shadow'],
    ['card-header', 'p-6 border-b border-neutral-200'],
    ['card-title', 'text-xl font-bold text-neutral-900'],
    ['card-description', 'text-sm text-neutral-500 mt-1'],
    ['card-content', 'p-6'],
    ['card-footer', 'p-6 border-t border-neutral-200'],
    
    // Form inputs
    ['input', 'rounded-md border border-neutral-300 px-4 py-2 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'],
    ['label', 'text-sm font-medium text-neutral-700 mb-1.5 block'],
    
    // Layout
    ['container-xl', 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'],
    ['container-lg', 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8'],
    ['container-md', 'max-w-3xl mx-auto px-4 sm:px-6 lg:px-8'],
    
    // Typography
    ['heading-1', 'font-heading text-4xl font-bold text-neutral-900 tracking-tight sm:text-5xl lg:text-6xl'],
    ['heading-2', 'font-heading text-3xl font-bold text-neutral-900 tracking-tight sm:text-4xl'],
    ['heading-3', 'font-heading text-2xl font-bold text-neutral-900 tracking-tight sm:text-3xl'],
    ['heading-4', 'font-heading text-xl font-semibold text-neutral-900 tracking-tight sm:text-2xl'],
    ['text-body', 'text-neutral-600 leading-relaxed'],
    ['text-body-lg', 'text-lg text-neutral-600 leading-relaxed'],
    ['text-body-sm', 'text-sm text-neutral-500 leading-relaxed'],
  ],
  
  // Add comprehensive safelist for dynamically generated classes
  safelist: [
    // Typography
    'text-primary-50', 'text-primary-100', 'text-primary-500', 'text-primary-600', 'text-primary-700',
    'text-accent-500', 'text-accent-600', 'text-accent-700',
    'text-white', 'text-neutral-50', 'text-neutral-500', 'text-neutral-600', 'text-neutral-700', 'text-neutral-900',
    'text-success-500', 'text-warning-500', 'text-error-500',
    
    // Backgrounds
    'bg-primary-50', 'bg-primary-100', 'bg-primary-500', 'bg-primary-600', 'bg-primary-700',
    'bg-accent-50', 'bg-accent-100', 'bg-accent-500', 'bg-accent-600', 'bg-accent-700',
    'bg-white', 'bg-neutral-50', 'bg-neutral-100', 'bg-neutral-200', 'bg-neutral-900',
    'bg-success-50', 'bg-success-500', 'bg-warning-50', 'bg-warning-500', 'bg-error-50', 'bg-error-500',
    
    // Buttons
    'btn', 'btn-primary', 'btn-secondary', 'btn-outline', 'btn-accent', 'btn-sm', 'btn-lg',
    
    // Cards
    'card', 'card-header', 'card-title', 'card-description', 'card-content', 'card-footer',
    
    // Forms
    'input', 'label',
    
    // Layout
    'container-xl', 'container-lg', 'container-md',
    
    // Typography
    'heading-1', 'heading-2', 'heading-3', 'heading-4',
    'text-body', 'text-body-lg', 'text-body-sm',
    
    // Other common utilities
    'rounded', 'rounded-lg', 'rounded-xl', 'rounded-full',
    'shadow', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl',
    'p-2', 'p-4', 'p-6', 'p-8',
    'my-2', 'my-4', 'my-6', 'my-8',
    'mt-1', 'mt-2', 'mt-4', 'mt-6', 'mt-8',
  ],
  
  rules: [
    // Add custom CSS rule for gradient text
    [/^text-gradient-(\w+)-(\w+)$/, ([, color1, color2]) => ({
      'background-image': `linear-gradient(to right, var(--un-text-${color1}), var(--un-text-${color2}))`,
      '-webkit-background-clip': 'text',
      '-webkit-text-fill-color': 'transparent',
      'background-clip': 'text',
      'color': 'transparent',
    })],
    
    // Glass effect
    ['glass', { 
      'backdrop-filter': 'blur(16px) saturate(180%)',
      'background-color': 'rgba(255, 255, 255, 0.7)',
      'border': '1px solid rgba(255, 255, 255, 0.125)'
    }],
  ],
});