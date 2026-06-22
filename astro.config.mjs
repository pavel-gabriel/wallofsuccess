import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// Served at the domain root by our own API server in Kubernetes (base '/').
// For GitHub Pages under a subpath, set BASE_PATH=/wallofsuccess (and SITE_URL).
const site = process.env.SITE_URL || 'http://localhost:8080';
const base = process.env.BASE_PATH || '/';

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
