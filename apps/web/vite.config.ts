import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tanstackStart(),
    // Produces .output/server (Nitro). Preset stays default (node-server
    // compatible, Vercel-friendly); switch to { preset: 'bun' } if we
    // self-host the web app on Bun long-term.
    nitro(),
    // React's Vite plugin must come after Start's plugin.
    viteReact(),
    tailwindcss(),
  ],
});
