import { defineConfig } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  images: ['src/logo/icon-mark.svg'],
  preset: {
    transparent: {
      sizes: [192, 512],
      favicons: [[48, 'favicon.ico']],
    },
    maskable: {
      sizes: [512],
    },
    apple: {
      sizes: [180],
      padding: 0,
    },
  },
})
