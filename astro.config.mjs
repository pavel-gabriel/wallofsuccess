import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import { fileURLToPath } from 'node:url';

// Two build modes, selected by PUBLIC_BACKEND:
//   supabase -> GitHub Pages demo (talks to Supabase, served under /wallofsuccess)
//   api      -> self-hosted Kubernetes build (talks to the bundled API at /, base '/')
const backend = process.env.PUBLIC_BACKEND === 'supabase' ? 'supabase' : 'api';

const site =
  process.env.SITE_URL ||
  (backend === 'supabase' ? 'https://pavel-gabriel.github.io' : 'http://localhost:8080');
const base = process.env.BASE_PATH || (backend === 'supabase' ? '/wallofsuccess' : '/');

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  integrations: [preact()],
  build: {
    // Emit /submit/index.html etc. so deep links work as static files.
    format: 'directory',
  },
  vite: {
    resolve: {
      alias: {
        '@backend': fileURLToPath(new URL(`./src/lib/backend/${backend}.js`, import.meta.url)),
      },
    },
  },
});
