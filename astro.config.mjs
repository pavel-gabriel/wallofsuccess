import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// GitHub Pages serves this project at https://<owner>.github.io/<repo>.
// Adjust `site` and `base` if you use a custom domain (then set base to '/').
// These can also be overridden at build time via SITE_URL / BASE_PATH env vars.
const site = process.env.SITE_URL || 'https://pavel-gabriel.github.io';
const base = process.env.BASE_PATH || '/wallofsuccess';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  integrations: [preact()],
  build: {
    // Emit /submit/index.html etc. so deep links work on GitHub Pages.
    format: 'directory',
  },
});
