// astro.config.mjs — Aeon Agora frontend (glass-box).
//
// Static output. No SSR. No API routes. Cloudflare Pages.
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://agora.beta.aeon.bot',
  build: {
    inlineStylesheets: 'auto',
  },
});
